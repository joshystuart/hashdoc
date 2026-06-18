import { describe, expect, it, beforeEach } from 'vitest';
import { encode, buildLink } from '@portablemd/core';
import { resolveView, mountViewer } from './viewer.js';

const ORIGIN = 'https://md.example/';

describe('resolveView — fragment routing', () => {
  it('shows the Editor when there is no fragment', () => {
    expect(resolveView(ORIGIN).kind).toBe('editor');
  });

  it('renders a Document from a Link fragment', () => {
    const link = buildLink(encode('# Hello\n\nworld'), ORIGIN);
    const state = resolveView(link);
    expect(state.kind).toBe('document');
    if (state.kind === 'document') {
      expect(state.html).toContain('<h1>Hello</h1>');
    }
  });

  it('renders GFM from a Link (tables, strikethrough, task lists)', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |\n\n~~x~~\n\n- [x] done\n';
    const state = resolveView(buildLink(encode(md), ORIGIN));
    expect(state.kind).toBe('document');
    if (state.kind === 'document') {
      expect(state.html).toContain('<table>');
      expect(state.html).toContain('<s>x</s>');
      expect(state.html).toContain('type="checkbox"');
    }
  });

  it('surfaces a typed error for a corrupt Link', () => {
    const state = resolveView(`${ORIGIN}#1!!!notvalid`);
    expect(state.kind).toBe('error');
  });

  it('sanitizes script content carried in a Link', () => {
    const state = resolveView(buildLink(encode('<script>window.x=1</script>ok'), ORIGIN));
    expect(state.kind).toBe('document');
    if (state.kind === 'document') {
      expect(state.html).not.toMatch(/<script/i);
    }
  });
});

describe('mountViewer — DOM mounting', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
  });

  it('mounts a rendered Document and executes no scripts', () => {
    const link = buildLink(encode('# Doc\n\n<script>globalThis.__pwned = true</script>'), ORIGIN);
    mountViewer(root, link);
    expect(root.querySelector('h1')?.textContent).toBe('Doc');
    expect(root.querySelector('script')).toBeNull();
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('resolves to the Editor with no fragment (lazy-loaded)', () => {
    const state = mountViewer(root, ORIGIN);
    // The Editor module is loaded via dynamic import(); mountViewer returns the
    // resolved state synchronously. The full DOM mount is exercised by the
    // editor behaviour test, where the dynamic import is awaited.
    expect(state.kind).toBe('editor');
  });
});

describe('mountViewer — graceful decode failures (issue-05)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
  });

  function corruptLink(): string {
    // A real Link with its tail chopped off — the classic "pasted into chat
    // and got cut off" failure.
    const full = buildLink(
      encode('# A document long enough to compress '.repeat(20)),
      ORIGIN,
    );
    return full.slice(0, Math.floor(full.length / 2));
  }

  it('shows the truncation-led message and a New Document action for a corrupt Link', () => {
    const state = mountViewer(root, corruptLink());

    expect(state.kind).toBe('error');
    if (state.kind === 'error') expect(state.errorKind).toBe('corrupt');

    // A real, visible DOM state — not an empty root.
    expect(root.querySelector('section.error')).not.toBeNull();
    const text = root.textContent ?? '';
    // Leads with the truncation explanation.
    expect(text.toLowerCase()).toContain('cut off');
    expect(text.toLowerCase()).toContain('chat or email');

    const newDoc = root.querySelector('.error__new');
    expect(newDoc).not.toBeNull();
    expect(newDoc?.textContent).toBe('New Document');
  });

  it('shows the "newer version" message for an unknown version tag', () => {
    const v1Payload = encode('hello');
    const newerLink = `${ORIGIN}#9${v1Payload.slice(1)}`;
    const state = mountViewer(root, newerLink);

    expect(state.kind).toBe('error');
    if (state.kind === 'error') expect(state.errorKind).toBe('unknown-version');

    expect(root.querySelector('section.error')).not.toBeNull();
    expect((root.textContent ?? '').toLowerCase()).toContain('newer version');
    // The version case is not a truncation; no New Document action there.
    expect(root.querySelector('.error__new')).toBeNull();
  });

  it('New Document re-routes to the Editor (clears the fragment)', () => {
    window.location.hash = '#1!!!notvalid';
    mountViewer(root, window.location.href);

    const newDoc = root.querySelector<HTMLButtonElement>('.error__new');
    expect(newDoc).not.toBeNull();
    newDoc!.click();

    expect(window.location.hash).toBe('');
    // Re-routing with no fragment resolves to the Editor.
    expect(resolveView(window.location.pathname + window.location.search).kind).toBe(
      'editor',
    );
  });

  it('an empty fragment still routes to the Editor, not an error', () => {
    expect(resolveView(`${ORIGIN}#`).kind).toBe('editor');
    expect(mountViewer(root, `${ORIGIN}#`).kind).toBe('editor');
  });
});

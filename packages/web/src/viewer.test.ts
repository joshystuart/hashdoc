import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encode, decode, buildLink, payloadFromUrl } from '@portablemd/core';
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
      expect(state.html).toContain('<h1 id="hello">');
      expect(state.html).toContain('Hello</h1>');
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
    // The heading carries a leading `#` anchor affordance (issue-09).
    expect(root.querySelector('h1')?.textContent).toBe('#Doc');
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

describe('Viewer reading niceties (issue-09)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.title = '';
  });

  function mockClipboard(): string[] {
    const writes: string[] = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: (t: string) => {
          writes.push(t);
          return Promise.resolve();
        },
      },
    });
    return writes;
  }

  it('heading anchor click scrolls into view and PRESERVES the payload fragment', () => {
    const md = '# Top\n\n## Deep Section\n\nbody';
    // Drive routing off the real window.location so a click that (must not!)
    // navigate the hash would be observable on location.href.
    const link = buildLink(encode(md), location.origin + location.pathname);
    const fragment = link.slice(link.indexOf('#'));
    window.location.hash = fragment;

    const state = mountViewer(root, window.location.href);
    expect(state.kind).toBe('document');

    // Record scrollIntoView calls (jsdom has no layout).
    const scrolled: string[] = [];
    for (const h of Array.from(root.querySelectorAll<HTMLElement>('h1,h2'))) {
      h.scrollIntoView = () => {
        scrolled.push(h.id);
      };
    }

    const anchor = root.querySelector<HTMLAnchorElement>('h2 .heading-anchor');
    expect(anchor).not.toBeNull();
    expect(anchor!.getAttribute('href')).toBe('#deep-section');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor!.dispatchEvent(event);

    // Click was intercepted (default prevented) and scroll targeted the heading.
    expect(event.defaultPrevented).toBe(true);
    expect(scrolled).toContain('deep-section');

    // The fragment is still the original payload — decoding it round-trips.
    const payload = payloadFromUrl(window.location.href);
    expect(payload).not.toBeNull();
    expect(decode(payload!)).toBe(md);
  });

  it('Copy source copies the raw markdown', async () => {
    const writes = mockClipboard();
    const md = '# Doc\n\nraw **markdown** body';
    mountViewer(root, buildLink(encode(md), 'https://md.example/'));

    const button = root.querySelector<HTMLButtonElement>('.viewer__copy-source');
    expect(button).not.toBeNull();
    button!.click();
    await Promise.resolve();
    expect(writes).toEqual([md]);
  });

  it('Copy Link copies a link that decodes back to the document', async () => {
    const writes = mockClipboard();
    const md = '# Doc\n\nbody';
    mountViewer(root, buildLink(encode(md), 'https://md.example/'));

    const button = root.querySelector<HTMLButtonElement>('.viewer__copy-link');
    expect(button).not.toBeNull();
    button!.click();
    await Promise.resolve();

    expect(writes.length).toBe(1);
    const copied = writes[0]!;
    expect(copied.startsWith(location.origin + location.pathname)).toBe(true);
    const payload = payloadFromUrl(copied);
    expect(payload).not.toBeNull();
    expect(decode(payload!)).toBe(md);
  });

  it('sets the tab title from the first H1', () => {
    mountViewer(root, buildLink(encode('# Quarterly Report\n\nbody'), 'https://md.example/'));
    expect(document.title).toBe('Quarterly Report');
  });

  it('falls back to "portablemd" when the document has no H1', () => {
    mountViewer(root, buildLink(encode('## sub only\n\nbody'), 'https://md.example/'));
    expect(document.title).toBe('portablemd');
  });

  it('renders Copy source and Copy Link actions in the chrome', () => {
    mountViewer(root, buildLink(encode('# x'), 'https://md.example/'));
    expect(root.querySelector('.viewer__copy-source')?.textContent).toBe('Copy source');
    expect(root.querySelector('.viewer__copy-link')?.textContent).toBe('Copy Link');
    expect(root.querySelector('.viewer__edit')?.textContent).toBe('Edit');
  });
});

describe('Print stylesheet (issue-09)', () => {
  it('has a @media print block that hides interactive chrome and wraps code', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, 'style.css'), 'utf8');
    expect(css).toMatch(/@media\s+print/);
    const printBlock = css.slice(css.indexOf('@media print'));
    // Chrome / buttons / editor toolbar are hidden in print.
    expect(printBlock).toContain('.viewer__chrome');
    expect(printBlock).toContain('.code-block__copy');
    expect(printBlock).toContain('.editor__toolbar');
    expect(printBlock).toMatch(/display:\s*none/);
    // Code wraps rather than clips.
    expect(printBlock).toContain('pre-wrap');
  });
});

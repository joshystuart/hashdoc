import { describe, expect, it, beforeEach } from 'vitest';
import { encode, buildLink } from '@portablemd/core';
import { resolveView, mountViewer } from './viewer.js';

const ORIGIN = 'https://md.example/';

describe('resolveView — fragment routing', () => {
  it('shows the placeholder when there is no fragment', () => {
    expect(resolveView(ORIGIN).kind).toBe('placeholder');
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

  it('mounts the placeholder with no fragment', () => {
    mountViewer(root, ORIGIN);
    expect(root.querySelector('.placeholder')).not.toBeNull();
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render as preactRender } from 'preact';
import { EditorView } from '@codemirror/view';
import { encode, buildLink, payloadFromUrl, decode, linkSizeWarning } from '@hashdoc/core';
import { mountEditor } from './mount.js';
import { hasImages, classifyImages } from './images.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function bigMarkdown(): string {
  let s = '# Big document\n\n';
  let seed = 12345;
  for (let i = 0; i < 12000; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    s += String.fromCharCode(97 + (seed % 26));
    if (i % 80 === 79) {
      s += '\n';
    }
  }
  return s + '\n';
}

function getView(root: HTMLElement): EditorView {
  const content = root.querySelector('.cm-content');
  expect(content, 'CodeMirror content element should be mounted').not.toBeNull();
  const view = EditorView.findFromDOM(content as HTMLElement);
  expect(view, 'a live CodeMirror view should be attached').not.toBeNull();
  return view!;
}

function typeIntoSource(root: HTMLElement, text: string): void {
  const view = getView(root);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

describe('image detection helpers', () => {
  it('hasImages detects a markdown image and ignores plain text/links', () => {
    expect(hasImages('# Title\n\nNo images here, just a [link](https://x).')).toBe(false);
    expect(hasImages('![alt](https://x/y.png)')).toBe(true);
    expect(hasImages('text ![](data:image/png;base64,AAAA) more')).toBe(true);
  });

  it('classifyImages distinguishes remote from data-URI images', () => {
    expect(classifyImages('plain')).toEqual({ any: false, remote: false, data: false });
    expect(classifyImages('![a](https://h/i.png)')).toEqual({ any: true, remote: true, data: false });
    expect(classifyImages('![a](data:image/png;base64,AA)')).toEqual({ any: true, remote: false, data: true });
    expect(classifyImages('![a](https://h/i.png) and ![b](data:image/png;base64,AA)')).toEqual({
      any: true,
      remote: true,
      data: true,
    });
  });
});

describe('Editor — advisory warnings (issue-11)', () => {
  let root: HTMLElement;
  let copied: string[];

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    copied = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((value: string) => {
          copied.push(value);
          return Promise.resolve();
        }),
      },
    });
  });

  afterEach(() => {
    preactRender(null, root);
    root.remove();
  });

  function linkFor(markdown: string): string {
    return buildLink(encode(markdown), location.origin + location.pathname);
  }

  it('shows the current Link size and reflects the character count', async () => {
    mountEditor(root);
    await flush();
    const md = '# Small doc\n';
    typeIntoSource(root, md);
    await flush();

    const size = root.querySelector('.editor__size');
    expect(size).not.toBeNull();
    const chars = linkFor(md).length;
    expect(size!.textContent).toContain(chars.toLocaleString());
  });

  it('no size warning for a small document', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, '# tiny\n');
    await flush();

    expect(linkSizeWarning(linkFor('# tiny\n').length)).toBeUndefined();
    expect(root.querySelector('.editor__size-warning')).toBeNull();
  });

  it('shows the size warning from core once past the threshold', async () => {
    mountEditor(root);
    await flush();

    const md = bigMarkdown();
    typeIntoSource(root, md);
    await flush();

    const chars = linkFor(md).length;
    const expected = linkSizeWarning(chars);
    expect(expected, 'fixture should be past the threshold').toBeTypeOf('string');

    const warning = root.querySelector('.editor__size-warning');
    expect(warning).not.toBeNull();
    expect(warning!.textContent).toBe(expected);
  });

  it('surfaces an image warning mentioning size + privacy/IP for a remote image', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, '![alt](https://x/y.png)');
    await flush();

    const warning = root.querySelector('.editor__image-warning');
    expect(warning).not.toBeNull();
    const text = warning!.textContent!.toLowerCase();

    expect(text).toMatch(/size|larger|bigger|inflat|bloat|long/);

    expect(text).toMatch(/ip|privacy|address|reader|fetch/);
  });

  it('surfaces an image warning for a data-URI image too', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, '![alt](data:image/png;base64,AAAA)');
    await flush();
    expect(root.querySelector('.editor__image-warning')).not.toBeNull();
  });

  it('no image warning when there are no images', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, '# just text\n\nand a [link](https://x).');
    await flush();
    expect(root.querySelector('.editor__image-warning')).toBeNull();
  });

  it('Copy Link still copies a valid Link while warnings are shown', async () => {
    mountEditor(root);
    await flush();

    const md = '![alt](https://x/y.png)\n\n' + bigMarkdown();
    typeIntoSource(root, md);
    await flush();

    expect(root.querySelector('.editor__size-warning')).not.toBeNull();
    expect(root.querySelector('.editor__image-warning')).not.toBeNull();

    (root.querySelector('.split-button__primary') as HTMLButtonElement).click();
    await flush();

    expect(copied).toHaveLength(1);
    expect(decode(payloadFromUrl(copied[0]!)!)).toBe(md);
  });
});

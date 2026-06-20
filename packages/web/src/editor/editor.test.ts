import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render as preactRender } from 'preact';
import { EditorView } from '@codemirror/view';
import { decode, decodeProtected, payloadFromUrl } from '@hashdoc/core';
import { mountEditor } from './mount.js';
import { mountViewer } from '../viewer.js';
import { render as renderMarkdown } from '../render.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function toggleProtect(root: HTMLElement): void {
  const toggle = root.querySelector('.editor__protect-checkbox') as HTMLInputElement;
  expect(toggle, 'protect toggle should exist').not.toBeNull();
  toggle.checked = true;
  toggle.dispatchEvent(new Event('change', { bubbles: true }));
}

async function copyResolvedLink(root: HTMLElement, copied: string[]): Promise<string> {
  const button = root.querySelector('.editor__copy') as HTMLButtonElement;
  const before = copied.length;
  for (let i = 0; i < 100; i++) {
    button.click();
    await flush();
    if (copied.length > before) {
      return copied[copied.length - 1]!;
    }
  }
  throw new Error('Copy Link never produced a Link');
}

describe('Editor — author creates a Link', () => {
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

  it('renders a split source + preview pane', async () => {
    mountEditor(root);
    await flush();
    expect(root.querySelector('.editor__source')).not.toBeNull();
    expect(root.querySelector('.editor__preview')).not.toBeNull();
    expect(root.querySelector('.cm-editor')).not.toBeNull();
  });

  it('live preview is identical to the Viewer render of the same markdown', async () => {
    mountEditor(root);
    await flush();
    const md = '# Title\n\nSome **bold** and `code`.\n';
    typeIntoSource(root, md);
    await flush();
    const preview = root.querySelector('.editor__preview')!;
    expect(preview.innerHTML).toBe(renderMarkdown(md));
  });

  it('Copy Link produces a Link that decodes back to the typed markdown', async () => {
    mountEditor(root);
    await flush();
    const md = '# Hello\n\nThis is *mine*.\n\n- one\n- two\n';
    typeIntoSource(root, md);
    await flush();

    const copyButton = root.querySelector('.editor__copy') as HTMLButtonElement;
    expect(copyButton).not.toBeNull();
    copyButton.click();
    await flush();

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(copied).toHaveLength(1);
    const link = copied[0]!;
    const payload = payloadFromUrl(link);
    expect(payload).not.toBeNull();
    expect(decode(payload!)).toBe(md);
  });

  it('type -> Copy Link -> re-open renders the Document', async () => {
    mountEditor(root);
    await flush();
    const md = '## Round trip\n\nText with a [link](https://example.com).\n';
    typeIntoSource(root, md);
    await flush();

    (root.querySelector('.editor__copy') as HTMLButtonElement).click();
    await flush();

    const link = copied[0]!;


    const viewerRoot = document.createElement('div');
    const state = mountViewer(viewerRoot, link);
    expect(state.kind).toBe('document');
    if (state.kind === 'document') {
      expect(state.html).toContain('<h2 id="round-trip">');
      expect(state.html).toContain('Round trip</h2>');
      expect(state.html).toContain('href="https://example.com"');
    }
  });

  it('seeds the self-describing example Document in no-fragment new mode (issue-12)', async () => {
    mountEditor(root);
    await flush();


    const view = getView(root);
    const doc = view.state.doc.toString();
    expect(doc).toContain('# HashDoc');
    expect(doc).toMatch(/select all/i);


    const preview = root.querySelector('.editor__preview')!;
    expect(preview.querySelector('h1')).not.toBeNull();
    expect(preview.querySelector('table')).not.toBeNull();
    expect(preview.querySelector('pre code')).not.toBeNull();
    expect(preview.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('does NOT seed the example when forking (initialMarkdown provided) (issue-12)', async () => {
    mountEditor(root, { initialMarkdown: '# Forked\n\nmine\n', forkedFromDocument: true });
    await flush();

    const view = getView(root);
    const doc = view.state.doc.toString();
    expect(doc).toBe('# Forked\n\nmine\n');
    expect(doc).not.toContain('# HashDoc');
  });

  it('keeps the bar a clean action row: no bearer note, never says "secure"', async () => {
    mountEditor(root);
    await flush();

    expect(root.querySelector('.editor__bearer-note')).toBeNull();

    const bar = root.querySelector('.editor__bar')!;
    expect(bar.textContent!.toLowerCase()).not.toContain('secure');
  });

  it('Protect toggle reveals password + confirm inputs and the threat-model copy', async () => {
    mountEditor(root);
    await flush();

    expect(root.querySelector('.editor__password')).toBeNull();
    expect(root.querySelector('.editor__confirm')).toBeNull();

    toggleProtect(root);
    await flush();

    expect(root.querySelector('.editor__password')).not.toBeNull();
    expect(root.querySelector('.editor__confirm')).not.toBeNull();

    const note = root.querySelector('.editor__protect-note')!;
    const text = note.textContent!.toLowerCase();
    expect(text).toContain('separately');
    expect(text).toContain('unrecoverable');
  });

  it('Protection ON: Copy Link produces a 2… Link that decodeProtected reverses', async () => {
    mountEditor(root);
    await flush();
    const md = '# Secret\n\nThis is *protected*.\n';
    typeIntoSource(root, md);
    await flush();

    toggleProtect(root);
    await flush();
    setInput(root.querySelector('.editor__password') as HTMLInputElement, 'hunter2');
    setInput(root.querySelector('.editor__confirm') as HTMLInputElement, 'hunter2');
    await flush();

    const link = await copyResolvedLink(root, copied);
    const payload = payloadFromUrl(link);
    expect(payload).not.toBeNull();
    expect(payload![0]).toBe('2');
    expect(await decodeProtected(payload!, 'hunter2')).toBe(md);
  });

  it('Protection ON: View opens the protected Link to the Viewer locked prompt', async () => {
    mountEditor(root);
    await flush();
    const md = '# Locked\n\ncontents\n';
    typeIntoSource(root, md);
    await flush();

    toggleProtect(root);
    await flush();
    setInput(root.querySelector('.editor__password') as HTMLInputElement, 'correct horse');
    setInput(root.querySelector('.editor__confirm') as HTMLInputElement, 'correct horse');
    await flush();

    const link = await copyResolvedLink(root, copied);

    const viewerRoot = document.createElement('div');
    const state = mountViewer(viewerRoot, link);
    expect(state.kind).toBe('locked');
    expect(viewerRoot.querySelector('.unlock__password')).not.toBeNull();
  });

  it('size indicator reflects the protected Link length when protection is on', async () => {
    mountEditor(root);
    await flush();
    const md = '# Size\n\nsome body text here\n';
    typeIntoSource(root, md);
    await flush();

    toggleProtect(root);
    await flush();
    setInput(root.querySelector('.editor__password') as HTMLInputElement, 'pw-123');
    setInput(root.querySelector('.editor__confirm') as HTMLInputElement, 'pw-123');
    await flush();

    const link = await copyResolvedLink(root, copied);
    const size = root.querySelector('.editor__size')!;
    expect(size.textContent).toContain(link.length.toLocaleString());
  });

  it('does not copy a protected Link while password and confirm mismatch', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, '# Mismatch\n');
    await flush();

    toggleProtect(root);
    await flush();
    setInput(root.querySelector('.editor__password') as HTMLInputElement, 'one');
    setInput(root.querySelector('.editor__confirm') as HTMLInputElement, 'two');
    await flush();

    expect(root.querySelector('.editor__protect-error')).not.toBeNull();

    (root.querySelector('.editor__copy') as HTMLButtonElement).click();
    await flush();
    expect(copied).toHaveLength(0);
  });

  it('live preview renders without a password in both states', async () => {
    mountEditor(root);
    await flush();
    const md = '# Preview\n\n**bold** and `code`.\n';
    typeIntoSource(root, md);
    await flush();

    const preview = root.querySelector('.editor__preview')!;
    expect(preview.innerHTML).toBe(renderMarkdown(md));

    toggleProtect(root);
    await flush();
    expect(preview.innerHTML).toBe(renderMarkdown(md));
  });

  it('toolbar bold action wraps text in the source and updates the preview', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, 'plain');
    await flush();


    const view = getView(root);
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });

    const boldButton = Array.from(root.querySelectorAll('.editor__tool')).find(
      (b) => b.getAttribute('title') === 'Bold',
    ) as HTMLButtonElement;
    boldButton.click();
    await flush();

    expect(view.state.doc.toString()).toBe('**plain**');
    const preview = root.querySelector('.editor__preview')!;
    expect(preview.innerHTML).toContain('<strong>plain</strong>');
  });
});

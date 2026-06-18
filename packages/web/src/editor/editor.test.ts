import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render as preactRender } from 'preact';
import { EditorView } from '@codemirror/view';
import { decode, payloadFromUrl } from '@portablemd/core';
import { mountEditor } from './mount.js';
import { mountViewer } from '../viewer.js';
import { render as renderMarkdown } from '../render.js';

/**
 * issue-02 behaviour test: type -> Copy Link -> re-open -> rendered Document.
 *
 * Driving the source pane: rather than synthesising contenteditable key events
 * (unreliable under jsdom), we grab the live CodeMirror view from the mounted
 * DOM and dispatch a document change — the same path a keystroke takes — then
 * exercise the real Copy Link button and clipboard.
 *
 * Preact effects (which create the CodeMirror view) and re-renders (which update
 * the preview) are scheduled asynchronously, so we `flush()` between steps.
 */
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
    // Preact leaves the tree mounted between tests; unmount to avoid cross-talk.
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

    // Re-open the produced Link in the Viewer.
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

    // The CodeMirror doc carries the distinctive example text.
    const view = getView(root);
    const doc = view.state.doc.toString();
    expect(doc).toContain('# portablemd');
    expect(doc).toMatch(/select all/i);

    // The live preview is a real demo: headline constructs render in the DOM.
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
    expect(doc).not.toContain('# portablemd');
  });

  it('shows bearer-access messaging at the Copy Link point; never says "secure" (issue-12)', async () => {
    mountEditor(root);
    await flush();

    const note = root.querySelector('.editor__bearer-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toMatch(/anyone with (this|the) link can read it/i);

    // Guard: the editor bar (toolbar + actions, where Link copy lives) must not
    // describe the Link as "secure".
    const bar = root.querySelector('.editor__bar')!;
    expect(bar.textContent!.toLowerCase()).not.toContain('secure');
  });

  it('toolbar bold action wraps text in the source and updates the preview', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, 'plain');
    await flush();

    // Select all so the bold action wraps the whole doc.
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

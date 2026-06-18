import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render as preactRender } from 'preact';
import { EditorView } from '@codemirror/view';
import { encode, decode, buildLink, payloadFromUrl } from '@portablemd/core';
import { mountViewer } from '../viewer.js';

/**
 * issue-03 behaviour test: view a Document -> Edit -> change -> Copy Link.
 *
 * The fork is the whole point: the produced Link must reflect the edit, while
 * the originally-viewed Link still decodes to the original markdown (it can't be
 * mutated — it's an immutable string — but we assert it through the real flow).
 *
 * Preact effects (which build the CodeMirror view) and re-renders run async, so
 * we flush() between steps; the dynamic import() of the Editor is also awaited.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Edit lazy-imports the Editor (dynamic import()) and Preact builds the
 * CodeMirror view in a layout effect — both async. Poll until the source pane
 * exists rather than guessing a fixed number of flushes.
 */
async function clickEditAndWaitForEditor(root: HTMLElement): Promise<void> {
  (root.querySelector('.viewer__edit') as HTMLButtonElement).click();
  for (let i = 0; i < 50 && !root.querySelector('.cm-content'); i++) {
    await flush();
  }
}

function getView(root: HTMLElement): EditorView {
  const content = root.querySelector('.cm-content');
  expect(content, 'CodeMirror content element should be mounted').not.toBeNull();
  const view = EditorView.findFromDOM(content as HTMLElement);
  expect(view, 'a live CodeMirror view should be attached').not.toBeNull();
  return view!;
}

const ORIGIN = 'https://md.example/';
const ORIGINAL_MD = '# Shared note\n\nFrom the **sender**.\n';

describe('Reader edits & forks a viewed Document (issue-03)', () => {
  let root: HTMLElement;
  let copied: string[];
  let originalLink: string;

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
    originalLink = buildLink(encode(ORIGINAL_MD), ORIGIN);
  });

  afterEach(() => {
    preactRender(null, root);
    root.remove();
  });

  it('shows an Edit action on the viewed Document', () => {
    const state = mountViewer(root, originalLink);
    expect(state.kind).toBe('document');
    expect(root.querySelector('.viewer__edit')).not.toBeNull();
  });

  it('Edit opens the Editor pre-filled with the viewed Document', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);

    const view = getView(root);
    expect(view.state.doc.toString()).toBe(ORIGINAL_MD);
    // The preview reflects the seeded markdown.
    expect(root.querySelector('.editor__preview')!.innerHTML).toContain('<h1>Shared note</h1>');
  });

  it('view -> Edit -> change -> Copy Link: new Link reflects the edit; original is unaffected', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);

    // Reader amends the Document.
    const editedMd = '# Shared note\n\nFrom the **sender**, with my reply added.\n';
    const view = getView(root);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: editedMd } });
    await flush();

    (root.querySelector('.editor__copy') as HTMLButtonElement).click();
    await flush();

    expect(copied).toHaveLength(1);
    const newLink = copied[0]!;

    // The new Link is a different Link that decodes to the edited markdown.
    expect(newLink).not.toBe(originalLink);
    expect(decode(payloadFromUrl(newLink)!)).toBe(editedMd);

    // The original Link is untouched: it still decodes to the original Document.
    expect(decode(payloadFromUrl(originalLink)!)).toBe(ORIGINAL_MD);
  });

  it('makes the fork explicit after Copy Link (new link created, original unchanged)', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);

    (root.querySelector('.editor__copy') as HTMLButtonElement).click();
    await flush();

    const status = root.querySelector('.editor__copy-status');
    expect(status).not.toBeNull();
    expect(status!.textContent).toMatch(/new link/i);
    expect(status!.textContent).toMatch(/original/i);
  });
});

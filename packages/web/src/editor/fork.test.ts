import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render as preactRender } from 'preact';
import { EditorView } from '@codemirror/view';
import { encode, decode, buildLink, payloadFromUrl } from '@openartifact/core';
import { mountViewer } from '../viewer.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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

    expect(root.querySelector('.editor__preview')!.innerHTML).toContain('Shared note</h1>');
  });

  it('view -> Edit -> change -> Copy Link: new Link reflects the edit; original is unaffected', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);


    const editedMd = '# Shared note\n\nFrom the **sender**, with my reply added.\n';
    const view = getView(root);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: editedMd } });
    await flush();

    (root.querySelector('.editor__copy') as HTMLButtonElement).click();
    await flush();

    expect(copied).toHaveLength(1);
    const newLink = copied[0]!;


    expect(newLink).not.toBe(originalLink);
    expect(decode(payloadFromUrl(newLink)!)).toBe(editedMd);


    expect(decode(payloadFromUrl(originalLink)!)).toBe(ORIGINAL_MD);
  });

  it('confirms Copy Link via the button label and shows no fork status message', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);

    const copyButton = root.querySelector('.editor__copy') as HTMLButtonElement;
    copyButton.click();
    await flush();

    expect(copyButton.textContent).toMatch(/link copied/i);
    expect(root.querySelector('.editor__copy-status--ok')).toBeNull();
  });

  it('View returns to the rendered Document even when nothing was edited', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);

    const view = root.querySelector('.editor__view') as HTMLButtonElement;
    expect(view).not.toBeNull();
    expect(view.textContent).toMatch(/view/i);

    view.click();
    for (let i = 0; i < 50 && !root.querySelector('.viewer__chrome'); i++) {
      await flush();
    }

    expect(root.querySelector('.viewer__chrome')).not.toBeNull();
    expect(root.querySelector('.cm-content')).toBeNull();
    expect(root.querySelector('.document')!.textContent).toContain('Shared note');
  });

  it('View reflects in-Editor edits in the rendered Document', async () => {
    mountViewer(root, originalLink);
    await clickEditAndWaitForEditor(root);

    const editedMd = '# Shared note\n\nFrom the **sender**, plus a fresh paragraph.\n';
    const view = getView(root);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: editedMd } });
    await flush();

    (root.querySelector('.editor__view') as HTMLButtonElement).click();
    for (let i = 0; i < 50 && !root.querySelector('.viewer__chrome'); i++) {
      await flush();
    }

    expect(root.querySelector('.document')!.textContent).toContain('fresh paragraph');
  });
});

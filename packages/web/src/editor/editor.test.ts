import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render as preactRender } from 'preact';
import { EditorView } from '@codemirror/view';
import { decode, decodeSecure, payloadFromUrl } from '@hashdoc/core';
import { mountEditor } from './mount.js';
import { mountViewer } from '../viewer.js';
import { render as renderMarkdown } from '../render.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

function getView(root: HTMLElement): EditorView {
  const content = root.querySelector('.cm-content');
  expect(
    content,
    'CodeMirror content element should be mounted',
  ).not.toBeNull();
  const view = EditorView.findFromDOM(content as HTMLElement);
  expect(view, 'a live CodeMirror view should be attached').not.toBeNull();
  return view!;
}

function typeIntoSource(root: HTMLElement, text: string): void {
  const view = getView(root);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

function setInput(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function openMenu(root: HTMLElement): void {
  const caret = root.querySelector('.split-button__caret') as HTMLButtonElement;
  expect(caret, 'split button caret should exist').not.toBeNull();
  caret.click();
}

function menuItem(root: HTMLElement, text: string): HTMLButtonElement {
  const item = Array.from(root.querySelectorAll('.split-button__item')).find(
    (el) => el.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
  expect(item, `menu item "${text}" should exist`).not.toBeNull();
  return item!;
}

function dialog(root: HTMLElement): HTMLDialogElement {
  return root.querySelector('.password-dialog') as HTMLDialogElement;
}

async function waitForDialogOpen(root: HTMLElement): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (dialog(root)?.open) {
      return;
    }
    await flush();
  }
  throw new Error('password dialog never opened');
}

async function waitForDialogClosed(root: HTMLElement): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (!dialog(root)?.open) {
      return;
    }
    await flush();
  }
  throw new Error('password dialog never closed');
}

async function fillDialog(root: HTMLElement, password: string): Promise<void> {
  await waitForDialogOpen(root);
  setInput(
    root.querySelector('.password-dialog__input') as HTMLInputElement,
    password,
  );
  await flush();
}

function submitDialog(root: HTMLElement): void {
  const form = root.querySelector('.password-dialog__form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function copyViaPrimary(
  root: HTMLElement,
  copied: string[],
): Promise<string> {
  const button = root.querySelector(
    '.split-button__primary',
  ) as HTMLButtonElement;
  const before = copied.length;
  for (let i = 0; i < 1500; i++) {
    button.click();
    await tick();
    if (copied.length > before) {
      return copied[copied.length - 1]!;
    }
  }
  throw new Error('primary copy never produced a Link');
}

async function copyViaSecureDialog(
  root: HTMLElement,
  copied: string[],
  password: string,
): Promise<string> {
  openMenu(root);
  await flush();
  menuItem(root, 'Copy secure link').click();
  await fillDialog(root, password);
  const before = copied.length;
  submitDialog(root);
  for (let i = 0; i < 1500; i++) {
    await tick();
    if (copied.length > before) {
      await waitForDialogClosed(root);
      return copied[copied.length - 1]!;
    }
  }
  throw new Error('secure dialog submit never produced a Link');
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

  it('primary copies a plain Link that decodes back to the typed markdown', async () => {
    mountEditor(root);
    await flush();
    const md = '# Hello\n\nThis is *mine*.\n\n- one\n- two\n';
    typeIntoSource(root, md);
    await flush();

    const link = await copyViaPrimary(root, copied);
    const payload = payloadFromUrl(link);
    expect(payload).not.toBeNull();
    expect(payload![0]).toBe('1');
    expect(decode(payload!)).toBe(md);
  });

  it('type -> Copy Link -> re-open renders the Document', async () => {
    mountEditor(root);
    await flush();
    const md = '## Round trip\n\nText with a [link](https://example.com).\n';
    typeIntoSource(root, md);
    await flush();

    const link = await copyViaPrimary(root, copied);

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
    mountEditor(root, {
      initialMarkdown: '# Forked\n\nmine\n',
      forkedFromDocument: true,
    });
    await flush();

    const view = getView(root);
    const doc = view.state.doc.toString();
    expect(doc).toBe('# Forked\n\nmine\n');
    expect(doc).not.toContain('# HashDoc');
  });

  it('keeps the plain bar honest: no bearer note, never says "secure"', async () => {
    mountEditor(root);
    await flush();

    expect(root.querySelector('.editor__bearer-note')).toBeNull();

    const bar = root.querySelector('.editor__bar')!;
    expect(bar.textContent!.toLowerCase()).not.toContain('secure');
  });

  it('the secure menu item opens the dialog with the threat-model copy', async () => {
    mountEditor(root);
    await flush();

    expect(dialog(root).open).toBe(false);

    openMenu(root);
    await flush();
    menuItem(root, 'Copy secure link').click();
    await waitForDialogOpen(root);

    expect(dialog(root).open).toBe(true);
    expect(root.querySelector('.password-dialog__input')).not.toBeNull();
    const note = root.querySelector('.password-dialog__note')!;
    const text = note.textContent!.toLowerCase();
    expect(text).toContain('separately');
    expect(text).toContain('unrecoverable');
  });

  it('submitting a password copies a secure Link, locks the primary, and closes the dialog', async () => {
    mountEditor(root);
    await flush();
    const md = '# Secret\n\nThis is *secure*.\n';
    typeIntoSource(root, md);
    await flush();

    const link = await copyViaSecureDialog(root, copied, 'hunter2');
    const payload = payloadFromUrl(link);
    expect(payload).not.toBeNull();
    expect(payload![0]).toBe('2');
    expect(await decodeSecure(payload!, 'hunter2')).toBe(md);

    await waitForDialogClosed(root);
    expect(dialog(root).open).toBe(false);
    const primary = root.querySelector('.split-button__primary')!;
    expect(primary.classList.contains('app-button--secure')).toBe(true);
    expect(root.querySelector('.split-button--secure')).not.toBeNull();
  });

  it('with a password set the primary copies the secure Link without reopening the dialog', async () => {
    mountEditor(root);
    await flush();
    const md = '# Remembered\n\nbody\n';
    typeIntoSource(root, md);
    await flush();

    await copyViaSecureDialog(root, copied, 'sessionpw');
    const countAfterDialog = copied.length;

    const link = await copyViaPrimary(root, copied);
    expect(copied.length).toBeGreaterThan(countAfterDialog);
    expect(dialog(root).open).toBe(false);
    const payload = payloadFromUrl(link);
    expect(payload![0]).toBe('2');
    expect(await decodeSecure(payload!, 'sessionpw')).toBe(md);
  });

  it('Change password produces a Link decryptable with the new password but not the old', async () => {
    mountEditor(root);
    await flush();
    const md = '# Rotate\n\nsecrets\n';
    typeIntoSource(root, md);
    await flush();

    await copyViaSecureDialog(root, copied, 'old-pass');

    openMenu(root);
    await flush();
    menuItem(root, 'Change password').click();
    await fillDialog(root, 'new-pass');
    expect(dialog(root).open).toBe(true);
    submitDialog(root);
    await waitForDialogClosed(root);
    expect(dialog(root).open).toBe(false);

    const link = await copyViaPrimary(root, copied);
    const payload = payloadFromUrl(link)!;
    expect(payload[0]).toBe('2');
    expect(await decodeSecure(payload, 'new-pass')).toBe(md);
    await expect(decodeSecure(payload, 'old-pass')).rejects.toThrow();
  });

  it('Remove password reverts the primary to a plain Link', async () => {
    mountEditor(root);
    await flush();
    const md = '# Reverted\n\nplain again\n';
    typeIntoSource(root, md);
    await flush();

    await copyViaSecureDialog(root, copied, 'temp-pass');
    expect(root.querySelector('.split-button--secure')).not.toBeNull();

    openMenu(root);
    await flush();
    menuItem(root, 'Remove password').click();
    await flush();

    expect(root.querySelector('.split-button--secure')).toBeNull();

    const link = await copyViaPrimary(root, copied);
    const payload = payloadFromUrl(link)!;
    expect(payload[0]).toBe('1');
    expect(decode(payload)).toBe(md);
  });

  it('after creating a secure Link, the plain Copy Link menu item reverts the primary to plain', async () => {
    mountEditor(root);
    await flush();
    const md = '# Sticky\n\nbody\n';
    typeIntoSource(root, md);
    await flush();

    await copyViaSecureDialog(root, copied, 'pw-revert');
    expect(root.querySelector('.split-button--secure')).not.toBeNull();

    openMenu(root);
    await flush();
    menuItem(root, 'Copy Link').click();
    await flush();

    expect(root.querySelector('.split-button--secure')).toBeNull();
    const primary = root.querySelector('.split-button__primary')!;
    expect(primary.classList.contains('app-button--secure')).toBe(false);

    const link = await copyViaPrimary(root, copied);
    const payload = payloadFromUrl(link)!;
    expect(payload[0]).toBe('1');
    expect(decode(payload)).toBe(md);
  });

  it('keeps the password after demoting to plain so secure can be re-chosen without a dialog', async () => {
    mountEditor(root);
    await flush();
    const md = '# Resecure\n\nbody\n';
    typeIntoSource(root, md);
    await flush();

    await copyViaSecureDialog(root, copied, 'remembered');

    openMenu(root);
    await flush();
    menuItem(root, 'Copy Link').click();
    await flush();
    expect(root.querySelector('.split-button--secure')).toBeNull();

    openMenu(root);
    await flush();
    menuItem(root, 'Copy secure link').click();
    await flush();

    expect(dialog(root).open).toBe(false);
    expect(root.querySelector('.split-button--secure')).not.toBeNull();
    const link = await copyViaPrimary(root, copied);
    const payload = payloadFromUrl(link)!;
    expect(payload[0]).toBe('2');
    expect(await decodeSecure(payload, 'remembered')).toBe(md);
  });

  it('the dialog submit is disabled on an empty password', async () => {
    mountEditor(root);
    await flush();
    typeIntoSource(root, '# Empty\n');
    await flush();

    openMenu(root);
    await flush();
    menuItem(root, 'Copy secure link').click();
    await waitForDialogOpen(root);

    const submit = root.querySelector(
      '.password-dialog__submit',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    submitDialog(root);
    await flush();
    expect(copied).toHaveLength(0);
  });

  it('View on a secure Document shows the Viewer document directly, secure and unlocked', async () => {
    mountEditor(root);
    await flush();
    const md = '# Sticky View\n\ncontents\n';
    typeIntoSource(root, md);
    await flush();

    await copyViaSecureDialog(root, copied, 'sticky-pw');

    root.querySelector<HTMLButtonElement>('.editor__view')!.click();
    for (
      let i = 0;
      i < 200 && root.querySelector('.viewer .document') === null;
      i++
    ) {
      await tick();
    }

    expect(root.querySelector('.viewer .document')).not.toBeNull();
    expect(root.querySelector('.unlock__password')).toBeNull();
    expect(root.querySelector('.split-button--secure')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('.viewer__edit')!.click();
    for (
      let i = 0;
      i < 200 && root.querySelector('.cm-content') === null;
      i++
    ) {
      await tick();
    }
    expect(root.querySelector('.split-button--secure')).not.toBeNull();
    const link = await copyViaPrimary(root, copied);
    const payload = payloadFromUrl(link)!;
    expect(payload[0]).toBe('2');
    expect(await decodeSecure(payload, 'sticky-pw')).toBe(md);
  });

  it('View opens the secure Link to the Viewer locked prompt', async () => {
    mountEditor(root);
    await flush();
    const md = '# Locked\n\ncontents\n';
    typeIntoSource(root, md);
    await flush();

    const link = await copyViaSecureDialog(root, copied, 'correct horse');

    const viewerRoot = document.createElement('div');
    const state = mountViewer(viewerRoot, link);
    expect(state.kind).toBe('locked');
    expect(viewerRoot.querySelector('.unlock__password')).not.toBeNull();
  });

  it('size indicator reflects the secure Link length once a password is set', async () => {
    mountEditor(root);
    await flush();
    const md = '# Size\n\nsome body text here\n';
    typeIntoSource(root, md);
    await flush();

    const link = await copyViaSecureDialog(root, copied, 'pw-123');
    const size = root.querySelector('.editor__size')!;
    let matched = false;
    for (let i = 0; i < 400 && !matched; i++) {
      if (size.textContent!.includes(link.length.toLocaleString())) {
        matched = true;
      } else {
        await tick();
      }
    }
    expect(size.textContent).toContain(link.length.toLocaleString());
  });

  it('live preview renders regardless of password state', async () => {
    mountEditor(root);
    await flush();
    const md = '# Preview\n\n**bold** and `code`.\n';
    typeIntoSource(root, md);
    await flush();

    const preview = root.querySelector('.editor__preview')!;
    expect(preview.innerHTML).toBe(renderMarkdown(md));

    await copyViaSecureDialog(root, copied, 'pw');
    expect(preview.innerHTML).toBe(renderMarkdown(md));
  });

  it('shows the HashDoc logo at the far left of the bar', async () => {
    mountEditor(root);
    await flush();

    const leading = root.querySelector('.editor__bar .app-header__leading')!;
    const logo = leading.querySelector('.app-header__logo')!;
    expect(logo).not.toBeNull();
    expect(leading.firstElementChild).toBe(logo);
    expect(logo.querySelector('img')?.getAttribute('src')).toContain(
      'hashdoc-logo.svg',
    );
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

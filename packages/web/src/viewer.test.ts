import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  encode,
  decode,
  encodeSecure,
  decodeSecure,
  buildLink,
  payloadFromUrl,
} from '@hashdoc/core';
import { resolveView, mountViewer } from './viewer.js';

const ORIGIN = 'https://md.example/';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !predicate(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(predicate()).toBe(true);
}

async function waitForDialogOpen(root: HTMLElement): Promise<void> {
  await waitFor(() => (root.querySelector('.password-dialog') as HTMLDialogElement)?.open === true);
}

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

    expect(root.querySelector('h1')?.textContent).toBe('#Doc');
    expect(root.querySelector('script')).toBeNull();
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('resolves to the Editor with no fragment (lazy-loaded)', () => {
    const state = mountViewer(root, ORIGIN);



    expect(state.kind).toBe('editor');
  });

  it('keeps the chrome a clean action row: no bearer note, never says "secure"', () => {
    const link = buildLink(encode('# Doc\n\nbody'), ORIGIN);
    mountViewer(root, link);

    expect(root.querySelector('.viewer__bearer-note')).toBeNull();

    const chrome = root.querySelector('.viewer__chrome')!;
    expect(chrome.textContent!.toLowerCase()).not.toContain('secure');

    const primary = root.querySelector('.split-button__primary')!;
    expect(primary.textContent!.toLowerCase()).not.toContain('secure');
    expect(primary.textContent).toBe('Copy Link');
  });

  it('places the theme toggle last so it sits at the far right of the chrome', () => {
    const link = buildLink(encode('# Doc\n\nbody'), ORIGIN);
    mountViewer(root, link);

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.viewer__chrome button'),
    );
    expect(buttons.at(-1)?.classList.contains('theme-toggle')).toBe(true);
  });

  it('shows the HashDoc logo at the far left of the chrome', () => {
    const link = buildLink(encode('# Doc\n\nbody'), ORIGIN);
    mountViewer(root, link);

    const chrome = root.querySelector('.viewer__chrome')!;
    const leading = chrome.querySelector('.app-header__leading')!;
    const logo = leading.querySelector('.app-header__logo')!;
    expect(logo).not.toBeNull();
    expect(leading.firstElementChild).toBe(logo);
    expect(logo.querySelector('img')?.getAttribute('src')).toContain('hashdoc-logo.svg');
  });
});

describe('mountViewer — graceful decode failures (issue-05)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
  });

  function corruptLink(): string {


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


    expect(root.querySelector('section.error')).not.toBeNull();
    const text = root.textContent ?? '';

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

    expect(root.querySelector('.error__new')).toBeNull();
  });

  it('New Document re-routes to the Editor (clears the fragment)', () => {
    window.location.hash = '#1!!!notvalid';
    mountViewer(root, window.location.href);

    const newDoc = root.querySelector<HTMLButtonElement>('.error__new');
    expect(newDoc).not.toBeNull();
    newDoc!.click();

    expect(window.location.hash).toBe('');

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


    const link = buildLink(encode(md), location.origin + location.pathname);
    const fragment = link.slice(link.indexOf('#'));
    window.location.hash = fragment;

    const state = mountViewer(root, window.location.href);
    expect(state.kind).toBe('document');


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


    expect(event.defaultPrevented).toBe(true);
    expect(scrolled).toContain('deep-section');


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

    const button = root.querySelector<HTMLButtonElement>('.split-button__primary');
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

  it('falls back to "HashDoc" when the document has no H1', () => {
    mountViewer(root, buildLink(encode('## sub only\n\nbody'), 'https://md.example/'));
    expect(document.title).toBe('HashDoc');
  });

  it('renders Copy source and Copy Link actions in the chrome', () => {
    mountViewer(root, buildLink(encode('# x'), 'https://md.example/'));
    expect(root.querySelector('.viewer__copy-source')?.textContent).toBe('Copy source');
    expect(root.querySelector('.split-button__primary')?.textContent).toBe('Copy Link');
    expect(root.querySelector('.viewer__edit')?.textContent).toBe('Edit');
  });

  it('plain Link: the secure menu item opens the dialog and copies a decryptable secure Link', async () => {
    const writes = mockClipboard();
    const md = '# Doc\n\nbody to protect';
    mountViewer(root, buildLink(encode(md), 'https://md.example/'));

    (root.querySelector('.split-button__caret') as HTMLButtonElement).click();
    await flush();
    const item = Array.from(root.querySelectorAll('.split-button__item')).find((el) =>
      el.textContent?.includes('Copy secure link'),
    ) as HTMLButtonElement;
    expect(item).not.toBeNull();
    item.click();
    await waitForDialogOpen(root);

    const input = root.querySelector('.password-dialog__input') as HTMLInputElement;
    input.value = 'hunter2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    (root.querySelector('.password-dialog__form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await waitFor(() => writes.length === 1);

    const payload = payloadFromUrl(writes[0]!)!;
    expect(payload.startsWith('2')).toBe(true);
    expect(await decodeSecure(payload, 'hunter2')).toBe(md);
  });
});

describe('Viewer unlock flow (secure Links)', () => {
  let root: HTMLElement;
  const PASSWORD = 'correct horse battery staple';

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

  async function waitFor(predicate: () => boolean): Promise<void> {
    for (let i = 0; i < 200 && !predicate(); i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(predicate()).toBe(true);
  }

  function submitPassword(password: string): void {
    const input = root.querySelector<HTMLInputElement>('.unlock__password')!;
    input.value = password;
    root.querySelector<HTMLFormElement>('.unlock__form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  }

  it('routes a secure Link to a locked state synchronously', async () => {
    const link = buildLink(await encodeSecure('# Secret\n\nbody', PASSWORD), ORIGIN);
    const state = resolveView(link);
    expect(state.kind).toBe('locked');
    if (state.kind === 'locked') {
      expect(state.payload.startsWith('2')).toBe(true);
    }
  });

  it('renders a password prompt for a locked Link', async () => {
    const link = buildLink(await encodeSecure('# Secret\n\nbody', PASSWORD), ORIGIN);
    const state = mountViewer(root, link);

    expect(state.kind).toBe('locked');
    expect(root.querySelector('.unlock__password')).not.toBeNull();
    expect(root.querySelector('.unlock__submit')).not.toBeNull();
    expect((root.textContent ?? '').toLowerCase()).toContain('secure');
    expect(root.querySelector('.document')).toBeNull();
  });

  it('renders the Document after the correct password, sanitizing scripts', async () => {
    const md = '# Quarterly Report\n\n<script>globalThis.__pwnedUnlock = true</script>body';
    const link = buildLink(await encodeSecure(md, PASSWORD), ORIGIN);
    mountViewer(root, link);

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('.document') !== null);

    expect(root.querySelector('h1')?.textContent).toContain('Quarterly Report');
    expect(document.title).toBe('Quarterly Report');
    expect(root.querySelector('script')).toBeNull();
    expect((globalThis as Record<string, unknown>).__pwnedUnlock).toBeUndefined();
  });

  it('keeps the prompt and shows an error on a wrong password, then unlocks on retry', async () => {
    const link = buildLink(await encodeSecure('# Secret\n\nbody', PASSWORD), ORIGIN);
    mountViewer(root, link);

    submitPassword('wrong password');
    await waitFor(() => {
      const message = root.querySelector<HTMLElement>('.unlock__error');
      return message !== null && !message.hidden;
    });

    expect((root.querySelector('.unlock__error')?.textContent ?? '').toLowerCase()).toContain(
      'incorrect password',
    );
    expect(root.querySelector('.unlock__password')).not.toBeNull();
    expect(root.querySelector('.document')).toBeNull();

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('.document') !== null);
    expect(root.querySelector('h1')?.textContent).toContain('Secret');
  });

  it('shows the corrupt-Link error view for a truncated secure Link', async () => {
    const full = buildLink(
      await encodeSecure('# A secure document long enough '.repeat(20), PASSWORD),
      ORIGIN,
    );
    const truncated = full.slice(0, Math.floor(full.length / 2));
    const state = mountViewer(root, truncated);
    expect(state.kind).toBe('locked');

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('section.error') !== null);

    expect((root.textContent ?? '').toLowerCase()).toContain('cut off');
    expect(root.querySelector('.document')).toBeNull();
  });

  it('Copy Link re-emits the original secure Link, not a re-encoded plaintext Link', async () => {
    const writes = mockClipboard();
    const md = '# Secret\n\nbody';
    const link = buildLink(await encodeSecure(md, PASSWORD), location.origin + location.pathname);
    mountViewer(root, link);

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('.document') !== null);

    expect(root.querySelector('.split-button--secure')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('.split-button__primary')!.click();
    await waitFor(() => writes.length === 1);

    const copied = writes[0]!;
    const payload = payloadFromUrl(copied);
    expect(payload).not.toBeNull();
    expect(payload!.startsWith('2')).toBe(true);
    expect(await decodeSecure(payload!, PASSWORD)).toBe(md);
  });

  it('after unlock the menu offers a plain Copy Link that downgrades to a tag 1 Link', async () => {
    const writes = mockClipboard();
    const md = '# Secret\n\nbody';
    const link = buildLink(await encodeSecure(md, PASSWORD), location.origin + location.pathname);
    mountViewer(root, link);

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('.document') !== null);

    (root.querySelector('.split-button__caret') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const item = Array.from(root.querySelectorAll('.split-button__item')).find((el) =>
      el.textContent?.includes('Copy Link'),
    ) as HTMLButtonElement;
    expect(item).not.toBeNull();
    item.click();
    await waitFor(() => writes.length === 1);

    const payload = payloadFromUrl(writes[0]!)!;
    expect(payload.startsWith('1')).toBe(true);
    expect(decode(payload)).toBe(md);
  });

  it('Copy source copies the decrypted markdown after unlock', async () => {
    const writes = mockClipboard();
    const md = '# Secret\n\nraw **markdown** body';
    mountViewer(root, buildLink(await encodeSecure(md, PASSWORD), ORIGIN));

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('.document') !== null);

    root.querySelector<HTMLButtonElement>('.viewer__copy-source')!.click();
    await waitFor(() => writes.length === 1);
    expect(writes).toEqual([md]);
  });

  it('Edit forks the decrypted markdown into the Editor after unlock', async () => {
    const md = '# Secret\n\nedit me';
    mountViewer(root, buildLink(await encodeSecure(md, PASSWORD), ORIGIN));

    submitPassword(PASSWORD);
    await waitFor(() => root.querySelector('.document') !== null);

    root.querySelector<HTMLButtonElement>('.viewer__edit')!.click();
    await waitFor(() => root.querySelector('.cm-content') !== null);

    const { EditorView } = await import('@codemirror/view');
    const view = EditorView.findFromDOM(root.querySelector('.cm-content') as HTMLElement);
    expect(view).not.toBeNull();
    expect(view!.state.doc.toString()).toBe(md);
  });
});

describe('Print stylesheet (issue-09)', () => {
  it('has a @media print block that hides interactive chrome and wraps code', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, 'style.css'), 'utf8');
    expect(css).toMatch(/@media\s+print/);
    const printBlock = css.slice(css.indexOf('@media print'));

    expect(printBlock).toContain('.viewer__chrome');
    expect(printBlock).toContain('.code-block__copy');
    expect(printBlock).toContain('.editor__toolbar');
    expect(printBlock).toMatch(/display:\s*none/);

    expect(printBlock).toContain('pre-wrap');
  });
});

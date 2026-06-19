import {
  decode,
  encode,
  buildLink,
  payloadFromUrl,
  DecodeError,
  classifyDecodeError,
  type DecodeErrorKind,
} from '@portablemd/core';
import {
  render,
  enhance,
  copyText,
  interceptInPageAnchors,
  firstHeadingText,
} from './render.js';
import { currentTheme, toggleTheme } from './theme.js';

const DEFAULT_TITLE = 'portablemd';

export type ViewerState =
  | { kind: 'document'; html: string; markdown: string }
  | { kind: 'editor' }
  | { kind: 'error'; errorKind: DecodeErrorKind };

export function resolveView(url: string): ViewerState {
  const payload = payloadFromUrl(url);
  if (payload === null) {
    return { kind: 'editor' };
  }
  try {
    const markdown = decode(payload);
    return { kind: 'document', html: render(markdown), markdown };
  } catch (e) {
    const errorKind: DecodeErrorKind =
      e instanceof DecodeError ? classifyDecodeError(e) : 'corrupt';
    return { kind: 'error', errorKind };
  }
}

export function mountViewer(
  root: HTMLElement,
  url: string = window.location.href,
): ViewerState {
  const state = resolveView(url);
  switch (state.kind) {
    case 'document': {
      root.textContent = '';
      const markdown = state.markdown;

      const chrome = document.createElement('div');
      chrome.className = 'viewer__chrome';

      const copySource = makeChromeButton('viewer__copy-source', 'Copy source', 'Copy the raw markdown source');
      copySource.addEventListener('click', () => {
        void copyText(markdown).then((ok) => {
          flash(copySource, ok ? 'Copied' : 'Copy failed', 'Copy source');
        });
      });

      const copyLink = makeChromeButton('viewer__copy-link', 'Copy Link', 'Copy a link to this document');
      copyLink.addEventListener('click', () => {
        const link = buildLink(encode(markdown), location.origin + location.pathname);
        void copyText(link).then((ok) => {
          flash(copyLink, ok ? 'Link copied' : 'Copy failed', 'Copy Link');
        });
      });

      const edit = makeChromeButton(
        'viewer__edit',
        'Edit',
        'Edit a copy — your changes make a new link; this one stays unchanged',
      );

      const themeToggle = makeThemeToggle();

      const bearerNote = document.createElement('span');
      bearerNote.className = 'viewer__bearer-note';
      bearerNote.textContent = 'Anyone with this link can read it.';

      chrome.append(themeToggle, copySource, copyLink, edit, bearerNote);

      const article = document.createElement('article');
      article.className = 'document';
      article.innerHTML = state.html;

      root.append(chrome, article);

      interceptInPageAnchors(article);
      document.title = firstHeadingText(markdown) ?? DEFAULT_TITLE;
      void enhance(article);

      edit.addEventListener('click', () => {
        void import('./editor/mount.js').then(({ mountEditor }) => {
          root.textContent = '';
          mountEditor(root, { initialMarkdown: markdown, forkedFromDocument: true });
        });
      });
      break;
    }
    case 'editor':
      root.textContent = '';
      void import('./editor/mount.js').then(({ mountEditor }) => {
        mountEditor(root);
      });
      break;
    case 'error':
      root.textContent = '';
      mountError(root, state.errorKind);
      break;
  }
  return state;
}

export function makeThemeToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';

  const sync = (): void => {
    const theme = currentTheme();
    const goingDark = theme === 'light';
    button.textContent = goingDark ? '\u{1F319}' : '☀️';
    const label = goingDark ? 'Switch to dark theme' : 'Switch to light theme';
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  sync();
  button.addEventListener('click', () => {
    toggleTheme();
    sync();
  });
  return button;
}

function makeChromeButton(className: string, label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `viewer__action ${className}`;
  button.textContent = label;
  button.title = title;
  return button;
}

function flash(button: HTMLButtonElement, message: string, original: string): void {
  button.textContent = message;
  window.setTimeout(() => {
    button.textContent = original;
  }, 2000);
}

function mountError(root: HTMLElement, errorKind: DecodeErrorKind): void {
  const section = document.createElement('section');
  section.className = 'error';

  const h = document.createElement('h1');
  const p = document.createElement('p');

  if (errorKind === 'unknown-version') {
    h.textContent = 'This Link needs a newer portablemd';
    p.textContent =
      'This Link was made with a newer version of portablemd than the one ' +
      'running here. Try updating, or open it in the latest version.';
    section.append(h, p);
  } else {
    h.textContent = "This Link didn't open";
    p.textContent =
      'Long links sometimes get cut off when pasted into chat or email, which ' +
      'leaves the document unreadable. If someone sent you this Link, ask them ' +
      'to copy and paste the whole thing again.';
    section.append(h, p);

    const actions = document.createElement('div');
    actions.className = 'error__actions';
    const fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.className = 'error__new';
    fresh.textContent = 'New Document';
    fresh.title = 'Start a fresh document in the editor';
    fresh.addEventListener('click', () => {
      window.location.hash = '';
      mountViewer(root, window.location.pathname + window.location.search);
    });
    actions.append(fresh);
    section.append(actions);
  }

  root.append(section);
}

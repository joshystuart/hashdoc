import {
  decode,
  decodeProtected,
  isProtected,
  payloadFromUrl,
  DecodeError,
  classifyDecodeError,
  type DecodeErrorKind,
} from '@hashdoc/core';
import { h, render as preactRender } from 'preact';
import {
  render,
  enhance,
  interceptInPageAnchors,
  firstHeadingText,
} from './render.js';
import { ViewerChrome } from './viewerChrome.js';

const DEFAULT_TITLE = 'HashDoc';

export type ViewerState =
  | { kind: 'document'; html: string; markdown: string }
  | { kind: 'editor' }
  | { kind: 'locked'; payload: string }
  | { kind: 'error'; errorKind: DecodeErrorKind };

export function resolveView(url: string): ViewerState {
  const payload = payloadFromUrl(url);
  if (payload === null) {
    return { kind: 'editor' };
  }
  if (isProtected(payload)) {
    return { kind: 'locked', payload };
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
    case 'document':
      renderDocument(root, state.markdown, state.html);
      break;
    case 'editor':
      root.textContent = '';
      void import('./editor/mount.js').then(({ mountEditor }) => {
        mountEditor(root);
      });
      break;
    case 'locked':
      mountUnlockPrompt(root, state.payload);
      break;
    case 'error':
      root.textContent = '';
      mountError(root, state.errorKind);
      break;
  }
  return state;
}

function renderDocument(
  root: HTMLElement,
  markdown: string,
  html: string,
  protectedPayload?: string,
): void {
  root.textContent = '';

  const viewer = document.createElement('div');
  viewer.className = 'viewer';

  const chrome = document.createElement('div');
  chrome.className = 'viewer__chrome-host';
  preactRender(
    h(ViewerChrome, {
      markdown,
      protectedPayload,
      onEdit: () => {
        void import('./editor/mount.js').then(({ mountEditor }) => {
          root.textContent = '';
          mountEditor(root, { initialMarkdown: markdown, forkedFromDocument: true });
        });
      },
    }),
    chrome,
  );

  const article = document.createElement('article');
  article.className = 'document';
  article.innerHTML = html;

  const content = document.createElement('div');
  content.className = 'viewer__content';
  content.append(article);

  viewer.append(chrome, content);
  root.append(viewer);

  interceptInPageAnchors(article);
  document.title = firstHeadingText(markdown) ?? DEFAULT_TITLE;
  void enhance(article);
}

function mountUnlockPrompt(root: HTMLElement, payload: string): void {
  root.textContent = '';

  const section = document.createElement('section');
  section.className = 'unlock';

  const heading = document.createElement('h1');
  heading.textContent = 'This Document is password-protected';

  const intro = document.createElement('p');
  intro.textContent = 'Enter the password to open it.';

  const form = document.createElement('form');
  form.className = 'unlock__form';

  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'unlock__password';
  input.required = true;
  input.autocomplete = 'current-password';
  input.setAttribute('aria-label', 'Password');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'unlock__submit';
  submit.textContent = 'Unlock';

  const message = document.createElement('p');
  message.className = 'unlock__error';
  message.hidden = true;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    message.hidden = true;
    void decodeProtected(payload, input.value)
      .then((markdown) => {
        renderDocument(root, markdown, render(markdown), payload);
      })
      .catch((e) => {
        const errorKind: DecodeErrorKind =
          e instanceof DecodeError ? classifyDecodeError(e) : 'corrupt';
        if (errorKind === 'wrong-password') {
          message.textContent = 'Incorrect password. Please try again.';
          message.hidden = false;
          input.value = '';
          input.focus();
          return;
        }
        root.textContent = '';
        mountError(root, errorKind);
      });
  });

  form.append(input, submit, message);
  section.append(heading, intro, form);
  root.append(section);
}

function mountError(root: HTMLElement, errorKind: DecodeErrorKind): void {
  const section = document.createElement('section');
  section.className = 'error';

  const h = document.createElement('h1');
  const p = document.createElement('p');

  if (errorKind === 'unknown-version') {
    h.textContent = 'This Link needs a newer HashDoc';
    p.textContent =
      'This Link was made with a newer version of HashDoc than the one ' +
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

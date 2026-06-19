import {
  decode,
  payloadFromUrl,
  DecodeError,
  classifyDecodeError,
  type DecodeErrorKind,
} from '@openartifact/core';
import { h, render as preactRender } from 'preact';
import {
  render,
  enhance,
  interceptInPageAnchors,
  firstHeadingText,
} from './render.js';
import { ViewerChrome } from './viewerChrome.js';

const DEFAULT_TITLE = 'openartifact';

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
      preactRender(
        h(ViewerChrome, {
          markdown,
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
      article.innerHTML = state.html;

      const content = document.createElement('div');
      content.className = 'viewer__content';
      content.append(article);

      root.append(chrome, content);

      interceptInPageAnchors(article);
      document.title = firstHeadingText(markdown) ?? DEFAULT_TITLE;
      void enhance(article);
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

function mountError(root: HTMLElement, errorKind: DecodeErrorKind): void {
  const section = document.createElement('section');
  section.className = 'error';

  const h = document.createElement('h1');
  const p = document.createElement('p');

  if (errorKind === 'unknown-version') {
    h.textContent = 'This Link needs a newer openartifact';
    p.textContent =
      'This Link was made with a newer version of openartifact than the one ' +
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

import { decode, payloadFromUrl, DecodeError } from '@portablemd/core';
import { render } from './render.js';

/**
 * What the app should show for a given URL. Routing is driven entirely by the
 * fragment (ADR 0001): a Payload present means Viewer; absent means the Editor
 * in new mode (issue-02).
 */
export type ViewerState =
  | { kind: 'document'; html: string }
  | { kind: 'editor' }
  | { kind: 'error'; message: string };

/**
 * Pure resolver: full URL -> what to render. Side-effect free so it is trivially
 * testable; the DOM mounting lives in {@link mountViewer}.
 */
export function resolveView(url: string): ViewerState {
  const payload = payloadFromUrl(url);
  if (payload === null) {
    return { kind: 'editor' };
  }
  try {
    const markdown = decode(payload);
    return { kind: 'document', html: render(markdown) };
  } catch (e) {
    const message =
      e instanceof DecodeError ? e.message : 'This Link could not be opened.';
    return { kind: 'error', message };
  }
}

/**
 * Render the current URL's view into a mount element. Returns the resolved
 * state for callers/tests that want to assert on it.
 *
 * The Viewer paths (document/error) render synchronously and stay featherweight.
 * The Editor is lazy-loaded: its module (Preact + CodeMirror) is pulled in via
 * dynamic `import()` only when there is no fragment, so it is absent from the
 * initial Viewer payload.
 */
export function mountViewer(
  root: HTMLElement,
  url: string = window.location.href,
): ViewerState {
  const state = resolveView(url);
  switch (state.kind) {
    case 'document':
      root.innerHTML = `<article class="document">${state.html}</article>`;
      break;
    case 'editor':
      root.textContent = '';
      void import('./editor/mount.js').then(({ mountEditor }) => {
        mountEditor(root);
      });
      break;
    case 'error':
      root.textContent = '';
      {
        const section = document.createElement('section');
        section.className = 'error';
        const h = document.createElement('h1');
        h.textContent = 'Cannot open this Link';
        const p = document.createElement('p');
        p.textContent = state.message;
        section.append(h, p);
        root.append(section);
      }
      break;
  }
  return state;
}

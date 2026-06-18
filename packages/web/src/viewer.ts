import {
  decode,
  payloadFromUrl,
  DecodeError,
  classifyDecodeError,
  type DecodeErrorKind,
} from '@portablemd/core';
import { render, enhance } from './render.js';

/**
 * What the app should show for a given URL. Routing is driven entirely by the
 * fragment (ADR 0001): a Payload present means Viewer; absent means the Editor
 * in new mode (issue-02).
 *
 * The `error` state carries a {@link DecodeErrorKind} so the Viewer can show
 * the right recovery story: a truncation-led message for corrupt Links, or a
 * "newer version" message for unknown version tags (issue-05).
 */
export type ViewerState =
  | { kind: 'document'; html: string; markdown: string }
  | { kind: 'editor' }
  | { kind: 'error'; errorKind: DecodeErrorKind };

/**
 * Pure resolver: full URL -> what to render. Side-effect free so it is trivially
 * testable; the DOM mounting lives in {@link mountViewer}.
 *
 * A truly EMPTY fragment is treated as "no Link" and routes to the Editor — the
 * decode path is only entered when there is an actual Payload to open.
 */
export function resolveView(url: string): ViewerState {
  const payload = payloadFromUrl(url);
  if (payload === null) {
    return { kind: 'editor' };
  }
  try {
    const markdown = decode(payload);
    return { kind: 'document', html: render(markdown), markdown };
  } catch (e) {
    // Any decode failure must land on a visible, friendly state — never a
    // white screen and never a console-only error. A non-DecodeError is
    // unexpected, so treat it as a corrupt Link (the broader bucket).
    const errorKind: DecodeErrorKind =
      e instanceof DecodeError ? classifyDecodeError(e) : 'corrupt';
    return { kind: 'error', errorKind };
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
    case 'document': {
      // Viewer chrome: the rendered Document plus an Edit action. Editing is
      // fork-and-share (glossary): Edit opens the Editor pre-filled with *this*
      // Document's markdown; saving there produces a NEW Link. The Link being
      // viewed is an immutable string and is never mutated (issue-03).
      root.textContent = '';
      const chrome = document.createElement('div');
      chrome.className = 'viewer__chrome';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'viewer__edit';
      edit.textContent = 'Edit';
      edit.title = 'Edit a copy — your changes make a new link; this one stays unchanged';
      chrome.append(edit);

      const article = document.createElement('article');
      article.className = 'document';
      article.innerHTML = state.html;

      root.append(chrome, article);

      // Syntax-highlight any code blocks via the shared enhance step — the exact
      // path the Editor preview uses, so Viewer and preview can never diverge.
      // highlight.js loads (async chunk) only if the Document actually has code.
      void enhance(article);

      const markdown = state.markdown;
      edit.addEventListener('click', () => {
        // Lazy-import keeps CodeMirror out of the Viewer entry chunk.
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

/**
 * Render a friendly, recoverable error state. Every bad Link lands here rather
 * than on a white screen.
 *
 * - `corrupt`: leads with the truncation explanation — the single most likely
 *   real-world cause is a long Link getting cut off when pasted into chat or
 *   email — and offers a New Document action that drops the fragment and opens
 *   the Editor.
 * - `unknown-version`: the Link was made by a newer portablemd; ask the reader
 *   to update.
 */
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
      // Re-route to the no-fragment Editor without a hard reload (jsdom can't
      // reload). Clearing the hash and re-mounting reuses the existing routing.
      window.location.hash = '';
      mountViewer(root, window.location.pathname + window.location.search);
    });
    actions.append(fresh);
    section.append(actions);
  }

  root.append(section);
}

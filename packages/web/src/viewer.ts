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

/** Fallback tab title when a Document has no H1 (issue-09). */
const DEFAULT_TITLE = 'portablemd';

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
      const markdown = state.markdown;

      const chrome = document.createElement('div');
      chrome.className = 'viewer__chrome';

      // Copy source: the Document's raw markdown. Copy Link: the current Link
      // (rebuilt from the payload so it is always the canonical origin-relative
      // string, independent of how the page was navigated to). Both go through
      // the shared copyText() clipboard path (issue-09).
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

      // Theme toggle (issue-10): flips <html data-theme> and persists the choice.
      // Lives in the always-on chrome so it is reachable while reading.
      const themeToggle = makeThemeToggle();

      chrome.append(themeToggle, copySource, copyLink, edit);

      const article = document.createElement('article');
      article.className = 'document';
      article.innerHTML = state.html;

      root.append(chrome, article);

      // Keep in-page heading anchors from clobbering the payload fragment: the
      // entire Document lives in location.hash (ADR 0001), so we intercept
      // `#slug` clicks and scrollIntoView instead of navigating the hash.
      interceptInPageAnchors(article);

      // Tab title from the Document's first H1, with a sensible fallback.
      document.title = firstHeadingText(markdown) ?? DEFAULT_TITLE;

      // Syntax-highlight code, render math/mermaid, and add copy-code buttons via
      // the shared enhance step — the exact path the Editor preview uses, so
      // Viewer and preview can never diverge. Heavy libs load (async chunk) only
      // if the Document actually uses the corresponding feature.
      void enhance(article);

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
 * Build the theme toggle button (issue-10). It reflects the current theme in its
 * icon and accessible label, and on click flips the theme, persists the choice,
 * and updates its own label. A single toggle on the shared app shell recolours
 * both the Viewer and the Editor.
 */
export function makeThemeToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';

  const sync = (): void => {
    const theme = currentTheme();
    // Show the icon for the theme you'd switch TO, with a matching label.
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

/** Build a Viewer chrome action button with a shared class/look. */
function makeChromeButton(className: string, label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `viewer__action ${className}`;
  button.textContent = label;
  button.title = title;
  return button;
}

/** Briefly show a status label on a button, then restore the original. */
function flash(button: HTMLButtonElement, message: string, original: string): void {
  button.textContent = message;
  window.setTimeout(() => {
    button.textContent = original;
  }, 2000);
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

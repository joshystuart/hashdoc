/**
 * Theme model (issue-10).
 *
 * portablemd defaults to the reader's OS preference (`prefers-color-scheme`) and
 * lets them override it with a manual toggle that persists in `localStorage`. The
 * resolved theme is reflected as a `data-theme="light|dark"` attribute on
 * `<html>`; `style.css` defines both palettes against that attribute, so the
 * Viewer and the Editor recolour together (they share the app shell).
 *
 * NO-FLASH: a tiny inline script in `index.html`'s <head> (see THEME_INIT_SCRIPT)
 * runs this same resolution synchronously before first paint, so the page never
 * flashes the wrong theme. The logic lives here as a pure, unit-testable function
 * rather than only inside that inline string.
 */

/** The two concrete themes a palette can resolve to. */
export type Theme = 'light' | 'dark';

/** A stored manual override, or 'system' to follow the OS preference. */
export type ThemeChoice = Theme | 'system';

/** localStorage key holding the reader's manual override (issue-10). */
export const THEME_STORAGE_KEY = 'portablemd-theme';

/**
 * Resolve the concrete theme to apply, given a stored override and the OS
 * preference. Pure and side-effect free so it is trivially testable and is the
 * single source of truth shared by both the inline no-flash script and the app.
 *
 * - A valid stored override ('light' | 'dark') always wins.
 * - Otherwise (no override, or the sentinel 'system') fall back to the OS
 *   preference: dark when the OS prefers dark, else light.
 */
export function resolveTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return prefersDark ? 'dark' : 'light';
}

/** Read the reader's stored manual override, tolerating a missing/blocked store. */
export function getStoredChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') {
      return value;
    }
  } catch {
    // localStorage can throw (private mode, blocked storage) — treat as 'system'.
  }
  return 'system';
}

/** True when the OS currently prefers a dark colour scheme. */
export function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** The concrete theme currently applied to `<html>` (defaults to light). */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Reflect a concrete theme onto `<html>` via the `data-theme` attribute. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Persist a manual override (tolerating a missing/blocked store). */
function storeChoice(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Best-effort: if we can't persist, the choice still applies for this load.
  }
}

/**
 * Resolve and apply the theme from the current environment (stored override else
 * OS preference). Returns the applied theme. Called on app start to align the
 * runtime with whatever the inline no-flash script already set.
 */
export function initTheme(): Theme {
  const theme = resolveTheme(getStoredChoice(), prefersDark());
  applyTheme(theme);
  return theme;
}

/**
 * Flip between light and dark, persist the choice as a manual override, and
 * apply it. Returns the newly applied theme. This is what the toggle button
 * calls — a manual choice from here on always wins over the OS preference until
 * the reader clears their browser storage.
 */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storeChoice(next);
  return next;
}

/**
 * The inline no-flash script for `index.html`'s <head>. It mirrors
 * {@link resolveTheme} but is self-contained (no imports) so it can run as a raw
 * inline <script> BEFORE the bundle and before the body paints — eliminating the
 * flash of the wrong theme. Exported as a string so a test can assert the page
 * embeds exactly this logic.
 *
 * SECURITY/CSP NOTE (for issue-13): this is an inline same-origin script, which
 * is fine for "zero third-party requests" (ADR 0002) — nothing is fetched. But a
 * strict Content-Security-Policy without `unsafe-inline` will block it; issue-13
 * (privacy/safety hardening) must add a CSP hash or nonce for this exact script,
 * or move it to an external same-origin file, to keep no-flash working.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();`;

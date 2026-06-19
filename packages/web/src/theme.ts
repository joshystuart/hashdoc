export type Theme = 'light' | 'dark';

export type ThemeChoice = Theme | 'system';

export const THEME_STORAGE_KEY = 'portablemd-theme';

export function resolveTheme(
  stored: string | null | undefined,
  prefersDark: boolean,
): Theme {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return prefersDark ? 'dark' : 'light';
}

export function getStoredChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') {
      return value;
    }
  } catch {}
  return 'system';
}

export function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function storeChoice(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

export function initTheme(): Theme {
  const theme = resolveTheme(getStoredChoice(), prefersDark());
  applyTheme(theme);
  return theme;
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storeChoice(next);
  return next;
}

export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();`;

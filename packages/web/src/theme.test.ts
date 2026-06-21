import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  resolveTheme,
  getStoredChoice,
  applyTheme,
  currentTheme,
  toggleTheme,
  initTheme,
  THEME_STORAGE_KEY,
  THEME_INIT_SCRIPT,
} from './theme.js';

const here = dirname(fileURLToPath(import.meta.url));

function mockPrefersDark(dark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: dark && /dark/.test(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe('resolveTheme — pure resolution (OS pref + override)', () => {
  it('falls back to the OS preference when there is no override (dark)', () => {
    expect(resolveTheme(null, true)).toBe('dark');
  });

  it('falls back to the OS preference when there is no override (light)', () => {
    expect(resolveTheme(null, false)).toBe('light');
  });

  it("treats the 'system' sentinel like no override", () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('a valid stored override wins over the OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');

    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('an invalid stored value is ignored (falls back to OS pref)', () => {
    expect(resolveTheme('purple', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
  });
});

describe('theme resolution from the live environment', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('with no override and matchMedia mocked to dark, resolves to dark', () => {
    mockPrefersDark(true);
    expect(initTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('with no override and matchMedia mocked to light, resolves to light', () => {
    mockPrefersDark(false);
    expect(initTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('toggleTheme — persists a manual override', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('toggling sets data-theme and writes the override to localStorage', () => {
    applyTheme('light');
    const next = toggleTheme();
    expect(next).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('a subsequent resolve reads the override over matchMedia', () => {
    applyTheme('light');
    toggleTheme();

    mockPrefersDark(false);
    expect(getStoredChoice()).toBe('dark');
    expect(resolveTheme(getStoredChoice(), false)).toBe('dark');
    expect(initTheme()).toBe('dark');
  });

  it('toggling again flips back to light and persists that', () => {
    applyTheme('dark');
    expect(toggleTheme()).toBe('light');
    expect(currentTheme()).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

describe('no-flash inline script (index.html)', () => {
  it('index.html embeds a head script that sets data-theme synchronously', () => {
    const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
    const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));

    expect(head).toMatch(/<script>/);

    expect(head).toContain(THEME_STORAGE_KEY);
    expect(head).toContain('prefers-color-scheme: dark');
    expect(head).toContain('documentElement.dataset.theme');
  });

  it('THEME_INIT_SCRIPT mirrors the same resolution logic', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain('prefers-color-scheme: dark');
    expect(THEME_INIT_SCRIPT).toContain('documentElement.dataset.theme');
  });
});

describe('style.css — both palettes and dark hljs exist', () => {
  const css = readFileSync(join(here, 'style.css'), 'utf8');
  const darkHljs = readFileSync(join(here, 'highlight-dark.css'), 'utf8');

  it('defines theme tokens in :root (light) and a [data-theme="dark"] override', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--bg/s);
    expect(css).toMatch(/--fg/);
    expect(css).toMatch(/\[data-theme=['"]dark['"]\]\s*\{/);

    const root = css.slice(css.indexOf(':root'));
    expect(root).toMatch(/--bg:\s*#fff/i);
  });

  it('recolours via variables rather than only hard-coded colours', () => {
    expect(css).toContain('var(--bg)');
    expect(css).toContain('var(--fg)');
    expect(css).toContain('var(--code-bg)');
  });

  it('ships dark-scoped highlight.js token colours', () => {
    expect(darkHljs).toMatch(/\[data-theme=['"]dark['"]\]\s+\.hljs/);
  });
});

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * issue-02 acceptance: the Editor (CodeMirror 6 + Preact) is lazy-loaded so the
 * Viewer entry stays featherweight. We verify the *built* output: CodeMirror
 * must land in a separate async chunk, NOT the entry chunk.
 *
 * Skipped when dist is absent — run `pnpm build` first (CI builds before test).
 */
const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const assetsDir = join(distDir, 'assets');

// A token that only appears in CodeMirror's bundled source.
const CODEMIRROR_MARKER = /cm-content|cm-editor|@codemirror/;

// A token that only appears in highlight.js's bundled source. hljs's public API
// names and its grammar metadata (`hljs`, `highlightAuto`, `case_insensitive`,
// `contains:`) do not occur in our own source.
const HLJS_MARKER = /highlightAuto|case_insensitive|grmr_|hljs-comment/;

function jsFiles(dir: string): { name: string; text: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));
}

describe('lazy-loaded Editor chunk (built output)', () => {
  const built = existsSync(assetsDir);

  it.runIf(built)('keeps CodeMirror out of the entry chunk', () => {
    const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
    // The entry chunk is the one referenced by a <script type="module"> in HTML.
    const entryMatch = indexHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
    expect(entryMatch).not.toBeNull();
    const entryName = entryMatch![1]!.split('/').pop()!;
    const entry = jsFiles(assetsDir).find((f) => f.name === entryName);
    expect(entry, `entry chunk ${entryName} should exist`).toBeDefined();
    expect(entry!.text).not.toMatch(CODEMIRROR_MARKER);
  });

  it.runIf(built)('puts CodeMirror in a separate async chunk', () => {
    const withCodeMirror = jsFiles(assetsDir).filter((f) => CODEMIRROR_MARKER.test(f.text));
    expect(withCodeMirror.length).toBeGreaterThan(0);
  });

  // issue-06: highlight.js must also stay lazy — out of the Viewer entry chunk
  // and only present in a separate async chunk loaded on demand.
  it.runIf(built)('keeps highlight.js out of the entry chunk', () => {
    const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
    const entryMatch = indexHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
    expect(entryMatch).not.toBeNull();
    const entryName = entryMatch![1]!.split('/').pop()!;
    const entry = jsFiles(assetsDir).find((f) => f.name === entryName);
    expect(entry, `entry chunk ${entryName} should exist`).toBeDefined();
    expect(entry!.text).not.toMatch(HLJS_MARKER);
  });

  it.runIf(built)('puts highlight.js in a separate async chunk', () => {
    const withHljs = jsFiles(assetsDir).filter((f) => HLJS_MARKER.test(f.text));
    expect(withHljs.length).toBeGreaterThan(0);
  });

  if (!built) {
    it('SKIPPED: dist not present — run `pnpm build` to enable the lazy-load audit', () => {
      expect(built).toBe(false);
    });
  }
});

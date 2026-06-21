import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const assetsDir = join(distDir, 'assets');

const CODEMIRROR_MARKER = /cm-content|cm-editor|@codemirror/;
const HLJS_MARKER = /highlightAuto|case_insensitive|grmr_|hljs-comment/;
const MERMAID_MARKER = /mermaid-js|sequenceDiagram|flowchart-v2|\bgantt\b/;
const KATEX_MARKER = /ParseError|katex-html|\bstrut\b|delimsizing/;

function jsFiles(dir: string): { name: string; text: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));
}

describe('lazy-loaded Editor chunk (built output)', () => {
  const built = existsSync(assetsDir);

  it.runIf(built)('keeps CodeMirror out of the entry chunk', () => {
    const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

    const entryMatch = indexHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
    expect(entryMatch).not.toBeNull();
    const entryName = entryMatch![1]!.split('/').pop()!;
    const entry = jsFiles(assetsDir).find((f) => f.name === entryName);
    expect(entry, `entry chunk ${entryName} should exist`).toBeDefined();
    expect(entry!.text).not.toMatch(CODEMIRROR_MARKER);
  });

  it.runIf(built)('puts CodeMirror in a separate async chunk', () => {
    const withCodeMirror = jsFiles(assetsDir).filter((f) =>
      CODEMIRROR_MARKER.test(f.text),
    );
    expect(withCodeMirror.length).toBeGreaterThan(0);
  });

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

  it.runIf(built)('keeps Mermaid out of the entry chunk', () => {
    const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
    const entryMatch = indexHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
    expect(entryMatch).not.toBeNull();
    const entryName = entryMatch![1]!.split('/').pop()!;
    const entry = jsFiles(assetsDir).find((f) => f.name === entryName);
    expect(entry, `entry chunk ${entryName} should exist`).toBeDefined();
    expect(entry!.text).not.toMatch(MERMAID_MARKER);
  });

  it.runIf(built)('puts Mermaid in a separate async chunk', () => {
    const withMermaid = jsFiles(assetsDir).filter((f) =>
      MERMAID_MARKER.test(f.text),
    );
    expect(withMermaid.length).toBeGreaterThan(0);
  });

  it.runIf(built)('keeps KaTeX out of the entry chunk', () => {
    const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
    const entryMatch = indexHtml.match(/<script[^>]+src=["']([^"']+\.js)["']/i);
    expect(entryMatch).not.toBeNull();
    const entryName = entryMatch![1]!.split('/').pop()!;
    const entry = jsFiles(assetsDir).find((f) => f.name === entryName);
    expect(entry, `entry chunk ${entryName} should exist`).toBeDefined();
    expect(entry!.text).not.toMatch(KATEX_MARKER);
  });

  it.runIf(built)('puts KaTeX in a separate async chunk', () => {
    const withKatex = jsFiles(assetsDir).filter((f) =>
      KATEX_MARKER.test(f.text),
    );
    expect(withKatex.length).toBeGreaterThan(0);
  });

  if (!built) {
    it('SKIPPED: dist not present — run `pnpm build` to enable the lazy-load audit', () => {
      expect(built).toBe(false);
    });
  }
});

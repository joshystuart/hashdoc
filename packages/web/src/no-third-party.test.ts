import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ADR 0002 — zero third-party requests. Assert the built Viewer references no
 * external script/style/font infrastructure. Author-embedded image/link URLs
 * in *Document content* are fine; those never appear in the built bundle/HTML.
 *
 * If the app has not been built yet, this test is skipped (the root `build`
 * step runs before `test` in CI ordering checks; locally run `pnpm build`).
 */
const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('zero third-party requests (built output)', () => {
  const built = existsSync(distDir);

  it.runIf(built)('has no external script/link tags in built HTML', () => {
    const htmlFiles = walk(distDir).filter((f) => f.endsWith('.html'));
    expect(htmlFiles.length).toBeGreaterThan(0);
    for (const file of htmlFiles) {
      const html = readFileSync(file, 'utf8');
      // No <script src="http(s)://..."> and no <link href="http(s)://...">.
      expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
      expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
    }
  });

  it.runIf(built)('bundles JS/CSS without referencing external CDNs', () => {
    const assets = walk(distDir).filter((f) => /\.(js|css)$/.test(f));
    expect(assets.length).toBeGreaterThan(0);
    for (const file of assets) {
      const text = readFileSync(file, 'utf8');
      // No CDN-style asset imports (fonts.googleapis, cdn.jsdelivr, unpkg, etc.).
      expect(text).not.toMatch(/https?:\/\/(?:fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare)/i);
    }
  });

  if (!built) {
    it('SKIPPED: dist not present — run `pnpm build` to enable the third-party audit', () => {
      expect(built).toBe(false);
    });
  }
});

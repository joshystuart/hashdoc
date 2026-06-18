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

  // issue-08: KaTeX's fonts must be self-hosted — bundled into dist, with the
  // built CSS referencing them via LOCAL (relative/fingerprinted) urls, not a
  // CDN. We only assert font presence when a KaTeX chunk was actually built.
  it.runIf(built)('bundles KaTeX fonts locally (no CDN font requests)', () => {
    const files = walk(distDir);
    const css = files.filter((f) => f.endsWith('.css'));
    const usesKatex = css.some((f) => /\.katex|katex-html|KaTeX_/.test(readFileSync(f, 'utf8')));
    // If KaTeX CSS isn't in the build at all, there's nothing to self-host.
    if (!usesKatex) {
      return;
    }
    // KaTeX font files (woff2/woff/ttf named KaTeX_*) must be present in dist.
    const fonts = files.filter((f) => /KaTeX_[^/]+\.(woff2?|ttf)$/.test(f));
    expect(fonts.length, 'KaTeX font files should be bundled into dist').toBeGreaterThan(0);
    // The KaTeX CSS must reference fonts via local url(), never a CDN.
    for (const file of css) {
      const text = readFileSync(file, 'utf8');
      if (!/KaTeX_/.test(text)) {
        continue;
      }
      const urls = text.match(/url\(([^)]+)\)/g) ?? [];
      for (const u of urls) {
        expect(u).not.toMatch(/https?:\/\//i);
      }
    }
  });

  if (!built) {
    it('SKIPPED: dist not present — run `pnpm build` to enable the third-party audit', () => {
      expect(built).toBe(false);
    });
  }
});

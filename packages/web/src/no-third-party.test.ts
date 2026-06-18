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

  // Comprehensive sweep: NO bundled asset may pull anything over the network
  // from an external origin via any common mechanism — `src=`/`href=` tag
  // attributes, CSS `url(...)`, ES `import`/`import()` specifiers, `fetch(`,
  // `new Worker(`, `importScripts(`, or `new URL('http…')`. Only `data:`,
  // `blob:` and relative/fingerprinted local URLs are allowed. This would FAIL
  // if anyone later wired in a CDN font/script or an exfiltrating fetch.
  it.runIf(built)('no bundled asset references an external http(s) origin', () => {
    // Hosts we explicitly allow to appear as TEXT (never as a fetched origin):
    // CSP img-src documents `https:` as a *scheme* and spec/comment URLs may
    // mention example.com / w3.org. We therefore only flag http(s):// that is
    // wired into a real load mechanism, not every literal URL.
    const loaders: { label: string; re: RegExp }[] = [
      { label: 'tag src=', re: /\bsrc\s*=\s*["']https?:\/\/[^"']+["']/gi },
      { label: 'tag href=', re: /\bhref\s*=\s*["']https?:\/\/[^"']+["']/gi },
      { label: 'css url()', re: /url\(\s*["']?https?:\/\/[^)"']+["']?\s*\)/gi },
      { label: 'es import', re: /\bimport\s*\(?\s*["']https?:\/\/[^"']+["']/gi },
      { label: 'fetch()', re: /\bfetch\s*\(\s*["']https?:\/\/[^"']+["']/gi },
      { label: 'new Worker()', re: /new\s+Worker\s*\(\s*["']https?:\/\/[^"']+["']/gi },
      { label: 'importScripts()', re: /importScripts\s*\(\s*["']https?:\/\/[^"']+["']/gi },
      { label: "new URL('http…')", re: /new\s+URL\s*\(\s*["']https?:\/\/[^"']+["']/gi },
    ];
    const files = walk(distDir).filter((f) => /\.(js|css|html)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const { label, re } of loaders) {
        const hits = text.match(re);
        if (hits) {
          offenders.push(`${file}: ${label} -> ${hits.join(', ')}`);
        }
      }
    }
    expect(offenders, `external network loaders found:\n${offenders.join('\n')}`).toEqual([]);
  });

  // The CSP itself must encode "zero third-party": default-src/connect-src are
  // 'self', so neither a stray asset nor an exfiltrating XHR can leave origin.
  it.runIf(built)('built CSP locks default-src and connect-src to self', () => {
    // Strip HTML comments first: index.html documents the CSP in a comment that
    // contains the literal string `<meta http-equiv="Content-Security-Policy">`,
    // which must not be mistaken for the real (content-bearing) meta tag.
    const html = readFileSync(join(distDir, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const meta = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html);
    expect(meta, 'CSP <meta> must exist in built index.html').not.toBeNull();
    // CSP values contain single quotes ('self'); match the double-quoted attr.
    const content = /content="([^"]+)"/i.exec(meta![0])![1]!;
    const directive = (name: string): string =>
      content
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `) || d === name) ?? '';
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('connect-src')).toBe("connect-src 'self'");
    // script-src must not re-open inline execution.
    expect(directive('script-src')).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
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

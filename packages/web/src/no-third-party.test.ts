import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
      expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
      expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\//i);
    }
  });

  it.runIf(built)('bundles JS/CSS without referencing external CDNs', () => {
    const assets = walk(distDir).filter((f) => /\.(js|css)$/.test(f));
    expect(assets.length).toBeGreaterThan(0);
    for (const file of assets) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/https?:\/\/(?:fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare)/i);
    }
  });

  it.runIf(built)('no bundled asset references an external http(s) origin', () => {
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

  it.runIf(built)('built CSP locks default-src and connect-src to self', () => {
    const html = readFileSync(join(distDir, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const meta = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html);
    expect(meta, 'CSP <meta> must exist in built index.html').not.toBeNull();
    const content = /content="([^"]+)"/i.exec(meta![0])![1]!;
    const directive = (name: string): string =>
      content
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `) || d === name) ?? '';
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(directive('script-src')).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
  });

  it.runIf(built)('bundles KaTeX fonts locally (no CDN font requests)', () => {
    const files = walk(distDir);
    const css = files.filter((f) => f.endsWith('.css'));
    const usesKatex = css.some((f) => /\.katex|katex-html|KaTeX_/.test(readFileSync(f, 'utf8')));
    if (!usesKatex) {
      return;
    }
    const fonts = files.filter((f) => /KaTeX_[^/]+\.(woff2?|ttf)$/.test(f));
    expect(fonts.length, 'KaTeX font files should be bundled into dist').toBeGreaterThan(0);
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

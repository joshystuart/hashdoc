import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const distDir = join(here, '..', 'dist');
const indexHtml = join(distDir, 'index.html');
const built = existsSync(indexHtml);

const FAVICON_LINKS = [
  { rel: 'icon', href: '/favicon.ico' },
  {
    rel: 'icon',
    href: '/favicon-32x32.png',
    type: 'image/png',
    sizes: '32x32',
  },
  {
    rel: 'icon',
    href: '/favicon-16x16.png',
    type: 'image/png',
    sizes: '16x16',
  },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
  { rel: 'manifest', href: '/site.webmanifest' },
];

const DIST_ASSETS = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'apple-touch-icon.png',
  'favicon-192x192.png',
  'favicon-512x512.png',
  'site.webmanifest',
  'browserconfig.xml',
];

function pngSignature(file: string): number[] {
  return [...readFileSync(file).subarray(0, 8)];
}

describe('favicon assets (public/)', () => {
  it('keeps the raster source in public/', () => {
    const source = join(publicDir, 'favicon-source.png');
    expect(
      existsSync(source),
      'public/favicon-source.png must be committed',
    ).toBe(true);
    expect(statSync(source).size).toBeGreaterThan(100);
    expect(pngSignature(source)).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it('generates every favicon size from the source', () => {
    for (const name of DIST_ASSETS) {
      const file = join(publicDir, name);
      expect(existsSync(file), `${name} must exist in public/`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(0);
    }
  });

  it('site.webmanifest references self-hosted PNG icons', () => {
    const manifest = JSON.parse(
      readFileSync(join(publicDir, 'site.webmanifest'), 'utf8'),
    ) as {
      icons: { src: string; sizes: string; type: string }[];
      theme_color: string;
    };
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/favicon-\d+x\d+\.png$/);
      expect(icon.type).toBe('image/png');
      expect(existsSync(join(publicDir, icon.src.slice(1)))).toBe(true);
    }
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('favicon (built output)', () => {
  it.runIf(built)(
    'built index.html links every favicon asset from the app origin',
    () => {
      const html = readFileSync(indexHtml, 'utf8').replace(
        /<!--[\s\S]*?-->/g,
        '',
      );
      for (const link of FAVICON_LINKS) {
        const rel = link.rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const href = link.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(
          `<link[^>]+rel=["']${rel}["'][^>]+href=["']${href}["']|<link[^>]+href=["']${href}["'][^>]+rel=["']${rel}["']`,
          'i',
        );
        expect(
          html,
          `missing <link rel="${link.rel}" href="${link.href}">`,
        ).toMatch(re);
        expect(html).not.toMatch(
          new RegExp(`href=["']https?:\\/\\/${href.slice(1)}`, 'i'),
        );
      }
      expect(html).toMatch(/<meta[^>]+name=["']theme-color["']/i);
      expect(html).toMatch(/<meta[^>]+name=["']msapplication-config["']/i);

      const manifest = JSON.parse(
        readFileSync(join(distDir, 'site.webmanifest'), 'utf8'),
      ) as {
        theme_color: string;
      };
      const themeMeta =
        /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i.exec(
          html,
        );
      expect(themeMeta?.[1]).toBe(manifest.theme_color);
    },
  );

  it.runIf(built)('copies every favicon asset into dist/', () => {
    for (const name of DIST_ASSETS) {
      const file = join(distDir, name);
      expect(existsSync(file), `dist/${name} must exist`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(0);
    }
  });

  it.runIf(built)(
    'favicon PNGs are valid and ICO contains expected sizes',
    () => {
      for (const name of [
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
      ]) {
        expect(pngSignature(join(distDir, name))).toEqual([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
      }
      const ico = readFileSync(join(distDir, 'favicon.ico'));
      expect(ico.length).toBeGreaterThan(100);
      expect(ico[0]).toBe(0);
      expect(ico[1]).toBe(0);
    },
  );

  if (!built) {
    it('SKIPPED: dist not present — run `pnpm build` to enable the favicon audit', () => {
      expect(built).toBe(false);
    });
  }
});

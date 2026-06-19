import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const indexHtml = join(distDir, 'index.html');
const built = existsSync(indexHtml);

const OG_IMAGE_PATH = '/og-card.png';

describe('branded OG card (built output)', () => {
  it.runIf(built)('built index.html has the static Open Graph meta tags', () => {
    const html = readFileSync(indexHtml, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    expect(html).toMatch(/<meta[^>]+property=["']og:type["'][^>]+content=["']website["']/i);
    expect(html).toMatch(/<meta[^>]+property=["']og:title["'][^>]+content=["']portablemd["']/i);
    expect(html).toMatch(/<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']+["']/i);
    expect(html).toMatch(/<meta[^>]+property=["']og:site_name["']/i);
    expect(html).toMatch(
      new RegExp(`<meta[^>]+property=["']og:image["'][^>]+content=["']${OG_IMAGE_PATH}["']`, 'i'),
    );
  });

  it.runIf(built)('built index.html has the static Twitter card meta tags', () => {
    const html = readFileSync(indexHtml, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    expect(html).toMatch(
      /<meta[^>]+name=["']twitter:card["'][^>]+content=["']summary_large_image["']/i,
    );
    expect(html).toMatch(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']portablemd["']/i);
    expect(html).toMatch(/<meta[^>]+name=["']twitter:description["']/i);
    expect(html).toMatch(
      new RegExp(`<meta[^>]+name=["']twitter:image["'][^>]+content=["']${OG_IMAGE_PATH}["']`, 'i'),
    );
  });

  it.runIf(built)('the OG image is self-hosted: present in dist at the referenced path', () => {
    const png = join(distDir, 'og-card.png');
    expect(existsSync(png), 'dist/og-card.png must exist (copied from public/)').toBe(true);
    expect(statSync(png).size).toBeGreaterThan(1000);
    const head = readFileSync(png).subarray(0, 8);
    expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it.runIf(built)('the OG image path is root-relative, not an external origin', () => {
    const html = readFileSync(indexHtml, 'utf8');
    for (const m of html.matchAll(
      /<meta[^>]+(?:property=["']og:image["']|name=["']twitter:image["'])[^>]*>/gi,
    )) {
      expect(m[0]).not.toMatch(/content=["']https?:\/\//i);
      expect(m[0]).toContain(OG_IMAGE_PATH);
    }
  });

  it('the reviewable SVG source is kept in public/', () => {
    const svg = join(here, '..', 'public', 'og-card.svg');
    expect(existsSync(svg), 'public/og-card.svg source must be committed').toBe(true);
    const text = readFileSync(svg, 'utf8');
    const markup = text.replace(/<!--[\s\S]*?-->/g, '');
    const scannable = markup.replace(/xmlns=["']http:\/\/www\.w3\.org\/[^"']*["']/g, '');
    expect(scannable).not.toMatch(/https?:\/\//i);
    expect(markup).not.toMatch(/<image\b/i);
    expect(markup).not.toMatch(/@font-face|@import/i);
    expect(text).toMatch(/width="1200"/);
    expect(text).toMatch(/height="630"/);
  });

  if (!built) {
    it('SKIPPED: dist not present — run `pnpm build` to enable the OG card audit', () => {
      expect(built).toBe(false);
    });
  }
});

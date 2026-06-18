import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * issue-14 — Branded OG card. portablemd cannot generate per-Link previews
 * (the Document lives in the URL fragment, which no server sees — ADR 0002), so
 * the Open Graph / Twitter card is STATIC and identical for every Link, and the
 * image is self-hosted at the origin (no third-party request, ADR 0002).
 *
 * These assertions run against the BUILT output, so they prove the meta tags
 * survive the CSP plugin / HTML processing and the image is copied into dist.
 * If the app has not been built yet the tests skip (run `pnpm build`).
 */
const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const indexHtml = join(distDir, 'index.html');
const built = existsSync(indexHtml);

const OG_IMAGE_PATH = '/og-card.png';

describe('branded OG card (built output)', () => {
  it.runIf(built)('built index.html has the static Open Graph meta tags', () => {
    // Strip HTML comments — the doc-comment above the tags mentions og:* in prose.
    const html = readFileSync(indexHtml, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    expect(html).toMatch(/<meta[^>]+property=["']og:type["'][^>]+content=["']website["']/i);
    expect(html).toMatch(/<meta[^>]+property=["']og:title["'][^>]+content=["']portablemd["']/i);
    expect(html).toMatch(/<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']+["']/i);
    expect(html).toMatch(/<meta[^>]+property=["']og:site_name["']/i);
    // og:image must be the self-hosted, root-relative static card.
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
    // A real, non-trivial raster file — not an empty placeholder.
    expect(statSync(png).size).toBeGreaterThan(1000);
    // PNG magic number, so it is genuinely a raster image chat apps can unfurl.
    const head = readFileSync(png).subarray(0, 8);
    expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it.runIf(built)('the OG image path is root-relative, not an external origin', () => {
    // Only the image-URL tags (og:image / twitter:image), NOT the dimension/alt
    // siblings (og:image:width etc). They must stay self-hosted & root-relative.
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
    // Scan the MARKUP only — the design-note comment legitimately mentions
    // "http", "@font-face" etc. in prose, which must not trip the audit.
    const markup = text.replace(/<!--[\s\S]*?-->/g, '');
    // The SVG must carry no external NETWORK reference (ADR 0002). The SVG
    // namespace `xmlns="http://www.w3.org/2000/svg"` is a required XML
    // identifier (never fetched), so exclude it before scanning for http(s).
    const scannable = markup.replace(/xmlns=["']http:\/\/www\.w3\.org\/[^"']*["']/g, '');
    expect(scannable).not.toMatch(/https?:\/\//i);
    // No fetchable image refs and no external/embedded font infrastructure.
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

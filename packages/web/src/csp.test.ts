import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCsp, inlineScriptBodies } from './csp.js';

/**
 * Strict CSP (issue-13), defence-in-depth behind DOMPurify.
 *
 * jsdom/Vitest does NOT enforce CSP, so we verify the policy STRUCTURALLY
 * against the built `dist/index.html`:
 *   (a) the CSP <meta> exists with the required directives;
 *   (b) the inline no-flash theme script's SHA-256 — recomputed here from the
 *       script element's actual bytes — is present in `script-src` (proving the
 *       hash matches the script, so the browser would not block it);
 *   (c) `img-src` allows `data:` and `https:` (author images);
 *   (d) `style-src` permits inline styles (KaTeX/highlight injected <style>).
 *
 * The build must run first (root build runs before tests in CI; locally run
 * `pnpm build`). If dist is absent we skip with a loud reminder.
 */
const here = dirname(fileURLToPath(import.meta.url));
const distIndex = join(here, '..', 'dist', 'index.html');
const built = existsSync(distIndex);

/** Pull the `content="…"` of the CSP <meta http-equiv> out of the HTML. */
function extractCsp(rawHtml: string): string {
  // Strip comments: index.html documents the CSP in a comment containing the
  // literal `<meta http-equiv="Content-Security-Policy">` string.
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, '');
  const meta = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html);
  expect(meta, 'a CSP <meta http-equiv> must be present').not.toBeNull();
  // The CSP value itself contains single quotes ('self' etc.), so match a
  // double-quoted content attribute and allow single quotes inside it.
  const content = /content="([^"]+)"/i.exec(meta![0]);
  expect(content, 'the CSP <meta> must have a content attribute').not.toBeNull();
  return content![1]!;
}

/** Parse a CSP string into a directive -> source-list map. */
function parseCsp(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      continue;
    }
    map.set(tokens[0]!, tokens.slice(1));
  }
  return map;
}

describe('buildCsp (pure)', () => {
  it('always pins the strict baseline directives', () => {
    const csp = parseCsp(buildCsp([]));
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('connect-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    // No 'unsafe-inline' / 'unsafe-eval' in script-src.
    expect(csp.get('script-src')).toEqual(["'self'"]);
  });

  it('adds supplied inline-script hashes to script-src', () => {
    const csp = parseCsp(buildCsp(["'sha256-AAAA'", "'sha256-BBBB'"]));
    expect(csp.get('script-src')).toEqual(["'self'", "'sha256-AAAA'", "'sha256-BBBB'"]);
  });
});

describe.runIf(built)('CSP meta in built dist/index.html', () => {
  const html = built ? readFileSync(distIndex, 'utf8') : '';
  const cspString = built ? extractCsp(html) : '';
  const csp = parseCsp(cspString);

  it('default-src and connect-src are self (no exfiltration path)', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('connect-src')).toEqual(["'self'"]);
  });

  it('script-src has no unsafe-inline / unsafe-eval', () => {
    const scriptSrc = csp.get('script-src') ?? [];
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('img-src allows data: and https: (author-embedded images)', () => {
    const imgSrc = csp.get('img-src') ?? [];
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('https:');
  });

  it('style-src permits inline styles (KaTeX/highlight injected styles)', () => {
    const styleSrc = csp.get('style-src') ?? [];
    expect(styleSrc).toContain("'self'");
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it('hardens object-src/frame-src/base-uri', () => {
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
  });

  // The crux: the inline no-flash theme script's hash must match its bytes, or
  // the browser would block it and the page would flash the wrong theme.
  it("every inline script's SHA-256 is present in script-src (no-flash script allowed)", () => {
    const bodies = inlineScriptBodies(html);
    expect(bodies.length, 'the no-flash inline script must exist in built HTML').toBeGreaterThan(0);
    const scriptSrc = csp.get('script-src') ?? [];
    for (const body of bodies) {
      const digest = createHash('sha256').update(body, 'utf8').digest('base64');
      const token = `'sha256-${digest}'`;
      expect(
        scriptSrc,
        `inline script hash ${token} must be allow-listed in script-src`,
      ).toContain(token);
    }
  });

  it('the no-flash theme script is genuinely inline (sets data-theme synchronously)', () => {
    const bodies = inlineScriptBodies(html);
    const themeScript = bodies.find((b) => b.includes('documentElement.dataset.theme'));
    expect(themeScript, 'the no-flash theme script must be inline in <head>').toBeDefined();
    expect(themeScript).toContain('prefers-color-scheme: dark');
  });
});

if (!built) {
  describe('CSP audit (skipped — dist absent)', () => {
    it('SKIPPED: run `pnpm build` to enable the CSP audit', () => {
      expect(built).toBe(false);
    });
  });
}

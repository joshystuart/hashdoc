import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCsp, inlineScriptBodies, renderNetlifyHeaders, securityHeaders } from './csp.js';

const here = dirname(fileURLToPath(import.meta.url));
const distIndex = join(here, '..', 'dist', 'index.html');
const distHeaders = join(here, '..', 'dist', '_headers');
const built = existsSync(distIndex);

function extractCsp(rawHtml: string): string {
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, '');
  const meta = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html);
  expect(meta, 'a CSP <meta http-equiv> must be present').not.toBeNull();
  const content = /content="([^"]+)"/i.exec(meta![0]);
  expect(content, 'the CSP <meta> must have a content attribute').not.toBeNull();
  return content![1]!;
}

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
    expect(csp.get('script-src')).toEqual(["'self'"]);
  });

  it('adds supplied inline-script hashes to script-src', () => {
    const csp = parseCsp(buildCsp(["'sha256-AAAA'", "'sha256-BBBB'"]));
    expect(csp.get('script-src')).toEqual(["'self'", "'sha256-AAAA'", "'sha256-BBBB'"]);
  });
});

describe('securityHeaders (response headers — clickjacking & sniffing defenses)', () => {
  it('denies framing via both frame-ancestors and X-Frame-Options', () => {
    const headers = securityHeaders();
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('pins nosniff, no-referrer, COOP, and HSTS', () => {
    const headers = securityHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d+/);
  });

  it('renders a static-host _headers file applying to every path', () => {
    const rendered = renderNetlifyHeaders(securityHeaders());
    expect(rendered.startsWith('/*\n')).toBe(true);
    expect(rendered).toMatch(/^ {2}X-Frame-Options: DENY$/m);
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

  it('emits a static-host _headers file with clickjacking + sniffing defenses', () => {
    expect(existsSync(distHeaders), 'dist/_headers must be emitted by the build').toBe(true);
    const text = readFileSync(distHeaders, 'utf8');
    expect(text).toMatch(/X-Frame-Options: DENY/);
    expect(text).toMatch(/X-Content-Type-Options: nosniff/);
    expect(text).toMatch(/frame-ancestors 'none'/);
  });

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

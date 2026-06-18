import { createHash } from 'node:crypto';

/**
 * Strict Content-Security-Policy helpers (issue-13), defence-in-depth behind
 * DOMPurify.
 *
 * These are dependency-free (only `node:crypto`) so they can be imported by BOTH
 * the Vite build plugin (vite.config.ts) and the Vitest suite (csp.test.ts)
 * without dragging the Vite/esbuild toolchain into the jsdom test runtime. The
 * build plugin and the test therefore hash the SAME bytes via the SAME code.
 *
 * portablemd makes ZERO third-party requests (ADR 0002): every font/asset is
 * bundled and self-hosted, nothing is fetched cross-origin, and the document
 * payload never leaves the browser. The CSP encodes that as policy so a future
 * regression (a CDN font, an external script, an exfiltrating `fetch`) is
 * blocked by the browser rather than shipping silently.
 *
 * THE INLINE SCRIPT HASH (the crux): a `<meta http-equiv>` CSP supports hashes
 * but NOT nonces (nonces require an HTTP response header). To keep `script-src
 * 'self'` strict yet still allow the no-flash inline theme script, we hash the
 * EXACT bytes of that inline script and add `'sha256-<base64>'` to `script-src`.
 * {@link inlineScriptBodies} extracts those bytes from the HTML and
 * {@link inlineScriptHash} hashes them, so the hash can never drift from the
 * script: if the script text changes, the hash regenerates on the next build.
 */

/**
 * Extract the body of every executable inline `<script>` (one with NO `src=`)
 * from an HTML string. HTML comments are stripped first so a comment that merely
 * mentions `<script>` (e.g. CSP documentation) is never mistaken for a real
 * script. Shared by the plugin and the CSP test so both hash the SAME bytes.
 */
export function inlineScriptBodies(html: string): string[] {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const bodies: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutComments)) !== null) {
    const attrs = match[1] ?? '';
    if (/\bsrc\s*=/.test(attrs)) {
      continue; // external script — covered by script-src 'self'.
    }
    const body = match[2] ?? '';
    if (body.length > 0) {
      bodies.push(body);
    }
  }
  return bodies;
}

/** Inline-script SHA-256 in the exact form CSP expects: `'sha256-<base64>'`. */
export function inlineScriptHash(scriptBody: string): string {
  const digest = createHash('sha256').update(scriptBody, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

/**
 * Build the CSP header value, given the inline-script hashes that must be
 * allowed. Single source of truth so the test suite can reconstruct and
 * validate it against the built HTML.
 *
 * - `default-src 'self'`               — nothing loads cross-origin by default.
 * - `script-src 'self' <hashes>`       — our bundle plus the hashed inline
 *                                        no-flash script. NO 'unsafe-inline'.
 * - `style-src 'self' 'unsafe-inline'` — KaTeX/highlight.js inject <style>/style
 *                                        attributes; the PRD permits this.
 * - `img-src 'self' data: https:`      — author-embedded images may be data: or
 *                                        remote https: (Document content only).
 * - `font-src 'self'`                  — KaTeX fonts are bundled/self-hosted.
 * - `connect-src 'self'`               — no cross-origin fetch/XHR/WebSocket;
 *                                        the fragment can never be exfiltrated.
 * - `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`,
 *   `form-action 'self'`               — close plugin/frame/<base>/form vectors.
 */
export function buildCsp(scriptHashes: readonly string[]): string {
  const scriptSrc = ["'self'", ...scriptHashes].join(' ');
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
}

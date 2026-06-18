import { defineConfig, type Plugin } from 'vite';
import { buildCsp, inlineScriptBodies, inlineScriptHash } from './src/csp.js';

/**
 * Strict Content-Security-Policy (issue-13), defence-in-depth behind DOMPurify.
 * The policy itself and the inline-script hashing live in `src/csp.ts` (a
 * dependency-free module shared with the CSP test). This plugin wires that into
 * the HTML at build/serve time.
 */

/** Marker the source index.html uses for the plugin to replace with the CSP meta. */
const CSP_PLACEHOLDER = '<!--PORTABLEMD_CSP-->';

/**
 * Vite plugin: compute the SHA-256 of every inline <script> in index.html and
 * inject a strict CSP <meta> (with those hashes in script-src) where the
 * placeholder sits. Runs for both `vite serve` and `vite build`, so dev and the
 * built output enforce the same policy and the hash always matches the actual
 * inline-script bytes.
 */
function strictCspPlugin(): Plugin {
  return {
    name: 'portablemd-strict-csp',
    transformIndexHtml: {
      // Run AFTER Vite injects its own tags so we hash the final inline scripts.
      order: 'post',
      handler(html) {
        const hashes = inlineScriptBodies(html).map(inlineScriptHash);
        const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(hashes)}" />`;
        if (html.includes(CSP_PLACEHOLDER)) {
          return html.replace(CSP_PLACEHOLDER, meta);
        }
        // Fallback: insert right after <head> if the marker is missing.
        return html.replace(/<head>/i, `<head>\n    ${meta}`);
      },
    },
  };
}

export default defineConfig({
  // Build to a relative base so the app works from any path on a static host.
  base: './',
  plugins: [strictCspPlugin()],
  // Preact JSX via the automatic runtime. The Editor uses .tsx; esbuild needs
  // to know which runtime to import the JSX helpers from.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  build: {
    outDir: 'dist',
    // Everything must be bundled locally — zero third-party requests (ADR 0002).
    assetsInlineLimit: 0,
  },
});

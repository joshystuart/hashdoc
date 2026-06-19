import { defineConfig, type Plugin } from 'vite';
import { buildCsp, inlineScriptBodies, inlineScriptHash } from './src/csp.js';

const CSP_PLACEHOLDER = '<!--OPENARTIFACT_CSP-->';

function strictCspPlugin(): Plugin {
  return {
    name: 'openartifact-strict-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        let out = html.replace(
          /(<meta[^>]+(?:og:image|twitter:image)["'][^>]+content=["'])\.?\/og-card\.png(["'])/gi,
          '$1/og-card.png$2',
        );
        const hashes = inlineScriptBodies(out).map(inlineScriptHash);
        const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(hashes)}" />`;
        if (out.includes(CSP_PLACEHOLDER)) {
          return out.replace(CSP_PLACEHOLDER, meta);
        }
        return out.replace(/<head>/i, `<head>\n    ${meta}`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [strictCspPlugin()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});

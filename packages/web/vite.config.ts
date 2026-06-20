import { defineConfig, type Plugin } from 'vite';
import {
  buildCsp,
  inlineScriptBodies,
  inlineScriptHash,
  renderNetlifyHeaders,
  securityHeaders,
} from './src/csp.js';

const CSP_PLACEHOLDER = '<!--HASHDOC_CSP-->';

function securityHeadersPlugin(): Plugin {
  const headers = securityHeaders();
  return {
    name: 'HashDoc-security-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: renderNetlifyHeaders(headers),
      });
    },
  };
}

function strictCspPlugin(): Plugin {
  return {
    name: 'HashDoc-strict-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        let out = html.replace(
          /(<meta[^>]+(?:og:image|twitter:image)["'][^>]+content=["'])\.?\/og-card\.png(["'])/gi,
          '$1/og-card.png$2',
        );
        out = out.replace(
          /(<link[^>]+href=["'])\.\/(favicon[^"']*|apple-touch-icon\.png|site\.webmanifest)(["'])/gi,
          '$1/$2$3',
        );
        out = out.replace(
          /(<meta[^>]+name=["']msapplication-config["'][^>]+content=["'])\.\/(browserconfig\.xml)(["'])/gi,
          '$1/$2$3',
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
  plugins: [strictCspPlugin(), securityHeadersPlugin()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});

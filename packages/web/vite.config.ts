import { defineConfig } from 'vite';

export default defineConfig({
  // Build to a relative base so the app works from any path on a static host.
  base: './',
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

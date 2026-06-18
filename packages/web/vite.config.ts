import { defineConfig } from 'vite';

export default defineConfig({
  // Build to a relative base so the app works from any path on a static host.
  base: './',
  build: {
    outDir: 'dist',
    // Everything must be bundled locally — zero third-party requests (ADR 0002).
    assetsInlineLimit: 0,
  },
});

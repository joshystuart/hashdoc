// One-shot OG card rasterizer (issue-14).
//
// portablemd ships a STATIC 1200x630 Open Graph / Twitter card (per-Link
// previews are impossible — the Document lives in the URL fragment which no
// server sees, ADR 0002). Chat apps want a raster image, so we rasterize the
// reviewable SVG source (public/og-card.svg) to public/og-card.png and COMMIT
// the PNG. `pnpm build` does NOT run this — the committed PNG is what ships, so
// the production build never depends on the rasterizer.
//
// Run manually after editing the SVG:  node scripts/build-og-card.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const svg = readFileSync(join(publicDir, 'og-card.svg'), 'utf8');

const resvg = new Resvg(svg, {
  // Fix the output to the canonical OG size regardless of SVG attrs.
  fitTo: { mode: 'width', value: 1200 },
  // Use the OS font set so the web-safe system stack in the SVG renders.
  font: { loadSystemFonts: true },
  background: '#ffffff',
});

const png = resvg.render().asPng();
const out = join(publicDir, 'og-card.png');
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);

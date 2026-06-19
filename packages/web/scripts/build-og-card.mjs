import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const svg = readFileSync(join(publicDir, 'og-card.svg'), 'utf8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true },
  background: '#ffffff',
});

const png = resvg.render().asPng();
const out = join(publicDir, 'og-card.png');
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);

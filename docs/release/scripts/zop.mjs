import { readFileSync } from 'node:fs';
import zop from '@gfx/zopfli';
import { buildContainer, padStream } from '../../tools/pack/container.mjs';
import { inflate } from '../../tools/pack/deflate.mjs';
const js = Buffer.from(readFileSync('dist/app.js', 'utf8'));
const deflateAsync = zop.deflateAsync ?? zop.default?.deflateAsync;
const its = process.argv.slice(2).map(Number);
for (const n of its) for (const m of [0, 15, 30]) {
  const t = Date.now();
  const z = await deflateAsync(js, { numiterations: n, blocksplitting: true, blocksplittingmax: m });
  const f = buildContainer(padStream(z, inflate), 'utf16').length;
  console.log(n, m, z.length, f, (Date.now() - t) + 'ms');
}

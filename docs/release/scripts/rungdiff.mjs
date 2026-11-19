// Differing pixels between each rung's shots and the previous rung's (the same view).
import { existsSync, readFileSync } from 'node:fs';
import { decodePng, diffImages } from '../../scripts/lib/png.mjs';
const dir = 'shots/T14/ladder';
for (let k = 1; k <= 14; k++) {
  const a = `r${String(k - 1).padStart(2, '0')}`, b = `r${String(k).padStart(2, '0')}`;
  const out = [];
  for (const v of ['skyline', 'street', 'tour']) {
    const pa = `${dir}/${a}_${v}.png`, pb = `${dir}/${b}_${v}.png`;
    if (!existsSync(pb)) continue;
    const d = diffImages(decodePng(readFileSync(pa)), decodePng(readFileSync(pb)));
    out.push(`${v} ${d.differing ?? d.count ?? JSON.stringify(d)}`);
  }
  if (out.length) console.log(`${b} vs ${a}: ${out.join('  ')}`);
}

// npm run steady: the car lights must not blink in step on a rasteriser with a coarse depth
// interpolator. Renders six consecutive tour frames (1/60 s apart, no post) with Chromium's
// software rasteriser, counts the near-white pixels over the road ahead, and fails when that count
// changes by more than 5% a frame on average.
//
// Why: the ground is one quad 80 km wide. With its interpolated depth, SwiftShader put it metres too
// near at a few hundred metres, differently every frame, which cut every headlight sprite to a
// sliver in alternate frames: 989 1185 970 1217 1202 1208 near-white pixels, 12% change a frame.
// The RTX 4070 SUPER under D3D11 never showed it (1.7%). With the ground at a constant depth
// (src/backdrop/ground.glsl) both give about 1.5% (plans/T15-playtest-fixes.md).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/bundle.mjs';
import { decodePng } from './lib/png.mjs';

const FRAMES = 6;
const LIMIT = 5;
const dir = join(ROOT, '.tmp', 'steady');
mkdirSync(dir, { recursive: true });
const mode = process.argv.includes('--gpu') ? 'gpu' : 'software';
const shot = spawnSync(process.execPath, [join(ROOT, 'scripts', 'shot.mjs'), '--layers', 'all', '--tour', '1', '--t', '20',
  '--frames', String(FRAMES), '--dt', '0.0166667', '--size', '1280x720', '--post', '0', '--mode', mode, '--out', join(dir, 'f.png')],
  { encoding: 'utf8' });
if (shot.status !== 0) {
  console.log(shot.stdout + shot.stderr);
  console.log('STEADY FAILED: the frames could not be rendered');
  process.exit(1);
}
console.log(shot.stdout.split(/\r?\n/).find((l) => l.startsWith('renderer')) ?? '');
const counts = [];
for (let i = 0; i < FRAMES; i++) {
  const { width, data } = decodePng(readFileSync(join(dir, `f_${i}.png`)));
  let white = 0;
  for (let y = 330; y < 530; y++) for (let x = 480; x < 800; x++) {
    const o = (y * width + x) * 4;
    if (Math.min(data[o], data[o + 1], data[o + 2]) > 170) white++;
  }
  counts.push(white);
}
const mean = counts.reduce((a, b) => a + b) / FRAMES;
let change = 0;
for (let i = 1; i < FRAMES; i++) change += Math.abs(counts[i] - counts[i - 1]);
const percent = change / (FRAMES - 1) / mean * 100;
const ok = mean > 300 && percent < LIMIT;
console.log(`near-white pixels over the road, frame by frame: ${counts.join(' ')}   mean change ${percent.toFixed(1)}% (limit ${LIMIT}%)`);
console.log(ok ? 'STEADY OK' : 'STEADY FAILED');
process.exit(ok ? 0 : 1);

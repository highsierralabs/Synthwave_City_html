// npm run smoke: the shipped file boots from file:// on the real GPU, reports no errors, draws a
// non-empty frame and holds a frame-time budget (architecture.md section 13).
//
//   node scripts/smoke.mjs [--no-build] [--file dist/synthwave-city.html] [--seconds 5]
//                          [--size 1920x1080] [--budget 18] [--out shots/smoke.png] [--mode gpu|software]
//
// Frame time is the requestAnimationFrame interval, as a viewer sees it (never uncapped): every interval
// over --seconds is recorded after a 2.5 s settle, and the 95th percentile is held against --budget
// (ms). On a 60 Hz display a frame that keeps up measures about 16.7 ms, so the default budget is
// 18 ms: one missed vsync in twenty fails it. Measure on an idle machine; other agents' GPU work
// inflates the numbers.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { build } from './build.mjs';
import { ROOT } from './lib/bundle.mjs';
import { fileUrl, isHardware, launch, parseArgs, watchConsole } from './lib/browser.mjs';
import { decodePng, formatStats, imageStats } from './lib/png.mjs';

const args = parseArgs(process.argv.slice(2));
const file = resolve(String(args.file ?? join(ROOT, 'dist', 'synthwave-city.html')));
const seconds = Number(args.seconds ?? 5);
const budget = Number(args.budget ?? 18);
const mode = String(args.mode ?? 'gpu');
const [width, height] = String(args.size ?? '1920x1080').split('x').map(Number);
const out = resolve(String(args.out ?? 'shots/smoke.png'));
mkdirSync(dirname(out), { recursive: true });

let failed = false;
const fail = (message) => { console.log(`FAIL: ${message}`); failed = true; };

if (!args['no-build'] && !args.file) await build();
const browser = await launch(mode);
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const log = watchConsole(page);
  const t0 = Date.now();
  await page.goto(fileUrl(file), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 20000 });
  console.log(`file: ${file}\ncanvas after ${Date.now() - t0} ms`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const rec = (window.__rec = { d: [], last: 0 });
    const tick = (ts) => {
      if (rec.last) rec.d.push(ts - rec.last);
      rec.last = ts;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(seconds * 1000);
  const frame = await page.evaluate(() => {
    const d = [...window.__rec.d].sort((a, b) => a - b);
    const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0;
    return { n: d.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: d[d.length - 1] ?? 0, long: d.filter((x) => x > 50).length };
  });
  const renderer = await page.evaluate(() => {
    const g = document.createElement('canvas').getContext('webgl2');
    const d = g && g.getExtension('WEBGL_debug_renderer_info');
    return g ? String(d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'no WebGL2';
  });
  const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return `${c.width}x${c.height}`; });
  const errors = await page.evaluate(() => window.__E ?? []);
  const png = await page.screenshot({ path: out });
  const stats = imageStats(decodePng(png));
  console.log(`renderer: ${renderer}`);
  console.log(`canvas ${canvas}   frames ${frame.n} in ${seconds} s, rAF intervals (headless frame clock): median ${frame.p50.toFixed(1)} ms   p95 ${frame.p95.toFixed(1)}   p99 ${frame.p99.toFixed(1)}   worst ${frame.max.toFixed(1)}   over 50 ms: ${frame.long}`);
  console.log(`image ${formatStats(stats)}`);
  console.log(`screenshot: ${out}`);
  for (const e of errors) fail(`shader error: ${e.trim()}`);
  for (const e of log.errors) fail(`console error: ${e.slice(0, 600)}`);
  for (const w of log.warnings.slice(0, 10)) console.log(`console warning: ${w.slice(0, 300)}`);
  if (stats.mean < 2) fail('the frame is black');
  if (stats.clipped > 0.5) fail('more than half the frame is clipped white');
  if (stats.transparent > 0) fail('the frame has transparent pixels (the final pass must write alpha 1)');
  if (frame.n < 10) fail('almost no frames were drawn');
  if (mode === 'gpu' && frame.p95 > budget) fail(`95th percentile frame time ${frame.p95.toFixed(1)} ms is over the ${budget} ms budget`);
  if (mode === 'gpu' && !isHardware(renderer)) fail('not a hardware GPU; the frame time means nothing');
} catch (error) {
  fail(error.message.split('\n')[0]);
} finally {
  await browser.close();
}
console.log(failed ? 'SMOKE FAILED' : 'SMOKE OK');
process.exit(failed ? 1 : 0);

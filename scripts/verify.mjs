// npm run verify: the packed build draws the same pixels as the unminified sources (R5, D-10).
//
// One harness entry with every product layer, post and the probe is built twice:
//   reference  esbuild only (DEV=false), shaders as written, a plain page with a script file;
//   packed     the full product pipeline: shaders minified with one name map, terser (best set),
//              tools/pack utf16 container.
// Both are opened from file:// on the GPU at several cameras, times, qualities and moods, and every
// pixel is compared. Any difference fails. A reference frame that is black fails too: comparing two
// empty frames proves nothing.
//
//   node scripts/verify.mjs [--layers all] [--no-rename] [--sabotage] [--keep] [--size 960x540]
//
// --sabotage breaks one shader rename on purpose (lib/bundle.mjs) to show the gate can fail.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFile } from './build.mjs';
import { bundle, pageFor, parseLayers, scratchDir, writeEntry } from './lib/bundle.mjs';
import { fileUrl, launch, parseArgs, watchConsole } from './lib/browser.mjs';
import { decodePng, diffImages, formatStats, imageStats } from './lib/png.mjs';

const args = parseArgs(process.argv.slice(2));
// Product layers only: the probe draws flat boxes at the same depth as the buildings and would
// hide them from the comparison (T05).
const layers = parseLayers(args.layers ?? 'all');
const [width, height] = String(args.size ?? '960x540').split('x').map(Number);
const VIEWS = [
  'view=high&t=5&q=2&mood=0',
  'view=street&t=12.25&q=2&mood=1',
  'cam=1900,90,700,2.2,-0.05&t=301.5&q=1&mood=2',
  'view=top&t=60&q=0&mood=0',
];

const dir = scratchDir('verify');
let failed = false;
const fail = (m) => { console.log(`FAIL: ${m}`); failed = true; };
let browser;
try {
  const entry = writeEntry(dir, layers);
  writeFileSync(join(dir, 'reference.js'), await bundle({ entry, dev: false }));
  writeFileSync(join(dir, 'reference.html'), pageFor('reference.js'));
  const packed = await buildFile({ entry, rename: !args['no-rename'], withDev: true, sabotage: !!args.sabotage, safe: false });
  writeFileSync(join(dir, 'packed.html'), packed.main.html);
  console.log(`layers: ${layers.join(', ')}`);
  console.log(`packed harness: ${packed.main.html.length} bytes (${packed.main.container}, terser ${packed.best.name}); reference script ${packed.bundled.length} chars`);

  browser = await launch('gpu');
  const shoot = async (name, hash) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const log = watchConsole(page);
    try {
      await page.goto(fileUrl(join(dir, name), hash), { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => !!window.__READY, null, { timeout: 60000 });
      await page.waitForTimeout(200);
      const png = await page.screenshot();
      const errors = [...(await page.evaluate(() => window.__E ?? [])), ...log.errors];
      return { img: decodePng(png), png, errors };
    } finally {
      await page.close();
    }
  };
  for (const hash of VIEWS) {
    const ref = await shoot('reference.html', hash);
    const got = await shoot('packed.html', hash);
    const d = diffImages(ref.img, got.img);
    const s = imageStats(ref.img);
    console.log(`${d.differing === 0 ? 'same' : 'DIFF'}  #${hash}\n      differing pixels ${d.differing}/${d.total}, max channel diff ${d.maxDiff};  reference ${formatStats(s)}`);
    for (const e of ref.errors) fail(`reference error: ${e.trim().slice(0, 300)}`);
    for (const e of got.errors) fail(`packed error: ${e.trim().slice(0, 300)}`);
    if (d.differing > 0) {
      fail(`packed frame differs at #${hash}`);
      if (args.keep) {
        writeFileSync(join(dir, `ref-${VIEWS.indexOf(hash)}.png`), ref.png);
        writeFileSync(join(dir, `packed-${VIEWS.indexOf(hash)}.png`), got.png);
      }
    }
    if (s.mean < 2 || s.colours < 16) fail(`reference frame at #${hash} is nearly empty; the comparison proves nothing`);
  }
} catch (error) {
  fail(error.message.split('\n')[0]);
} finally {
  if (browser) await browser.close();
  if (args.keep) console.log(`kept ${dir}`);
  else rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? 'VERIFY FAILED' : 'VERIFY OK');
process.exit(failed ? 1 : 0);

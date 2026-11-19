// Screenshots of the unminified sources on the real GPU. Self-contained: bundles the harness with the
// layers you name into .tmp/shot/<run>/, opens it from disk (file://) in the cached Chromium,
// prints the renderer, console errors and warnings, shader logs (window.__E) and image statistics,
// and writes PNGs. No server, so any number of agents can run it at once.
//
//   node scripts/shot.mjs --layers backdrop,buildings --cam 2048,180,2048,0.6,-0.15 --t 12 --out shots/T05/a.png
//
//   --layers a,b      layers to include: src/<name> or dev/<name> (probe); `all` = every product layer + post
//   --cam x,y,z,yaw,pitch[,roll,fov]   camera pose (default: --view high)
//   --view name       street | high | far | top | edge (dev/harness.ts, VIEWS)
//   --t seconds       time of the (first) frame; time is frozen (default 10)
//   --q 0|1|2         quality (default 2)          --mood n   0 sunset, 1 midnight, 2 miami
//   --post 0          leave post out (the engine's plain blit shows the scene)
//   --size WxH        viewport in CSS pixels, device scale 1 (default 1600x900; keep <= 1920 wide)
//   --frames N        a sequence of N frames: files name_0.png .. name_N-1.png
//   --dt s            time step between frames (default 0)
//   --move dx,dy,dz   camera step per frame in metres (default none)
//   --tour 1          include src/camera and let it drive (its update writes P)
//   --app 1           shoot the unminified src/main.ts instead of the harness (runs live;
//                     --frames N --dt s then waits dt seconds of real time between shots)
//   --wait ms         extra wait before the first capture (default 300; app default 2500)
//   --mode gpu|software|nowebgl   (default gpu)
//   --keep 1          keep the bundle in .tmp/shot/ for inspection
//   --out path.png    (default shots/shot.png)
//
// Exits 1 if the page reported an error, a shader failed, or a capture failed.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { bundle, pageFor, parseLayers, ROOT, scratchDir, writeEntry } from './lib/bundle.mjs';
import { fileUrl, isHardware, launch, parseArgs, watchConsole } from './lib/browser.mjs';
import { decodePng, formatStats, imageStats } from './lib/png.mjs';

const args = parseArgs(process.argv.slice(2));
if (process.argv.length <= 2) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const app = args.app === '1' || args.app === true;
const layers = parseLayers(args.layers);
const tour = args.tour === '1' || args.tour === true;
const [width, height] = String(args.size ?? '1600x900').split('x').map(Number);
const frames = Number(args.frames ?? 1);
const dt = Number(args.dt ?? 0);
const t0 = Number(args.t ?? 10);
const move = args.move ? String(args.move).split(',').map(Number) : [0, 0, 0];
const out = resolve(String(args.out ?? 'shots/shot.png'));
mkdirSync(dirname(out), { recursive: true });

const hash = [
  args.cam ? `cam=${args.cam}` : `view=${args.view ?? 'high'}`,
  `t=${t0}`,
  `q=${args.q ?? 2}`,
  `mood=${args.mood ?? 0}`,
  args.post !== undefined ? `post=${args.post}` : '',
  tour ? 'tour=1' : '',
].filter(Boolean).join('&');

const dir = scratchDir('shot');
let failed = false;
const lines = [];
let browser;
try {
  const entry = app ? join(ROOT, 'src', 'main.ts') : writeEntry(dir, layers, { tour });
  const js = await bundle({ entry, dev: true });
  writeFileSync(join(dir, 'app.js'), js);
  writeFileSync(join(dir, 'index.html'), pageFor('app.js'));

  browser = await launch(String(args.mode ?? 'gpu'));
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const log = watchConsole(page);
  await page.goto(fileUrl(join(dir, 'index.html'), app ? '' : hash), { waitUntil: 'load', timeout: 60000 });
  if (!app) await page.waitForFunction(() => !!window.__READY, null, { timeout: 60000 });
  await page.waitForTimeout(Number(args.wait ?? (app ? 2500 : 300)));

  for (let i = 0; i < frames; i++) {
    if (i > 0) {
      if (app) await page.waitForTimeout(dt * 1000);
      else await page.evaluate(([t, x, y, z]) => window.__H.step(t, x, y, z), [t0 + i * dt, move[0], move[1], move[2]]);
    }
    const file = frames > 1 ? out.replace(/\.png$/i, `_${i}.png`) : out;
    const png = await page.screenshot({ path: file });
    let pose = '';
    if (!app) {
      const info = await page.evaluate(() => window.__H.info());
      pose = `  pose ${info.pose.join(',')}  draws ${info.draws}  instances ${info.instances}  cpu ${info.ms} ms`;
    }
    lines.push(`wrote ${file}  ${formatStats(imageStats(decodePng(png)))}${pose}`);
  }

  if (app) {
    const renderer = await page.evaluate(() => {
      const g = document.createElement('canvas').getContext('webgl2');
      const d = g && g.getExtension('WEBGL_debug_renderer_info');
      return g ? String(d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'no WebGL2';
    });
    lines.push(`renderer: ${renderer}`);
    lines.push(`app: src/main.ts, unminified, live loop`);
  } else {
    const info = await page.evaluate(() => window.__H.info());
    lines.push(`renderer: ${info.renderer}${isHardware(info.renderer) ? '' : '   WARNING: not a hardware GPU; frame times mean nothing'}`);
    lines.push(`layers: ${info.layers.join(', ') || '(none)'}   scene ${info.scene}   boxes ${info.boxes}   megas ${info.megas}   hash #${hash}`);
  }
  const errors = await page.evaluate(() => window.__E ?? []);
  for (const e of errors) { lines.push(`SHADER ERROR: ${e.trim()}`); failed = true; }
  for (const e of log.errors) { lines.push(`CONSOLE ERROR: ${e.slice(0, 800)}`); failed = true; }
  for (const w of log.warnings.slice(0, 20)) lines.push(`console warning: ${w.slice(0, 400)}`);
} catch (error) {
  lines.push(`shot failed: ${error.message.split('\n')[0]}`);
  failed = true;
} finally {
  if (browser) await browser.close();
  if (!args.keep) rmSync(dir, { recursive: true, force: true });
}
for (const line of lines) console.log(line);
process.exit(failed ? 1 : 0);

// npm run input: the camera's pointer listeners, driven by real mouse and touch events in Chromium.
// Bundles dev/input/index.ts (src/camera on a plain element, stepped by hand at 60 steps a second)
// into .tmp/input/, opens it from disk and checks what each gesture does to the pose:
// the drag direction on the tour and in free flight, one finger flying, two boosting, a mouse press
// only looking, and the hand-over when the steering finger lifts. Exits 1 on any failure.
// Added after the play test of 2026-11-19 (plans/T15-playtest-fixes.md).
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { bundle, pageFor, ROOT } from './lib/bundle.mjs';
import { fileUrl, launch } from './lib/browser.mjs';
const dir = join(ROOT, '.tmp', 'input');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'app.js'), await bundle({ entry: join(ROOT, 'dev', 'input', 'index.ts'), dev: true }));
writeFileSync(join(dir, 'index.html'), pageFor('app.js'));
const browser = await launch('gpu');
const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
const page = await ctx.newPage();
await page.goto(fileUrl(join(dir, 'index.html')));
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, x, y]) => ({ id, x, y })) });
const step = (n) => page.evaluate((n) => window.T.step(n), n);
const fwd = (a, b) => { const w = (v) => v - 4096 * Math.round(v / 4096); return w(b[0] - a[0]) * -Math.sin(b[3]) + w(b[2] - a[2]) * -Math.cos(b[3]); };
const f = (v) => v.toFixed(3);
let ok = true;
const check = (name, pass, detail) => { ok &&= pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${detail}`); };

// Tour, mouse: drag right, then down.
let a = await step(60);
await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(400, 300, { steps: 4 });
let b = await step(3);
check('tour, mouse drag right 100 px turns right (yaw falls)', b[3] - a[3] < -0.3, `yaw ${f(a[3])} -> ${f(b[3])}`);
await page.mouse.move(400, 400, { steps: 4 });
let c = await step(3);
check('tour, mouse drag down 100 px looks down (pitch falls)', c[4] - b[4] < -0.3, `pitch ${f(b[4])} -> ${f(c[4])}`);
await page.mouse.up();
// Free flight.
await page.evaluate(() => window.T.mode());
a = await step(240);
b = await step(60);
check('flight, nothing held: at rest', Math.abs(fwd(a, b)) < 1, `${f(fwd(a, b))} m in 1 s`);
await page.mouse.move(300, 300); await page.mouse.down();
a = await step(1); b = await step(60);
check('flight, mouse button held: looks only, does not fly', Math.abs(fwd(a, b)) < 1 && b[6] === 0, `${f(fwd(a, b))} m in 1 s, fingers ${b[6]}`);
await page.mouse.up();
await touch('touchStart', [[1, 300, 300]]);
a = await step(1); b = await step(60);
check('flight, one finger held: flies forward', fwd(a, b) > 15 && b[6] === 1, `${f(fwd(a, b))} m in 1 s, fingers ${b[6]}`);
await touch('touchMove', [[1, 400, 300]]);
c = await step(3);
check('flight, that finger dragged right 100 px turns right', c[3] - b[3] < -0.3, `yaw ${f(b[3])} -> ${f(c[3])}`);
await touch('touchStart', [[1, 400, 300], [2, 500, 400]]);
a = await step(120); b = await step(60);
check('flight, two fingers held: boost', fwd(a, b) > 100 && b[6] === 2, `${f(fwd(a, b))} m in 1 s, fingers ${b[6]}`);
await touch('touchEnd', []);
// One finger lifting while another stays: Chromium's scripted touch input cannot lift a single
// point, so this case sends pointer events straight to the element (setPointerCapture then throws
// for the made-up id, after the listener has done its work).
const ev = (type, id, x, y) => page.evaluate(([type, id, x, y]) => {
  try { document.querySelector('div').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); } catch {}
}, [type, id, x, y]);
await ev('pointerdown', 11, 300, 300); await ev('pointerdown', 12, 500, 400);
await ev('pointerup', 11, 300, 300);
a = await step(2);
await ev('pointermove', 12, 500, 400); await ev('pointermove', 12, 600, 400);
b = await step(3);
check('flight, first finger lifted: the remaining finger steers', b[3] - a[3] < -0.3 && b[6] === 1, `yaw ${f(a[3])} -> ${f(b[3])}, fingers ${b[6]}`);
await ev('pointerup', 12, 600, 400);
a = await step(240); b = await step(60);
check('flight, all lifted: counts back to zero and comes to rest', b[5] === 0 && b[6] === 0 && Math.abs(fwd(a, b)) < 1, `down ${b[5]}, fingers ${b[6]}, ${f(fwd(a, b))} m in 1 s`);
await browser.close();
console.log(ok ? 'INPUT OK' : 'INPUT FAILED');
process.exit(ok ? 0 : 1);

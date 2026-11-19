// Point 6 helper: open a packed file, start audio with a real (synthetic) click, and read what the
// page schedules and what the beat slots of the uniform block F carry, from WebGL bufferData calls.
//   node .tmp/T14/beat.mjs file.html [--phone]
import { resolve } from 'node:path';
import { fileUrl, launch } from '../../scripts/lib/browser.mjs';
const file = resolve(process.argv[2]);
const phone = process.argv.includes('--phone');
const browser = await launch('gpu', ['--autoplay-policy=user-gesture-required']);
const ctx = await browser.newContext(phone
  ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  window.__F = [];
  const bd = WebGL2RenderingContext.prototype.bufferData;
  WebGL2RenderingContext.prototype.bufferData = function (t, d, u) {
    if (t === 35345 && d && d.length === 64 && d[19] === 0 && window.__F.length < 4000) window.__F.push([performance.now(), d[22], d[23], d[48], d[49], d[50], d[52]]);
    return bd.call(this, t, d, u);
  };
  window.__notes = 0;
  for (const m of ['createOscillator', 'createBufferSource']) {
    const f = AudioContext.prototype[m] ?? BaseAudioContext.prototype[m];
    BaseAudioContext.prototype[m] = function (...a) { window.__notes++; return f.apply(this, a); };
  }
  const AC = window.AudioContext;
  window.__ac = null;
  window.AudioContext = function (...a) { const c = new AC(...a); window.__ac = c; return c; };
  window.AudioContext.prototype = AC.prototype;
});
await page.goto(fileUrl(file));
await page.waitForFunction(() => window.__F.length > 30, null, { timeout: 30000 });
const before = await page.evaluate(() => ({ notes: window.__notes, ac: !!window.__ac }));
if (phone) await page.touchscreen.tap(206, 400); else await page.mouse.click(640, 360);
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const t1 = performance.now() - 3000;
  const f = window.__F.filter((x) => x[0] > t1);
  const col = (i) => f.map((x) => x[i]);
  const range = (a) => [Math.min(...a), Math.max(...a)].map((v) => v.toFixed(3)).join('..');
  return { state: window.__ac?.state, rate: window.__ac?.sampleRate, notes: window.__notes, frames: f.length,
    beat: range(col(1)), pulse: range(col(2)), kick: range(col(3)), bass: range(col(4)), lead: range(col(5)), mood: range(col(6)),
    pulseHigh: col(2).filter((v) => v > 0.9).length };
});
console.log(`${file.split(/[\/]/).pop()}${phone ? ' (phone emulation: 412x915 @2.625, touch)' : ''}`);
console.log(`  before the gesture: AudioContext ${before.ac ? 'exists' : 'none'}, notes ${before.notes}`);
console.log(`  after: AudioContext ${r.state}, ${r.notes} sources started in 4 s; last 3 s: ${r.frames} main-pass uploads of F`);
console.log(`  F beat ${r.beat}  pulse ${r.pulse} (frames above 0.9: ${r.pulseHigh})  kick ${r.kick}  bass ${r.bass}  lead ${r.lead}  mood ${r.mood}`);
console.log(`  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
await browser.close();

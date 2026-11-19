// Time from navigation to the payload starting (eval) and to the first frame, under CPU throttling.
//   node .tmp/T14/startup.mjs runs file1 file2 ...
import { resolve } from 'node:path';
import { fileUrl, launch } from '../../scripts/lib/browser.mjs';
const runs = Number(process.argv[2]);
const files = process.argv.slice(3);
const rates = [1, 4, 6];
const browser = await launch('gpu');
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const renderer = await (async () => { const p = await browser.newPage(); const r = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(d.UNMASKED_RENDERER_WEBGL); }); await p.close(); return r; })();
console.log(`renderer: ${renderer}`);
{ const p = await browser.newPage(); await p.goto(fileUrl(resolve(files[0]))); await p.waitForTimeout(3000); await p.close(); }
for (const rate of rates) {
  for (const f of files) {
    const ev = [], fr = [], ld = [];
    for (let k = 0; k < runs; k++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.addInitScript(() => {
        const ev = window.eval;
        window.eval = function (code) { window.__tEval ||= performance.now(); return (0, ev)(code); };
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { if (window.__tEval && !window.__tFrame) window.__tFrame = performance.now(); cb(ts); });
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(fileUrl(resolve(f)), { waitUntil: 'load' });
      await page.waitForFunction(() => window.__tFrame && window.__H === undefined, null, { timeout: 60000 });
      const t = await page.evaluate(() => [window.__tEval, window.__tFrame, performance.getEntriesByType('navigation')[0]?.loadEventEnd ?? 0]);
      if (errors.length) console.log('errors', errors);
      ev.push(t[0]); fr.push(t[1]); ld.push(t[2]);
      await ctx.close();
    }
    console.log(`rate ${rate}x  ${f.split(/[\/]/).pop().padEnd(26)} unpacked (eval) median ${med(ev).toFixed(0)} ms [${ev.map((x) => x.toFixed(0)).join(' ')}]   first frame median ${med(fr).toFixed(0)} ms [${fr.map((x) => x.toFixed(0)).join(' ')}]`);
  }
}
await browser.close();

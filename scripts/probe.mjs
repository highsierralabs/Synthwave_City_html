// npm run probe: proves on the real GPU the WebGL2 assumptions the helper and the layers rely on
// (plans/T00-foundation.md, M1). Prints PASS or FAIL per item; exits 1 on any failure.
//
//   node scripts/probe.mjs [--minified] [--mode gpu|software]
//
// --minified runs the same page with every shader through tools/glslmin (one name map), which also
// shows that the minifier's output of common.glsl compiles.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundle, pageFor, ROOT, scratchDir } from './lib/bundle.mjs';
import { fileUrl, isHardware, launch, parseArgs, watchConsole } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
const dir = scratchDir('probe');
const js = await bundle({ entry: join(ROOT, 'dev', 'gltest', 'index.ts'), dev: true, glsl: args.minified ? { rename: true, withDev: true } : null });
writeFileSync(join(dir, 'probe.js'), js);
writeFileSync(join(dir, 'index.html'), pageFor('probe.js'));

const mode = String(args.mode ?? 'gpu');
const browser = await launch(mode);
let failed = 0;
try {
  const page = await browser.newPage();
  const log = watchConsole(page);
  await page.goto(fileUrl(join(dir, 'index.html')));
  await page.waitForFunction(() => Array.isArray(window.__PROBE), null, { timeout: 30000 });
  const results = await page.evaluate(() => window.__PROBE);
  const renderer = await page.evaluate(() => window.__PROBE_INFO);
  console.log(`renderer: ${renderer}${isHardware(renderer) ? '' : '   WARNING: not a hardware GPU'}`);
  console.log(`shaders: ${args.minified ? 'minified by tools/glslmin' : 'as written'}`);
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.item}\n      ${r.detail}`);
    if (!r.ok) failed++;
  }
  for (const e of log.errors) console.log(`CONSOLE ERROR: ${e.slice(0, 600)}`);
  for (const w of log.warnings) console.log(`console warning: ${w.slice(0, 300)}`);
  if (mode === 'gpu' && !isHardware(renderer)) failed++;
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `PROBE FAILED (${failed})` : 'PROBE OK');
process.exit(failed ? 1 : 0);

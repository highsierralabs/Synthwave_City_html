// npm run size [-- module ...]: the product build, then the marginal cost of every module against
// its plan's budget (architecture.md section 3.5).
//
// A module's marginal cost is the packed size of the full program minus the packed size of the same
// program with that module replaced by a stub generated from its export names. That is what cutting
// it would save, which is less than its share of the minified text because deflate shares context.
// The comparison builds use one terser set and fast raw deflate (tools/pack quickSize), so they rank
// and attribute; the first line is the real file from `npm run build`.
//
//   core       = everything stubbed except contracts, gl, engine and their shaders, minus the container
//   container  = the packed size of an empty program (T01's unpacker and container)
//
//   node scripts/size.mjs                 every module
//   node scripts/size.mjs street camera   only these (names: plan, backdrop, buildings, street, air,
//                                         lights, post, audio, camera, main)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, GATE } from './build.mjs';
import { bundle, freshImport, minifyJs, rel, ROOT } from './lib/bundle.mjs';
import { ownerOf, readPlans } from './lib/plans.mjs';

const MODULES = ['plan', 'backdrop', 'buildings', 'street', 'air', 'lights', 'post', 'audio', 'camera', 'main'];
const pathOf = (m) => join(ROOT, 'src', m === 'plan' ? 'plan.ts' : m === 'main' ? 'main.ts' : `${m}/index.ts`);
const fmt = (n) => (n === null || n === undefined ? '' : n.toLocaleString('en-US'));
const SET = 'A';

/** A stub with the same exports and no behaviour. main's stub keeps the boot sequence (boot, every
 *  init, run) so that stubbing it removes only the shell, not the program. */
export function stubFor(m, source) {
  if (m === 'main') {
    const layers = ['backdrop', 'buildings', 'street', 'air', 'lights', 'post'];
    return [
      `import { boot, run } from './engine';`,
      ...layers.map((l) => `import { init as ${l} } from './${l}/index';`),
      `import { cameraInit } from './camera/index';`,
      `const c = document.createElement('canvas'); document.body.append(c);`,
      `if (boot(c)) { ${layers.map((l) => `${l}();`).join(' ')} cameraInit(c); run(); }`,
    ].join('\n');
  }
  const out = [];
  for (const [, kind, name] of source.matchAll(/^export\s+(function|let|const)\s+([A-Za-z_$][\w$]*)/gm)) {
    out.push(kind === 'function' ? `export function ${name}(..._: any[]): any {}` : `export let ${name}: any = 0;`);
  }
  return out.join('\n') + '\n';
}

async function quick(stubbed) {
  const stubs = new Map();
  for (const m of stubbed) stubs.set(pathOf(m), stubFor(m, readFileSync(pathOf(m), 'utf8')));
  const js = await bundle({ entry: pathOf('main'), dev: false, glsl: { rename: true }, stubs });
  const [{ code }] = await minifyJs(js, [SET]);
  const { quickSize } = await freshImport('tools/pack/index.mjs');
  return quickSize(code);
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const w of wanted) if (!MODULES.includes(w)) { console.error(`unknown module "${w}"; one of: ${MODULES.join(', ')}`); process.exit(2); }
const rows = wanted.length ? wanted : MODULES;

const record = await build();
const plans = readPlans();
const budgetOf = (path) => { const p = ownerOf(plans, rel(path)); return p ? { id: p.id, budget: Number(p.budget) || null } : { id: '?', budget: null }; };

const full = await quick([]);
const table = [];
for (const m of rows) {
  if (!existsSync(pathOf(m))) continue;
  const cost = full - (await quick([m]));
  table.push({ name: m, cost, ...budgetOf(pathOf(m)) });
}
if (!wanted.length) {
  const { pack } = await freshImport('tools/pack/index.mjs');
  const empty = (await pack('', { container: 'utf16', level: 'max' })).html.length;
  const base = await quick(MODULES);
  table.unshift({ name: 'container', cost: empty, ...budgetOf(join(ROOT, 'tools', 'pack', 'index.mjs')) });
  table.unshift({ name: 'core', cost: base, ...budgetOf(join(ROOT, 'src', 'engine.ts')), note: 'contracts, gl, engine, common.glsl, engine.glsl (deflate only)' });
}

console.log(`\nmarginal cost per module (terser ${SET}, raw deflate level 9; full program ${fmt(full)} bytes deflated)`);
console.log(`${'module'.padEnd(11)}${'bytes'.padStart(8)}  ${'budget'.padStart(8)}  ${'plan'.padEnd(18)}`);
let sum = 0;
for (const r of table) {
  sum += r.cost;
  const over = r.budget && r.cost > r.budget ? '  OVER' : '';
  console.log(`${r.name.padEnd(11)}${fmt(r.cost).padStart(8)}  ${fmt(r.budget).padStart(8)}  ${r.id.padEnd(18)}${over}${r.note ? '  ' + r.note : ''}`);
}
console.log(`${'total'.padEnd(11)}${fmt(sum).padStart(8)}  (sum of rows; shared context makes it differ from the file)`);
console.log(`file       ${fmt(record.bytes).padStart(8)}  gate ${fmt(GATE)}`);

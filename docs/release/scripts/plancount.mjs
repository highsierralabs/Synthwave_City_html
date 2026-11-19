import * as esbuild from 'esbuild';
const r = await esbuild.build({ entryPoints: ['src/plan.ts'], bundle: true, format: 'esm', write: false, define: { DEV: 'false' } });
const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const c = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({ entryPoints: ['src/contracts.ts'], bundle: true, format: 'esm', write: false })).outputFiles[0].text).toString('base64'));
m.buildPlan(c.SEED);
const counts = [0, 0, 0, 0, 0];
for (let i = 0; i < m.cells.length; i += 4) counts[m.cells[i]]++;
const h = []; for (let i = 0; i < m.megaCount; i++) h.push(Math.round(m.megas[i * 3 + 2]));
console.log('seed', c.SEED, 'cells low/mid/high/plaza/mega', counts.join('/'), 'boxes', m.boxCount, 'megas', m.megaCount, 'heights', h.join(','));

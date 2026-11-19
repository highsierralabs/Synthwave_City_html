// npm run check: typecheck + unit tests + the import rules of section 4.2 + plans:check, whole repo.
// While siblings are running use `npm run check:task -- T##`, which reports only your paths.
import { spawnSync } from 'node:child_process';
import { importViolations } from './lib/imports.mjs';
import { plansCheck } from './plans-check.mjs';

const run = (cmd) => spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let failed = false;
const step = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '\n' + detail : ''}`);
  if (!ok) failed = true;
};

// Two projects: the product (DOM types only) and the tests (adds Node types). Both always run.
const tscRuns = ['tsconfig.json', 'tsconfig.tests.json'].map((p) => run(`npx tsc --noEmit --pretty false -p ${p}`));
const tsc = { status: tscRuns.some((r) => r.status !== 0) ? 1 : 0, stdout: tscRuns.map((r) => r.stdout + r.stderr).join('\n'), stderr: '' };
const tscLines = (tsc.stdout + tsc.stderr).trim();
step('typecheck', tsc.status === 0, tsc.status === 0 ? '' : tscLines.split(/\r?\n/).map((l) => '      ' + l).join('\n'));

const vt = run('npx vitest run');
const vtOut = (vt.stdout + vt.stderr).trim().split(/\r?\n/);
step('tests', vt.status === 0, (vt.status === 0 ? vtOut.filter((l) => /Test Files|Tests /.test(l)) : vtOut).map((l) => '      ' + l).join('\n'));

const imports = importViolations();
step('import rules', imports.length === 0, imports.map((v) => `      ${v.file}:${v.line} imports '${v.spec}': ${v.reason}`).join('\n'));

const plans = plansCheck();
const texts = [...new Set(plans.problems.map((p) => p.text))];
step('plans:check', texts.length === 0, texts.map((t) => '      ' + t).join('\n'));

console.log(failed ? 'CHECK FAILED' : 'CHECK OK');
process.exit(failed ? 1 : 0);

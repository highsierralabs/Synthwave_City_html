// npm run check:task -- T05: the repo gates, reported only for the paths one plan owns, so a
// half-written file in a sibling task cannot fail yours.
//   1. typecheck: the whole program is checked; only errors in owned files count
//   2. tests: the owned test folders that exist (tests/<x>/**)
//   3. import rules (section 4.2): only violations in owned files count
//   4. plans:check: problems of this plan, and overlaps that involve it
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { importViolations } from './lib/imports.mjs';
import { findPlan, ownedGlobs, ownsMatcher, readPlans } from './lib/plans.mjs';
import { plansCheck } from './plans-check.mjs';

const task = process.argv[2];
if (!task) {
  console.error('usage: npm run check:task -- T05');
  process.exit(2);
}
const plan = findPlan(readPlans(), task);
if (!plan) {
  console.error(`no plan found for ${task}`);
  process.exit(2);
}
const owned = ownsMatcher(plan);
const run = (cmd) => spawnSync(cmd, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let failed = false;

// Two projects: the product (DOM types only) and the tests (adds Node types). Both always run.
const tscRuns = ['tsconfig.json', 'tsconfig.tests.json'].map((p) => run(`npx tsc --noEmit --pretty false -p ${p}`));
const tsc = { status: tscRuns.some((r) => r.status !== 0) ? 1 : 0, stdout: tscRuns.map((r) => r.stdout + r.stderr).join('\n'), stderr: '' };
const errs = (tsc.stdout + tsc.stderr).split(/\r?\n/).filter((l) => /\(\d+,\d+\): error TS/.test(l));
const mine = errs.filter((l) => owned(l.slice(0, l.indexOf('('))));
console.log(`typecheck: ${mine.length} error(s) in ${plan.id}, ${errs.length - mine.length} elsewhere`);
for (const l of mine) console.log('  ' + l);
if (mine.length) failed = true;

const testRoots = [...new Set(ownedGlobs(plan).filter((g) => g.startsWith('tests/')).map((g) => g.replace(/\/\*\*$/, '')))].filter((p) => existsSync(p));
if (testRoots.length) {
  const vt = run(`npx vitest run ${testRoots.map((r) => `"${r}"`).join(' ')}`);
  const out = (vt.stdout + vt.stderr).trim().split(/\r?\n/);
  console.log(`tests: ${vt.status === 0 ? 'ok' : 'FAILED'} (${testRoots.join(', ')})`);
  console.log((vt.status === 0 ? out.filter((l) => /Test Files|Tests /.test(l)) : out).map((l) => '  ' + l).join('\n'));
  if (vt.status !== 0) failed = true;
} else console.log('tests: no owned test folder');

const imports = importViolations().filter((v) => owned(v.file));
console.log(`import rules: ${imports.length} violation(s) in ${plan.id}`);
for (const v of imports) console.log(`  ${v.file}:${v.line} imports '${v.spec}': ${v.reason}`);
if (imports.length) failed = true;

const planProblems = [...new Set(plansCheck().problems.filter((p) => p.plan === plan.id).map((p) => p.text))];
console.log(`plan: ${planProblems.length} problem(s)`);
for (const t of planProblems) console.log('  ' + t);
if (planProblems.length) failed = true;

console.log(failed ? `FAIL ${plan.id}` : `PASS ${plan.id}`);
process.exit(failed ? 1 : 0);

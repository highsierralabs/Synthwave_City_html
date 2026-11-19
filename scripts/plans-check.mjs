// npm run plans:check: every plan parses (frontmatter fields, status, id, the twelve sections in
// order), and no path is owned by two plans (Agents.md, "Parallel tasks").
import { pathToFileURL } from 'node:url';
import { globToRegExp, ownedGlobs, readPlans } from './lib/plans.mjs';

// Two globs overlap if either matches a sample path built from the other.
const samples = (glob) => [glob, glob.replace(/\*\*/g, 'a/b').replace(/\*/g, 'x'), glob.replace(/\/\*\*$/, '/x.ts')];

/** Returns { plans, problems: [{ plan, text }] }. */
export function plansCheck() {
  const plans = readPlans();
  const problems = [];
  for (const plan of plans) for (const p of plan.problems) problems.push({ plan: plan.id ?? plan.file, text: `${plan.file}: ${p}` });
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      for (const ga of ownedGlobs(plans[i])) {
        for (const gb of ownedGlobs(plans[j])) {
          const ra = globToRegExp(ga), rb = globToRegExp(gb);
          if (samples(gb).some((p) => ra.test(p)) || samples(ga).some((p) => rb.test(p))) {
            const text = `overlap: ${plans[i].id} owns "${ga}" and ${plans[j].id} owns "${gb}"`;
            problems.push({ plan: plans[i].id, text }, { plan: plans[j].id, text });
          }
        }
      }
    }
  }
  return { plans, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { plans, problems } = plansCheck();
  const shown = new Set();
  for (const p of problems) if (!shown.has(p.text)) { shown.add(p.text); console.log(p.text); }
  console.log(`${plans.length} plans`);
  for (const plan of plans) console.log(`  ${String(plan.status ?? '?').padEnd(12)} ${plan.id ?? plan.file}`);
  console.log(shown.size ? `FAIL: ${shown.size} problem(s)` : 'OK');
  process.exit(shown.size ? 1 : 0);
}

// Reads plan frontmatter (plans/T##-*.md) and turns `owns` globs into matchers.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './bundle.mjs';

export const STATUSES = ['draft', 'ready', 'in-progress', 'blocked', 'done', 'abandoned'];
export const REQUIRED = ['id', 'title', 'status', 'depends_on', 'owns', 'reads', 'budget', 'executor', 'updated'];
/** The twelve sections of Agents.md, "What a plan contains", in order. */
export const SECTIONS = ['Purpose', 'Context and orientation', 'Scope', 'Interfaces', 'Plan of work', 'Validation and acceptance',
  'Idempotence and recovery', 'Progress', 'Surprises and discoveries', 'Decision log', 'Contract change requests', 'Outcomes and retrospective'];

function parseList(value) {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (inner.trim() === '') return [];
  const out = [];
  let depth = 0, current = '';
  for (const ch of inner) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Every plans/T##-*.md with its frontmatter fields and a list of problems. */
export function readPlans(dir = join(ROOT, 'plans')) {
  const plans = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/^T\d\d-.+\.md$/.test(name)) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    const plan = { file: `plans/${name}`, problems: [], text };
    if (!m) {
      plan.problems.push('no frontmatter');
      plans.push(plan);
      continue;
    }
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([a-z_]+):\s*(.*?)\s*$/.exec(line);
      if (!kv) continue;
      const value = kv[2];
      plan[kv[1]] = value.startsWith('[') ? parseList(value) : value.replace(/\s+#.*$/, '');
    }
    for (const key of REQUIRED) if (plan[key] === undefined) plan.problems.push(`missing "${key}"`);
    if (plan.status && !STATUSES.includes(plan.status)) plan.problems.push(`unknown status "${plan.status}"`);
    if (plan.id && `plans/${plan.id}.md` !== plan.file) plan.problems.push(`id "${plan.id}" does not match the file name`);
    if (plan.updated && !/^\d{4}-\d\d-\d\d$/.test(plan.updated)) plan.problems.push(`updated "${plan.updated}" is not a date`);
    if (plan.owns && !plan.owns.includes(plan.file)) plan.problems.push('does not own its own plan file');
    // Section headings in order (numbered "## n. Title").
    const headings = [...text.matchAll(/^## (?:\d+\. )?(.+?)\s*$/gm)].map((h) => h[1]);
    let at = 0;
    for (const s of SECTIONS) {
      const i = headings.indexOf(s, at);
      if (i < 0) plan.problems.push(`missing section "${s}" (or out of order)`);
      else at = i + 1;
    }
    plans.push(plan);
  }
  return plans;
}

/** Expands {a,b} alternatives. */
export function expandBraces(pattern) {
  const m = /\{([^{}]*)\}/.exec(pattern);
  if (!m) return [pattern];
  return m[1].split(',').flatMap((alt) => expandBraces(pattern.slice(0, m.index) + alt.trim() + pattern.slice(m.index + m[0].length)));
}

/** `**` is any path, `*` any run of characters within one path segment. Case-insensitive: paths
 *  resolve case-insensitively on this disk (Agents.md, Windows). */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; } else re += '[^/]*';
    } else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', 'i');
}

export function ownedGlobs(plan) {
  return (plan.owns ?? []).flatMap(expandBraces);
}

/** A function telling whether a repository-relative path belongs to the plan. */
export function ownsMatcher(plan) {
  const regexes = ownedGlobs(plan).map(globToRegExp);
  return (path) => regexes.some((r) => r.test(path.replaceAll('\\', '/')));
}

/** The plan with id `task` or id starting `task-` (T05 finds T05-buildings). */
export function findPlan(plans, task) {
  return plans.find((p) => p.id === task || (p.id ?? '').startsWith(task + '-'));
}

/** The plan owning a repository-relative path, or undefined. */
export function ownerOf(plans, path) {
  return plans.find((p) => ownsMatcher(p)(path));
}

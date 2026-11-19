// The import rules of architecture.md section 4.2, checked by reading import lines.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { ROOT, rel } from './bundle.mjs';

const LAYERS = ['backdrop', 'buildings', 'street', 'air', 'lights', 'post'];

/** What a src module may import, by module id. A module may always import files in its own
 *  folder (a layer's own .ts and .glsl files). */
const ALLOWED = {
  contracts: [],
  plan: ['contracts'],
  gl: ['contracts', 'common.glsl'],
  engine: ['contracts', 'gl', 'plan', 'engine.glsl'],
  audio: ['contracts', 'engine'],
  camera: ['contracts', 'engine', 'plan'],
  main: ['*'],
  ...Object.fromEntries(LAYERS.map((l) => [l, ['contracts', 'gl', 'engine', 'plan']])),
};

/** Module id of a src file: 'gl', 'engine', 'common.glsl', or the folder name for src/<dir>/... */
function moduleOf(file) {
  const r = relative(join(ROOT, 'src'), file).replaceAll('\\', '/');
  if (r.startsWith('..')) return null;
  const parts = r.split('/');
  if (parts.length > 1) return parts[0];
  return r.endsWith('.glsl') ? r : r.replace(/\.(ts|d\.ts)$/, '');
}

function listTs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listTs(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** [{ file, line, spec, reason }] for every import in src/ that breaks a rule. */
export function importViolations() {
  const out = [];
  for (const file of listTs(join(ROOT, 'src'))) {
    const from = moduleOf(file);
    const allowed = ALLOWED[from];
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((text, i) => {
      const m = /^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/.exec(text);
      if (!m) return;
      const spec = m[1] ?? m[2];
      const bad = (reason) => out.push({ file: rel(file), line: i + 1, spec, reason });
      if (!spec.startsWith('.')) return bad('a package import: the product has no runtime dependencies');
      const target = resolve(dirname(file), spec);
      const to = moduleOf(target);
      if (to === null) return bad('imports from outside src/');
      if (!allowed) return bad(`no import rule for module "${from}"`);
      if (to === from) return; // own folder
      if (allowed.includes('*') || allowed.includes(to)) return;
      if (LAYERS.includes(from) && LAYERS.includes(to)) return bad('a layer never imports another layer');
      bad(`"${from}" may import only ${allowed.join(', ') || 'nothing'} (section 4.2)`);
    });
  }
  return out;
}

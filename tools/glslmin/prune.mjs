// Dead code removal for the shader minifier (plans/T02-glslmin.md, M4). Owner: T02.
//
// Removes top-level function definitions, function prototypes and single-name `const` globals
// whose name no source refers to, repeating until nothing more goes (a helper used only by a dead
// helper goes too). Conservative on purpose:
//   - any use of the name anywhere (code, macro body, #if line) keeps every overload of it;
//   - an item with a preprocessor line inside it is never removed;
//   - uniforms, in/out variables, blocks, structs and plain globals are never removed;
//   - main and reserved names are never removed.
// It only works when every shader is in the same call, which is how the build calls it.

import { TYPES } from './names.mjs';

const QUALIFIERS = new Set(['const', 'highp', 'mediump', 'lowp', 'invariant', 'precise']);

/** Top-level items of one file: { start, end, name, prunable } with token indices inclusive. */
function items(toks, types) {
  const out = [];
  let k = 0;
  const n = toks.length;
  while (k < n) {
    if (toks[k].t === '#') { while (k < n && toks[k].t !== 'eol') k++; k++; continue; }
    const start = k;
    let depth = 0, hasDir = false, fn = false, end = n - 1, nameAt = -1, commas = 0;
    for (let j = k; j < n; j++) {
      const t = toks[j];
      if (t.t === '#') { hasDir = true; while (j < n && toks[j].t !== 'eol') j++; continue; }
      const v = t.v;
      if (v === '(' && depth === 0 && nameAt < 0 && j > start && toks[j - 1].t === 'id') nameAt = j - 1;
      if (v === '(' || v === '[') depth++;
      else if (v === ')' || v === ']') depth--;
      else if (v === '{') { if (depth === 0 && toks[j - 1]?.v === ')') fn = true; depth++; }
      else if (v === '}') { if (--depth === 0 && fn) { end = j; break; } }
      else if (v === ',' && depth === 0) commas++;
      else if (v === ';' && depth === 0) { end = j; break; }
    }
    let name = null, prunable = false;
    if (fn || (nameAt >= 0 && toks[end].v === ';' && toks[nameAt + 1]?.v === '(' && isPrototype(toks, start, nameAt, types))) {
      name = toks[nameAt]?.v ?? null;
      prunable = name !== null;
    } else if (toks[start].v === 'const' && commas === 0) {
      let j = start;
      while (QUALIFIERS.has(toks[j].v)) j++;
      if (types.has(toks[j].v)) {
        j++;
        if (toks[j]?.v === '[') { while (j < end && toks[j].v !== ']') j++; j++; }
        if (toks[j]?.t === 'id') { name = toks[j].v; prunable = true; }
      }
    }
    out.push({ start, end, name, prunable: prunable && !hasDir });
    k = end + 1;
  }
  return out;
}

/** "float f(float x);" : the tokens before the name are qualifiers and one type. */
function isPrototype(toks, start, nameAt, types) {
  let j = start;
  while (j < nameAt && QUALIFIERS.has(toks[j].v)) j++;
  return j === nameAt - 1 && types.has(toks[j].v);
}

/**
 * @param {Array<Array<{t:string,v:string}>>} files token arrays, all shaders of the program set
 * @param {Set<string>} keep names never removed (reserved, main)
 * @param {Set<string>} [structTypes] user struct names, which can be return and const types
 * @returns {{ files: typeof files, removed: string[] }}
 */
export function prune(files, keep, structTypes = new Set()) {
  const types = new Set([...TYPES, ...structTypes]);
  const all = [];
  const owner = files.map((toks, f) => {
    const own = new Int32Array(toks.length).fill(-1);
    for (const it of items(toks, types)) {
      if (!it.prunable) continue;
      const id = all.length;
      all.push({ ...it, file: f, live: true });
      for (let k = it.start; k <= it.end; k++) own[k] = id;
    }
    return own;
  });
  const removed = new Set();
  for (;;) {
    const refs = new Map();
    files.forEach((toks, f) => {
      for (let k = 0; k < toks.length; k++) {
        const t = toks[k];
        if (t.t !== 'id' || (k > 0 && toks[k - 1].v === '.')) continue;
        const o = owner[f][k];
        if (o >= 0 && (!all[o].live || all[o].name === t.v)) continue;
        refs.set(t.v, (refs.get(t.v) ?? 0) + 1);
      }
    });
    let changed = false;
    for (const it of all) {
      if (it.live && !keep.has(it.name) && !refs.get(it.name)) {
        it.live = false; changed = true; removed.add(it.name);
      }
    }
    if (!changed) break;
  }
  const outFiles = files.map((toks, f) => toks.filter((_, k) => owner[f][k] < 0 || all[owner[f][k]].live));
  return { files: outFiles, removed: [...removed].sort() };
}

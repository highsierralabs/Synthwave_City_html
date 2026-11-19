// Shader minifier. Owner: T02 (plans/T02-glslmin.md).
//
// A tokenizer and a declaration finder, not a parser. Every identifier the sources declare is given
// one short name, the same in every file, so varyings, block members and functions in the common
// chunk keep matching across fragments. Identifiers after "." are never renamed (swizzles and struct
// fields cannot be told apart), and neither are struct field declarations. The rules a shader author
// must follow are in the plan, under Outcomes.

import { lex, needSpace, isPlainFloat, shortFloat } from './lex.mjs';
import { TYPES, ALWAYS_RESERVED, isLanguageName, shortNames } from './names.mjs';
import { prune } from './prune.mjs';

const BLOCK_STORAGE = new Set(['in', 'out', 'uniform', 'buffer']);
// Directives whose identifiers may be renamed: macros only, except in #define where the body is code.
const MACRO_DIRECTIVES = new Set(['ifdef', 'ifndef', 'if', 'elif', 'undef']);

/**
 * Minifies a set of GLSL fragments together, with one rename map shared by all of them.
 *
 * @param {Record<string, string>} sources  path -> GLSL text. Fragments, not whole shaders: the
 *        "#version" header is added at run time and never passes through here.
 * @param {{ rename?: boolean, reserved?: string[], prune?: boolean }} [options]
 *        rename (default true): false strips comments and space only (and implies prune false).
 *        reserved: extra identifiers to leave alone. F, T0..T7, X0..X3, FS and main always are.
 *        prune (default true): drop top-level functions and const globals that no source uses.
 *        Only correct when every shader that will be linked is in this one call.
 * @returns {{ out: Record<string, string>, names: Record<string, string>, removed: string[] }}
 *        out: the same paths with minified text; names: original identifier -> short name;
 *        removed: names of the functions and constants pruned (empty with rename false).
 */
export function minifyShaders(sources, options = {}) {
  const paths = Object.keys(sources);
  let files = paths.map((p) => lex(sources[p]));
  const out = {};
  if (options.rename === false) {
    paths.forEach((p, k) => { out[p] = emit(files[k], null); });
    return { out, names: {}, removed: [] };
  }

  const reserved = new Set([...ALWAYS_RESERVED, ...(options.reserved ?? [])]);
  const types = new Set(TYPES);
  const declared = new Set();
  const macros = new Set();

  // Pass 1: struct type names, so "Window w;" is seen as a declaration in pass 2.
  const structs = new Set();
  for (const toks of files) {
    for (let k = 0; k + 1 < toks.length; k++) {
      if (toks[k].v === 'struct' && toks[k + 1].t === 'id') structs.add(toks[k + 1].v);
    }
  }
  for (const s of structs) types.add(s);

  // Dead functions and constants go first, so they neither ship nor take a short name.
  let removed = [];
  if (options.prune !== false) {
    const p = prune(files, reserved, structs);
    files = p.files;
    removed = p.removed;
  }

  // Pass 2: declarations, and token positions that must keep their text.
  const keep = files.map((toks) => findDeclarations(toks, types, declared, macros));

  // Which tokens are renameable, and how often each name is used.
  const canRename = (name) => declared.has(name) && !reserved.has(name) && !isLanguageName(name);
  const count = new Map();
  const forbidden = new Set([...reserved]);
  const sites = files.map((toks, f) => {
    const site = new Map();
    let directive = null;
    for (let k = 0; k < toks.length; k++) {
      const tok = toks[k];
      if (tok.t === '#') {
        // "#" alone on a line is a null directive: its next token is already the end of the line.
        if (toks[k + 1] && toks[k + 1].t !== 'eol') { directive = toks[k + 1].v; k++; } else directive = '';
        continue;
      }
      if (tok.t === 'eol') { directive = null; continue; }
      if (tok.t !== 'id') continue;
      const afterDot = k > 0 && toks[k - 1].v === '.';
      let ok = !afterDot && !keep[f].has(k) && canRename(tok.v);
      if (ok && directive !== null && directive !== 'define') {
        ok = MACRO_DIRECTIVES.has(directive) && macros.has(tok.v);
      }
      if (ok) {
        site.set(k, tok.v);
        count.set(tok.v, (count.get(tok.v) ?? 0) + 1);
      } else if (!afterDot) {
        forbidden.add(tok.v);
      }
    }
    return site;
  });

  // Function scopes (T14): the parameter list and body of every top-level function. A name whose
  // every renamed occurrence lies inside function scopes is local; locals are named per scope, so
  // the parameters and variables of different functions reuse the same short names. Everything else
  // (functions, globals, block members, varyings, macros) is global and named once for all files.
  const scopes = options.locals === false ? files.map(() => []) : files.map(functionScopes);
  const scopeOf = (f, k) => { for (const s of scopes[f]) if (k > s[0] && k < s[1]) return s; return null; };
  const isGlobal = new Set();
  sites.forEach((site, f) => { for (const [k, name] of site) if (!scopeOf(f, k)) isGlobal.add(name); });

  // Global names: most used first; ties by name, so the result does not depend on file order.
  const globalCount = new Map([...count].filter(([name]) => isGlobal.has(name)));
  const order = [...globalCount.keys()].sort((a, b) => globalCount.get(b) - globalCount.get(a) || (a < b ? -1 : a > b ? 1 : 0));
  const names = {};
  const gen = shortNames();
  for (const name of order) {
    let s;
    do { s = gen.next().value; } while (forbidden.has(s) || isLanguageName(s));
    names[name] = s;
  }
  // A short name may equal an original name that is itself renamed (a -> b while x -> a). That is
  // safe: every occurrence of a name either is renamed or has put that name in `forbidden`.

  // Short names a macro body refers to: a macro expanded inside a function must not find a local there.
  const macroRefs = new Set();
  files.forEach((toks, f) => {
    let inDefine = false;
    for (let k = 0; k < toks.length; k++) {
      if (toks[k].t === '#') inDefine = toks[k + 1]?.v === 'define';
      else if (toks[k].t === 'eol') inDefine = false;
      else if (inDefine && sites[f].has(k) && isGlobal.has(sites[f].get(k))) macroRefs.add(names[sites[f].get(k)]);
    }
  });

  // Local names, one scope at a time: most used in the scope first, each the first short name that is
  // not forbidden, not the short name of a global the scope (or a macro) refers to, and not taken by
  // another local of the same scope.
  const localName = files.map(() => new Map()); // token index -> short name
  sites.forEach((site, f) => {
    for (const s of scopes[f]) {
      const used = new Map();
      const taken = new Set(macroRefs);
      for (const [k, name] of site) {
        if (k <= s[0] || k >= s[1]) continue;
        if (isGlobal.has(name)) taken.add(names[name]);
        else used.set(name, (used.get(name) ?? 0) + 1);
      }
      if (s[2] !== null && site.has(s[2])) taken.add(names[site.get(s[2])]); // the function's own name
      const local = [...used.keys()].sort((a, b) => used.get(b) - used.get(a) || (a < b ? -1 : a > b ? 1 : 0));
      const short = new Map();
      const g = shortNames();
      for (const name of local) {
        let n;
        do { n = g.next().value; } while (forbidden.has(n) || isLanguageName(n) || taken.has(n));
        taken.add(n);
        short.set(name, n);
        // The names map is file-order independent: a local reports its smallest short name.
        if (names[name] === undefined || n.length < names[name].length || (n.length === names[name].length && n < names[name])) names[name] = n;
      }
      for (const [k, name] of site) if (k > s[0] && k < s[1] && short.has(name)) localName[f].set(k, short.get(name));
    }
  });

  paths.forEach((p, f) => {
    const site = sites[f];
    out[p] = emit(files[f], (k) => (localName[f].has(k) ? localName[f].get(k) : site.has(k) ? names[site.get(k)] : null));
  });
  return { out, names, removed };
}

/**
 * Top-level function scopes of one file: [open, close, nameIndex] token indices, where open is the
 * "(" of the parameter list and close the "}" of the body (or the ")" of a prototype). Directive
 * lines are skipped; braces are counted outside them.
 */
function functionScopes(toks) {
  const out = [];
  let depth = 0;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === '#') { while (k < toks.length && toks[k].t !== 'eol') k++; continue; }
    if (t.v === '{') depth++;
    else if (t.v === '}') depth--;
    else if (t.v === '(' && depth === 0 && toks[k - 1]?.t === 'id' && toks[k - 2] && (toks[k - 2].t === 'id' || toks[k - 2].v === ']')) {
      const close = matchSkippingDirectives(toks, k);
      if (toks[close + 1]?.v === '{') {
        const end = matchSkippingDirectives(toks, close + 1);
        out.push([k, end, k - 1]);
        k = end;
      } else if (toks[close + 1]?.v === ';') {
        out.push([k, close, k - 1]);
        k = close;
      }
    }
  }
  return out;
}

/** Like match, but ignores brackets on directive lines. */
function matchSkippingDirectives(toks, k) {
  const open = toks[k].v;
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let j = k; j < toks.length; j++) {
    if (toks[j].t === '#') { while (j < toks.length && toks[j].t !== 'eol') j++; continue; }
    if (toks[j].v === open) depth++;
    else if (toks[j].v === close && --depth === 0) return j;
  }
  return toks.length - 1;
}

/**
 * Finds declared names in one file. Adds them to `declared` (and macro names to `macros`) and
 * returns the token positions that declare struct fields or members of a named block, which keep
 * their text, plus block names.
 */
function findDeclarations(toks, types, declared, macros) {
  const keep = new Set();
  const n = toks.length;
  const isDeclName = (t) => t && t.t === 'id' && !types.has(t.v) && !isLanguageName(t.v);
  // Names declared after a closing brace: "struct S { ... } a, b[2];" and "uniform B { ... } inst;"
  const declarators = (q) => {
    while (isDeclName(toks[q])) {
      declared.add(toks[q].v);
      q++;
      if (toks[q]?.v === '[') q = match(toks, q) + 1;
      if (toks[q]?.v !== ',') break;
      q++;
    }
  };

  // Field ranges: struct bodies, and bodies of interface blocks that have an instance name.
  const fieldRange = [];
  for (let k = 0; k < n; k++) {
    const t = toks[k];
    if (t.v === 'struct') {
      let j = k + 1;
      if (toks[j]?.t === 'id') { declared.add(toks[j].v); j++; }
      if (toks[j]?.v === '{') {
        const end = match(toks, j);
        fieldRange.push([j, end]);
        declarators(end + 1);
        k = j;
      }
    } else if (t.t === 'id' && BLOCK_STORAGE.has(t.v) && toks[k + 1]?.t === 'id' && toks[k + 2]?.v === '{') {
      keep.add(k + 1); // the block name: JavaScript looks it up by name
      const end = match(toks, k + 2);
      if (isDeclName(toks[end + 1])) {
        fieldRange.push([k + 2, end]);
        declarators(end + 1);
      }
    }
  }
  const inFields = (k) => fieldRange.some(([a, b]) => k > a && k < b);

  const declare = (k) => {
    if (inFields(k)) keep.add(k);
    else declared.add(toks[k].v);
  };

  for (let k = 0; k < n; k++) {
    const t = toks[k];
    if (t.t === '#') {
      const name = toks[k + 1];
      if (name?.v === 'define' && toks[k + 2]?.t === 'id') {
        const m = toks[k + 2].v;
        declared.add(m);
        macros.add(m);
        let j = k + 3;
        if (toks[j]?.v === '(' && !toks[j].ws) {
          for (j++; j < n && toks[j].v !== ')' && toks[j].t !== 'eol'; j++) {
            if (toks[j].t === 'id') declared.add(toks[j].v);
          }
        }
        k = j;
      } else if (name && name.v !== 'define') {
        // Other directives declare nothing; skip to the end of the line.
        while (k < n && toks[k].t !== 'eol') k++;
      }
      continue;
    }
    if (t.t !== 'id' || !types.has(t.v)) continue;
    if (k > 0 && toks[k - 1].v === '.') continue;
    if (t.v === 'struct') continue;
    // A struct definition's own name is not a variable declaration: "struct S {".
    if (toks[k - 1]?.v === 'struct') continue;
    let j = k + 1;
    if (toks[j]?.v === '[') j = match(toks, j) + 1; // array type: float[3] a
    if (!isDeclName(toks[j])) continue;
    declare(j);
    if (toks[j + 1]?.v === '(') continue; // a function: its parameters are found as declarations
    // More declarators in the same statement: "vec2 i = floor(p), f = fract(p);"
    let depth = 0;
    for (let q = j + 1; q < n; q++) {
      const v = toks[q].v;
      if (toks[q].t === 'eol') break;
      if (v === '(' || v === '[' || v === '{') depth++;
      else if (v === ')' || v === ']' || v === '}') { if (--depth < 0) break; }
      else if (depth === 0 && v === ';') break;
      else if (depth === 0 && v === ',' && isDeclName(toks[q + 1])) declare(q + 1);
    }
  }
  return keep;
}

/** Index of the bracket that closes the one at `k`, or the last token. */
function match(toks, k) {
  const open = toks[k].v;
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let j = k; j < toks.length; j++) {
    if (toks[j].v === open) depth++;
    else if (toks[j].v === close && --depth === 0) return j;
  }
  return toks.length - 1;
}

/** Joins tokens back into text with the least space, renaming identifiers through `rename`
 *  (token index -> new text, or null for none). */
function emit(toks, rename) {
  let out = '';
  let prev = null; // text of the last token written on the current line, null at a line start
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t === '#') {
      if (!out.endsWith('\n')) out += '\n';
      out += '#';
      const name = toks[k + 1];
      if (name && name.t !== 'eol') {
        out += name.v;
        k++;
        const next = toks[k + 1];
        if (next && next.t !== 'eol') out += ' ';
        prev = null;
        if (name.v === 'define' && next && next.t === 'id') {
          out += text(next, k + 1);
          k++;
          const after = toks[k + 1];
          // "#define A(x)" is a function-like macro, "#define A (x)" is not. An object-like macro
          // always gets a space before its body: C99 6.10.3 requires one, as in "#define N -1.".
          const functionLike = after && after.v === '(' && !after.ws;
          if (after && after.t !== 'eol' && !functionLike) { out += ' '; prev = null; } else prev = text(next, k);
        }
      } else {
        prev = null;
      }
      continue;
    }
    if (tok.t === 'eol') { out += '\n'; prev = null; continue; }
    let v = text(tok, k);
    if (tok.t === 'num' && isPlainFloat(tok.v)) v = shortFloat(tok.v);
    if (prev !== null && needSpace(prev, v)) out += ' ';
    out += v;
    prev = v;
  }

  function text(t, k) {
    const r = rename && rename(k);
    return r ?? t.v;
  }
  return out;
}

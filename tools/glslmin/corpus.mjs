// The test corpus for the shader minifier: src/common.glsl as it stands on disk, plus the fixture
// programs under tests/glslmin/fixtures/. Owner: T02 (plans/T02-glslmin.md).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COMMON = 'src/common.glsl';
const FIXTURES = 'tests/glslmin/fixtures';

const FALLBACK_HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;\n';

/** The header src/gl.ts puts in front of every shader (architecture.md 10.5), read fresh from its
 *  `const HEAD = '...'` line, or a copy of it if that line is not found. T00 owns the real one. */
export function header() {
  try {
    const m = /const HEAD = '([^']*)'/.exec(readFileSync(join(ROOT, 'src', 'gl.ts'), 'utf8'));
    return m ? m[1].replace(/\\n/g, '\n') : FALLBACK_HEAD;
  } catch {
    return FALLBACK_HEAD;
  }
}

/** Reads the corpus fresh from disk: { sources: path -> text, programs: [{ name, vs, fs, ... }] }
 *  where vs and fs are source paths. */
export function loadCorpus() {
  const manifest = JSON.parse(readFileSync(join(ROOT, FIXTURES, 'programs.json'), 'utf8'));
  const sources = { [COMMON]: readFileSync(join(ROOT, COMMON), 'utf8') };
  const programs = manifest.programs.map((p) => {
    const vs = `${FIXTURES}/${p.vs}`;
    const fs = `${FIXTURES}/${p.fs}`;
    for (const path of [vs, fs]) sources[path] ??= readFileSync(join(ROOT, path), 'utf8');
    return { ...p, vs, fs };
  });
  return { sources, programs };
}

/** Complete vertex and fragment sources for one program, assembled as prog() in src/gl.ts does:
 *  HEAD + common + "\n" + body, with "#define FS\n" before common in the fragment stage.
 *  `join` replaces the "\n" between common and body; "" is the strictest case. */
export function assemble(texts, program, join = '\n') {
  const head = header();
  return {
    vs: head + texts[COMMON] + join + texts[program.vs],
    fs: head + '#define FS\n' + texts[COMMON] + join + texts[program.fs],
  };
}

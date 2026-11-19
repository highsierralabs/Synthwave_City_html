// Bundling shared by build, shot, dev, verify, size and probe.
//
//   bundle({ entry, dev, glsl })   esbuild: strip types, one scope (IIFE), DEV defined, .glsl as text
//   minifyJs(js)                    terser with several option sets; returns every candidate
//   writeEntry(dir, names, opts)    a generated harness entry importing only the named layers
//
// The build tools of T01 and T02 are loaded fresh on every call (cache-busted by mtime), so a
// long-lived dev server picks up a sibling's new version, and a half-written one fails one build only.
import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { minify } from 'terser';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
const posix = (p) => p.replaceAll('\\', '/');

/** The product layers in draw-independent init order, plus post. `--layers all` means these. */
export const LAYERS = ['backdrop', 'buildings', 'street', 'air', 'lights', 'post'];
/** Harness-only layers that live under dev/. */
export const DEV_LAYERS = ['probe'];

/** Source file of a layer name: dev/<name>/index.ts for dev layers, else src/<name>/index.ts. */
export function layerPath(name) {
  return join(ROOT, DEV_LAYERS.includes(name) ? 'dev' : 'src', name, 'index.ts');
}

/** Imports a repository module fresh (cache-busted by mtime). */
export async function freshImport(relPath) {
  const file = join(ROOT, relPath);
  return import(pathToFileURL(file).href + '?v=' + statSync(file).mtimeMs);
}

function listGlsl(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) listGlsl(p, out);
    else if (name.name.endsWith('.glsl')) out.push(p);
  }
  return out;
}

/** Every .glsl under src/ (and dev/ when `withDev`), minified in one call with one name map. */
export async function minifyAllGlsl({ rename = true, withDev = false } = {}) {
  const files = [...listGlsl(join(ROOT, 'src')), ...(withDev ? listGlsl(join(ROOT, 'dev')) : [])].sort();
  const sources = {};
  for (const f of files) sources[rel(f)] = readFileSync(f, 'utf8');
  const { minifyShaders } = await freshImport('tools/glslmin/index.mjs');
  const { out, names } = minifyShaders(sources, { rename });
  return { out, names, count: files.length };
}

// glsl.sabotage (verify's self-test) breaks one rename on purpose: in the first bundled shader other
// than common.glsl that calls fog(), one call is renamed to an undeclared name.
function glslPlugin(glsl) {
  return {
    name: 'glsl',
    setup(build) {
      let minified = null, sabotaged = false;
      build.onStart(() => { minified = null; sabotaged = false; });
      build.onLoad({ filter: /\.glsl$/ }, async (args) => {
        const text = readFileSync(args.path, 'utf8');
        if (!glsl) return { contents: text, loader: 'text', watchFiles: [args.path] };
        minified ??= await minifyAllGlsl(glsl);
        const key = rel(args.path);
        if (!(key in minified.out)) throw new Error(`glsl: ${key} was not in the minified set`);
        let contents = minified.out[key];
        const call = new RegExp(`\\b${minified.names?.fog ?? 'fog'}\\(`);
        if (glsl.sabotage && !sabotaged && key !== 'src/common.glsl' && call.test(contents)) {
          contents = contents.replace(call, 'zzSabotaged(');
          sabotaged = true;
          console.log(`sabotage: broke the rename of fog() in ${key}`);
        }
        return { contents, loader: 'text' };
      });
    },
  };
}

// stubs: Map of absolute source path -> TypeScript text loaded in its place (scripts/size.mjs).
function stubPlugin(stubs) {
  return {
    name: 'stubs',
    setup(build) {
      build.onLoad({ filter: /.ts$/ }, (args) => {
        const key = resolve(args.path).toLowerCase();
        for (const [path, contents] of stubs) if (resolve(path).toLowerCase() === key) return { contents, loader: 'ts' };
        return undefined;
      });
    },
  };
}

/** esbuild options for one bundle. `glsl` null keeps shaders as written; an object minifies them
 *  all together ({ rename, withDev, sabotage }). `stubs` replaces modules (Map path -> text). */
export function bundleOptions({ entry, dev = true, glsl = null, outfile, stubs } = {}) {
  return {
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    charset: 'utf8',
    legalComments: 'none',
    define: { DEV: dev ? 'true' : 'false' },
    plugins: [...(stubs ? [stubPlugin(stubs)] : []), glslPlugin(glsl)],
    logLevel: 'silent',
    ...(outfile ? { outfile, write: true } : { write: false }),
  };
}

/** Bundles `entry` into one JavaScript text. */
export async function bundle(opts) {
  const result = await esbuild.build(bundleOptions(opts));
  return result.outputFiles[0].text;
}

/** terser option sets tried by the build. Safe transforms only: nothing that changes float
 *  arithmetic (no unsafe_math), so the packed file draws the same pixels as the sources. */
export const TERSER_SETS = {
  A: { compress: { passes: 3, ecma: 2022, pure_getters: true, unsafe_arrows: true, unsafe_methods: true, toplevel: true }, mangle: { toplevel: true } },
  B: { compress: { passes: 2, ecma: 2022, toplevel: true }, mangle: { toplevel: true } },
  C: { compress: { passes: 3, ecma: 2022, pure_getters: true, unsafe_arrows: true, booleans_as_integers: true, keep_fargs: false, hoist_funs: true, toplevel: true }, mangle: { toplevel: true } },
};

/** Minifies with one or all option sets; returns [{ name, code }]. */
export async function minifyJs(js, names = Object.keys(TERSER_SETS)) {
  const out = [];
  for (const name of names) {
    const set = TERSER_SETS[name];
    const r = await minify(js, { ecma: 2022, module: false, toplevel: true, ...set, format: { ecma: 2022, comments: false } });
    out.push({ name, code: r.code });
  }
  return out;
}

/** Writes a harness entry under `dir` that imports only the named layers (and the camera when
 *  `tour`), and returns its path. */
export function writeEntry(dir, names, { tour = false } = {}) {
  mkdirSync(dir, { recursive: true });
  const lines = [`import { harness } from '${posix(join(ROOT, 'dev', 'harness.ts'))}';`];
  const list = [];
  names.forEach((name, i) => {
    const file = layerPath(name);
    if (!existsSync(file)) throw new Error(`unknown layer "${name}" (${rel(file)} does not exist)`);
    lines.push(`import { init as L${i} } from '${posix(file)}';`);
    list.push(`['${name}', L${i}]`);
  });
  if (tour) lines.push(`import { cameraInit } from '${posix(join(ROOT, 'src', 'camera', 'index.ts'))}';`);
  lines.push(`harness([${list.join(', ')}], ${tour ? 'cameraInit' : 'undefined'});`);
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, lines.join('\n') + '\n');
  return entry;
}

/** Expands a --layers value: 'all' is every product layer plus post; otherwise a comma list. */
export function parseLayers(value) {
  if (!value || value === true) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean).flatMap((s) => (s === 'all' ? LAYERS : [s]));
}

/** A minimal HTML page that loads a classic script next to it. */
export function pageFor(scriptName) {
  return `<!doctype html><meta charset="utf-8"><body><script src="${scriptName}"></script>`;
}

/** A unique scratch directory under .tmp/<group>/ for one run of a script. */
export function scratchDir(group) {
  const dir = join(ROOT, '.tmp', group, `${process.pid}-${Date.now().toString(36)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// npm run build: the single file (architecture.md section 3.4).
//
//   src/main.ts --esbuild (DEV=false, one IIFE scope; every .glsl through tools/glslmin, one name map)
//     --terser (each option set in lib/bundle.mjs) --quickSize each--> smallest
//     --pack (tools/pack: utf16 and ascii, level max)--> dist/
//
// Writes dist/synthwave-city.html (utf16, the product), dist/synthwave-city.safe.html (ascii),
// dist/app.js (the winning minified text, for reading) and dist/size.json, and prints the size
// against the gate with the change since the previous dist/size.json.
//
//   node scripts/build.mjs [--no-rename]     --no-rename: shaders are stripped, not renamed
//
// Reproducible: the same sources give the same bytes (no timestamps, no random names).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bundle, freshImport, minifyJs, ROOT } from './lib/bundle.mjs';
import { parseArgs } from './lib/browser.mjs';

export const GATE = 32768;
export const CEILING = 65536;
const fmt = (n) => n.toLocaleString('en-US');

/** Runs the whole pipeline on `entry`. Returns the outputs; writes nothing.
 *  `sets`: terser option set names to try (all by default). `level`: pack level. */
export async function buildFile({ entry = join(ROOT, 'src', 'main.ts'), rename = true, withDev = false, sabotage = false, sets, level = 'max', safe = true } = {}) {
  const js = await bundle({ entry, dev: false, glsl: { rename, withDev, sabotage }, flat: true });
  const { pack, quickSize } = await freshImport('tools/pack/index.mjs');
  const candidates = (await minifyJs(js, sets)).map((c) => ({ ...c, quick: quickSize(c.code) }));
  candidates.sort((a, b) => a.quick - b.quick || (a.name < b.name ? -1 : 1));
  const best = candidates[0];
  const main = await pack(best.code, { container: 'utf16', level });
  const ascii = safe ? await pack(best.code, { container: 'ascii', level }) : null;
  return { bundled: js, best, candidates, main, ascii };
}

/** The product build into dist/. Returns the size record. */
export async function build({ rename = true, quiet = false } = {}) {
  const dist = join(ROOT, 'dist');
  mkdirSync(dist, { recursive: true });
  const sizeFile = join(dist, 'size.json');
  const previous = existsSync(sizeFile) ? JSON.parse(readFileSync(sizeFile, 'utf8')) : null;
  const r = await buildFile({ rename });
  writeFileSync(join(dist, 'synthwave-city.html'), r.main.html);
  if (r.ascii) writeFileSync(join(dist, 'synthwave-city.safe.html'), r.ascii.html);
  writeFileSync(join(dist, 'app.js'), r.best.code);
  const record = {
    bytes: r.main.html.length,
    container: r.main.container,
    deflated: r.main.deflated,
    overhead: r.main.overhead,
    safeBytes: r.ascii ? r.ascii.html.length : null,
    minified: Buffer.byteLength(r.best.code),
    bundled: Buffer.byteLength(r.bundled),
    terser: r.best.name,
    candidates: Object.fromEntries(r.candidates.map((c) => [c.name, c.quick])),
    rename,
  };
  writeFileSync(sizeFile, JSON.stringify(record, null, 2) + '\n');
  if (!quiet) {
    const change = previous ? record.bytes - previous.bytes : null;
    console.log(`dist/synthwave-city.html  ${fmt(record.bytes)} bytes   gate ${fmt(GATE)} (${(100 * record.bytes / GATE).toFixed(1)}%)   ` +
      `change ${change === null ? 'n/a (first build)' : (change > 0 ? '+' : '') + fmt(change)}`);
    console.log(`  container ${record.container}: deflate ${fmt(record.deflated)} + overhead ${fmt(record.overhead)};  ` +
      `minified ${fmt(record.minified)} (terser ${record.terser}; quick sizes ${r.candidates.map((c) => `${c.name} ${fmt(c.quick)}`).join(', ')});  ` +
      `bundled ${fmt(record.bundled)}${rename ? '' : ';  shaders not renamed'}`);
    if (r.ascii) console.log(`dist/synthwave-city.safe.html  ${fmt(record.safeBytes)} bytes (${r.ascii.container})`);
    if (record.bytes > CEILING) console.log(`OVER THE ${fmt(CEILING)}-byte CEILING`);
    else if (record.bytes > GATE) console.log(`over the ${fmt(GATE)}-byte gate`);
  }
  return record;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  try {
    const record = await build({ rename: !args['no-rename'] });
    process.exit(record.bytes > CEILING ? 1 : 0);
  } catch (error) {
    console.error(`BUILD FAILED: ${error.message}`);
    if (error.errors) for (const e of error.errors) console.error(`  ${e.location?.file ?? ''}:${e.location?.line ?? ''} ${e.text}`);
    process.exit(1);
  }
}

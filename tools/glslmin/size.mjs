// Size table for the shader minifier on its corpus (plans/T02-glslmin.md, section 6). Owner: T02.
//
//   node tools/glslmin/size.mjs
//
// Prints bytes of source, strip-only, renamed (prune off) and renamed+pruned output, each raw and
// after deflateRawSync level 9, for the whole corpus (src/common.glsl read fresh, plus every
// fixture), concatenated in path order.
// Also checks that minifying the same input twice gives identical output.
import { deflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { minifyShaders } from './index.mjs';
import { loadCorpus } from './corpus.mjs';

export function sizeTable(sources) {
  const paths = Object.keys(sources).sort();
  const join = (m) => paths.map((p) => m[p]).join('');
  const strip = minifyShaders(sources, { rename: false }).out;
  const noPrune = minifyShaders(sources, { prune: false }).out;
  const renamed = minifyShaders(sources);
  const rows = { source: join(sources), strip: join(strip), renamed: join(noPrune), pruned: join(renamed.out) };
  const table = {};
  for (const [k, text] of Object.entries(rows)) {
    const bytes = Buffer.byteLength(text, 'utf8');
    table[k] = { bytes, deflated: deflateRawSync(Buffer.from(text, 'utf8'), { level: 9 }).length };
  }
  return { table, files: paths.length, names: Object.keys(renamed.names).length, removed: renamed.removed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { sources } = loadCorpus();
  const { table, files, names, removed } = sizeTable(sources);
  console.log(`corpus: ${files} files (src/common.glsl + fixtures), ${names} names renamed, pruned: ${removed.join(' ') || 'none'}`);
  console.log('renamed = rename with prune off; pruned = the default, rename and prune');
  console.log('variant     bytes   deflate-raw L9');
  for (const [k, v] of Object.entries(table)) console.log(`${k.padEnd(9)} ${String(v.bytes).padStart(7)} ${String(v.deflated).padStart(10)}`);
  const a = JSON.stringify(minifyShaders(sources)), b = JSON.stringify(minifyShaders(sources));
  console.log(`deterministic: ${a === b ? 'yes' : 'NO'}`);
  const common = { 'src/common.glsl': sources['src/common.glsl'] };
  const c = sizeTable(common).table;
  console.log(`common.glsl alone: source ${c.source.bytes}/${c.source.deflated}, strip ${c.strip.bytes}/${c.strip.deflated}, renamed ${c.renamed.bytes}/${c.renamed.deflated} (bytes/deflated)`);
}

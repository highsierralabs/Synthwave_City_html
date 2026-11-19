import { minify } from 'terser';
import * as esbuild from 'esbuild';
import { bundle, ROOT } from '../../scripts/lib/bundle.mjs';
import { join } from 'node:path';
import { fileSize } from './lib.mjs';
const js = await bundle({ entry: join(ROOT, 'src', 'main.ts'), dev: false, glsl: { rename: true } });
const base = { compress: { passes: 3, ecma: 2022, pure_getters: true, unsafe_arrows: true, unsafe_methods: true, toplevel: true }, mangle: { toplevel: true } };
const sets = {
  A: base,
  A5: { ...base, compress: { ...base.compress, passes: 5 } },
  Aunsafe: { ...base, compress: { ...base.compress, unsafe: true, unsafe_comps: false } },
  Acomp: { ...base, compress: { ...base.compress, unsafe_comps: true } },
  Aundef: { ...base, compress: { ...base.compress, unsafe_undefined: true } },
  Afargs: { ...base, compress: { ...base.compress, keep_fargs: false } },
  Ahoistv: { ...base, compress: { ...base.compress, hoist_vars: true } },
  Ainline3: { ...base, compress: { ...base.compress, inline: 3, reduce_funcs: true } },
  Aseq: { ...base, compress: { ...base.compress, sequences: 1000, join_vars: true } },
  AnoSeq: { ...base, compress: { ...base.compress, sequences: false } },
  AnoJoin: { ...base, compress: { ...base.compress, join_vars: false } },
  AnoHoist: { ...base, compress: { ...base.compress, hoist_props: false } },
  Acollapse: { ...base, compress: { ...base.compress, collapse_vars: false } },
  Aregs: { ...base, compress: { ...base.compress, reduce_vars: false } },
  Aarrows: { ...base, compress: { ...base.compress, arrows: false } },
};
const out = [];
for (const [name, set] of Object.entries(sets)) {
  const r = await minify(js, { ecma: 2022, module: false, toplevel: true, ...set, format: { ecma: 2022, comments: false } });
  out.push([name, r.code.length, (await fileSize(r.code)).file]);
  console.log(...out.at(-1));
}
// esbuild minify alone
const e = await esbuild.transform(js, { minify: true, target: 'es2022' });
console.log('esbuild', e.code.length, (await fileSize(e.code)).file);
// esbuild minify then terser A
const r2 = await minify(e.code, { ecma: 2022, module: false, toplevel: true, ...base, format: { ecma: 2022, comments: false } });
console.log('esbuild+A', r2.code.length, (await fileSize(r2.code)).file);

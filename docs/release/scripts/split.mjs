import { minifyAllGlsl } from '../../scripts/lib/bundle.mjs';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
const d = (s) => deflateRawSync(Buffer.from(s), { level: 9 }).length;
const app = readFileSync('dist/app.js', 'utf8');
const { out } = await minifyAllGlsl({ rename: true });
let glsl = '', js = app;
for (const [k, v] of Object.entries(out)) {
  const lit = JSON.stringify(v).slice(1, -1);
  // find in app as template or string
  const forms = [v, lit, v.replaceAll('\n', '\n')];
  let found = false;
  for (const f of forms) if (js.includes(f)) { js = js.replace(f, ''); found = true; break; }
  console.log(k, v.length, found ? 'found' : 'MISSING');
  glsl += v;
}
console.log('app', app.length, 'deflate', d(app));
console.log('glsl', glsl.length, 'deflate alone', d(glsl));
console.log('js w/o glsl', js.length, 'deflate alone', d(js));

// Roadroller experiment (T14 M3). node .tmp/T14/rr/run.mjs <level>
import { readFileSync, writeFileSync } from 'node:fs';
import { Packer } from 'roadroller';
import { pack } from '../../../tools/pack/index.mjs';
const level = Number(process.argv[2] ?? 0);
const js = readFileSync('dist/app.js', 'utf8');
const t = Date.now();
const packer = new Packer([{ data: js, type: 'js', action: 'eval' }], {});
await packer.optimize(level);
const { firstLine, secondLine } = packer.makeDecoder();
const out = firstLine + '\n' + secondLine;
console.log(`level ${level}: roadroller output ${Buffer.byteLength(out)} bytes in ${((Date.now() - t) / 1000).toFixed(1)} s`);
writeFileSync(`.tmp/T14/rr/out${level}.js`, out);
const plain = '<body><script>' + out + '</script>';
writeFileSync(`.tmp/T14/rr/plain${level}.html`, plain);
console.log(`  plain utf-8 file (<body><script>...): ${Buffer.byteLength(plain)} bytes`);
const r = await pack(out, { container: 'utf16', level: 'max' });
writeFileSync(`.tmp/T14/rr/packed${level}.html`, r.html);
console.log(`  roadroller output deflated into the utf16 container: ${r.html.length} bytes (deflate ${r.deflated})`);

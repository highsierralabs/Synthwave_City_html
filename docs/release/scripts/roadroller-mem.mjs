import { readFileSync, writeFileSync } from 'node:fs';
import { Packer } from 'roadroller';
import { pack } from '../../../tools/pack/index.mjs';
const js = readFileSync('dist/app.js', 'utf8');
for (const mb of [150, 64, 32, 16]) {
  const packer = new Packer([{ data: js, type: 'js', action: 'eval' }], { maxMemoryMB: mb });
  await packer.optimize(0);
  const { firstLine, secondLine } = packer.makeDecoder();
  const out = firstLine + '\n' + secondLine;
  const r = await pack(out, { container: 'utf16', level: 'normal' });
  writeFileSync(`.tmp/T14/rr/packed_mem${mb}.html`, r.html);
  console.log(`maxMemoryMB ${mb}: roadroller ${out.length} chars, in utf16 container ${r.html.length} bytes; arrays: ${(out.match(/new Uint\d+Array\([^)]*\)/g) || []).join(' ')}`);
}

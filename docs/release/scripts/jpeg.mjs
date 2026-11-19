// Re-encodes docs/screenshots/*.png as JPEG through Chromium's canvas encoder.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { launch } from '../../scripts/lib/browser.mjs';
const [q, outDir] = [Number(process.argv[2] ?? 0.85), process.argv[3] ?? 'docs/release/screenshots'];
const browser = await launch('gpu');
const page = await browser.newPage();
for (const f of readdirSync('docs/screenshots').filter((n) => n.endsWith('.png'))) {
  const b64 = readFileSync('docs/screenshots/' + f).toString('base64');
  const jpg = await page.evaluate(async ([b64, q]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, [b64, q]);
  const out = `${outDir}/${f.replace('.png', '.jpg')}`;
  writeFileSync(out, Buffer.from(jpg, 'base64'));
  console.log(out, Buffer.from(jpg, 'base64').length);
}
await browser.close();

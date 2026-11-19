// One JPEG contact sheet per rung (skyline | street | tour, each 480x270) into docs/release/ladder/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch } from '../../scripts/lib/browser.mjs';
const ids = process.argv.slice(2);
mkdirSync('docs/release/ladder', { recursive: true });
const browser = await launch('gpu');
const page = await browser.newPage();
for (const id of ids) {
  const imgs = ['skyline', 'street', 'tour'].map((v) => readFileSync(`shots/T14/ladder/${id}_${v}.png`).toString('base64'));
  const jpg = await page.evaluate(async (imgs) => {
    const c = document.createElement('canvas');
    c.width = 1440; c.height = 270;
    const g = c.getContext('2d');
    for (let i = 0; i < 3; i++) {
      const im = new Image();
      im.src = 'data:image/png;base64,' + imgs[i];
      await im.decode();
      g.drawImage(im, i * 480, 0, 480, 270);
    }
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, imgs);
  writeFileSync(`docs/release/ladder/${id}.jpg`, Buffer.from(jpg, 'base64'));
  console.log(id, Buffer.from(jpg, 'base64').length);
}
await browser.close();

// Loads packed files in a real browser, as a person would, and prints container against delivery.
// Owner: T01. Run: node tools/pack/browser-test.mjs [--browsers all] [--level fast|normal|max] [--keep]
//
// Deliveries: file://, HTTP with no charset, HTTP with charset=utf-8, HTTP with charset=iso-8859-1,
// and HTTP in slow chunks (does document.body exist when the payload first runs?).
// The payload sets a global to a checksum of a string it carries; the page must report the same value.
// Also checks the two DecompressionStream claims in Agents.md (zlib header, trailing bytes), and that a
// string literal holding every unit of the utf16 alphabet reaches the script intact.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { pack } from './index.mjs';
import { findChromium, findInstalledBrowsers, findFirefox } from './browser.mjs';
import { inAlphabet } from './container.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../../..');
const outDir = join(root, '.tmp', 'T01', 'browser');
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i < 0 ? dflt : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};

// ---- the payload ---------------------------------------------------------------------------------------
// Real JavaScript from the parent project when it is there (read only), random text otherwise, so the
// deflate stream is realistic. A string of random BMP characters makes the stream's bytes varied.
function makePayload() {
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let text = '';
  const parent = 'C:/highsierralabs/Synthwave_City/dist/assets';
  if (existsSync(parent)) {
    for (const f of readdirSync(parent)) if (/^(sky|beams|ground)/.test(f)) text += readFileSync(join(parent, f), 'utf8');
  }
  text = text.replace(/\*\//g, '* /');
  let d = '';
  for (let i = 0; i < 6000; i++) {
    let c = Math.floor(rnd() * 0xfffd) + 1;
    if (c >= 0xd800 && c <= 0xdfff) c = 0x41 + (c & 15);
    d += String.fromCharCode(c);
  }
  const check = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0) + ':' + s.length;
  };
  const js =
    `/*${text}*/var d=${JSON.stringify(d)};` +
    `globalThis.__SUM=(()=>{let h=2166136261;for(let i=0;i<d.length;i++)h=Math.imul(h^d.charCodeAt(i),16777619);return(h>>>0)+":"+d.length})();` +
    `globalThis.__BODY=!!document.body;globalThis.__T=performance.now()`;
  return { js, expect: check(d) };
}

// ---- server ---------------------------------------------------------------------------------------------
const files = new Map(); // path -> Buffer
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const body = files.get(u.pathname.slice(1));
  if (u.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (!body) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ct = u.searchParams.get('ct');
  res.writeHead(200, ct === 'none' ? {} : { 'content-type': ct ?? 'text/html' });
  if (u.searchParams.get('slow')) {
    const n = 4;
    const step = Math.ceil(body.length / n);
    let i = 0;
    const tick = () => {
      if (i >= body.length) return res.end();
      res.write(body.subarray(i, i + step));
      i += step;
      setTimeout(tick, 80);
    };
    tick();
  } else res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const write = (name, buf) => {
  writeFileSync(join(outDir, name), buf);
  files.set(name, Buffer.from(buf));
};

const deliveries = [
  ['file://', (n) => pathToFileURL(join(outDir, n)).href],
  ['http', (n) => `http://127.0.0.1:${port}/${n}`],
  ['http utf-8', (n) => `http://127.0.0.1:${port}/${n}?ct=${encodeURIComponent('text/html; charset=utf-8')}`],
  ['http latin1', (n) => `http://127.0.0.1:${port}/${n}?ct=${encodeURIComponent('text/html; charset=iso-8859-1')}`],
  ['http slow', (n) => `http://127.0.0.1:${port}/${n}?slow=1`],
  ['no type', (n) => `http://127.0.0.1:${port}/${n}?ct=none`],
];

async function runPage(browser, url, probe) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 100)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 100)));
  let result;
  try {
    await page.goto(url);
    await page.waitForFunction('globalThis.__SUM', null, { timeout: 8000 });
    result = await page.evaluate(probe);
  } catch (e) {
    result = { fail: String(e.message).split('\n')[0].slice(0, 80) };
  }
  result.errors = errors;
  await page.close();
  return result;
}

async function testBrowser(name, executablePath, fixtures) {
  const browser = await chromium.launch({ executablePath, headless: true });
  console.log(`\n== ${name}: ${browser.version()}`);
  const header = ['container'.padEnd(14), ...deliveries.map(([d]) => d.padEnd(12))].join('');
  console.log(header);
  let failed = 0;
  const cells = [];
  for (const fx of fixtures) {
    let line = fx.label.padEnd(14);
    for (const [dname, urlOf] of deliveries) {
      const r = await runPage(browser, urlOf(fx.file), fx.probe);
      const ok = !r.fail && r.sum === fx.expect && !r.errors.length && (dname !== 'http slow' || r.body);
      const info = dname === 'no type'; // no Content-Type header at all: reported, not required
      if (!ok && !info) failed++;
      const cell = ok ? `PASS ${r.t.toFixed(0)}ms` : info ? 'fail (info)' : 'FAIL';
      line += cell.padEnd(12);
      if (!ok && !info) console.log(`   ${fx.label} / ${dname}: ${JSON.stringify(r)}`);
      cells.push({ container: fx.label, delivery: dname, ok, ms: r.t, charset: r.cs });
    }
    console.log(line);
  }
  // The two claims in Agents.md marked [M].
  const raw = Buffer.from('hello world, '.repeat(200) + 'END');
  const z = deflateRawSync(raw, { level: 9 });
  const claims = { 'raw stream accepted': z, 'zlib header rejected': deflateSync(raw, { level: 9 }), 'trailing byte rejected': Buffer.concat([z, Buffer.alloc(1)]), 'trailing zeros rejected': Buffer.concat([z, Buffer.alloc(7)]), 'empty stored block in front accepted': Buffer.concat([Buffer.from([0, 0, 0, 0xff, 0xff]), z]) };
  const page = await browser.newPage();
  await page.goto('about:blank');
  console.log('DecompressionStream("deflate-raw"):');
  for (const [k, v] of Object.entries(claims)) {
    const r = await page.evaluate(async (arr) => {
      try {
        return 'accepted ' + (await new Response(new Response(new Uint8Array(arr)).body.pipeThrough(new DecompressionStream('deflate-raw'))).text()).length;
      } catch (e) {
        return 'rejected';
      }
    }, [...v]);
    const want = k.includes('rejected') ? 'rejected' : 'accepted';
    const ok = r.startsWith(want);
    if (!ok) failed++;
    console.log(`  ${k.padEnd(40)} ${r}  ${ok ? 'as claimed' : 'NOT AS CLAIMED'}`);
  }
  await page.close();
  await browser.close();
  return { failed, cells };
}

const probe = () => ({ sum: globalThis.__SUM, body: globalThis.__BODY, t: globalThis.__T, cs: document.characterSet });

const { js, expect } = makePayload();
const level = flag('level', 'normal');
const fixtures = [];
const sizes = {};
for (const container of ['utf16', 'ascii']) {
  const r = await pack(js, { container, level });
  sizes[container] = { file: r.html.length, deflated: r.deflated, overhead: r.overhead, compressor: r.compressor };
  write(`${container}.html`, r.html);
  fixtures.push({ label: container, file: `${container}.html`, expect, probe });
}
// Every unit of the alphabet inside a string literal: the parser and the decoder must keep each one.
{
  const units = [];
  for (let u = 0; u <= 0xffff; u++) if (inAlphabet(u)) units.push(u);
  let s = '';
  for (const u of units) s += String.fromCharCode(u);
  const text = `<body><script>s="${s}";globalThis.__SUM=(()=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0)+":"+s.length})();globalThis.__BODY=!!document.body;globalThis.__T=performance.now()</script>`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  write('alphabet.html', Buffer.from('\ufeff' + text, 'utf16le'));
  fixtures.push({ label: 'all units', file: 'alphabet.html', expect: (h >>> 0) + ':' + s.length, probe });
}
console.log('payload', Buffer.byteLength(js), 'bytes of JavaScript;', JSON.stringify(sizes));

let failed = 0;
const targets = [['playwright chromium', findChromium()]];
if (flag('browsers', '') === 'all') for (const b of findInstalledBrowsers()) targets.push([b.name, b.path]);
for (const [name, path] of targets) {
  if (!path) {
    console.log(`\n== ${name}: not found`);
    failed++;
    continue;
  }
  failed += (await testBrowser(name, path, fixtures)).failed;
}
const ff = findFirefox();
console.log(`\nFirefox: ${ff ? 'installed at ' + ff + ' but Playwright cannot drive a stock Firefox; not tested' : 'not installed; not tested'}`);
console.log('Safari / WebKit: not installed; not tested');
server.close();
if (!flag('keep', false)) for (const n of ['alphabet.html']) rmSync(join(outDir, n), { force: true });
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);

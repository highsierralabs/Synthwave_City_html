// Lists the top-level var/function names of dist/app.js and checks them against the window
// properties of Chromium (a name already on window would be overwritten or refused).
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { launch } from '../../scripts/lib/browser.mjs';
const code = readFileSync(process.argv[2] ?? 'dist/app.js', 'utf8');
const ctx = vm.createContext({});
const before = new Set(Object.getOwnPropertyNames(ctx));
try { vm.runInContext(code, ctx); } catch {}
const names = Object.getOwnPropertyNames(ctx).filter((n) => !before.has(n));
const browser = await launch('gpu');
const page = await browser.newPage();
await page.goto('about:blank');
const win = await page.evaluate(() => { const s = new Set(); for (let o = window; o; o = Object.getPrototypeOf(o)) for (const n of Object.getOwnPropertyNames(o)) s.add(n); return [...s]; });
await browser.close();
const hit = names.filter((n) => win.includes(n));
console.log(`top-level var/function names: ${names.length}; window properties: ${win.length}; collisions: ${hit.length ? hit.join(', ') : 'none'}`);
console.log(names.join(' '));

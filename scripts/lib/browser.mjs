// Finds the Chromium that Playwright has already cached and launches it on the real GPU.
// The cached revision (1234, Chromium 151) is older than this Playwright expects, so the path is
// passed explicitly. Never run `npx playwright install` (Agents.md).
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const RELATIVE = [
  'chrome-win64/chrome.exe',
  'chrome-win/chrome.exe',
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
];

/** Path of the newest cached full Chromium, or SC_CHROMIUM when set. */
export function findChromium() {
  const override = process.env.SC_CHROMIUM;
  if (override) {
    if (!existsSync(override)) throw new Error(`SC_CHROMIUM does not exist: ${override}`);
    return override;
  }
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
  ];
  let best;
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (!name.startsWith('chromium-')) continue;
      const revision = Number(name.slice('chromium-'.length));
      if (!Number.isInteger(revision) || (best && revision <= best.revision)) continue;
      for (const rel of RELATIVE) {
        const path = join(root, name, rel);
        if (existsSync(path)) { best = { revision, path }; break; }
      }
    }
  }
  return best?.path;
}

/** mode: 'gpu' (default), 'software' (SwiftShader) or 'nowebgl'. */
export async function launch(mode = 'gpu', extraArgs = []) {
  const executablePath = findChromium();
  if (!executablePath) throw new Error('No cached Chromium found. Set SC_CHROMIUM to a Chrome executable.');
  const args = {
    gpu: ['--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])],
    software: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    nowebgl: ['--disable-3d-apis'],
  }[mode];
  if (!args) throw new Error(`unknown browser mode: ${mode}`);
  // file:// pages loading sibling scripts need no extra flag; keep the list short.
  return chromium.launch({ executablePath, headless: true, args: [...args, ...extraArgs] });
}

/** Parses `--name value` pairs and bare `--flag`s (value true). */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { (out._ ??= []).push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

/** file:// URL of a local path, with an optional #hash. */
export function fileUrl(path, hash = '') {
  return pathToFileURL(path).href + (hash ? '#' + hash : '');
}

/** True when a renderer string names a hardware GPU rather than SwiftShader. */
export function isHardware(renderer) {
  return /NVIDIA|AMD|Radeon|Intel|Apple|Adreno|Mali/i.test(String(renderer)) && !/SwiftShader/i.test(String(renderer));
}

/** Collects console errors, warnings and page errors of a page into arrays. */
export function watchConsole(page) {
  const log = { errors: [], warnings: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') log.errors.push(msg.text());
    else if (msg.type() === 'warning') log.warnings.push(msg.text());
  });
  page.on('pageerror', (err) => log.errors.push('pageerror: ' + err.message));
  return log;
}

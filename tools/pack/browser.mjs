// A small finder for the Chromium that Playwright has already cached, and for other installed
// Chromium-based browsers. Owner: T01. Deliberately independent of scripts/lib/browser.mjs (T00).
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const RELATIVE = [
  'chrome-win64/chrome.exe',
  'chrome-win/chrome.exe',
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
];

/** Path of the newest cached Playwright Chromium, or undefined. SC_CHROMIUM overrides. */
export function findChromium() {
  const override = process.env.SC_CHROMIUM;
  if (override) return existsSync(override) ? override : undefined;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.XDG_CACHE_HOME && join(process.env.XDG_CACHE_HOME, 'ms-playwright'),
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
        if (existsSync(path)) {
          best = { revision, path };
          break;
        }
      }
    }
  }
  return best?.path;
}

/** Other installed browsers a test may add: Chromium-based ones that Playwright can drive by path. */
export function findInstalledBrowsers() {
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  const candidates = [
    ['chrome', 'Google/Chrome/Application/chrome.exe'],
    ['edge', 'Microsoft/Edge/Application/msedge.exe'],
    ['brave', 'BraveSoftware/Brave-Browser/Application/brave.exe'],
  ];
  const out = [];
  for (const [name, rel] of candidates) {
    for (const root of pf) {
      const path = join(root, rel);
      if (existsSync(path)) {
        out.push({ name, path });
        break;
      }
    }
  }
  return out;
}

/** Firefox, if installed (Playwright cannot drive a stock Firefox, so this only reports). */
export function findFirefox() {
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const root of pf) {
    const path = join(root, 'Mozilla Firefox', 'firefox.exe');
    if (existsSync(path)) return path;
  }
  return undefined;
}

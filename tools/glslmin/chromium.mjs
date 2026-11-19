// Finds the Chromium that Playwright has already cached and launches it on the GPU.
// Owner: T02. A private copy of the idea in the parent project's scripts/lib/browser.mjs, so this
// tool does not depend on T00's scripts. Never runs "npx playwright install".
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const RELATIVE = ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome'];

/** Path of the newest cached chromium-NNNN build, or undefined. SC_CHROMIUM overrides. */
export function findChromium() {
  if (process.env.SC_CHROMIUM) return process.env.SC_CHROMIUM;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
  ];
  let best;
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const m = /^chromium-(\d+)$/.exec(name);
      if (!m || (best && +m[1] <= best.revision)) continue;
      for (const rel of RELATIVE) {
        const path = join(root, name, rel);
        if (existsSync(path)) { best = { revision: +m[1], path }; break; }
      }
    }
  }
  return best?.path;
}

/** Launches headless Chromium on the real GPU (ANGLE on D3D11 on Windows). */
export async function launchGpu() {
  const executablePath = findChromium();
  if (!executablePath) throw new Error('glslmin: no cached Chromium found; set SC_CHROMIUM');
  const args = ['--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];
  return { browser: await chromium.launch({ executablePath, headless: true, args }), executablePath };
}

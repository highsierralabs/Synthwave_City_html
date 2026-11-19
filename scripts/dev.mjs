// npm run dev -- --layers backdrop,buildings: the dev harness with rebuild on save and live reload.
// Blocks; prints its URL. Serves the same unminified bundle shot.mjs uses, from .tmp/dev/<run>/,
// on a free port on 127.0.0.1.
//
//   --layers a,b   as shot.mjs (default: probe)        --tour 1   include src/camera
//   --app 1        serve src/main.ts instead of the harness
//   --port n       a fixed port instead of a free one
//
// Open the printed URL. Edit the hash to move: #cam=x,y,z,yaw,pitch, view=, q=, mood=, post=0; add
// t= to freeze time (dev/harness.ts lists them). Without t the loop runs live.
import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { bundleOptions, pageFor, parseLayers, ROOT, scratchDir, writeEntry } from './lib/bundle.mjs';
import { parseArgs } from './lib/browser.mjs';

const args = parseArgs(process.argv.slice(2));
const app = args.app === '1' || args.app === true;
const layers = parseLayers(args.layers ?? 'probe');
const tour = args.tour === '1' || args.tour === true;

const freePort = () => new Promise((ok, no) => {
  const s = createServer();
  s.once('error', no);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

const dir = scratchDir('dev');
const entry = app ? join(ROOT, 'src', 'main.ts') : writeEntry(dir, layers, { tour });
writeFileSync(join(dir, 'index.html'), pageFor('app.js'));
const ctx = await esbuild.context({
  ...bundleOptions({ entry, dev: true, outfile: join(dir, 'app.js') }),
  banner: { js: "new EventSource('/esbuild').addEventListener('change',()=>location.reload());" },
  logLevel: 'info',
});
await ctx.watch();
const port = Number(args.port ?? (await freePort()));
await ctx.serve({ servedir: dir, host: '127.0.0.1', port });
console.log(`\ndev harness: http://127.0.0.1:${port}/${app ? '' : `#view=high${tour ? '&tour=1' : ''}`}`);
console.log(`${app ? 'app: src/main.ts' : `layers: ${layers.join(', ') || '(none)'}`}; rebuilds on save; Ctrl+C stops it.`);

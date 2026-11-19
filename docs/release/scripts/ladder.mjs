// T14 M4: the cut ladder. Each rung is a scratch copy of the repository under .tmp/T14/ladder/rNN with
// the cuts of every rung up to it applied, built with the copy's own pipeline (the same scripts and
// tools as the repository), then type-checked, smoke-tested from file:// and photographed.
//
//   node .tmp/T14/ladder.mjs [first] [last]        rungs first..last (default all)
//
// The shipped sources are never touched: the copies are made fresh from the working tree.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..', '..');
const OUT = join(ROOT, '.tmp', 'T14', 'ladder');
const SHOTS = join(ROOT, 'shots', 'T14', 'ladder');

// ---- edit operations ------------------------------------------------------------------------------
const rep = (file, from, to) => ({ file, from, to });
const cut = (file, start, end, to = '') => ({ file, start, end, to });
const del = (file) => ({ file, del: true });
const write = (file, text) => ({ file, text });

function apply(dir, op) {
  const path = join(dir, op.file);
  if (op.del) { rmSync(path); return; }
  if (op.text !== undefined) { writeFileSync(path, op.text); return; }
  let s = readFileSync(path, 'utf8');
  if (op.start !== undefined) {
    const a = s.indexOf(op.start);
    if (a < 0 || s.indexOf(op.start, a + 1) >= 0) throw new Error(`${op.file}: start marker not found exactly once: ${op.start.slice(0, 60)}`);
    const b = s.indexOf(op.end, a);
    if (b < 0) throw new Error(`${op.file}: end marker not found: ${op.end.slice(0, 60)}`);
    s = s.slice(0, a) + op.to + s.slice(b + op.end.length);
  } else {
    const n = s.split(op.from).length - 1;
    if (n !== 1) throw new Error(`${op.file}: expected one occurrence, found ${n}: ${op.from.slice(0, 80)}`);
    s = s.replace(op.from, () => op.to);
  }
  writeFileSync(path, s);
}

// ---- the rungs ---------------------------------------------------------------------------------------
const M = 'src/main.ts';
const RUNGS = [
  { id: 'r00', name: 'Full build (shipped)', loses: 'nothing', ops: [] },
  {
    id: 'r01', name: 'Shell trims', loses: 'toasts naming each action, the key list on the start card, fullscreen (F and its button), hiding the interface (H), the blocked context menu',
    ops: [
      rep(M, `'c,n,t,m{position:fixed;transition:opacity .6s}'`, `'c,n,m{position:fixed;transition:opacity .6s}'`),
      rep(M, `'c,t{background:`, `'c{background:`),
      rep(M, `  'k{display:block;opacity:.7;font-size:12px}' +\n  '@media(pointer:coarse){k{display:none}}' +\n`, ''),
      rep(M, `  't{left:50%;top:12%;transform:translateX(-50%);opacity:0;padding:8px 16px}' +\n`, ''),
      rep(M, `.z{cursor:none}.h w{display:none}`, `.z{cursor:none}`),
      rep(M, `Tap or press a key for sound' +\n  '<k>M mute · R station · N mood · F fullscreen · Space fly · 1 2 3 quality · H hide</k></c>' +`, `Tap or press a key for sound</c>' +`),
      rep(M, `<b>HD</b><b>□</b></n>`, `<b>HD</b></n>`),
      rep(M, `'<t></t></w><m></m>'`, `'</w><m></m>'`),
      rep(M, `const toastBox = document.querySelector<HTMLElement>('t')!;\n`, ''),
      rep(M, `let fade = 0;\n`, ''),
      cut(M, 'function dim(): void {', '  fade = setTimeout(dim, 1400);\n}\n\n'),
      cut(M, 'function act(k: string): void {', '\n}\n', `function act(k: string): void {
  switch (k) {
    case 'm':
      audioMute();
      break;
    case 'r':
      audioStation();
      break;
    case 'n':
      setMood(mood = (mood + 1) % 3);
      break;
    case ' ':
      cameraMode();
      break;
    case '0': // the quality button: the next one of 1, 2, 3
      k = (quality + 1) % 3 + 1 + '';
    // falls through
    case '1':
    case '2':
    case '3':
      setQuality(+k - 1);
  }
}
`),
      rep(M, `  addEventListener('contextmenu', (e) => e.preventDefault());\n`, ''),
      rep(M, `act('mrn 0f'[i]!)`, `act('mrn 0'[i]!)`),
    ],
  },
  {
    id: 'r02', name: 'No free flight', loses: 'free flight (WASD, Q/E, Shift, the second finger, Space and its button), the arrow-key look and wheel zoom; the tour and drag-to-look stay',
    ops: [
      rep(M, `    case ' ':\n      cameraMode();\n      break;\n`, ''),
      rep(M, `<b>◐</b><b>▲</b>`, `<b>◐</b>`),
      rep(M, `act('mrn 0'[i]!)`, `act('mrn0'[i]!)`),
      rep(M, `import { cameraInit, cameraMode } from './camera/index';`, `import { cameraInit } from './camera/index';`),
      write('src/camera/index.ts', `// Ladder rung: the tour with drag-to-look only.
import { addUpdate } from '../engine';
import { camReset, camUpdate, I_CALM, I_DOWN, I_DX, I_DY, IN } from './tour';

export function cameraInit(element: HTMLElement): void {
  camReset();
  IN[I_CALM] = +matchMedia('(prefers-reduced-motion:reduce)').matches;
  addUpdate(camUpdate);
  element.style.touchAction = 'none';
  let id = -1;
  let lx = 0;
  let ly = 0;
  element.addEventListener('pointerdown', (e) => {
    IN[I_DOWN] = IN[I_DOWN]! + 1;
    if (id < 0) id = e.pointerId, lx = e.clientX, ly = e.clientY, element.setPointerCapture(id);
  });
  element.addEventListener('pointermove', (e) => {
    if (e.pointerId == id) IN[I_DX] = IN[I_DX]! + e.clientX - lx, IN[I_DY] = IN[I_DY]! + e.clientY - ly, lx = e.clientX, ly = e.clientY;
  });
  const up = (e: PointerEvent): void => {
    IN[I_DOWN] = Math.max(0, IN[I_DOWN]! - 1);
    if (e.pointerId == id) id = -1;
  };
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
}

export function cameraMode(): number {
  return 0;
}
`),
      cut('src/camera/tour.ts', '  const keys = IN[I_KEYS]!;', '    return;\n  }\n', `  const lx = -IN[I_DX]! * .004;
  const ly = -IN[I_DY]! * .004;
  IN[I_DX] = IN[I_DY] = 0;
`),
      rep('src/camera/tour.ts', `  idle = IN[I_DOWN] || keys & 960 ? 0 : idle + dt;`, `  idle = IN[I_DOWN] ? 0 : idle + dt;`),
      cut('src/camera/tour.ts', '/** Toggles tour (0) and free flight (1)', '  return mode;\n}\n'),
    ],
  },
  {
    id: 'r03', name: 'One mood', loses: 'the midnight and miami moods (N and its button)',
    ops: [
      rep(M, `    case 'n':\n      setMood(mood = (mood + 1) % 3);\n      break;\n`, ''),
      rep(M, `<b>♫</b><b>◐</b>`, `<b>♫</b>`),
      rep(M, `act('mrn0'[i]!)`, `act('mr0'[i]!)`),
      rep(M, `let mood = 0;\n`, ''),
      rep(M, `import { boot, quality, run, setMood, setQuality } from './engine';`, `import { boot, quality, run, setQuality } from './engine';`),
      cut('src/engine.ts', '  // Mood eases forward around the 0..3 circle.\n', '% 3;\n'),
      cut('src/common.glsl', 'vec3 mood(vec3 a, vec3 b, vec3 c) {', '\n}\n'),
      rep('src/common.glsl', `mood(vec3(0.22, 0.05, 0.11), vec3(0.05, 0.06, 0.20), vec3(0.21, 0.06, 0.19))`, `vec3(0.22, 0.05, 0.11)`),
      rep('src/common.glsl', `mood(vec3(0.07, 0.03, 0.17), vec3(0.02, 0.02, 0.09), vec3(0.04, 0.09, 0.20))`, `vec3(0.07, 0.03, 0.17)`),
      rep('src/backdrop/sky.glsl', `mood(vec3(0.16, 0.012, 0.14), vec3(0.02, 0.015, 0.09), vec3(0.09, 0.03, 0.2))`, `vec3(0.16, 0.012, 0.14)`),
      rep('src/backdrop/sky.glsl', `mood(vec3(0.03, 0.005, 0.07), vec3(0.004, 0.003, 0.02), vec3(0.02, 0.01, 0.08))`, `vec3(0.03, 0.005, 0.07)`),
      rep('src/backdrop/sky.glsl', `mood(pal(4.0), pal(1.0), pal(3.0))`, `pal(4.0)`),
    ],
  },
  {
    id: 'r04', name: 'One station', loses: 'the second station (R and its button); one track remains',
    ops: [
      rep(M, `    case 'r':\n      audioStation();\n      break;\n`, ''),
      rep(M, `<b>♪</b><b>♫</b>`, `<b>♪</b>`),
      rep(M, `act('mr0'[i]!)`, `act('m0'[i]!)`),
      rep(M, `import { audioHidden, audioMute, audioStart, audioStation } from './audio/index';`, `import { audioHidden, audioMute, audioStart } from './audio/index';`),
      cut('src/audio/index.ts', '/** Steps to the next station.', '  return station();\n}\n'),
      rep('src/audio/index.ts', `import { beat, begin, init, LEVEL, master, pump, station } from './synth';`, `import { beat, begin, init, LEVEL, master, pump } from './synth';`),
      rep('src/audio/synth.ts', `const ROWS = 'h!023578:05263208' + '|&024579;5304751@';`, `const ROWS = 'h!023578:05263208';`),
      rep('src/audio/synth.ts', `=> ROWS.charCodeAt(cur * W + k)`, `=> ROWS.charCodeAt(k)`),
      cut('src/audio/synth.ts', '/** Steps to the other station', '  return cur;\n}\n'),
      rep('src/audio/synth.ts', `  F[U_MIX + 3] = cur;\n`, ''),
    ],
  },
  {
    id: 'r05', name: 'No touch bar, no quality keys', loses: 'the six-button touch bar (on a phone: no mute or quality control) and the 1 2 3 quality keys; quality is chosen by the device type and the render scale still adapts',
    ops: [
      cut(M, `  'n{left:0;right:0;`, `'n b:active{background:#ff2bd6aa}' +\n`),
      rep(M, `'.g c,.z n{opacity:0}.z n{pointer-events:none}.z{cursor:none}'`, `'.g c{opacity:0}.z{cursor:none}'`),
      rep(M, `  '<n><b>♪</b><b>HD</b></n>' +\n`, ''),
      cut(M, 'function act(k: string): void {', '\n}\n', `function act(k: string): void {
  if (k == 'm') audioMute();
}
`),
      rep(M, `let asleep = 0;\n`, ''),
      cut(M, `  addEventListener('pointerdown', () => {`, '  });\n'),
      rep(M, `  document.querySelectorAll('n b').forEach((b, i) => b.addEventListener('click', () => asleep || act('m0'[i]!)));\n`, ''),
      rep(M, `import { boot, quality, run, setQuality } from './engine';`, `import { boot, run } from './engine';`),
    ],
  },
  {
    id: 'r06', name: 'No billboards', loses: 'holographic billboards, tickers and face signs with invented words, the glyph atlas',
    ops: [
      write('src/lights/index.ts', `// Ladder rung: beams and pillars only.
import { F, O_BEAM, U_RES } from '../contracts';
import { addLayer } from '../engine';
import { ADD, buf, drawInst, gl, inst, prog, state } from '../gl';
import { boxCount, boxes } from '../plan';
import beamGlsl from './beam.glsl';

export function init(): void {
  const vao = inst(buf(boxes), [4, 4]);
  const p = prog(beamGlsl, beamGlsl);
  addLayer(O_BEAM, () => {
    gl.useProgram(p);
    state(ADD);
    drawInst(vao, 48, boxCount * F[U_RES + 3]!);
    gl.drawArraysInstanced(4, 48, 78, 1024); // TRIANGLES
  }, 1);
}
`),
      del('src/lights/holo.glsl'),
    ],
  },
  {
    id: 'r07', name: 'No people', loses: 'the 800 walkers on the sidewalks near the camera',
    ops: [
      rep('src/street/index.ts', `  const people = prog(peopleGlsl, peopleGlsl);\n`, ''),
      rep('src/street/index.ts', `    gl.useProgram(people);\n    drawInst(null, 6, 800 * F[U_RES + 3]!);\n`, ''),
      rep('src/street/index.ts', `import peopleGlsl from './people.glsl';\n`, ''),
      del('src/street/people.glsl'),
    ],
  },
  {
    id: 'r08', name: 'No street lamps', loses: 'the rows of street lamps and their pools of light',
    ops: [
      cut('src/backdrop/index.ts', '  const lamp = prog(lampGlsl, lampGlsl);', '  }, 1);\n'),
      rep('src/backdrop/index.ts', `import lampGlsl from './lamp.glsl';\n`, ''),
      del('src/backdrop/lamp.glsl'),
    ],
  },
  {
    id: 'r09', name: 'Plain grade', loses: 'chromatic fringe, vignette, scanlines and film grain (bloom, tone curve and gamma stay)',
    ops: [
      cut('src/post/post.glsl', '  // Chromatic fringe:', 'scene(vUv - d * 0.0015).b);\n', '  vec3 c = scene(vUv);\n'),
      rep('src/post/post.glsl', `  c *= 1.0 - dot(d, d) * 0.5;\n`, ''),
      cut('src/post/post.glsl', '  c *= 0.95 + 0.05 * sin(gl_FragCoord.y * 2.1);\n', '* 0.04;\n'),
    ],
  },
  {
    id: 'r10', name: 'Plain sky', loses: 'stars and the wireframe mountain ridge (gradient, haze and the striped sun stay)',
    ops: [
      cut('src/backdrop/sky.glsl', '  // stars:', 'n * 400.0));\n'),
      cut('src/backdrop/sky.glsl', '  // mountains:', 'smoothstep(-ea, ea, e));\n'),
    ],
  },
  {
    id: 'r11', name: 'No reflections', loses: 'the mirror pass: the wet road no longer mirrors the city (it keeps a fog-coloured sheen and the sun streak)',
    ops: [
      rep('src/engine.ts', `    mirror = target(sw >> 1 || 1, sh >> 1 || 1, 1, mirror);\n`, ''),
      cut('src/engine.ts', '  // Mirror pass:', '  pass(1, mirror);\n  for (let i = 4; i < 8; i++) F[i] = -F[i]!;\n'),
      rep('src/engine.ts', `  bindTex(1, p ? null : mirror[1]);\n`, ''),
      rep('src/engine.ts', `  gl.frontFace(p ? 2304 : 2305); // CW : CCW\n`, ''),
      rep('src/engine.ts', `  if (!p || quality) for (const [, draw, reflect] of layers) if (!p || reflect) draw(p);`, `  for (const [, draw] of layers) draw(p);`),
      rep('src/backdrop/ground.glsl', `wet * (texture(T1, uv).rgb + step(uRes.z, 0.5) * (fogColor(v)`, `wet * ((fogColor(v)`),
      cut('src/backdrop/ground.glsl', '  vec2 uv = gl_FragCoord.xy / uRes.xy', ';\n'),
    ],
  },
  {
    id: 'r12', name: 'No searchlights', loses: 'searchlights, beacon pillars, laser fans, aviation lights and plaza octahedra (the whole lights layer)',
    ops: [
      write('src/lights/index.ts', `// Ladder rung: no lights layer.\nexport function init(): void {}\n`),
      del('src/lights/beam.glsl'),
    ],
  },
  {
    id: 'r13', name: 'Plain towers', loses: 'sign panels, storefronts, equaliser facades, floor lines, roof slats, roof rings and red roof dots, switching window runs (windows, trim, crowns, spires and megatower bands stay)',
    ops: [
      cut('src/buildings/buildings.glsl', '  // One run in twenty switches now and then.\n', '0.05));\n'),
      cut('src/buildings/buildings.glsl', '  // Equaliser facades,', 'wc = mix(pal(5.0), pal(0.0), rel);\n'),
      cut('src/buildings/buildings.glsl', '  // Neon floor lines every eight floors', '* 2.0;\n'),
      cut('src/buildings/buildings.glsl', '  // A slatted lit band', 'step(0.4, h.y);\n'),
      cut('src/buildings/buildings.glsl', '  // Sign panels high', '* 2.0 * s;\n'),
      cut('src/buildings/buildings.glsl', '  // Storefronts:', '* 2.0 * s;\n'),
      cut('src/buildings/buildings.glsl', '  float m = length(vL.xz);\n', 'blink * 6.0;\n', '  vec3 roof = trim * 0.2 * max(grid(vL.x / 4.0, 0.06), grid(vL.z / 4.0, 0.06));\n'),
    ],
  },
  {
    id: 'r14', name: 'Plain track', loses: 'the lead and its echo, toms, the noise riser and the low swell (kick, snare, hats, bass and pad chords stay)',
    ops: [
      cut('src/audio/synth.ts', `    // Toms falling through`, `'triangle', 0.35, 1500, 0.08, wet, 1.5);\n`),
      cut('src/audio/synth.ts', `  // Every bar: a soft swell`, `spb * 4, 0.05);\n  }\n`),
      cut('src/audio/synth.ts', `  // Part 3 plays the lead`, `'lowpass', 0.01);\n  }\n`),
      rep('src/audio/synth.ts', `  const dly = ac.createDelay();\n`, ''),
      cut('src/audio/synth.ts', `  leadIn = gain(wet, 1);\n`, `  dly.connect(gain(wet, 0.5));\n`),
    ],
  },
];

// ---- running a rung ----------------------------------------------------------------------------------
const VIEWS = [
  ['skyline', ['--layers', 'all', '--cam', '3712,250,504,0,-0.1', '--t', '12']],
  ['street', ['--layers', 'all', '--cam', '2042,3,2300,0,0.04', '--t', '30']],
  ['tour', ['--layers', 'all', '--tour', '1', '--t', '60']],
];

function run(dir, args, opts = {}) {
  try {
    return { ok: true, out: execFileSync(process.execPath, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000, ...opts }) };
  } catch (e) {
    return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

const [first, last] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? RUNGS.length - 1)];
mkdirSync(OUT, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const results = existsSync(join(OUT, 'results.json')) ? JSON.parse(readFileSync(join(OUT, 'results.json'), 'utf8')) : {};
for (let k = first; k <= last; k++) {
  const rung = RUNGS[k];
  const dir = join(OUT, rung.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const p of ['src', 'scripts', 'tools', 'dev', 'package.json', 'tsconfig.json']) cpSync(join(ROOT, p), join(dir, p), { recursive: true });
  for (let j = 0; j <= k; j++) for (const op of RUNGS[j].ops) apply(dir, op);
  if (process.env.DRY) { const t = run(dir, [join(ROOT, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.json"]); console.log(rung.id, "edits ok, typecheck", t.ok ? "ok" : t.out.slice(0, 400)); continue; }
  const r = { id: rung.id, name: rung.name, loses: rung.loses };
  const tsc = run(dir, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '-p', 'tsconfig.json']);
  r.typecheck = tsc.ok ? 'ok' : tsc.out.trim().split('\n').slice(0, 5).join(' | ');
  const b = run(dir, ['scripts/build.mjs']);
  const size = JSON.parse(readFileSync(join(dir, 'dist', 'size.json'), 'utf8'));
  r.bytes = size.bytes;
  r.safeBytes = size.safeBytes;
  r.build = b.out.trim().split('\n')[0];
  const s = run(dir, ['scripts/smoke.mjs', '--no-build', '--file', 'dist/synthwave-city.html', '--seconds', '3', '--out', join(SHOTS, `${rung.id}_smoke.png`)]);
  r.smoke = s.out.includes('SMOKE OK') ? 'SMOKE OK' : 'FAILED: ' + s.out.split('\n').filter((l) => l.startsWith('FAIL')).join(' | ');
  r.smokeFrames = (s.out.match(/rAF intervals.*$/m) ?? [''])[0];
  r.shots = [];
  for (const [name, args] of VIEWS) {
    const out = join(SHOTS, `${rung.id}_${name}.png`);
    const sh = run(dir, ['scripts/shot.mjs', ...args, '--size', '960x540', '--out', out]);
    r.shots.push({ name, ok: sh.ok, line: (sh.out.match(/^wrote .*$/m) ?? [sh.out.split('\n').slice(-3).join(' ')])[0].replace(/^wrote \S+\s+/, '') });
  }
  const beat = run(ROOT, [join(ROOT, '.tmp', 'T14', 'beat.mjs'), join(dir, 'dist', 'synthwave-city.html')]);
  r.audio = beat.out.trim().split('\n').slice(1).map((l) => l.trim());
  results[rung.id] = r;
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${rung.id} ${rung.name.padEnd(30)} ${String(r.bytes).padStart(6)} B  typecheck ${r.typecheck}  ${r.smoke}  shots ${r.shots.map((x) => x.ok ? 'ok' : 'FAIL').join(',')}`);
  console.log(`     ${r.audio.join(' / ')}`);
}

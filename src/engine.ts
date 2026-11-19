// Engine: boot, frame loop, uniform block, passes, registries (architecture.md section 4). Owner: T00.
//
// Each frame (section 4.4):
//   clock -> default beat into F -> updates (camera writes P, audio may overwrite the beat)
//   -> canvas and scene size -> P wrapped, matrices and the rest of F
//   -> mirror pass (into a half-size target, texture unit 1; layers registered with reflect = 1;
//      only cleared at quality 0) -> main pass (every layer by order) -> post(scene texture).
// Before each pass the engine binds that pass's target, sets the viewport, clears colour and depth,
// sets the winding, binds unit 1 (mirror; null during the mirror pass), unit 2 (cells) and unit 0
// (null), and uploads F. A layer's draw only binds its program and vertex array, calls state(), and
// draws.
import blit from './engine.glsl';
import { bindTarget, bindTex, FULL, gl, glInit, OPAQUE, prog, state, target, tex, tri, type Target } from './gl';
import { buildPlan, cells } from './plan';
import {
  BPM0, CELLS, F, LOOP, P, P_FOV, P_PITCH, P_ROLL, P_X, P_Y, P_YAW, P_Z, Q_DENSITY0, Q_DENSITY1,
  Q_R0_0, Q_R0_1, Q_R0_2, Q_R1_0, Q_R1_1, Q_R1_2, SEED, TILE, U_CAM, U_FADE, U_FWD, U_MIX, U_MOOD,
  U_RES, U_RIGHT, U_SUN, U_TIME, U_UP,
} from './contracts';

/** Size of the scene target in pixels: canvas size times the render scale, at least 1. Read-only;
 *  0 until the first frame. The main pass draws at this size; the mirror pass at half of it. */
export let sceneW = 0;
export let sceneH = 0;
/** Seconds since start, double precision, never wrapped. Read-only. F[U_TIME] is this modulo LOOP;
 *  a module that needs absolute time (the tour) reads this instead of keeping its own clock. */
export let time = 0;
/** Current quality 0, 1, 2 (section 11.1). Read-only; change it with setQuality. */
export let quality = 2;
/** Render scale 0.5..1 applied to the canvas size. The loop lowers it when frames run long and
 *  raises it when they are short; frame() leaves it alone. Read-only. */
export let scale = 1;

/** Near plane in metres. The projection has no far plane: depth reaches 1 only at infinity, so the
 *  sky (screen(), z = w) is behind everything. */
const NEAR = 0.5;

let canvas: HTMLCanvasElement;
let scene: Target;
let mirror: Target;
let cellTex: WebGLTexture;
let post: (scene: WebGLTexture) => void;
let moodTarget = 0;
let last = 0;
let slow = 0;
let fast = 0;
let avg = 16;
// [order, draw, reflect], kept sorted by order.
const layers: [number, (pass: number) => void, number][] = [];
const updates: ((dt: number) => void)[] = [];
const resizers: ((w: number, h: number) => void)[] = [];

/** Creates the context, builds the plan (SEED), uploads the cell texture, sets the quality for the
 *  device (0 on a touch-first device, else 2) and a default post that copies the scene to the
 *  canvas. Returns false when WebGL2 is missing; then nothing else may be called.
 *  Call first, before any init(). `if (!boot(canvas)) showMessage();` */
export function boot(c: HTMLCanvasElement): boolean {
  canvas = c;
  if (!glInit(c)) return false;
  gl.bindBufferBase(35345, 0, gl.createBuffer()); // UNIFORM_BUFFER, binding point 0 holds F
  buildPlan(SEED);
  cellTex = tex(CELLS, CELLS, cells);
  const p = prog(blit, blit);
  setPost((s) => {
    bindTarget(null);
    gl.useProgram(p);
    bindTex(0, s);
    state(FULL);
    tri();
  });
  // Direction to the sun: low over the horizon, straight ahead at yaw 0.
  F[U_SUN + 1] = 0.1;
  F[U_SUN + 2] = -0.995;
  F[U_FADE + 3] = 1;
  setQuality(matchMedia('(pointer:coarse)').matches ? 0 : 2);
  return true;
}

/** Registers a draw function, called once per pass with `pass` 0 (main) or 1 (mirror). Lower
 *  `order` draws first (contracts.ts, O_*; equal orders draw in registration order). With
 *  `reflect` = 1 it is also drawn in the mirror pass, at quality 1 and up. Call from init().
 *  Inside draw: bind your program, `state(...)`, draw. Do not bind framebuffers or touch the
 *  viewport or winding. `addLayer(O_BUILD, drawBoxes, 1);` */
export function addLayer(order: number, draw: (pass: number) => void, reflect = 0): void {
  layers.push([order, draw, reflect]);
  layers.sort((a, b) => a[0] - b[0]);
}

/** Registers a per-frame update, called with dt in seconds (clamped to 0.1 in the loop) after the
 *  clock and the default beat are written into F and before P is read. Updates run in registration
 *  order. The camera writes P here; audio may overwrite F[U_TIME + 2..3] and F[U_MIX..]. Never
 *  allocate in one. `addUpdate((dt) => { P[P_X] += 10 * dt; });` */
export function addUpdate(fn: (dt: number) => void): void {
  updates.push(fn);
}

/** Registers a callback for changes of the scene size (window resize, quality, render scale),
 *  called with the new sceneW and sceneH before the next pass. Resize targets in place there:
 *  `onResize((w, h) => { half = target(w >> 1, h >> 1, 0, half); });`
 *  It is not called at registration; the first frame always calls it (the scene starts at 0 x 0),
 *  so a post that sizes its targets here needs no other set-up. */
export function onResize(fn: (w: number, h: number) => void): void {
  resizers.push(fn);
}

/** Sets the function that turns the finished scene (linear HDR, RGBA16F) into the picture on the
 *  canvas. It is called once per frame after the main pass, with the scene texture; it must bind
 *  its own targets (`bindTarget(null)` for the canvas), units and state, and write alpha 1.
 *  F still holds the main pass's values. `setPost((s) => { ...; bindTex(0, s); ... });` */
export function setPost(fn: (scene: WebGLTexture) => void): void {
  post = fn;
}

/** Sets quality 0, 1 or 2 (section 11.1): pixel ratio cap 1, 1.5, 2; mirror pass off at 0; density
 *  F[U_RES + 3] 0.4, 0.7, 1; far fade R0/R1 into F[U_FADE], and fog density 1.2 / R1. Takes effect
 *  on the next frame, with no reload. `setQuality(1);` */
export function setQuality(q: number): void {
  quality = q;
  F[U_RES + 2] = q;
  F[U_RES + 3] = q ? q > 1 ? 1 : Q_DENSITY1 : Q_DENSITY0;
  F[U_FADE] = q ? q > 1 ? Q_R0_2 : Q_R0_1 : Q_R0_0;
  F[U_FADE + 1] = q ? q > 1 ? Q_R1_2 : Q_R1_1 : Q_R1_0;
  F[U_FADE + 2] = 1.2 / F[U_FADE + 1]!;
}

/** Sets the mood to ease towards (about a second): 0 sunset, 1 midnight, 2 miami. It moves forward
 *  through 0 -> 1 -> 2 -> 0, so stepping blends smoothly. `snap` = 1 jumps there at once (for the
 *  harness). `setMood((m + 1) % 3);` */
export function setMood(m: number, snap = 0): void {
  moodTarget = m % 3;
  if (snap) F[U_MOOD] = moodTarget;
}

/** Starts the frame loop on requestAnimationFrame. dt is clamped to 0.1 s, so a hidden tab (no
 *  frames) resumes without a jump. Adapts the render scale. Call once, after every init(). */
export function run(): void {
  requestAnimationFrame(loop);
}

function loop(ts: number): void {
  requestAnimationFrame(loop);
  const ms = ts - last;
  last = ts;
  if (ms < 100) {
    // Render scale: below about 50 fps for half a second, step down; at refresh rate for four
    // seconds, step back up.
    avg += (ms - avg) * 0.1;
    slow = avg > 20 ? slow + ms : 0;
    fast = avg < 17.5 ? fast + ms : 0;
    if (slow > 500 && scale > 0.5) scale *= 0.85, slow = 0;
    if (fast > 4000 && scale < 1) scale = Math.min(1, scale / 0.85), fast = 0;
  }
  render(time + Math.min(ms / 1000, 0.1));
}

/** Draws one frame at time `seconds`, outside the loop, for the harness and tests: updates run with
 *  dt = seconds minus the previous frame's time (the whole of seconds on the first call; never
 *  negative). Mood does not ease; use setMood(m, 1). The render scale is not adapted.
 *  `frame(12);` */
export function frame(seconds: number): void {
  render(seconds);
}

function render(seconds: number): void {
  const dt = Math.max(0, seconds - time);
  time = seconds;

  // Clock and the default beat (section 5.3, 7). Computed in double precision, then stored.
  const t = time % LOOP;
  const beats = time * BPM0 / 60;
  F[U_TIME] = t;
  F[U_TIME + 1] = t / LOOP;
  F[U_TIME + 2] = beats % 64;
  F[U_TIME + 3] = F[U_MIX] = (1 - beats % 1) ** 2;
  F[U_MIX + 1] = F[U_MIX + 2] = 0.5;
  for (const u of updates) u(dt);

  // Mood eases forward around the 0..3 circle.
  F[U_MOOD] = (F[U_MOOD]! + (moodTarget - F[U_MOOD]! + 3) % 3 * Math.min(1, dt * 3)) % 3;

  // Canvas and scene size.
  const ratio = Math.min(devicePixelRatio, 1 + quality / 2);
  const w = Math.max(1, canvas.clientWidth * ratio | 0);
  const h = Math.max(1, canvas.clientHeight * ratio | 0);
  if (canvas.width != w || canvas.height != h) canvas.width = w, canvas.height = h;
  const sw = Math.max(1, w * scale | 0);
  const sh = Math.max(1, h * scale | 0);
  if (sw != sceneW || sh != sceneH) {
    sceneW = sw;
    sceneH = sh;
    scene = target(sw, sh, 1, scene);
    mirror = target(sw >> 1 || 1, sh >> 1 || 1, 1, mirror);
    for (const f of resizers) f(sw, sh);
  }

  // Camera: wrap P into the tile in place (keeps float32 precision), then the basis and matrix.
  P[P_X] = P[P_X]! - TILE * Math.floor(P[P_X]! / TILE);
  P[P_Z] = P[P_Z]! - TILE * Math.floor(P[P_Z]! / TILE);
  F[U_CAM] = P[P_X]!;
  F[U_CAM + 1] = P[P_Y]!;
  F[U_CAM + 2] = P[P_Z]!;
  const cy = Math.cos(P[P_YAW]!), sy = Math.sin(P[P_YAW]!);
  const cp = Math.cos(P[P_PITCH]!), sp = Math.sin(P[P_PITCH]!);
  const cr = Math.cos(P[P_ROLL]!), sr = Math.sin(P[P_ROLL]!);
  const tanH = Math.tan(P[P_FOV]! / 2 || 0.55);
  // Unrolled basis: forward, then right and up rolled about it.
  F[U_FWD] = -sy * cp;
  F[U_FWD + 1] = sp;
  F[U_FWD + 2] = -cy * cp;
  F[U_RIGHT] = cy * cr + sy * sp * sr;
  F[U_RIGHT + 1] = cp * sr;
  F[U_RIGHT + 2] = -sy * cr + cy * sp * sr;
  F[U_UP] = sy * sp * cr - cy * sr;
  F[U_UP + 1] = cp * cr;
  F[U_UP + 2] = cy * sp * cr + sy * sr;
  F[U_RIGHT + 3] = tanH * sw / sh;
  F[U_UP + 3] = tanH;
  // uVP, column-major: rows are right / (tanH * aspect), up / tanH, then forward twice (an infinite
  // perspective: z = d - 2 NEAR, w = d, with d the distance along forward). The eye is (0, y, 0).
  for (let i = 0; i < 3; i++) {
    F[i * 4] = F[U_RIGHT + i]! / F[U_RIGHT + 3]!;
    F[i * 4 + 1] = F[U_UP + i]! / tanH;
    F[i * 4 + 2] = F[i * 4 + 3] = F[U_FWD + i]!;
  }
  const y = P[P_Y]!;
  F[12] = -y * F[4]!;
  F[13] = -y * F[5]!;
  F[14] = -y * F[6]! - 2 * NEAR;
  F[15] = -y * F[7]!;

  bindTex(0, null);
  bindTex(2, cellTex);
  // Mirror pass: the scene reflected in y = 0 (column 1 of uVP negated), which flips the winding.
  for (let i = 4; i < 8; i++) F[i] = -F[i]!;
  pass(1, mirror);
  for (let i = 4; i < 8; i++) F[i] = -F[i]!;
  pass(0, scene);
  post(scene[1]);
}

function pass(p: number, t: Target): void {
  bindTex(1, p ? null : mirror[1]);
  bindTarget(t);
  F[U_CAM + 3] = p;
  F[U_RES] = t[3];
  F[U_RES + 1] = t[4];
  gl.bufferData(35345, F, 35048); // UNIFORM_BUFFER, DYNAMIC_DRAW
  gl.frontFace(p ? 2304 : 2305); // CW : CCW
  state(OPAQUE); // so the clear reaches depth
  gl.clear(16640); // COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT
  if (!p || quality) for (const [, draw, reflect] of layers) if (!p || reflect) draw(p);
}

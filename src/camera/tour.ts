// The camera's mathematics: the tour, free flight and the hand-over between them. Owner: T11
// (plans/T11-camera.md).
//
// Pure: imports only contracts.ts and plan.ts, no DOM and no clock, so Vitest can fly it for hours.
// camUpdate(dt) advances in fixed steps of 1/60 s and writes P interpolated between the last two
// steps, so the pose depends only on the accumulated dt, however it is split into frames.
//
// The tour runs along the centre lines of the road corridors, which are free of buildings at every
// height (architecture.md section 5.4). A leg is a straight from (ox, oz) along `dir`, then at the
// junction either nothing (straight on) or a quarter arc of radius 2 * min(half-widths), which stays
// inside the two corridors. Each leg's turn is chosen when the leg starts, so the view can look ahead.
import { AV_HALF, AVE, CELL, P, SEED, ST_HALF, TILE } from '../contracts';
import { heightAt, megaCount, megas } from '../plan';

/** Input, written by the listeners in index.ts and read by the steps. */
export const IN = new Float32Array(6);
/** Held keys: bit 0 W, 1 S, 2 A, 3 D, 4 Q, 5 E, 6 to 9 the arrows left, right, up, down, 10 Shift. */
export const I_KEYS = 0;
/** Drag in CSS pixels since the last step; the step consumes it. */
export const I_DX = 1;
export const I_DY = 2;
/** Pointers down. */
export const I_DOWN = 3;
/** 1 under prefers-reduced-motion: half speed, no bank. */
export const I_CALM = 4;
/** Wheel delta since the last step; the step consumes it. Zooms the field of view. */
export const I_ZOOM = 5;

const STEP = 1 / 60;
const PI2 = Math.PI / 2;

// The leg: straight start, direction (0 +x, 1 +z, 2 -x, 3 -z; d + 1 is a right turn), straight
// length, turn at its end (-1 left, 0 none, 1 right) and its radius, distance flown along it, the
// heading yaw at its start (continuous, never wrapped), legs so far, and the megatower aimed at.
let ox = 0;
let oz = 0;
let dir = 0;
let len = 0;
let turn = 0;
let rad = 0;
let along = 0;
let yaw0 = 0;
let legs = 0;
let goal = 0;
// Tour point and heading (written by at()), blend offset after a rejoin, altitude and its rate,
// altitude target, ground speed.
let qx = 0;
let qz = 0;
let qyaw = 0;
let bx = 0;
let bz = 0;
let y = 0;
let vy = 0;
let alt = 0;
let speed = 0;
// Mode (0 tour, 1 flight), flight position and velocity.
let mode = 0;
let fx = 0;
let fz = 0;
let ux = 0;
let uy = 0;
let uz = 0;
// The view, free-look offsets, seconds since the last pointer went up, step accumulator.
let vYaw = 0;
let vPitch = 0;
let vRoll = 0;
let lYaw = 0;
let lPitch = 0;
let idle = 0;
let acc = 0;
let fov = 0;
// Pose after the last two steps, laid out as P.
const cur = new Float64Array(8);
const prev = new Float64Array(8);

const dx = (d: number): number => (1 - d) % 2;
const dz = (d: number): number => (2 - d) % 2;
/** Corridor half-width of the road line nearest to coordinate c. */
const half = (c: number): number => Math.round(c / CELL) % AVE ? ST_HALF : AV_HALF;
const clamp = (v: number, a: number): number => Math.max(-a, Math.min(a, v));
const smooth = (a: number, b: number, v: number): number => {
  v = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return v * v * (3 - 2 * v);
};
/** Nearest copy of a difference across the wrapped tile. */
const wrap = (v: number): number => v - TILE * Math.round(v / TILE);
/** 0..1 from an integer and the seed. */
function hash(n: number): number {
  let h = Math.imul(n ^ SEED, 0x9e3779b1);
  h = Math.imul(h ^ h >>> 15, 0x85ebca6b);
  return ((h ^ h >>> 13) >>> 0) / 4294967296;
}
/** Lowest safe eye height at a point: 2 m above the tallest roof within 2 m. */
function clear(x: number, z: number): number {
  return Math.max(heightAt(x - 2, z - 2), heightAt(x + 2, z - 2), heightAt(x - 2, z + 2), heightAt(x + 2, z + 2)) + 2;
}

/** Starts a leg at (px, pz) heading d, with the next junction dist metres ahead: chooses the turn
 *  there (seeded; prefers straight on, avenues, and the goal megatower) and the altitude target. */
function leg(px: number, pz: number, d: number, dist: number): void {
  px = Math.round(px);
  pz = Math.round(pz);
  ox = px - TILE * Math.floor(px / TILE);
  oz = pz - TILE * Math.floor(pz / TILE);
  dir = d;
  const jx = ox + dx(d) * dist;
  const jz = oz + dz(d) * dist;
  const mx = wrap(megas[goal * 3]! - jx);
  const mz = wrap(megas[goal * 3 + 1]! - jz);
  const m = Math.hypot(mx, mz) + 1;
  const hIn = half(d & 1 ? jx : jz);
  const hOut = half(d & 1 ? jz : jx);
  let best = -9;
  turn = 0;
  if (dist > 40) {
    for (let t = -1; t < 2; t++) {
      const n = d + t + 4 & 3;
      const s = (dx(n) * mx + dz(n) * mz) / m * 2 + +((t ? hOut : hIn) > ST_HALF) * 2 + +!t * .5 + hash(legs * 3 + t + 1) * 1.6;
      if (s > best) best = s, turn = t;
    }
  }
  rad = turn ? 2 * Math.min(hIn, hOut) : 0;
  len = dist - rad;
  const h = hash(-++legs);
  // Near the goal climb past it. Otherwise, at about one junction in five, a new target: mostly
  // 30..200 m, sometimes the street, sometimes high.
  if (m < 600) alt = 250 + h * 130;
  else if (h * 8 % 1 < .2) alt = h < .15 ? 6 + h * 40 : h < .85 ? 30 + (h - .15) * 243 : 200 + (h - .85) * 1300;
  if (m < 300) goal = (goal + 1) % megaCount, alt = 30 + h * 170;
}

/** Tour point and heading at distance s along the leg (past its end: the end heading). */
function at(s: number): void {
  const f = turn ? Math.min(Math.max(s - len, 0) / rad, PI2) : 0;
  const k = (turn ? Math.min(s, len) : s) + rad * Math.sin(f);
  const c = rad * (1 - Math.cos(f));
  const n = dir + turn + 4 & 3;
  qx = ox + dx(dir) * k + dx(n) * c;
  qz = oz + dz(dir) * k + dz(n) * c;
  qyaw = yaw0 - turn * f;
}

/** Puts the tour on the road line nearest to (x, z), heading the way along it closest to yaw. */
function rejoin(x: number, z: number, yaw: number): void {
  const ix = Math.round(x / CELL) * CELL;
  const iz = Math.round(z / CELL) * CELL;
  const hx = -Math.sin(yaw);
  const hz = -Math.cos(yaw);
  const ax = Math.abs(z - iz) < Math.abs(x - ix);
  const d = ax ? hx > 0 ? 0 : 2 : hz > 0 ? 1 : 3;
  const c = ax ? x : z;
  const r = c - CELL * Math.floor(c / CELL);
  const base = -(d + 1) * PI2;
  yaw0 = base + 4 * PI2 * Math.round((yaw - base) / (4 * PI2));
  leg(ax ? x : ix, ax ? iz : z, d, (ax ? hx : hz) > 0 ? CELL - r : r);
  along = 0;
  at(0);
  bx = x - qx;
  bz = z - qz;
  lYaw = lPitch = 0;
}

function out(x: number, z: number, yaw: number, pitch: number): void {
  cur[0] = x;
  cur[1] = y;
  cur[2] = z;
  cur[3] = yaw;
  cur[4] = clamp(pitch, 1.5);
  cur[5] = vRoll;
  cur[6] = fov;
}

function step(): void {
  const dt = STEP;
  const keys = IN[I_KEYS]!;
  // Drag, or the arrow keys at 1.5 rad/s.
  const lx = IN[I_DX]! * .004 + ((keys >> 6 & 1) - (keys >> 7 & 1)) * dt * 1.5;
  const ly = IN[I_DY]! * .004 + ((keys >> 8 & 1) - (keys >> 9 & 1)) * dt * 1.5;
  fov = Math.max(.5, Math.min(1.6, fov * Math.exp(IN[I_ZOOM]! * .001)));
  IN[I_DX] = IN[I_DY] = IN[I_ZOOM] = 0;
  if (mode) {
    // Free flight: velocity eases toward the keys' wish; the eye slides along walls, or is pushed up.
    vYaw += lx;
    vPitch = clamp(vPitch + ly, 1.5);
    const sy = Math.sin(vYaw);
    const cy = Math.cos(vYaw);
    const sp = Math.sin(vPitch);
    const cp = Math.cos(vPitch);
    const fwd = (keys & 1) - (keys >> 1 & 1) + +(IN[I_DOWN]! > 1);
    const side = (keys >> 3 & 1) - (keys >> 2 & 1);
    const v = keys & 1024 ? 150 : 30;
    const k = dt * 4;
    ux += ((-sy * cp * fwd + cy * side) * v - ux) * k;
    uy += ((sp * fwd + (keys >> 5 & 1) - (keys >> 4 & 1)) * v - uy) * k;
    uz += ((-cy * cp * fwd - sy * side) * v - uz) * k;
    let nx = fx + ux * dt;
    let nz = fz + uz * dt;
    y += uy * dt;
    if (y < clear(nx, nz)) {
      if (y >= clear(fx, nz)) nx = fx;
      else if (y >= clear(nx, fz)) nz = fz;
      else if (y >= clear(fx, fz)) nx = fx, nz = fz;
      else y = clear(nx, nz);
    }
    fx = nx;
    fz = nz;
    vRoll -= vRoll * k;
    out(fx, fz, vYaw, vPitch);
    return;
  }
  // Tour: brake for the coming arc, fly on, start the next leg at the end of this one.
  let vt = 40 + 50 * smooth(10, 150, y);
  if (turn) vt = Math.min(vt, Math.sqrt((rad * 2.4) ** 2 + 40 * Math.max(0, len - along)));
  speed = Math.min(speed + 15 * dt, vt);
  const v = IN[I_CALM] ? speed / 2 : speed;
  along += v * dt;
  const total = len + rad * PI2;
  if (along >= total) {
    at(total);
    along -= total;
    yaw0 = qyaw;
    leg(qx, qz, dir + turn + 4 & 3, CELL - rad);
  }
  vy += (clamp((alt - y) * .3, 25) - vy) * dt;
  y += vy * dt;
  // The view leads the motion by 0.7 s, turning at most 1.3 rad/s, banking with its turn rate.
  at(along + v * .7);
  const was = vYaw;
  vYaw += clamp((qyaw - vYaw) * 3, 1.3) * dt;
  vRoll += ((IN[I_CALM] ? 0 : clamp((vYaw - was) / dt * .35, .4)) - vRoll) * dt * 3;
  vPitch += (.06 - .5 * smooth(10, 300, y) + Math.atan2(vy, v) * .4 - vPitch) * dt * 2;
  at(along);
  bx -= bx * dt;
  bz -= bz * dt;
  y = Math.max(y, clear(qx + bx, qz + bz));
  // Free look: drag turns the view; 1.5 s after the last pointer goes up it eases back.
  idle = IN[I_DOWN] || keys & 960 ? 0 : idle + dt;
  lYaw += lx;
  lPitch = clamp(lPitch + ly, 1.4);
  if (idle > 1.5) lYaw -= lYaw * dt * 1.5, lPitch -= lPitch * dt * 1.5;
  out(qx + bx, qz + bz, vYaw + lYaw, vPitch + lPitch);
}

/** Starts the tour afresh, deterministically, on an avenue. */
export function camReset(): void {
  mode = legs = vy = vPitch = vRoll = acc = 0;
  y = alt = 60;
  fov = 1.1;
  speed = 50;
  idle = 9;
  goal = hash(1) * megaCount | 0;
  vYaw = 0;
  rejoin(2048, 2112, 0);
  step();
  prev.set(cur);
}

/** Toggles tour (0) and free flight (1) from the pose on screen; returns the new mode. */
export function camToggle(): number {
  if (mode ^= 1) {
    fx = P[0]!;
    fz = P[2]!;
    ux = wrap(cur[0]! - prev[0]!) / STEP;
    uy = vy;
    uz = wrap(cur[2]! - prev[2]!) / STEP;
  } else {
    speed = Math.hypot(ux, uz);
    vy = uy;
    rejoin(P[0]!, P[2]!, P[3]!);
  }
  y = P[1]!;
  vYaw = P[3]!;
  vPitch = P[4]!;
  vRoll = P[5]!;
  cur.set(P);
  prev.set(P);
  return mode;
}

/** The per-frame update: fixed steps, then P interpolated between the last two. */
export function camUpdate(dt: number): void {
  for (acc += dt; acc >= STEP; acc -= STEP) prev.set(cur), step();
  for (let i = 0; i < 7; i++) {
    const d = cur[i]! - prev[i]!;
    P[i] = prev[i]! + (i == 0 || i == 2 ? wrap(d) : d) * acc / STEP;
  }
}

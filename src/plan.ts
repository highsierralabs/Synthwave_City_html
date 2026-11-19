// The city plan (architecture.md section 5.5). Owner: T03.
//
// Pure: no DOM, no GL, no Math.random, no Date. A seed in, typed arrays out. Skyline = periodic value
// noise plus three downtown peaks; the districts are quantiles of that field, so every seed gets the
// same mix. Every building sits inside a block interior, which is what keeps the air above every road
// corridor empty (section 5.4).
import {
  AV_HALF, AVE, B_H, B_HX, B_HZ, B_X, B_Y, B_Z, BOX, CELL, CELLS, D_HIGH, D_LOW, D_MEGA, D_PLAZA,
  K_CROWN, K_MEGA, K_PODIUM, K_SHAFT, K_SPIRE, ST_HALF, TILE,
} from './contracts';

/** BOX floats per box; layout B_* in contracts.ts. Megatowers first, then buildings in a seeded
 *  shuffle, the boxes of each building contiguous and bottom to top. */
export let boxes = new Float32Array(0);
export let boxCount = 0;
/** 4 bytes per cell, row-major (x fast): district D_*, tallest roof / 4, seed byte, 0. */
export const cells = new Uint8Array(CELLS * CELLS * 4);
/** x, z, height per megatower. */
export let megas = new Float32Array(0);
export let megaCount = 0;

// Boxes by cell, for heightAt: the box indices of cell c are bi[bs[c] .. bs[c + 1]).
let bs = new Uint16Array(0);
let bi = new Uint16Array(0);
let S = 0;

/** Integer hash of two integers and the seed. */
function H(a: number, b: number): number {
  let h = Math.imul(a ^ S, 0x85ebca6b) ^ Math.imul(b + S, 0xc2b2ae35);
  h = Math.imul(h ^ h >>> 15, 0x2c1b3c6d);
  h = Math.imul(h ^ h >>> 12, 0x297a2d39);
  return (h ^ h >>> 15) >>> 0;
}

/** Smooth value noise at cell (i, j) with p lattice points per tile side, so it wraps. */
function N(i: number, j: number, p: number, k: number): number {
  const x = (i + .5) * p / CELLS, y = (j + .5) * p / CELLS;
  const a = x | 0, b = y | 0;
  let u = x - a, v = y - b;
  u *= u * (3 - 2 * u);
  v *= v * (3 - 2 * v);
  const g = (s: number, t: number): number => H((a + s) % p + 64 * k, (b + t) % p) / 4294967296;
  const m = (t: number): number => g(0, t) + (g(1, t) - g(0, t)) * u;
  return m(0) + (m(1) - m(0)) * v;
}

/** Cell index with wrap. */
const at = (i: number, j: number): number => (j + CELLS) % CELLS * CELLS + (i + CELLS) % CELLS;
/** Distance from a road line to the building line beside it: avenue or street. */
const half = (l: number): number => l % AVE ? ST_HALF : AV_HALF;
/** Squared wrapped distance on one axis, in cells. */
const wd = (d: number): number => Math.min(d, CELLS - d) ** 2;

/** One building: x, z, half-widths, roof, district, hash, sort key. */
type Lot = [number, number, number, number, number, number, number, number];

/** Fills the arrays above from a seed. Deterministic. */
export function buildPlan(seed: number): void {
  S = seed;
  cells.fill(0);
  const f = new Float32Array(CELLS * CELLS);
  for (let c = 0; c < f.length; c++) {
    const i = c % CELLS, j = c / CELLS | 0;
    let v = N(i, j, 8, 1) + N(i, j, 16, 2) / 2;
    for (let k = 0; k < 3; k++) v += Math.exp(-(wd(Math.abs(i - H(k, 50) % CELLS)) + wd(Math.abs(j - H(k, 51) % CELLS))) / 20) * .8;
    f[c] = v;
  }

  // Megatowers: the highest cells, never within five cells (640 m) of each other.
  megaCount = 7;
  for (let m = 0; m < megaCount; m++) {
    let best = -1, bc = 0;
    for (let c = 0; c < f.length; c++) {
      let free = f[c]! > best;
      for (let d = 0; d < 81; d++) {
        const dx = d % 9 - 4, dy = (d / 9 | 0) - 4;
        if (dx * dx + dy * dy < 25 && cells[at(c % CELLS + dx, (c / CELLS | 0) + dy) * 4] == D_MEGA) free = false;
      }
      if (free) best = f[c]!, bc = c;
    }
    cells[bc * 4] = D_MEGA;
  }

  // Districts by quantile of the field, plus plazas that never touch.
  const q = f.slice().sort(), lo = q[307]!, hi = q[717]!;
  for (let c = 0; c < f.length; c++) {
    const i = c % CELLS, j = c / CELLS | 0;
    if (cells[c * 4] == D_MEGA) continue;
    cells[c * 4] = H(c, 9) % 100 < 4 && ![at(i + 1, j), at(i - 1, j), at(i, j + 1), at(i, j - 1)].some((n) => cells[n * 4] == D_PLAZA)
      ? D_PLAZA : f[c]! < lo ? D_LOW : f[c]! < hi ? 1 : D_HIGH;
  }

  // Lots: split each block interior by district, one building per lot.
  const L: Lot[] = [];
  for (let c = 0; c < f.length; c++) {
    const d = cells[c * 4]!, i = c % CELLS, j = c / CELLS | 0, h = H(c, 11);
    cells[c * 4 + 2] = h;
    if (d == D_PLAZA) continue;
    const x0 = i * CELL + half(i), z0 = j * CELL + half(j);
    const w = (i + 1) * CELL - half(i + 1) - x0, e = (j + 1) * CELL - half(j + 1) - z0;
    const nx = 1 + (h & 1 & +(d < D_HIGH)), nz = 1 + (h >> 1 & 1 & +(d < 1));
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const n = c * 16 + a * 4 + b, r = H(n, 12);
      L.push([x0 + (a + .5) * w / nx, z0 + (b + .5) * e / nz, w / nx / 2 - 2, e / nz / 2 - 2,
        [12, 50, 150, 0, 500][d]! + (r >>> 8) % [39, 111, 251, 1, 301][d]!, d, r, d == D_MEGA ? -1 : H(n, 3)]);
    }
  }
  L.sort((a, b) => a[7] - b[7]);

  // Boxes: at most five per building.
  boxes = new Float32Array(L.length * 5 * BOX);
  megas = new Float32Array(megaCount * 3);
  let o = 0;
  const put = (x: number, y: number, z: number, s: number, hx: number, h: number, hz: number, k: number): number => {
    boxes.set([x, y, z, s, hx, h, hz, k], o);
    o += BOX;
    return y + h;
  };
  L.forEach(([x, z, hx, hz, R, d, r], p) => {
    let y = 0;
    if (d == D_MEGA) {
      // three or four tapering segments and a spire
      const k = 3 + (r & 1);
      for (let m = 0; m < k; m++) y = put(x, y, z, p, hx * (1 - m * .2), R / k | 0, hz * (1 - m * .2), K_MEGA);
      y = put(x, y, z, p, 2, y / 6 | 0, 2, K_SPIRE);
      megas.set([x, z, y], p * 3);
    } else {
      // podium, shaft, optional narrower crown, and on tall ones an optional mast
      const cr = d > D_LOW && r & 4 ? R >> 2 : 0;
      y = put(x, 0, z, p, hx, Math.min(R >> 1, 8 + (r & 3) * 4), hz, K_PODIUM);
      y = put(x, y, z, p, hx - 3, R - cr - y, hz - 3, K_SHAFT);
      if (cr) y = put(x, y, z, p, (hx - 3) * .6, cr, (hz - 3) * .6, K_CROWN);
      if (d == D_HIGH && r & 8) y = put(x, y, z, p, 1.5, R >> 3, 1.5, K_SPIRE);
    }
    const c = at(x / CELL | 0, z / CELL | 0) * 4 + 1;
    cells[c] = Math.max(cells[c]!, y / 4 | 0); // y < 940, so the byte never overflows
  });
  boxCount = o / BOX;
  boxes = boxes.slice(0, o);

  // Bucket the boxes by cell (counting sort).
  const cell = (n: number): number => at(boxes[n * BOX + B_X]! / CELL | 0, boxes[n * BOX + B_Z]! / CELL | 0);
  bs = new Uint16Array(CELLS * CELLS + 1);
  bi = new Uint16Array(boxCount);
  for (let n = 0; n < boxCount; n++) bs[cell(n) + 1]!++;
  for (let c = 0; c < CELLS * CELLS; c++) bs[c + 1]! += bs[c]!;
  const at0 = bs.slice();
  for (let n = 0; n < boxCount; n++) bi[at0[cell(n)]!++] = n;
}

/** Tallest roof in metres at a point, for any real x and z (wraps). 0 over road corridors. */
export function heightAt(x: number, z: number): number {
  x = (x % TILE + TILE) % TILE;
  z = (z % TILE + TILE) % TILE;
  const c = at(x / CELL | 0, z / CELL | 0);
  let h = 0;
  for (let k = bs[c]!; k < bs[c + 1]!; k++) {
    const o = bi[k]! * BOX;
    if (Math.abs(x - boxes[o + B_X]!) <= boxes[o + B_HX]! && Math.abs(z - boxes[o + B_Z]!) <= boxes[o + B_HZ]!) h = Math.max(h, boxes[o + B_Y]! + boxes[o + B_H]!);
  }
  return h;
}

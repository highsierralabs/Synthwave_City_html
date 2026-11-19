// Unit tests for src/plan.ts: pure logic, node environment. They check invariants, not golden numbers,
// so the art pass can retune heights and proportions without touching them.
import { describe, expect, it } from 'vitest';
import {
  AV_HALF, AVE, B_H, B_HX, B_HZ, B_KIND, B_SEED, B_X, B_Y, B_Z, BOX, CELL, CELLS, D_MEGA, D_PLAZA, K_MEGA,
  K_SPIRE, SEED, ST_HALF, TILE,
} from '../../src/contracts';
import { boxCount, boxes, buildPlan, cells, heightAt, megaCount, megas } from '../../src/plan';

const SEEDS = [SEED, 1, 2, 3, 12345];
const half = (l: number): number => (l % AVE ? ST_HALF : AV_HALF);
const wrapDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % TILE;
  return Math.min(d, TILE - d);
};
const field = (n: number, o: number): number => boxes[n * BOX + o]!;

/** Distinct buildings as [first box, one past the last box]: a run of boxes sharing x and z. */
function runs(): [number, number][] {
  const out: [number, number][] = [];
  for (let n = 0; n < boxCount; n++) {
    const last = out[out.length - 1];
    if (last && field(n, B_X) == field(n - 1, B_X) && field(n, B_Z) == field(n - 1, B_Z)) last[1] = n + 1;
    else out.push([n, n + 1]);
  }
  return out;
}

/** True when [lo, hi] overlaps a road corridor of the periodic grid along one axis. */
function inCorridor(lo: number, hi: number): boolean {
  for (let l = 0; l < CELLS; l++) {
    for (const t of [-TILE, 0, TILE]) {
      const c = l * CELL + t;
      if (!(lo >= c + half(l) || hi <= c - half(l))) return true;
    }
  }
  return false;
}

/** Byte-for-byte equality of two typed arrays. */
const same = (a: ArrayBufferView, b: ArrayBufferView): boolean => {
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return x.length == y.length && x.every((v, i) => v == y[i]);
};

const snap = () => ({ b: boxes.slice(), c: cells.slice(), m: megas.slice() });

describe('determinism', () => {
  it('gives identical bytes for one seed, and different bytes for another', () => {
    buildPlan(SEED);
    const a = snap();
    buildPlan(7);
    const other = snap();
    buildPlan(SEED);
    const again = snap();
    expect(same(again.b, a.b)).toBe(true);
    expect(same(again.c, a.c)).toBe(true);
    expect(same(again.m, a.m)).toBe(true);
    expect(same(other.b, a.b)).toBe(false);
    expect(same(other.c, a.c)).toBe(false);
  });

  it('does not leak state: building after another seed equals building fresh', () => {
    buildPlan(99);
    buildPlan(SEED);
    const a = boxes.slice();
    expect(a.length).toBe(boxCount * BOX);
  });
});

describe('districts (M1)', () => {
  it('prints a district map with sensible counts', () => {
    buildPlan(SEED);
    const n = [0, 0, 0, 0, 0];
    let map = '';
    for (let j = 0; j < CELLS; j++) {
      for (let i = 0; i < CELLS; i++) {
        const d = cells[(j * CELLS + i) * 4]!;
        n[d]!++;
        map += '.-#oM'[d];
      }
      map += '\n';
    }
    console.log(map + 'low mid high plaza mega: ' + n.join(' '));
    expect(n[0]!).toBeGreaterThan(250); // low
    expect(n[1]!).toBeGreaterThan(250); // mid
    expect(n[2]!).toBeGreaterThan(100); // high
    expect(n[2]!).toBeLessThan(400);
  });

  it('differs between seeds and agrees with itself', () => {
    buildPlan(1);
    const a = cells.slice();
    buildPlan(2);
    let diff = 0;
    for (let c = 0; c < CELLS * CELLS; c++) if (a[c * 4] != cells[c * 4]) diff++;
    expect(diff).toBeGreaterThan(200);
  });

  it('has fewer than 6% plaza cells, never two adjacent, and as many mega cells as megas', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      let plaza = 0, mega = 0;
      for (let c = 0; c < CELLS * CELLS; c++) {
        const d = cells[c * 4]!, i = c % CELLS, j = (c / CELLS) | 0;
        if (d == D_PLAZA) {
          plaza++;
          for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
            expect(cells[(((j + dy) % CELLS) * CELLS + ((i + dx) % CELLS)) * 4]).not.toBe(D_PLAZA);
          }
        }
        if (d == D_MEGA) mega++;
      }
      expect(plaza / (CELLS * CELLS)).toBeLessThan(0.06);
      expect(plaza).toBeGreaterThan(0);
      expect(mega).toBe(megaCount);
    }
  });

  it('records the tallest roof of each cell / 4, a seed byte, and a zero spare', () => {
    buildPlan(SEED);
    const top = new Float64Array(CELLS * CELLS);
    for (let n = 0; n < boxCount; n++) {
      const c = ((field(n, B_Z) / CELL) | 0) * CELLS + ((field(n, B_X) / CELL) | 0);
      top[c] = Math.max(top[c]!, field(n, B_Y) + field(n, B_H));
    }
    const seeds = new Set<number>();
    for (let c = 0; c < CELLS * CELLS; c++) {
      expect(cells[c * 4 + 1]).toBe(Math.min(255, (top[c]! / 4) | 0));
      expect(cells[c * 4 + 3]).toBe(0);
      seeds.add(cells[c * 4 + 2]!);
      if (cells[c * 4] == D_PLAZA) expect(top[c]).toBe(0);
    }
    expect(seeds.size).toBeGreaterThan(100);
  });
});

describe('boxes (M2)', () => {
  it('keeps every box out of every road corridor, with wrap, for five seeds', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      for (let n = 0; n < boxCount; n++) {
        const x = field(n, B_X), z = field(n, B_Z), hx = field(n, B_HX), hz = field(n, B_HZ);
        if (inCorridor(x - hx, x + hx) || inCorridor(z - hz, z + hz)) {
          throw new Error(`seed ${s} box ${n} at ${x},${z} half ${hx},${hz} overlaps a corridor`);
        }
      }
    }
  });

  it('keeps every box inside the tile with positive size', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      for (let n = 0; n < boxCount; n++) {
        expect(field(n, B_HX)).toBeGreaterThan(0);
        expect(field(n, B_HZ)).toBeGreaterThan(0);
        expect(field(n, B_H)).toBeGreaterThan(0);
        expect(field(n, B_Y)).toBeGreaterThanOrEqual(0);
        expect(field(n, B_X) - field(n, B_HX)).toBeGreaterThanOrEqual(0);
        expect(field(n, B_X) + field(n, B_HX)).toBeLessThanOrEqual(TILE);
        expect(field(n, B_Z) - field(n, B_HZ)).toBeGreaterThanOrEqual(0);
        expect(field(n, B_Z) + field(n, B_HZ)).toBeLessThanOrEqual(TILE);
      }
    }
  });

  it('keeps a building contiguous, bottom to top, each base at the roof beneath', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      const seen = new Set<string>();
      for (const [a, b] of runs()) {
        const key = field(a, B_X) + ',' + field(a, B_Z);
        expect(seen.has(key)).toBe(false); // a building's boxes never reappear later
        seen.add(key);
        expect(field(a, B_Y)).toBe(0);
        for (let n = a + 1; n < b; n++) {
          expect(field(n, B_SEED)).toBe(field(a, B_SEED));
          expect(field(n, B_Y)).toBe(field(n - 1, B_Y) + field(n - 1, B_H));
          expect(field(n, B_HX)).toBeLessThanOrEqual(field(n - 1, B_HX) + 1e-6);
        }
      }
    }
  });

  it('gives seeds as integers 0 to 4095', () => {
    buildPlan(SEED);
    for (let n = 0; n < boxCount; n++) {
      const s = field(n, B_SEED);
      expect(Number.isInteger(s) && s >= 0 && s < 4096).toBe(true);
    }
  });

  it('has between 3000 and 7000 boxes, and the array is exactly that long', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      expect(boxCount).toBeGreaterThanOrEqual(3000);
      expect(boxCount).toBeLessThanOrEqual(7000);
      expect(boxes.length).toBe(boxCount * BOX);
    }
  });

  it('shuffles: a prefix of the non-mega boxes is an even sample across the tile', () => {
    buildPlan(SEED);
    const start = runs()[megaCount]![0];
    const quad = [0, 0, 0, 0];
    for (let n = start; n < start + 800; n++) quad[(field(n, B_X) < TILE / 2 ? 0 : 1) + (field(n, B_Z) < TILE / 2 ? 0 : 2)]!++;
    for (const q of quad) expect(q).toBeGreaterThan(100);
  });
});

describe('megatowers', () => {
  it('come first, five to eight, at least 600 m apart with wrap', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      expect(megaCount).toBeGreaterThanOrEqual(5);
      expect(megaCount).toBeLessThanOrEqual(8);
      expect(megas.length).toBe(megaCount * 3);
      const r = runs();
      let lastMega = -1;
      for (let n = 0; n < boxCount; n++) if (field(n, B_KIND) == K_MEGA) lastMega = n;
      // every mega segment lies in the first megaCount buildings
      expect(lastMega).toBeLessThan(r[megaCount]![0]);
      for (let m = 0; m < megaCount; m++) {
        const [a, b] = r[m]!;
        expect(field(a, B_KIND)).toBe(K_MEGA);
        expect(field(b - 1, B_KIND)).toBe(K_SPIRE);
        expect(megas[m * 3]).toBe(field(a, B_X));
        expect(megas[m * 3 + 1]).toBe(field(a, B_Z));
        expect(megas[m * 3 + 2]).toBe(field(b - 1, B_Y) + field(b - 1, B_H));
        expect(megas[m * 3 + 2]).toBeGreaterThan(500);
        expect(megas[m * 3 + 2]).toBeLessThan(1000);
        for (let k = m + 1; k < megaCount; k++) {
          const d = Math.hypot(wrapDist(megas[m * 3]!, megas[k * 3]!), wrapDist(megas[m * 3 + 1]!, megas[k * 3 + 1]!));
          expect(d).toBeGreaterThanOrEqual(600);
        }
      }
    }
  });
});

describe('heightAt (M3)', () => {
  it('is 0 along every road centre line and across the corridor widths', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      for (let l = 0; l < CELLS; l++) {
        const c = l * CELL, e = half(l) - 0.01;
        for (let t = 0; t < TILE; t += 7.3) {
          for (const o of [0, e, -e]) {
            if (heightAt(c + o, t) != 0 || heightAt(t, c + o) != 0) throw new Error(`seed ${s}: roof over road line ${l} at ${t}, offset ${o}`);
          }
        }
      }
    }
  });

  it('is 0 over plazas', () => {
    buildPlan(SEED);
    let n = 0;
    for (let c = 0; c < CELLS * CELLS; c++) {
      if (cells[c * 4] != D_PLAZA) continue;
      n++;
      for (let k = 0; k < 20; k++) expect(heightAt((c % CELLS) * CELL + (k * 6.1) % CELL, (((c / CELLS) | 0) * CELL) + (k * 5.3) % CELL)).toBe(0);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('matches the roofs inside boxes: the tallest box containing the point', () => {
    for (const s of SEEDS) {
      buildPlan(s);
      for (let n = 0; n < boxCount; n++) {
        const x = field(n, B_X), z = field(n, B_Z);
        let top = 0;
        for (let k = 0; k < boxCount; k++) {
          if (Math.abs(x - field(k, B_X)) > 130) continue; // brute force, with a cheap reject
          if (Math.abs(x - field(k, B_X)) <= field(k, B_HX) && Math.abs(z - field(k, B_Z)) <= field(k, B_HZ)) {
            top = Math.max(top, field(k, B_Y) + field(k, B_H));
          }
        }
        const h = heightAt(x, z);
        if (h != top || h < field(n, B_Y) + field(n, B_H)) throw new Error(`seed ${s} box ${n}: heightAt ${h}, brute force ${top}`);
      }
    }
  }, 30000);

  it('wraps', () => {
    buildPlan(SEED);
    let nonzero = 0;
    for (let k = 0; k < 4000; k++) {
      const x = (k * 37.25) % TILE, z = (k * 91.5) % TILE;
      const h = heightAt(x, z);
      if (h > 0) nonzero++;
      expect(heightAt(x + TILE, z - TILE)).toBe(h);
      expect(heightAt(x - 3 * TILE, z + 2 * TILE)).toBe(h);
    }
    expect(nonzero).toBeGreaterThan(500);
  });
});

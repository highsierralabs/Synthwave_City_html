// The city plan (architecture.md section 5.5). Owner: T03.
//
// STUB: the final signatures and a trivial city (one box in the middle of every block), so the
// engine and the probe have something to draw. T03 replaces the bodies.
import { BOX, CELL, CELLS, TILE } from './contracts';

/** BOX floats per box; layout B_* in contracts.ts. Megatowers first, then buildings in a seeded
 *  shuffle, the boxes of each building contiguous and bottom to top. */
export let boxes = new Float32Array(0);
export let boxCount = 0;
/** 4 bytes per cell, row-major (x fast): district D_*, tallest roof / 4, seed byte, 0. */
export let cells = new Uint8Array(CELLS * CELLS * 4);
/** x, z, height per megatower. */
export let megas = new Float32Array(0);
export let megaCount = 0;

/** Fills the arrays above from a seed. Deterministic. */
export function buildPlan(seed: number): void {
  boxCount = CELLS * CELLS;
  boxes = new Float32Array(boxCount * BOX);
  for (let i = 0; i < boxCount; i++) {
    const h = 20 + ((i * 2654435761 + seed) >>> 0) % 200;
    boxes.set([(i % CELLS + 0.5) * CELL, 0, ((i / CELLS | 0) + 0.5) * CELL, i % 4096, 30, h, 30, 1], i * BOX);
    cells[i * 4 + 1] = h / 4;
  }
  megas = new Float32Array(0);
  megaCount = 0;
}

/** Tallest roof in metres at a point, for any real x and z (wraps). 0 over road corridors. */
export function heightAt(x: number, z: number): number {
  const fx = ((x % TILE) + TILE) % TILE, fz = ((z % TILE) + TILE) % TILE;
  const i = (fx / CELL | 0) + (fz / CELL | 0) * CELLS;
  return Math.abs(fx % CELL - CELL / 2) < 30 && Math.abs(fz % CELL - CELL / 2) < 30 ? boxes[i * BOX + 5]! : 0;
}

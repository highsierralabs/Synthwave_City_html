---
id: T03-city-plan
title: The deterministic city
status: ready
depends_on: []
owns: [src/plan.ts, tests/plan/**, plans/T03-city-plan.md]
reads: [architecture.md, Agents.md, src/contracts.ts]
budget: 1100
executor: sonnet/high
updated: 2026-11-18
---

# T03: city plan

## 1. Purpose

Give every layer the same city: where each building stands, how tall it is, which districts are low,
tall or open plaza, and where the megatowers are. From a seed, with no asset and no randomness that
is not seeded, so the skyline is the same on every machine and every run.

## 2. Context and orientation

§5.4 and §5.5 are the design. The tile is 32 x 32 cells of 128 m. Roads run along every cell boundary
(the lines at multiples of `CELL`); every fourth is an avenue. A building may occupy only the block
interior: at least `ST_HALF` (or `AV_HALF` beside an avenue) from the road centre line on each side.
That is the invariant every other module relies on: **the air above every road corridor is empty at
any height**.

`src/plan.ts` exists as a stub with the final export signatures and a trivial city. Replace the body;
keep the signatures. `src/contracts.ts` has the box layout (`BOX`, `B_*`), the kinds (`K_*`), the
districts (`D_*`) and `SEED`.

This module ships in the file, so read Agents.md, "Writing for the packer", before writing it: flat
functions, typed arrays, no objects, no tables.

## 3. Scope

Owned: `src/plan.ts`, `tests/plan/**`.

Not in scope: drawing anything, lanes, billboard or beacon sites (§5.5: those are derived by the
layers), collision response (T11 uses `heightAt`).

## 4. Interfaces

Provides the `plan.ts` row of §10.4, exactly as in the stub:

- `buildPlan(seed)` fills the arrays below. Calling it twice with one seed gives identical bytes.
- `boxes` (`Float32Array`, `BOX` floats per box, layout in `contracts.ts`), `boxCount`.
- `cells` (`Uint8Array`, 4 bytes per cell, row-major with x as the fast index): district, tallest
  roof in the cell divided by 4 and clamped to 255, a seed byte, zero.
- `megas` (`Float32Array`, x, z, height per megatower), `megaCount`.
- `heightAt(x, z)`: tallest roof at that point in metres, for any real x and z (wraps); 0 over road
  corridors and plazas.

Order of `boxes`: megatowers first, then the other buildings in a seeded shuffle, each building's
boxes contiguous and bottom to top. A renderer that draws a prefix of the array then gets an even
sample of whole buildings, and never loses a megatower.

Seeds in the box layout are integers 0 to 4095 stored as floats, one per building.

## 5. Plan of work

**M1. Skyline field and districts.** A seeded integer hash and smooth value noise over the cell grid,
periodic in 32 cells so the tile wraps without a seam, plus two or three downtown peaks. Classify
cells: `low`, `mid`, `high` by the field; about 4% `plaza` (no building; never two adjacent); five to
eight `mega` cells at the peaks, at least 600 m apart measured with wrap, so that a megatower is in
most views but two copies of one never share a view. *Proof:* a test prints the district map as text;
counts per district are in sensible ranges; the map is identical for one seed and different for
another.

**M2. Lots and boxes.** Split each block interior into lots (one to four, by district; megas take the
whole block). A building is a podium, a shaft, optionally a narrower crown or setback, and for tall
ones a thin spire; megatowers are a stack of three or four tapering segments and a spire. Heights by
district as §5.5. Every box lies inside its lot with a small margin. Shuffle by building.
*Proof:* invariant tests (below).

**M3. `heightAt`.** A coarse raster of roof heights filled once in `buildPlan` (for instance 4 m
cells over the tile) and a wrapped lookup. *Proof:* for every box, `heightAt` at its centre is at
least its roof; for points on every road centre line it is 0.

**M4. Measure and trim.** `npm run size -- plan` when T00's script exists (it is being written at the
same time; if it is not there yet, report the minified size of the module from a direct esbuild and
terser run instead, and say which). Trim toward 1,100 bytes without losing the invariants.

## 6. Validation and acceptance

`npx vitest run tests/plan` passes, covering at least:

- determinism: same seed gives byte-identical `boxes`, `cells`, `megas`; another seed differs;
- no box overlaps any road corridor, measured with wrap, for five seeds;
- every box is inside the tile and has positive size; a building's boxes are contiguous and stack
  (each base at or below the roof of the one beneath);
- megatowers come first, number five to eight, and are at least 600 m apart with wrap;
- box count between 3,000 and 7,000; fewer than 6% plaza cells;
- `heightAt` is 0 on corridors and plazas, matches roofs inside boxes, and wraps
  (`heightAt(x + TILE, z - TILE) === heightAt(x, z)`).

One invariant test was seen to fail first (for example by shrinking the corridor margin).

`npm run check:task -- T03` exits 0 once T00 provides it; until then `npx tsc --noEmit` shows no
error in `src/plan.ts`.

Human checks: none here; whether the skyline looks good is judged in T05 and T13, which may ask for
numbers to change.

## 7. Idempotence and recovery

Pure code and tests. Safe to re-run.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

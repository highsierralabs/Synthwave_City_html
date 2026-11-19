---
id: T03-city-plan
title: The deterministic city
status: done
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

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan, src/contracts.ts and the stub; status set to in-progress.
- [x] 2026-11-18 M1 skyline field, districts, megatowers, plazas. District map printed by the test and checked by eye (section 12).
- [x] 2026-11-18 M2 lots and boxes (podium, shaft, optional crown, optional mast; megas are three or four tapering segments and a spire), shuffled by building, megas first.
- [x] 2026-11-18 M3 `heightAt` by per-cell box buckets (exact, no raster).
- [x] 2026-11-18 M4 measured: marginal 1,100 bytes against a budget of 1,100 (section 12 says how, and how rough it is).
- [x] 2026-11-18 Acceptance run (section 6 evidence below); status done.

Left: nothing in scope. `npm run size -- plan` and `npm run check:task -- T03` did not exist yet (`scripts/` was
empty), so they were not run; the orchestrator should run both once T00 lands.

## 9. Surprises and discoveries

- `tsconfig.json` has `"types": []`, so `Buffer` and other Node globals do not typecheck in tests. The determinism test
  compares bytes through `Uint8Array` views instead. Evidence: `tsc` error TS2591 on the first draft of the test.
- `expect()` inside a loop of hundreds of thousands of calls is very slow in Vitest 5.1 (the first heightAt test took over
  5 s and timed out). The heavy loops now throw a plain `Error` with the failing seed and box; the one O(n^2) brute-force
  test has a 30 s timeout and runs in about 3.6 s.
- With the 3.6 s brute force and an idle machine, the whole plan suite takes about 7 s; other executors running at the
  same time will inflate that.

## 10. Decision log

- 2026-11-18 **`heightAt` is exact, from per-cell box buckets, not a 4 m raster.** Reason: a raster needs 1 M entries (or an
  8 m raster would put roof over the corridor edge), while a counting sort of the boxes by cell is about six lines, tiny
  in memory, and returns the true tallest roof of any box containing the point. Cost per call is a loop over about ten boxes.
- 2026-11-18 **Districts are quantiles of the field (40% low, 40% mid, 20% high before megas and plazas), not fixed
  thresholds.** Reason: every seed gets the same mix, and the tests do not depend on the noise scale.
- 2026-11-18 **Lot margin is 2 m on each side of every lot**, on top of the block interior already being `ST_HALF` or
  `AV_HALF` from each road line, so a box edge is at least 12 m (street) or 20 m (avenue) from a centre line and neighbouring
  buildings have a 4 m gap. The tests measure against the bare corridor half-widths.
- 2026-11-18 **All heights are integers and the box seed is the building's position in the shuffled order** (`p & 4095`), so
  stacking is exact in float32 (base equals the roof beneath, tested with `toBe`) and seeds within one build are unique below
  4,096 buildings. A building is identified in tests as a run of boxes with equal x and z.
- 2026-11-18 **`cells` is `export const` (filled in place, reset with `fill(0)`) where the stub had `export let`.** The
  binding is never reassigned, so importers cannot tell the difference; noted in case a gate compares declarations.
- 2026-11-18 **No clamp of the roof byte to 255.** The tallest possible roof is about 940 m (megatower plus spire), which is
  235 in the byte. The test still computes `min(255, roof / 4 | 0)`. If the art pass makes anything taller than 1,020 m, add
  the clamp.
- 2026-11-18 Megatowers: seven, greedy from the highest cell of the skyline field, never within five cells (640 m, so
  at least about 629 m between box centres after the avenue offsets); height 500 to 800 m plus a spire of one sixth of that.
  Tests use the 600 m floor from the plan.

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**Result.** `src/plan.ts` builds the city from a seed in about 17 ms (observed, one run in Node 24, cold): 3,904 boxes for
seed 1984 (3,000 to 7,000 for all five tested seeds), 7 megatowers whose total heights with spire are 591, 591, 625, 654, 658, 686 and
868 m (the `megas` array; the 868 m one is simply the tallest draw of 500 to 800 m plus a spire of one sixth; the design upper bound is about 940 m), 38 plaza cells of 1,024 (3.7%). District map for seed 1984
(`.` low, `-` mid, `#` high, `o` plaza, `M` mega): counts 391 low, 396 mid, 192 high, 38 plaza, 7 mega; the high cells
form a few large downtown masses with megas inside them, mid rings them, low fills the rest, and plazas are scattered
singly. That is the shape section 5.5 asks for. Whether it *looks* right from the street is for T05 and T13.

**Bytes.** Marginal packed cost 1,100 bytes against a budget of 1,100. Method (no `npm run size` existed): esbuild
bundles an entry that imports `src/plan.ts` and uses every export (`--minify-syntax`, `DEV=false`), terser with
`toplevel` mangling and 3 passes, then Node `deflateRawSync` level 9. The module run that way is 2,646 characters minified
and 1,309 bytes deflated; the same entry against a reconstruction of the original stub is 209 bytes; the difference is
1,100. This is rougher than the real build (no shared deflate context, no zopfli, the entry itself is in both numbers),
so treat it as within a few percent of the budget, not as proof of meeting it. Possible cuts if the ledger needs bytes: the second noise octave, the mast on tall towers, the crown, the
mid-district two-lot split. None was measured, so no byte figure is claimed for any of them.

**Not verified.** `npm run size -- plan`, `npm run check:task -- T03` and `npm run plans:check` (T00 scripts absent);
the unminified-versus-packed equivalence of this module (needs `verify`); how the skyline looks (no layer draws it yet);
behaviour on a phone. Determinism was tested within one Node process and one seed order; cross-engine determinism
rests on integer arithmetic (`Math.imul`, `>>>`) plus `Math.exp`, `Math.min`, `**`, and float division, and `Math.exp` in
the peak term is the one call whose last bit could differ between JavaScript engines (it only moves a field value by
about 1e-16, which could reorder two cells whose field values tie to that precision; not tested).

**Evidence (acceptance, run 2026-11-18).**

- `npx vitest run tests/plan`: 17 tests passed, about 7 s. Covers determinism (same seed byte-identical across
  `boxes`, `cells`, `megas`, a different seed differs, state does not leak), districts, corridors with wrap for five seeds
  (1984, 1, 2, 3, 12345), tile bounds, positive sizes, contiguity and stacking, megas first, five to eight, at least 600 m
  apart with wrap, 3,000 to 7,000 boxes, under 6% plaza and never adjacent, `heightAt` zero on all road lines and across
  corridor widths and plazas, equal to a brute-force tallest-box-containing-the-point for every box of five seeds, and
  wrapping.
- A test seen to fail first: changing the lot half-width from `w / nx / 2 - 2` to `w / nx / 2 - 2 + 12` failed two tests,
  "keeps every box out of every road corridor" (`seed 1984 box 0 at 1728,320 half 64,52 overlaps a corridor`) and "heightAt
  is 0 along every road centre line" (`roof over road line 0 at 21.9, offset 17.99`). The change was reverted and all 17 pass.
- `npx tsc --noEmit -p tsconfig.json`: no output (no errors in the whole tree at that moment).

---
id: T05-buildings
title: Neon towers
status: ready
depends_on: [T00, T03]
owns: [src/buildings/**, plans/T05-buildings.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2800
executor: opus/high
updated: 2026-11-18
---

# T05: buildings

## 1. Purpose

The city itself: thousands of towers lit from inside and trimmed in neon, from low blocks to
megatowers that reach a kilometre. This is the layer that makes a viewer say "city", and the one most
of the screen is made of.

## 2. Context and orientation

Read §5 (world model), §6 (look, especially the light bands of §6.2) and §10. How a layer works is
§4.5: `src/buildings/index.ts` exports `init()`, which compiles a program with `prog()`, uploads the
plan's `boxes` as per-instance attributes, and registers a draw function with `addLayer`. `src/gl.ts`
and `src/engine.ts` document every helper in comments above each export; those files are the
reference. `dev/probe/` is a small working layer that already draws the plan's boxes flat-shaded:
read it first, and start from its idioms.

Every box is a unit cube from `cube()` in `common.glsl`, scaled by the box's half-widths and height
and placed with `place()`. All boxes are one instanced draw call. The fragment shader builds the
facade procedurally **in metres**, from the position on the face, the face normal, and integer hashes
of the building's seed, so that windows are the same size on every tower.

The box layout and kinds (`K_PODIUM`, `K_SHAFT`, `K_CROWN`, `K_MEGA`, `K_SPIRE`) are in
`src/contracts.ts`. Boxes of one building share a seed, so its segments share colours and window
rhythm.

## 3. Scope

Owned: `src/buildings/**` (`index.ts` and `.glsl` files).

Must have: window grid (floors about 3.5 m, bays 2 to 4 m, chosen per building) with a hashed pattern
of lit and dark windows in a few warm and cool colours at L1, some flickering or switching slowly;
neon edge trim on vertical corners or roof lines at L2 in palette colours picked per building; dark
indigo walls at L0, never black; lit crowns on tall buildings; spires with a blinking red tip;
megatowers visibly different (bands of light, larger scale); roofs that are not blank when seen from
above; detail that fades to its average colour when a window is smaller than a pixel; fog on
everything.

Optional, cut first if over budget, in this order: equaliser facades that pulse with `uMix`, animated
sign panels on facades, storefront strips at street level, horizontal light bands that travel.

Not in scope: billboards and beacons (T08), anything on the street (T06).

## 4. Interfaces

Consumes: `prog`, `inst`, `state` and the draw helper from `src/gl.ts`; `addLayer` from
`src/engine.ts`; `boxes`, `boxCount` from `src/plan.ts`; `BOX`, `K_*`, `O_BUILD` from
`src/contracts.ts`; the block `F`, `cube`, `place`, `fog`, `pal`, hashes and filtered-line helpers
from `src/common.glsl`.

Provides: `init()` from `src/buildings/index.ts`, registering at `O_BUILD` with `reflect = 1`. The
draw count is `boxCount` scaled by the density in `F[U_RES + 3]`.

## 5. Plan of work

**M1. Boxes with windows.** Instanced cubes with per-instance seed and kind as `flat` varyings; the
window grid with correct metres on all four sides, filtered: take `fwidth` before `fract`, and blend
to the average lit fraction as a window shrinks under two pixels. *Proof:* a near shot where single
windows are crisp; a far shot from 1,200 m where facades are calm; an eight-frame sequence moving
sideways 3 m per frame with no shimmer.

**M2. Identity per building.** Colours from the palette by hash, window proportions, lit fraction by
district kind, trim, crowns, spires, megatower treatment. *Proof:* a skyline shot in which no two
neighbouring towers look alike and megatowers stand out.

**M3. Light levels.** Check against §6.2 with post on (post arrives from T09 during this wave; until
it does, judge with the plain blit and note it). Large areas at or under L1; trim at L2.
*Proof:* image statistics from `shot.mjs` show the frame is not clipped; described in this plan.

**M4. Roofs, mirror pass, optional items, then measure.** Confirm buildings appear in the road
reflection (`--layers backdrop,buildings`; if the backdrop is not ready, use `probe`).
`npm run size -- buildings`; trim or cut toward the budget.

## 6. Validation and acceptance

- Shots, each opened and described in this plan: street level looking up a canyon; 300 m skyline
  toward the sun; 1,200 m overview; straight down from 800 m; close on one megatower.
- The sideways sequence shows no shimmer; the flight across the tile edge shows no seam and no pop at
  the far fade.
- With `--q 0` (density 0.4) the city is thinner but no building is cut in half.
- No console errors or unexplained shader warnings in `shot.mjs` output.
- `npm run check:task -- T05` exits 0. Measured bytes are recorded against the budget.

Human checks: whether the towers carry the parent's look
(`C:\highsierralabs\Synthwave_City\docs\screenshots\skyline.png` and `rooftops.png`).

## 7. Idempotence and recovery

Shots go in `shots/T05/`, scratch in `.tmp/T05/`. Both can be deleted at any time.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

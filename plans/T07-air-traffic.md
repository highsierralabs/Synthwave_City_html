---
id: T07-air-traffic
title: Flying vehicles
status: ready
depends_on: [T00, T03]
owns: [src/air/**, plans/T07-air-traffic.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2300
executor: opus/medium
updated: 2026-11-18
---

# T07: air traffic

## 1. Purpose

Rivers of flying vehicles between the towers: stacked lanes of craft with engine glow and long light
trails, crossing over and under each other at every avenue junction. It is the image people remember
from this kind of city, and the tour flies among them.

## 2. Context and orientation

Read §5 (especially §5.3 on loop-periodic motion and §5.5 on sky lanes), §6.2 and §10. How a layer
works is §4.5: `src/air/index.ts` exports `init()` and registers draw functions with `addLayer`.
`src/gl.ts` and `src/engine.ts` document every helper in comments above each export; `dev/probe/` is
a small working layer to copy idioms from.

Sky lanes run above the **avenues** only (road lines whose index is a multiple of `AVE`), because the
air above a road corridor is free of buildings at any height. Lanes that run along x and lanes that
run along z use different altitudes, so crossing traffic never meets. Suggested levels: x-lanes at
90, 190 and 290 m, z-lanes at 140, 240 and 340 m, two directions per level side by side, with a few
metres of hashed offset per craft so a lane is a loose stream and not a wire.

Nothing needs CPU data beyond a count: a craft is instance `i`, hashed to an avenue, an axis, a level,
a direction, a phase and an integer speed in laps per loop; position along the lane is
`fract(laps * uTime.y + phase) * TILE`. Trails are camera-facing strips from `ribbon()` in
`common.glsl`, stretched behind the craft along its lane. Everything is placed with `place()`.

## 3. Scope

Owned: `src/air/**` (`index.ts` and `.glsl` files).

Must have: a few thousand craft; small dark hulls with a coloured underglow; an engine glow at L3;
a trail at L2 in the craft's palette colour, fading along its length; a white or red strobe on some;
speeds faster than street traffic (30 to 90 m/s); streams visible to the far fade as lines of light.

Optional, cut first if over budget, in this order: a handful of large slow ships with rows of lights,
craft that bank or bob, descending spirals around megatowers.

Not in scope: ground traffic (T06), beams and billboards (T08).

## 4. Interfaces

Consumes: `prog`, `state` and the instanced draw helper from `src/gl.ts`; `addLayer` from
`src/engine.ts`; `O_VEHICLE`, `O_GLOW`, `AVE` and the grid constants from `src/contracts.ts`; the
block `F`, `cube`, `quad`, `ribbon`, `place`, `fog`, `pal` and hashes from `src/common.glsl`.

Provides: `init()` from `src/air/index.ts`. Glows and trails register with `reflect = 1` so the wet
streets catch them. Draw counts scale with the density in `F[U_RES + 3]`.

## 5. Plan of work

**M1. Trails and glows.** They carry the look at every distance. *Proof:* a shot from 250 m along an
avenue shows stacked streams in both directions at three levels; a shot from 900 m shows the lanes as
a lattice of light above the avenues.

**M2. Hulls.** Shaped cubes with heading. *Proof:* a close shot from inside a lane where single craft
are recognisable as vehicles.

**M3. Motion.** An eight-frame sequence at 0.1 s per frame: craft advance smoothly, trails follow,
nothing jitters; frames at `--t 4095.9` and `--t 0.1` are continuous.

**M4. Crossings and clearance.** With `--layers buildings,air` (or `probe,air`), no craft passes
through a building, and x and z streams cross at different heights. *Proof:* a shot at an avenue
junction from 200 m.

**M5. Optional items, then measure.** `npm run size -- air`; trim or cut toward the budget.

## 6. Validation and acceptance

- Shots, each opened and described in this plan: inside a lane; along an avenue from 250 m; a junction
  from 200 m; 900 m overview; straight down from 600 m.
- The motion sequence is smooth and the loop seam is invisible.
- Trails are additive with depth test on and depth write off; a tower in front hides the craft behind
  it.
- No console errors or unexplained shader warnings in `shot.mjs` output.
- `npm run check:task -- T07` exits 0. Measured bytes are recorded against the budget.

Human checks: whether the sky feels as busy as the parent's
(`C:\highsierralabs\Synthwave_City\docs\screenshots\skyline.png`).

## 7. Idempotence and recovery

Shots go in `shots/T07/`, scratch in `.tmp/T07/`. Both can be deleted at any time.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

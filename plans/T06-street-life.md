---
id: T06-street-life
title: Ground traffic and people
status: ready
depends_on: [T00, T03]
owns: [src/street/**, plans/T06-street-life.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2200
executor: opus/medium
updated: 2026-11-18
---

# T06: street life

## 1. Purpose

Busy streets: rivers of headlights and tail lights on every road, cars you can make out when the
camera drops to street level, and people on the sidewalks. From above, the traffic is what makes the
grid read as alive; from below, it is what the camera flies through.

## 2. Context and orientation

Read §5 (especially §5.3 on loop-periodic motion and §5.4 on the grid), §6.2 and §10. How a layer
works is §4.5: `src/street/index.ts` exports `init()` and registers draw functions with `addLayer`.
`src/gl.ts` and `src/engine.ts` document every helper in comments above each export; `dev/probe/` is
a small working layer to copy idioms from.

Nothing here needs data from the CPU beyond a count. A car is instance `i`: hash `i` to pick a road
line (0 to 31, in x or in z), a direction, a lane (§5.4 gives lane offsets for streets and avenues;
traffic keeps right), a phase, and an integer speed in laps per loop. Its position along the road is
`fract(laps * uTime.y + phase) * TILE` (§5.3), which wraps without a seam. Cars on crossing roads
pass through each other at intersections; that is accepted.

Cars are cubes from `cube()` shaped in the vertex shader. Head and tail lights and their glow are
additive camera-facing sprites. Everything is placed with `place()`.

## 3. Scope

Owned: `src/street/**` (`index.ts` and `.glsl` files).

Must have: several thousand cars over the tile, denser on avenues, in the right lanes and directions;
bodies dark with a little coloured trim; white-yellow headlights and red tail lights as small L3
cores with glow that survives fog, so distant roads read as streams of light; people as small bright
impostors moving slowly along sidewalks near the camera.

Optional, cut first if over budget, in this order: light pools on the road under each car,
motorcycles (a single narrow light), a few buses or trucks (longer boxes), brake-light flicker.

Not in scope: flying vehicles (T07), street lamps and road markings (T04).

## 4. Interfaces

Consumes: `prog`, `state` and the instanced draw helper from `src/gl.ts`; `addLayer` from
`src/engine.ts`; `O_VEHICLE`, `O_GLOW` and the grid constants from `src/contracts.ts`; the block `F`,
`cube`, `quad`, `place`, `fog`, `pal`, hashes and the grid helpers from `src/common.glsl`.

Provides: `init()` from `src/street/index.ts`. Draw counts scale with the density in `F[U_RES + 3]`.

## 5. Plan of work

**M1. Lights first.** They are what is seen from everywhere. Sprites for head and tail lights on
every lane of every road, moving. *Proof:* a shot from 400 m shows continuous streams, white toward
the camera on one side of each road and red on the other; an eight-frame sequence at 0.25 s per frame
shows them advancing in the correct directions.

**M2. Car bodies.** Cubes with a cabin shape, correct heading on x-roads and z-roads. *Proof:* a
street-level shot with cars in lanes at plausible spacing and size (about 4.5 by 1.8 by 1.4 m).

**M3. People.** Impostors on sidewalks, only near the camera. *Proof:* a sidewalk-height shot.

**M4. Loop seam and far fade.** Frames at `--t 4095.9` and `--t 0.1` are continuous; lights sink at
the far fade without popping. *Proof:* the two frames, compared by eye and by `shot.mjs` statistics.

**M5. Optional items, then measure.** `npm run size -- street`; trim or cut toward the budget.

## 6. Validation and acceptance

- Shots, each opened and described in this plan: street level in an avenue; a street intersection
  from 40 m; 400 m overview; straight down from 300 m.
- The motion sequence shows traffic keeping right and moving at city speeds (roughly 8 to 25 m/s).
- With `--layers backdrop,street` (or `probe,street` if the backdrop is not ready) cars sit on the
  carriageway, not on sidewalks or in buildings.
- No console errors or unexplained shader warnings in `shot.mjs` output.
- `npm run check:task -- T06` exits 0. Measured bytes are recorded against the budget.

Human checks: whether the streets feel busy
(`C:\highsierralabs\Synthwave_City\docs\screenshots\street.png` is the reference).

## 7. Idempotence and recovery

Shots go in `shots/T06/`, scratch in `.tmp/T06/`. Both can be deleted at any time.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

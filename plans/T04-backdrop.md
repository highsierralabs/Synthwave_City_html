---
id: T04-backdrop
title: Sky, ground and street lamps
status: ready
depends_on: [T00, T03]
owns: [src/backdrop/**, plans/T04-backdrop.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2600
executor: opus/medium
updated: 2026-11-18
---

# T04: backdrop

## 1. Purpose

The stage the city stands on: a dusk sky with a striped sun, stars and a wireframe mountain ridge, and
wet streets that run to the horizon in every direction, with lane markings, glowing curbs, the city
mirrored in the asphalt, and rows of street lamps. With only this layer mounted the viewer already
sees an endless synthwave grid under a synthwave sky.

## 2. Context and orientation

Read §5 (world model), §6 (look, especially the light bands of §6.2) and §10. How a layer works is
§4.5: `src/backdrop/index.ts` exports `init()`, which compiles programs with `prog()`, and registers
draw functions with `addLayer(order, draw, reflect)`. `src/gl.ts` and `src/engine.ts` document every
helper in comments above each export; those files are the reference. `dev/probe/` is a small working
layer written by T00: read it first as the example of the idioms to copy.

The sky is one full-screen triangle at the far plane, drawn after the opaque layers (`O_SKY`), using
`ray()` from `common.glsl` for the view direction. The ground is one large quad at `y = 0` centred
under the camera; its fragment shader works in tile coordinates (`uCam.xz + position.xz`) and derives
everything from the grid helpers in `common.glsl` and the cell texture `T2`. The mirrored city is
texture `T1`, sampled at the fragment's own screen position (`gl_FragCoord.xy / uRes.xy`); at quality
0 it is black, and the ground should still look wet (a cheap streak of the fog colour will do).

Street lamps need no buffer: their positions follow from `gl_InstanceID` and the grid constants.

## 3. Scope

Owned: `src/backdrop/**` (`index.ts` and `.glsl` files).

Must have: sky gradient by mood (`uMood.x`), sun with scrolling stripes and halo in direction `uSun`,
stars, horizon haze that meets `fogColor`; ground with streets and avenues at the §5.4 dimensions,
lane dashes, curbs glowing at L2, sidewalks, block interiors that differ by district, reflection,
fog to the horizon; lamps on both sides of every road with a small glow.

Optional, cut first if over budget, in this order: mountain ridge, pedestrian crossings, plaza floor
patterns, star twinkle.

Not in scope: vehicles, buildings, any light pools from traffic (T06).

## 4. Interfaces

Consumes: `prog`, `state`, `tri` and the instancing helpers from `src/gl.ts`; `addLayer` from
`src/engine.ts`; `O_GROUND`, `O_SKY`, `O_GLOW` and the grid constants from `src/contracts.ts`; the
block `F`, `place`, `fog`, `fogColor`, `pal`, `ray`, the grid and filtered-line helpers and samplers
`T1`, `T2` from `src/common.glsl`.

Provides: `init()` from `src/backdrop/index.ts`. The sky registers with `reflect = 1` so the wet road
mirrors the sunset; the ground does not draw in the mirror pass.

## 5. Plan of work

**M1. Ground first, since everything stands on it.** The street pattern with analytic filtering:
every line is drawn through the filtered-line helper, and markings fade to their average when
narrower than a pixel. *Proof:* a shot from 200 m looking along an avenue and a sequence of eight
frames moving forward 4 m per frame: no crawling or sparkle on the lane dashes at the horizon.

**M2. Sky.** Gradient, sun, stars, haze. *Proof:* a shot toward the sun (yaw 0) and one away from it
(yaw 3.14); the horizon line where ground meets sky has no hard seam in either.

**M3. Reflection and wetness.** Sample `T1` with a small normal wobble from noise; fade it with
distance and view angle. *Proof:* with `--layers backdrop,probe`, the probe boxes and the sun appear
mirrored in the road; with `--q 0` the road still reads as wet.

**M4. Lamps.** Posts and glow from `gl_InstanceID`. *Proof:* street-level shot with lamps receding in
perspective on both sides; they disappear by the far fade, not at a hard edge.

**M5. Optional items, then measure.** `npm run size -- backdrop`; trim or cut toward the budget.

## 6. Validation and acceptance

- Shots, each opened and described in this plan: street level along an avenue; 200 m up toward the
  sun; 200 m up away from the sun; straight down from 600 m; each mood (`--mood 0`, `1`, `2`).
- The forward-motion sequence shows no shimmer on road markings.
- A sequence across the tile edge (camera x from 4090 to 4102) shows no seam.
- Ground luminance stays in L0 except curbs, markings and reflections (§6.2); the sun's disc is L3.
- No console errors or unexplained shader warnings in `shot.mjs` output.
- `npm run check:task -- T04` exits 0. Measured bytes are recorded against the budget.

Human checks: whether the sun and the palette feel like the parent project
(`C:\highsierralabs\Synthwave_City\docs\screenshots\skyline.png` is the reference for mood).

## 7. Idempotence and recovery

Shots go in `shots/T04/`, scratch in `.tmp/T04/`. Both can be deleted at any time.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

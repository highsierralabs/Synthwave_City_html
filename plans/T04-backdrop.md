---
id: T04-backdrop
title: Sky, ground and street lamps
status: done
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

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan, contracts, common.glsl, gl.ts, engine.ts,
  plan.ts (cell layout), dev/probe; looked at the parent's skyline, street and rooftops screenshots.
  Baseline `npm run size -- backdrop` with the stub: 0 bytes.
- [x] 2026-11-18 M1 ground: `src/backdrop/ground.glsl`, one 80 km quad. Streets and avenues at the
  §5.4 widths, sidewalks, district-tinted block interiors (texelFetch of T2), cyan street curbs and
  magenta avenue curbs at L2, centre line and dashed lane dividers (street 3.5 m; avenue 5.25 and
  8.75 m), all through a footprint-scaled filtered line; whole pattern fades to an average colour
  when a cell is a few pixels wide.
- [x] 2026-11-18 M2 sky: `src/backdrop/sky.glsl`. Exactly fogColor() below the horizon, haze band,
  mood gradient, equal-area hashed stars with twinkle, sun (radius 0.15 rad, colour by mood, cut-outs
  scrolling down, halo), ridged-noise wireframe mountains sampled on a circle so they have no seam.
- [x] 2026-11-18 M3 reflection: T1 at the fragment's screen position with a noise wobble that fades
  out at distance, weighted by a puddle mask and a view-angle term; at quality 0 a fog-colour sheen
  plus a sun streak instead.
- [x] 2026-11-18 M4 lamps: `src/backdrop/lamp.glsl`, 8192 lamps (post + head instance pairs) from
  gl_InstanceID, scrambled index for the density prefix, mirrored; light pools in the ground shader.
- [x] 2026-11-18 M5 optional items: all four kept (mountain ridge, crossings, plaza floor grid, star
  twinkle). Measured 1,540 bytes against 2,600.
- [x] 2026-11-18 Acceptance run, evidence below. Status done.

## 9. Surprises and discoveries

- `pal(0)` with an int literal does not compile ("no matching overloaded function"): `pal` takes a
  float. Every call is written `pal(0.0)`. Evidence: shot.mjs SHADER ERROR on the first run.
- With `--layers backdrop,probe` the probe's own ground and sky are drawn too, at the same orders.
  The sky drawn last wins (both at the far plane, LEQUAL), so `probe,backdrop` (backdrop registered
  last) shows this sky; the two y = 0 ground quads of different size z-fight, so in probe shots the
  probe's magenta curb grid shows through in places (seen in shots/T04/far.png and edge_*.png).
  Ground judgements were made from `--layers backdrop` and `--layers all` shots instead.
- Seen from 1500 m the mirror pass shows a large, exact reflection of the sun on the far ground, which
  read as wrong next to the parent's dark plain. The far average wetness was lowered from 0.3 to 0.1
  (shots/T04/all_far.png before and after).
- A per-pixel noise wobble of the reflection sparkles once the noise cell is under a pixel; it now
  fades out with the footprint (fwd_strip.png before: speckled sun streak; after: smooth).
- Lamp posts are drawn as cubes rotated a quarter turn for the x-running roads; a swap of x and z
  would mirror the cube and flip its winding, so a rotation is used.

## 10. Decision log

- 2026-11-18 Three .glsl files, each with its own small helpers (`lineA` in ground and sky). The
  copies are the same text, which deflate shares; a GLSL include does not exist here and a TS-side
  `#define` would rely on minifier behaviour for macro names.
- 2026-11-18 A private footprint-scaled line (`lineA`) instead of common.glsl's `line()`: `line()`
  peaks near 0.5 when a line is much thinner than a pixel, so thousands of distant curbs and dashes
  summed to a glare. `lineA` multiplies by min(1, 2w/a). Fine grids take the footprint from the
  coordinate before `fract`.
- 2026-11-18 Ground quad half-size 40,000 m, not 8,192: below the horizon the sky is exactly
  fogColor(), and only a ground that reaches full fog meets it without a band at altitude.
- 2026-11-18 Lamps every 64 m (8,192 lamps, 16,384 instances, 36 vertices each), not every 32 m: half
  the vertex work; the ground's light pools keep the rhythm readable. The head is a small L3 box and
  bloom makes its glow, so no additive sprite program is needed.
- 2026-11-18 Lamp density prefix uses `id * 1597 & 8191` (an odd multiplier, a bijection mod 8192),
  so quality 0 draws an even 40% sample with no buffer.
- 2026-11-18 Sun colour, halo and midnight variant come from `mood()` (yellow, cyan, orange tops);
  mountains lowered to at most about 0.1 rad so the striped lower half of the sun stays above them.
- 2026-11-18 Stars are not drawn in the mirror pass (`1 - uCam.w`): reflected stars read as dust on
  the road.

## 11. Contract change requests

None needed. Suggestion only, not filed: if T13/T14 want one copy, a footprint-scaled line like
`lineA` (above) could move into common.glsl; buildings and lights may want the same thing.

## 12. Outcomes and retrospective

**Result against Purpose.** With only this layer mounted the viewer sees an endless street grid with
glowing curbs, dashed lanes, crossings, plaza grids, rows of lamps and wet, mirroring asphalt, under
a dusk sky with a striped sun, stars and a wireframe ridge (shots/T04/street.png, top_only.png,
far_only.png). With the sibling layers and post (`--layers all`) the frame reads close to the
parent's skyline picture: sun on the ridge, magenta haze, dark plain beyond the city
(shots/T04/all_sun.png, all_high.png, all_street.png).

**Bytes.** `npm run size -- backdrop`: **1,540** marginal packed bytes against a budget of 2,600
(full file 17,330 at that moment, with siblings mid-flight). Possible cuts, not measured one by
one: mountain ridge, crossings, plaza grid, twinkle, the quality-0 sun streak.

**Acceptance evidence** (all run 2026-11-18 on ANGLE / RTX 4070 SUPER / D3D11, no console errors and
no shader warnings in any shot output):

- Street level along an avenue, `--layers backdrop --view street` (street.png): wet asphalt with the
  sun, ridge and lamp heads mirrored in puddles, dashed lanes, a solid centre line, zebra crossing
  in the foreground, magenta avenue curbs, lamps receding on both sides and fading to dots at the
  horizon. With all layers (all_street.png) cars, buildings and the sun reflect in the road.
- 200 m up toward the sun, `--cam 2048,200,2300,0,-0.15` (sun.png): striped sun half behind a dark
  ridge with magenta wire and a cyan crest, sun streak down the avenue. Away, yaw 3.14 (away.png):
  violet sky with stars, ridge, no hard seam where ground meets sky (a hazy band under the ridge).
- Straight down from 600 m, `--view top` (top_only.png): road grid with cyan street and magenta
  avenue curbs, lamp pools in pairs per cell edge, plaza cells with a cyan floor grid, district tints.
- Moods `--mood 0/1/2` (mood0-2.png): sunset magenta with a yellow sun; midnight indigo with a cyan
  sun; miami lighter pink-violet with an orange sun.
- Quality 0, `--q 0 --view street` (street_q0.png): no mirror; the road still reads wet from the
  fog-colour sheen and an orange sun streak.
- Forward motion, 8 frames at 4 m per frame from 200 m (fwd_*.png, crops in fwd_strip.png and
  fwd_strip2.png) and 4 frames at 3 m height (fwdlow_strip.png): lane dashes, curbs and crossings
  hold steady between frames; no crawling seen on the markings. The reflection's wobble is
  structured near the camera and smooth at distance.
- Tile edge, camera x 4090 to 4102 (edge_*.png, edge_strip.png across the wrap): the ground pattern
  and lamps continue across x = 0 with no seam.
- `npm run check:task -- T04`: PASS (typecheck 0 errors, import rules 0, plan 0 problems).
- `npm run verify` (whole app, including this layer): VERIFY OK, 0 differing pixels in 4 views.

**Light levels** (from the constants in the shaders, not measured from pixels): asphalt 0.01 to
0.025, sidewalks up to 0.07, block interiors up to about 0.06 (L0); lane marks 0.7 and pools up to
0.25 (L1); curbs 2.5 (L2); sun disc 5 and lamp heads 6 (L3); plaza grid lines 0.6.

**Not verified.** Frame time (nine agents share this GPU, so no number here means anything); any
phone or browser other than Chromium; how it looks after T13's balance pass; whether the 64 m lamp
spacing and the 16,384 x 36 lamp vertices are fine on a phone. Shimmer was judged from stills and
crops, not from motion at refresh rate. The ground in probe shots is partly the probe's own ground.

Human checks: whether the sun, ridge and palette feel like the parent's skyline.png.

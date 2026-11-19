---
id: T05-buildings
title: Neon towers
status: done
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

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan, `src/gl.ts`, `src/engine.ts`,
  `src/common.glsl`, `src/plan.ts`, `dev/probe/`; looked at the parent's `skyline.png`, `rooftops.png`,
  `street.png`, `plaza.png`. Status set to in-progress.
- [x] 2026-11-18 M1: `src/buildings/index.ts` (one program, one vertex array of the plan's boxes, one
  instanced draw at `O_BUILD` with `reflect = 1`) and `src/buildings/buildings.glsl` (one file, both
  stages). Window grid in metres on all four sides, filtered with a private `grid()` that takes
  `fwidth` before `fract` and fades to the average once a cell is under about two pixels.
- [x] 2026-11-18 M2: per-building identity from `hash3(seed)`: trim colour, two window colours, bay
  width 2 to 4 m, floor height 3.2 to 3.8 m, mullion proportions, lit fraction; neon trim on roof
  lines and vertical corners; crowns with fins; spires with rings and a blinking red tip; megatowers
  with 32 m bands, 8 m pinstripes and a climbing band; roofs with panels, a ring and a red dot.
- [x] 2026-11-18 M3: light levels checked against §6.2 with the plain blit and with T09's
  in-progress post (see Validation evidence below).
- [x] 2026-11-18 M4: roofs, mirror pass (buildings show in the probe's and the backdrop's road
  reflection), all four optional items (equaliser facades, sign panels, storefronts, travelling band
  on megatowers), far-fade dimming, density prefix that never cuts a building. Measured 1,012 bytes.
- [x] 2026-11-18 Acceptance shots taken with `--layers all` (real sibling layers) and with
  `probe,buildings[,post]`; `npm run check:task -- T05` exit 0; `node scripts/verify.mjs --layers
  buildings` and `npm run verify` both VERIFY OK.

Left for later (not this task): the art pass may retune the numbers listed under Outcomes.

## 9. Surprises and discoveries

- The trim line held at "at least a pixel" (`ew = max(0.3, fwidth(e))`) did not make mid-distance
  facades pale, as first suspected; a diagnostic shot with fog removed (`shots/T05/diag_nofog.png`)
  showed the pale colour was the window average itself. Lowering the far average fixed most of it.
  The remaining pink-grey on facades 400 to 900 m away is the shared fog colour, which is T00's
  (`common.glsl`), not this layer's.
- `place()` scales heights to zero across the far fade, so a sinking building leaves its roof
  outline as a flat neon square on the ground (`shots/T05/m1_far.png`, `acc_over1200.png` before the
  fix). Fixed inside this module: the vertex shader reads the fade factor as
  `place(vec3(aA.x, 1.0, aA.z), vec3(0.0)).y` and the fragment colour is multiplied by it.
- With `--layers probe,buildings` the probe draws its own flat boxes at the same depth; mine win
  (drawn after, `LEQUAL`), but `npm run verify` with all layers also includes the probe, so it was
  re-run with `--layers buildings` alone to prove the packed shader, not the probe's.
- All three density prefixes (0.4, 0.7, 1) already end on a building boundary for the shipped seed
  (`.tmp/T05/find.ts`: the next box's seed differs at 1,561, 2,733 and 3,904), so the extension loop
  in `draw` is a guarantee for other seeds and densities rather than a visible fix today.

## 10. Decision log

- 2026-11-18. Lit fraction is driven by the box's roof height (`(vA.y + vB.y) / 800`) plus hashes,
  not by the district byte in the cell texture: roof height tracks the district (§5.5) and needs no
  texture fetch. Reason: fewer bytes, same effect.
- 2026-11-18. Facade average beyond two pixels per window is `0.06 * lit * (cA + cB)`, about half
  the energy-conserving value. Reason: at the energy-conserving value, facades 300 m and further
  away read as beige-grey (`shots/T05/m3_high.png`), against the art direction (deep indigo darks,
  never washed out). The darker average lets the trim carry the skyline, as in the parent's
  `skyline.png`. This is a look choice, not a filtering threshold, and the art pass may move it.
- 2026-11-18. Trim width is at least half a pixel each side and its brightness falls as
  `sqrt(0.3 / width)`, not linearly. Reason: the brief puts edges first for reading the skyline at a
  distance; a strictly energy-conserving line fades out too early.
- 2026-11-18. Windows are lit in runs of three along a floor, with colour and brightness per window,
  and floors in bands of five. Reason: per-window salt-and-pepper did not read like the parent's
  blocky lit clusters (`rooftops.png`).
- 2026-11-18. Sign-panel fill uses window colour B (orange or cyan), not A. Reason: A can be ice
  white, which read as a blank white rectangle at a distance (`shots/T05/all_skyline.png`).
- 2026-11-18. All four optional items kept: the module is at 1,012 of 2,800 bytes with them.
- 2026-11-18. The density prefix is extended in `draw` to the end of the building it lands in
  (boxes of one building are contiguous in `plan.boxes`). A short loop over typed-array reads, no
  allocation.

## 11. Contract change requests

None. Two things a later plan might want, not needed now:
- The private `grid(x, w)` in `buildings.glsl` (periodic filtered line that fades to its average)
  would belong in `common.glsl` if a second layer wants one; one copy costs nothing extra today.

## 12. Outcomes and retrospective

**Result against Purpose.** The city layer exists: 3,904 boxes in one instanced draw, every tower
lit from inside with a dense window grid in two colours, neon trim on roof lines and vertical
corners in a per-building colour, lit crowns, spires with blinking red tips, tiered megatowers with
bands of light, roofs with panels, rings and red dots, storefronts at street level, animated sign
panels, equaliser facades on the beat, fog on everything, mirrored in the wet road. With the real
sibling layers (`shots/T05/fin_skyline.png`) the picture reads as the parent's skyline: dense,
garish, edge-lit, with a megatower in view.

**Bytes.** `npm run size -- buildings`: **1,012 bytes** against a budget of 2,800 (file 17,466 at
the time, with siblings mid-flight). What each optional item would save if cut was not measured one
by one; the whole module is 1,012, so any single cut is a fraction of that.

**Validation evidence** (all run 2026-11-18, RTX 4070 SUPER via ANGLE D3D11, as printed by shot.mjs):

- Street level up a canyon, `fin_canyon.png` (`--cam 2051.5,1.7,2300,0,0.6 --layers all`): low
  buildings both sides with crisp single windows, coloured storefronts under neon strips, an orange
  slatted roof band, a magenta-framed chevron sign. No errors.
- Skyline, `fin_skyline.png` (`--cam 3712,300,504,0,-0.1 --layers all`): megatower in the centre
  with yellow bands and spire in front of the sun; dense window grids, coloured sign panels, neon
  edges on every box. Clipped 0.00%.
- 1,200 m overview, `fin_over1200.png`: every building outlined in its trim colour, the tiered
  purple megatower bottom left, sign panels as coloured rectangles, sinking buildings dim into the
  far fade with no flat outline. Clipped 0.00%.
- Straight down from 800 m, `fin_top800.png`: roofs show panel grids, rings, red dots and
  perimeter trim; no roof is blank.
- Megatower close, `fin_mega.png` / `acc_mega.png` (`--cam 1920,380,512,0.785,0.05`): the 625 m
  megatower with tier steps, magenta 32 m bands, spire with rings; a green crown with fins in front.
- Quality 0, `fin_q0.png` (`--q 0`): the city is thinner; every visible building is whole.
- Sideways sequence, `seq_0..7.png` (8 frames, 3 m per frame, 300 m up), compared as
  `seq_mosaic.png` (frames 0, 1, 6, 7): the mid-distance facades stay calm and identical frame to
  frame apart from the shift; no sparkle seen in the stills.
- Tile edge, `edge_0..3.png` (20 m per frame across x = 4096), `edge_mosaic.png`: no seam, no pop.
- Equaliser, `diag_eq_0/1.png` (diagnostic build with every building forced to equaliser, reverted
  after): green level bars change between beats.
- M3 light levels: with the plain blit (`--layers probe,buildings`) clipped 0.00 to 0.14% of pixels
  (the 0.14% at street level, where the probe's curb fills the bottom of the frame); with post,
  0.00% in every shot. Values written: walls 0.022 to 0.055 (L0), windows 0.4 to 1.0 (L1),
  storefronts 0.45, trim 2.5, floor lines 2.0, sign stripes 1.8, crown fins up to 1.55, megatower
  bands 1.5 (L2), spire tips 8 and roof dots 6 (L3, small).
- Console: no errors and no shader warnings in any shot.mjs output.
- `npm run check:task -- T05`: PASS, exit 0.
- `node scripts/verify.mjs --layers buildings`: 4 views, 0 differing pixels, VERIFY OK; `npm run
  verify` (all layers) VERIFY OK.

**Not verified.**
- Shimmer in real motion: judged from still sequences only, not from live playback.
- Frame time: not measured. Nine agents share this GPU and CPU, so no number taken now would mean
  anything.
- Any phone or browser other than headless Chromium 151 on this desktop.
- Moods 1 and 2 on the buildings alone (verify renders them with all layers, but I did not inspect
  those frames).
- The marginal cost of each optional item separately.

**For the art pass.** Numbers most worth a look, all in `buildings.glsl`: the far average `0.06`
(facades 400 to 900 m away still look pink-grey under the shared fog); the fade threshold
`smoothstep(0.2, 0.5, ...)` in `grid()` and `far`; trim brightness `2.5` and width rule; crown fin
brightness (a near crown fills a lot of screen in `fin_mega.png`); storefront `0.45`; lit fraction
`0.3 + height / 800`.

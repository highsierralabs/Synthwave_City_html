---
id: T06-street-life
title: Ground traffic and people
status: done
depends_on: [T00, T03]
owns: [src/street/**, plans/T06-street-life.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2200
executor: opus/medium
updated: 2026-11-19
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

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan, contracts, common.glsl, gl.ts, engine
  exports, dev/probe; looked at the parent's skyline, street, plaza and rooftops screenshots.
- [x] 2026-11-18 M1 lights: four sprites per car on every lane of every road, from gl_InstanceID
  only (no buffers). 400 m shots show streams; the eight-frame sequence shows directions.
- [x] 2026-11-18 M2 bodies: two boxes per car (body and cabin), side stripe, tail and head bars.
- [x] 2026-11-18 M3 people: 800 additive walkers on the sidewalks of the 5 x 5 cells round the camera.
- [x] 2026-11-18 M4 seam and fade: frames at t 4095.9 and 0.1 match; far fade by smoothstep.
- [x] 2026-11-18 M5 optional items: all four built (light pools, motorcycles, buses, brake
  flicker). Measured 1,236 bytes against 2,200.
- [x] 2026-11-18 Fixed a density defect found at quality 0 (see Surprises). Acceptance re-run.

Nothing is left. Follow-ups for the art pass are in Outcomes.
- [x] 2026-11-19 Reopened and closed by T15 (plans/T15-playtest-fixes.md), by the orchestrator. The
  ground no longer hides what is below it (it writes a constant depth), so car bodies, which reached
  0.45 m under the road, now stop at it: `l.y = max(l.y, 0.0)` in `body.glsl`, before the pattern
  coordinate is taken. The lights are unchanged; they were the victim, not the cause. Street view
  before and after: 3 of 921,600 pixels differ. `npm run size -- street`: 1,204 of 2,200.

## 9. Surprises and discoveries

- The first lane layout put car slot j at phase j / 64, so a drawn prefix (quality 0 and 1) kept a
  contiguous 40 or 70 % stretch of every lane: at quality 0 the roads near the camera were empty and
  all traffic sat far away (shots/T06/q0_x40.png before the fix, since overwritten). Slot j now sits
  at place (j * 39) mod 64, a permutation that spreads any prefix along the lane; the same shot
  afterwards shows cars evenly on every road. Lesson: "shuffled, so a prefix is an even sample" has
  to hold in space, not just in index order.
- With `--layers backdrop,post` (no street) a sharp-edged yellow area shows on a far avenue
  (shots/T06/b_only_x40.png, top right). It is not from this layer; noted, not investigated (T04).
- Bloom comes only with post mounted: `--layers probe,street` shows the lights as small dots; with
  post they read as a river (shots/T06/high_post.png against high.png).

## 10. Decision log

- 2026-11-18 No instance buffers at all: car and walker are pure functions of gl_InstanceID and
  uTime, drawn with drawInst(null, ...). Smallest code; nothing to fill or shuffle.
- 2026-11-18 Cars in a lane are evenly spaced with one integer speed per lane, instead of random
  phases and speeds, so cars in a lane never overlap. 384 lane slots (avenue lanes counted twice, so
  an avenue lane carries twice a street lane) x 64 = 24,576 cars. Started at 48 per lane; 64 made
  the avenue read as a river from 400 m.
- 2026-11-18 Shared placement lives in src/street/car.glsl (inside #ifndef FS) and is prepended in
  TypeScript to the body and light shaders (prog(car + body, ...)). Both are .glsl files, so glslmin
  renames them with its shared map; no contract change needed.
- 2026-11-18 Light sprites never shrink below about 2 px radius; their peak falls as sqrt(0.3 / r),
  so distant lights stay visible as points. Head and tail brightness depends on the angle to the
  camera (0.3 to 1), so from above both colours show.
- 2026-11-18 People are additive neon figures (1.2, low L2) rather than dark silhouettes: additive
  needs no sorting and reads at a distance. The parent shows dark figures with lit accents.
- 2026-11-18 Lights and people are drawn in the mirror pass (reflect = 1), so the wet road reflects
  them; bodies are not (vertex cost).
- 2026-11-18 Buses and motorcycles are a per-car scale (carSize). The slot jitter went from 0.4 to
  0.3 of a slot so a bus (10.8 m) never overlaps a neighbour (minimum centre gap 12.8 m on avenues).

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**Result against Purpose.** Every road carries moving traffic: 24,576 cars over the tile, an avenue
lane twice as dense as a street lane, in the right lanes, keeping right, at 8 to 15 m/s on streets
and 14 to 25 m/s on avenues. Each car is two dark boxes with a coloured side stripe, red tail and
white head bars, four light sprites and a pool of headlight on the road; 6 % are buses, 6 %
motorcycles; tails brake at random. 800 people walk the sidewalks near the camera and fade out by
240 m. From 400 m the avenue reads as a river of white and red points; from street level cars,
lights, reflections and people are all visible.

**Bytes.** `npm run size -- street`: **1,236 bytes against a budget of 2,200** (file 17,216 at the
time, gate 32,768). All optional items are in. Possible cuts, not measured one by one (estimates,
inferred): light pools about 80 to 100 bytes, buses and motorcycles about 60, brake flicker about
40, people (people.glsl and its draw) about 350 to 400.

**Acceptance evidence** (RTX 4070 SUPER over D3D11, as every run printed):

- Street level in an avenue: shots/T06/all_street2.png, final_walk.png (all layers). Seen: cars
  ahead in the right lanes with red tails, oncoming cars on the left with white headlights and their
  reflections, people on both sidewalks, a bus. Bodies read as dark slabs with a stripe.
- Street intersection from 40 m: all_x40.png, bs_x40.png. Seen: cars in lanes on both roads,
  crossing cars passing through each other in the box (accepted by the plan), headlight pools.
- 400 m overview: all_o400.png, final_o400.png, high_post.png. Seen: the avenue as a dense white and
  red stream to the far fade; streets as sparser dotted lines. What looks off: straight down the
  avenue, lights between R0 and R1 stand above the already sunk city as a column of soft blobs (the
  sprite is lifted by its radius so the ground does not cut it).
- Straight down from 300 m: top300.png (probe), all_top300.png. Seen: cars on all roads, white and
  red pairs visible from above, denser on avenues.
- Motion: seq_0..7.png (0.25 s apart, 25 m over the avenue at x = 2048, looking -z): cars right of
  the centre line show tails and move up the frame (away, -z); cars left show headlights and move
  down; about 20 m in 1.75 s for the near ones, inside 8 to 25 m/s.
- On the carriageway: in seq_*, seam_* and near40.png (probe ground) every car sits between the curb
  lines, three lanes per side on the avenue; people sit between curb and building line.
- Loop seam: seam_a.png (t 4095.9) and seam_b.png (t 0.1), top-down over the avenue: the same cars,
  each a few metres further along its lane; image mean 70.7/255 in both.
- Far fade: far_avenue.png and farseq_0..2.png (camera moving 40 m per frame): the far band of
  lights dims into the haze and holds its place between frames; no pop seen in three stills (stills
  cannot prove it).
- Quality 0: q0_x40.png after the fix: cars evenly spread on every road.
- No console errors and no shader warnings in any shot.mjs output of this session.
- `npm run check:task -- T06`: PASS (typecheck 0 errors, import rules 0, plan 0).

**Not verified.** Frame time: nine agents share this GPU and CPU, so none was measured. At quality 2
the layer draws 49,152 boxes (1.77 M vertices) and 123k sprites; the vertex cost on a phone is
unknown. No packed-build check (verify, smoke) was run by this task. Shimmer of sprites in motion
was not judged beyond short sequences. Phone, Firefox and Safari not tested.

**For the art pass.** Lights between R0 and R1 straight down an avenue (fade them earlier?); people
are bright figures where the parent's are dark with lit accents; pool brightness 0.3; avenue
density (64 per lane); headlight intensity 8 and the sqrt falloff.

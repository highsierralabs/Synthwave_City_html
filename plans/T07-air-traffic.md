---
id: T07-air-traffic
title: Flying vehicles
status: done
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

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan, contracts, common.glsl, gl.ts, engine.ts
  exports and dev/probe; looked at the parent's skyline, rooftops, street and plaza screenshots.
- [x] 2026-11-18 M1 trails and glows: `src/air/air.glsl` and `src/air/index.ts`, with no vertex buffer.
  The first shots (`shots/T07/m1_*.png`) show stacked streams over the avenues only.
- [x] 2026-11-18 M2 hulls: tapered cube hulls with a heading, an underglow, a flank stripe and a lit
  tail face; a neon edge outline came later (see Decision log).
- [x] 2026-11-18 M3 motion: an 8-frame sequence at 0.1 s steps and the loop-seam pair, looked at.
- [x] 2026-11-18 M4 crossings and clearance: shots with the real `buildings` and `backdrop`, and a
  numeric clearance check against the plan's boxes (`.tmp/T07/clear.ts`).
- [x] 2026-11-18 M5 optional items: large slow ships and the bob built, spirals left out. Measured.
- [x] 2026-11-18 Acceptance run, Outcomes written, status set to done.

## 9. Surprises and discoveries

- Hash-chosen ships collided. With one ship per ~170 craft chosen by `hash(id)`, ships 3710 and 3742
  were in the same lane 9 m apart at t = 12 (found with the scratch script `.tmp/T07/findship.mjs`,
  which mirrors the shader's lane maths). Fixed by making ships structural: `k == 3 + stream % 8` for
  streams with `stream % 3 == 0`. That gives at most one ship per stream (32 in all), each at its
  own altitude.
- `place()` flattens heights to zero past `R1`, so craft between 1,950 m and the tile corner (up to
  ~2,900 m) would have lain glowing on the ground. I found this by reasoning, not on screen. The
  lights now fade out with the same `smoothstep(uFade.x, uFade.y, ...)`, and `m4_horizon.png` shows
  no lights lying on the ground.
- Seen from above, a hull with no trim on its top read as a plain black slab in the full city
  (`final_all.png`, lower left). I added an edge outline, and `final_all2.png` shows the hull outlined.
- `drawInst` always starts at vertex 0, so the light range (vertices 36..53) is drawn directly, with
  `gl.bindVertexArray(null); gl.drawArraysInstanced(4, 36, 18, n)`. The null bind matters, because
  otherwise another layer's vertex array is still bound.

## 10. Decision log

- 2026-11-18. No instance buffer at all: lane, speed, size and colour all come from `gl_InstanceID`.
  Lanes are assigned by structure (`id % 96` = stream), not by hash, so any density prefix gives
  every stream an even share. Reason: there is no CPU data, and the prefix rule (11.1) holds by
  construction.
- 2026-11-18. One speed per sub-lane (two sub-lanes per stream, 5 and 10.5 m right of the centre
  line) and golden-ratio phases `fract(k * 0.618034)`. No craft ever overtakes another, so none can
  pass through another, and any prefix of `k` is spread evenly along the lane.
- 2026-11-18. One program and two draws, both with `reflect = 1`: the hulls opaque at `O_VEHICLE` and
  the lights additive at `O_GLOW`. They are split by vertex range rather than by a uniform, which
  saves a `getUniformLocation`.
- 2026-11-18. Lights are never narrower than about 2 px (trail) or 2.5 px (sprites). Brightness is
  scaled by `sqrt(base / width)` for trails and by `base / size` for sprites, so distant streams stay
  steady lines. This is not fully energy-conserving, on purpose, so that far streams stay visible.
- 2026-11-18. A trail is 1.5 s of flight long plus two hull lengths, with its head at 3.5 x the
  palette colour (L2); the engine glow is 6 x (L3). Trails were lengthened from 0.8 s after the first
  shots with post looked thin next to the parent's streaks.
- 2026-11-18. Ships fly 310 m above their stream's level (400 to 650 m), on the centre line, at 8 to
  15 m/s. Their half-length is 26 to 34 m and their half-width 0.3 x that (at most 10.2 m, against a
  corridor half-width of 18 m).
- 2026-11-18. The bob (1 m, `sin(uTime.x ...)`) and the strobes use `uTime.x`, so they jump once per
  loop (every 68 min). That is accepted for cosmetic effects by architecture 5.3. Lane motion uses
  `uTime.y` with integer laps and is seamless.
- 2026-11-18. Descending spirals around megatowers left out. They leave the road corridors, so
  clearance would no longer hold by construction, and they would need the megatower positions in the
  shader (uniforms or a buffer). There is room in the budget; the reason is safety and scope, not
  bytes.
- 2026-11-18. A neon edge outline on hulls was added after the full-city shot (see Surprises); it
  costs about 60 bytes (from the 794 to 860 measurement).

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**Result against Purpose.** At full density, 4,608 craft fly in stacked lanes over the avenues. That
is 96 streams: 2 axes x 8 avenues x 3 levels x 2 directions. x-lanes fly at 90/190/290 m and z-lanes
at 140/240/340 m, with +-3 m of jitter and a +-1 m bob, at 30 to 90 m/s. They keep right, with two
sub-lanes per direction. Each craft has:

- a small, dark, tapered hull with neon edges, a flank stripe, an underglow and a lit tail;
- an engine glow at L3;
- a trail at L2 in its palette colour, fading along its length;
- on a third of the craft, a red or white strobe.

Above the traffic fly 32 large, slow ships with rows of lit windows. Everything is placed with
`place()` and fogged (`fog()` for hulls, `1 - fogAmount` for additive light). It is drawn in the
mirror pass too, and the instance count scales with the density in `F[U_RES + 3]`.

**Bytes.** `npm run size -- air` measured **860** marginal packed bytes against a budget of 2,300.
The file was 17,210 bytes at the time. Earlier measurements: 690 for M1 to M3 without ships, and 794
with ships. Possible cuts:

- ships: an estimated 100 to 150 bytes, taken from the 690 to 794 step, which also included the
  trail retune;
- the hull edge outline: about 60;
- the bob: about 20;
- the strobe: about 60 (an estimate, not measured).

**Acceptance evidence.** All runs were on 2026-11-18, on ANGLE with the NVIDIA RTX 4070 SUPER under
D3D11, as `shot.mjs` reported.

- `npm run check:task -- T07` printed `PASS T07-air-traffic`: typecheck 0 errors, import rules 0,
  plan 0.
- `npm run verify`, with every layer including air, printed `VERIFY OK`: 0 differing pixels in 4
  views.
- None of the `shot.mjs` runs listed below printed a console error, a warning or a shader log.
- **Inside a lane** (`final_lane.png` and `m2_lane.png`, camera 1960,92,2058 looking along +x):
  streams at several levels in both directions. Near craft are recognisable as small dark hulls with
  a coloured underside, a glow and a trail, and one stream converges on the vanishing point.
- **Along an avenue from 250 m** (`m1_ave250.png`): stacked streams in both directions, and a dense
  river of dots straight down the avenue.
- **Junction from 200 m** (`m1_junc200.png` with probe, `m4_junc_build.png` with the real buildings):
  x and z streams cross at different heights. Craft pass between the towers and none goes through
  one.
- **900 m overview** (`m2_over900.png`, `m2_ship.png`): the lanes read as a lattice of short light
  streaks above the avenues. From 900 m it looks more like many separate dashes than continuous
  lines.
- **Straight down from 600 m** (`m1_top.png`, `m5_top.png`): streams appear only over the avenue
  lines, as a cross at x = 2048 and z = 2048.
- **Clearance, numeric** (`.tmp/T07/clear.ts` against the real plan): 0 of 3,904 boxes enter the
  +-13.5 m band any craft can reach. The nearest box face to an avenue centre line is 20.00 m away.
- **Occlusion:** in `m4_horizon.png` the trails stop at the edges of the towers in front of them
  (additive light with depth test on and depth write off, through `state(ADD)`).
- **Motion** (`m3_seq_0..7.png`, 0.1 s steps, 960x540): I looked at frames 0, 1 and 7, and did not
  open frames 2 to 6. Craft heads move a few metres per step and their trails move with them.
- **Loop seam** (`m3_seam_4095.9.png`, `m3_seam_0.1.png`): the same stream layout, with craft
  slightly further along and nothing reshuffled.
- **Quality 0** (`m5_q0.png`): a sparser, even sample; streams end sooner because the far fade is
  shorter.
- **Street level with every real layer** (`m5_street.png`): rivers of light overhead along both axes.
- **Full city** (`final_all2.png`, `--layers all`): streams cross the horizon band and run down the
  avenue, and near craft have neon outlines.

**Not verified.**

- Smoothness in motion. There are only stills and an 8-frame sequence; no live playback was judged
  by eye, and shimmer of distant trails over time was not checked beyond that sequence.
- Frame time: not measured. Nine agents share the GPU, so any number would mean little. The layer
  is two instanced draws of 4,608 instances (36 and 18 vertices) with a short vertex shader.
- Reflections of the air traffic in the wet street. The layer is registered with `reflect = 1`, but
  no shot was checked for them specifically.
- Phones and other browsers: not tested.
- The cut estimates above are inferred from the measurement steps, not measured one cut at a time.

**For the art pass.** A craft passing within about 10 m of the camera draws a very wide, bright
trail across the frame (`m2_high.png`, `m4_high_build.png`). The tour flies among the lanes, so this
will happen. Possible fixes: fade trail brightness as the craft gets close, or cap the trail width
in pixels. These values are first guesses, balanced on one day against the probe and the sibling
layers: trail head 3.5, glow 6, ship windows `pal(7)` at 1.0, and a trail length of 1.5 s.

Human check still open: does the sky feel as busy as the parent's `skyline.png`?

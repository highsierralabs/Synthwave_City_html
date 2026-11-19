---
id: T13-art-pass
title: Balance the picture
status: in-progress
depends_on: [T00, T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12]
owns: [docs/screenshots/**, plans/T13-art-pass.md]
reads: [architecture.md, Agents.md, src/**, plans/**]
budget: 0
executor: opus/high
updated: 2026-11-18
---

# T13: art pass

## 1. Purpose

Nine tasks each made their own part look right alone. This one makes the whole frame look right
together, and like Synthwave City: the layers balanced against each other on the shared light scale,
the fog and bloom tuned so the skyline has depth, the tour paced so there is always something to look
at. It is also the first time anyone looks at the finished city in motion.

## 2. Context and orientation

Revised by the orchestrator on 2026-11-18 after wave 2 landed; see "State after wave 2" below.

It runs alone, with no sibling editing anything, and it may change **numbers** in any module:
colours, intensities, counts, sizes, speeds, densities, fog, bloom, exposure, tour parameters. It may
fix a defect it finds in any module. It may not change structure, contracts or signatures. Every
change is logged in this plan with the file, the old and new value, and the reason, so the owning
plan's record stays honest.

The reference for the look is the parent project's pictures in
`C:\highsierralabs\Synthwave_City\docs\screenshots\` (`skyline.png`, `street.png`, `plaza.png`,
`rooftops.png`) and, if a comparison at a matching camera helps, the parent itself (read its
`Agents.md` for how to take a shot there; do not change anything in it).

The gate applies: the file must stay under 32,768 bytes, and every change is followed by
`npm run build` to see what it cost.


### State after wave 2 (orchestrator, 2026-11-18)

Every module is built and committed. `npm run check`, `npm run verify` (product layers, 0 differing
pixels) and `npm run smoke` pass. The file is **17,522 bytes** against the 32,768 gate, with every
optional item of every plan built. Module costs are in `npm run size`.

The picture is already close to the parent's. What the orchestrator saw in `--layers all` shots
(`shots/orch/w2-*.png`, `tour-*.png`, `phone-q0.png`, which you can re-take), worst first:

1. **Air traffic dominates the frame from altitude.** Trails are long, in every palette colour, and
   cross the whole picture as horizontal streaks, in front of the skyline and the sun. In the parent's
   `skyline.png` the sky lanes are busy but read as streams of small craft; the towers and the beams
   are the subject. Shorter and dimmer trails, fewer colours per stream, or fewer craft at the lower
   levels are all candidates.
2. **Skyline depth.** From 160 to 300 m most of what is in view is low, flat-roofed blocks; the
   megatowers and the `high` district are rarely in the frame, and T05 notes that facades 400 to 900 m
   away wash to pink-grey in the fog rather than standing as dark silhouettes against a brighter sky
   (§6.3). Fog colour against sky colour, fog density, and the tour's choice of altitude and route are
   the levers. The plan's district mix and heights are numbers too (`src/plan.ts`), but its tests
   (`tests/plan`) hold invariants that must keep passing.
3. **Stars** read as short streaks rather than points at lower resolutions.
4. **The road is a near-perfect mirror at street level.** Striking, and perhaps too much: the parent's
   streets are wet, not glass.
5. **The sun's stripes** soften under bloom.

Check these with your own eyes before acting on them; they are one viewer's impressions from six
stills. Then do the survey of M1 and trust what you see there over this list.

There is byte headroom. This task may spend bytes where a small addition clearly repairs something a
viewer would miss, but it is not the place for new features: record the cost of every change with
`npm run build`, and keep the total growth of this task under about 500 bytes.

Known and not yours to fix: the engine keeps its frame loop running after a context loss (T12's
note); frame times were never measured on an idle machine (do that in M5, now that you run alone).

You run alone, so **you commit your own work**: one commit per milestone, plain messages saying what
changed, using the repository's configured identity, with no co-author or AI attribution trailer of
any kind. Never push, never add a remote.

### Notes the wave-2 executors left for this task

**T04**

- Sun: radius 0.15 rad, disc at 5x (L3), stripe gap half-width clamp(0.25 - v*0.35, 0, 0.45) below v=0.5. With bloom the gaps soften (all_sun.png); widen them or darken the gap if the reference's crisp stripes are wanted.
- Mountain height m*m*0.1 rad; wire density az*24 and depth*60; fill f*0.2. The ridge covers the sun's lower stripes when it is taller.
- Sky colours in sky.glsl mood() calls (horizon f*1.7, mid and top colours); the far-ground haze band colour comes from T00's fogColor.
- Reflection strength: wet = (car*0.5 + walk*0.15) * (0.3 + 0.9*noise), far average 0.1, angle term 0.25 + 0.75*(1+v.y)^4. At street level puddles are quite mirror-like; at 1500 m the sun glint is subtle.
- Zebra brightness 0.15 and lane marks 0.7 (white). Curbs 2.5 (pal(1) cyan on streets, pal(0) magenta on avenues). Lamp heads 6x and pools 0.25.
- Lamp spacing 64 m with heads 7.3 m up; the parent's street.png has denser lamps. 32 m spacing would double the instance count to 32,768.

**T05**

- Far facade average 0.06*lit*(cA+cB) in buildings.glsl. This is about half the energy-conserving value, so distant facades stay dark. Facades 400-900 m away still read pink-grey, mostly from the shared fog colour in common.glsl (T00)
- Window fade threshold smoothstep(0.2, 0.5, fwidth) in grid() and in 'far'. Moving it later keeps the parent-like pixel texture visible longer, at some shimmer risk
- Trim: brightness 2.5, width ew = max(0.3, 0.5*fwidth(e)), falloff sqrt(0.3/ew)
- Crown fins: 0.05 + rel^3*1.5. A near crown fills a lot of screen (fin_mega.png)
- Storefront brightness 0.45 and lit fraction 0.3 + roof/800 + hashes
- Window colour B is only orange or cyan, so neighbouring buildings repeat that pairing often
- The parent's mid-distance facades keep colourful pixel noise; ours average out. If that look is wanted, a block-level lit pattern that survives past window size is the lever

**T06**

- Straight down an avenue, sprites between R0 and R1 are lifted by their radius and stand above the sunk city as a column of blobs (final_o400.png). Consider fading lights earlier than R0/R1, or not lifting them.
- People are bright additive figures (intensity 1.2). The parent's are dark silhouettes with lit accents.
- Headlight intensity 8, minimum sprite radius 4*d*tan/resY, sqrt(0.3/r) falloff, and the face factor 0.3..1: these set how much the streams bloom.
- Pool brightness 0.3, size 1.8 x 5 m: at grazing angles many pools can overlap.
- Density is 64 cars per lane slot (avenue spacing about 32 m, street about 64 m). Revisit it for phone vertex cost.
- The far horizon band of lights in far_avenue.png is a dense carpet. It might be judged too uniform against the parent's skyline.

**T07**

- A craft passing within about 10 m of the camera makes a very wide, bright trail across the frame (shots/T07/m2_high.png, m4_high_build.png); the tour flies among the lanes, so this will happen. Options: fade trail brightness as the craft gets close, or cap trail width in pixels
- Brightness levels are first guesses: trail head 3.5 x palette (L2), engine glow 6 x (L3), strobe 8 x, ship windows pal(7) at 1.0, underglow 1.6, edge 2.0, stripe 2.5
- Trail length is 1.5 s of flight plus two hull lengths; from 900 m the lanes read as dashes more than continuous lines. A longer trail or a denser stream (CRAFT = 4608 in src/air/index.ts) would make the lattice more continuous
- Far-light compensation: trails sqrt(base/width), sprites base/size; this is not energy-conserving, on purpose, so far streams stay visible. Check that it does not over-brighten the horizon band under the final post

**T08**

- Searchlight count (about 16% of tall shafts plus one per megatower segment) and intensity (col x1.1, core x4): with all layers on, the sky is dense with beams, which is close to the parent's skyline.png but could be thinned.
- Face billboards look small and dim next to T05's facade signs at distance. The levers are the size (g = 5..17 m), the face fraction (r.z < 0.4) and the background level (0.16).
- Ticker text is pale and small (g = 8 m); it may need a larger glyph or a brighter colour.
- Plaza octahedron at 96 m with a 28 m radius is often hidden by surrounding towers from street-level views.
- Beam shimmer noise is seeded by the beam type, not per beam, so beams of one type shimmer in step.
- Aviation light on intensity is 8 (L3), off 0.25, with a blink period of 1.67 s.

**T09**

- Bloom strength 0.2 of the summed 5 levels, and the knee from 0.9 to 1.7 on the peak channel. The far view looks softer and less crisp than the parent's skyline.png.
- Tone curve 1-exp(-1.2 m^2/(m+0.1)) and the white point (whitening smoothstep 4..16 on the scene peak, before bloom).
- Saturation exponent 1.3 on the chroma. Without it the city looked muted and brownish (all_high_nosat.png).
- The region round the sun is milky in all_high_pow.png, and the far sky is a flat mauve. Either could be the backdrop's brightness rather than post.
- Vignette 0.5, scanline depth 5% at a 3 px period, grain amplitude 0.04 and the CA offset 0.0015 are all first guesses.

**T10**

- Master LEVEL 0.42 gives peaks of -7.5 and -7.9 dBFS; there is room for about 1 dB more.
- Mix balance is untested by ear: hats (0.3 offbeat, 0.12 extra), pad 0.045 per oscillator, lead 0.1, the bed at 0.03, and reverb return 0.4. Band share above 2 kHz is only 2-3%.
- The station 0 breakdown drops about 10 dB RMS (pad, hats and lead only); it may feel too empty.
- F level decay rates (1.5, 0.5, 0.3 per sixteenth) and the pulse shape (1 - frac)^2: check them against how the city pulses.

**T11**

- Turns at street junctions use a 20 m radius at up to 48 m/s, about 0.5 s per turn. At 200 m and above they look dramatic (shots/T11/all_3.png). Avenue-by-avenue junctions use 36 m. Consider a wider radius when the drone is above the surrounding roofs; that would need a roof check.
- Low flight down 20 m streets among tall buildings shows mostly walls (sheet_b.png, frames 48-59 of the first probe run). The avenue weight is 2, which gives 79% of the time on avenues; 3 gives 98.5%.
- Altitude mix over 1 hour, seed 1984: under 12 m 6.9%, 12-30 m 4.9%, 30-100 m 24.9%, 100-200 m 45.6%, 200-300 m 16.8%, 300-400 m 0.9%; peak about 355 m. Above 300 m is rare. Tune via the climb radius (600 m), climb target (250-380 m) and vertical rate (25 m/s).
- Other tunables in src/camera/tour.ts: speed 40-90 m/s with 15 m/s^2 acceleration and 20 m/s^2 braking; view lead 0.7 s; yaw rate 1.3 rad/s; bank 0.35 x turn rate, capped at 0.4 rad; pitch curve .06 - .5*smooth(10,300,y) + 0.4*atan(vy/v); drag sensitivity 0.004 rad/px; release delay 1.5 s; flight speed 30 m/s, or 150 m/s with Shift.

**T12**

- Card and toast styling are a first guess: border #ff2bd6, background #0a0414c0, title #19f0ff with a glow, sizes 24/14/12 px. Judge them against the final look of the city.
- The fullscreen glyph (□) is small and weak, and quality is the text 'HD'. Better symbols cost only a few bytes. Check that ♪ ♫ ◐ ▲ exist in Android's default fonts; I only saw them rendered on this Windows machine.
- The bar is 6 x 48 px buttons, 44 px tall (46 measured), with 8 px gaps, centred at the bottom. Check it does not sit over an important part of the picture in landscape.
- The key-hint line wraps in the middle of '1 2 3' on a narrow desktop window. A non-breaking space costs a couple of bytes.
- Fade timings (3.5 s idle, 0.6 s fade, 1.4 s toast) are guesses. The cursor hides together with the bar.

## 3. Scope

Owned: `docs/screenshots/**` (the pictures the README will use) and this plan. A serial window to
retune numbers anywhere.

Not in scope: new features; saving bytes for its own sake (T14).

## 4. Interfaces

None of its own.

## 5. Plan of work

**M1. Survey.** A fixed set of a dozen views (street, canyon, avenue at 100 m, skyline toward and
away from the sun, 600 m, 1,500 m, straight down, a megatower close, a junction, a plaza, the tile
edge), each at every quality and mood, plus a two-minute tour sequence at one frame a second. Write
down what is wrong, worst first.

**M2. Light balance.** Bring every layer onto the bands of §6.2 with post on. Typical faults: one
layer far brighter than the rest; bloom washing out the skyline; fog too thin to hide the far fade or
so thick that the megatowers vanish; reflections brighter than what they reflect.

**M3. Distance and repetition.** From high up, the tile repeat and the far fade must not be
noticeable: tune the fog and the fade radii per quality.

**M4. Motion.** Tour pacing, altitude mix, bank; traffic speeds; flicker rates; the beat pulse
(strong enough to feel, not a strobe).

**M5. Quality 0 on a phone-sized frame.** 412x915 and 915x412 at quality 0: readable, not sparse.

**M6. The README pictures.** Four or five shots into `docs/screenshots/`, at most 1920 px wide.

## 6. Validation and acceptance

- Before and after pictures for each of the M1 views, looked at and described.
- `npm run check`, `npm run verify` and `npm run smoke` pass; the file is under the gate.
- The change log in this plan is complete.

Human checks: the operator's eyes on a monitor and on a phone. This task ends with a short list of
what the operator should look at and what was a judgement call.

## 7. Idempotence and recovery

Every change is a number in a tracked file; `git diff` shows them all and `git checkout` undoes them.

## 8. Progress

- [x] 2026-11-18 M1 survey. Thirteen fixed views (`.tmp/T13/survey.sh`: street, canyon, ave100,
  sun300, away300, h600, h1500, top, mega, junction, plaza, edge, megafar) at q2 in moods 0, 1, 2 and
  at q0 and q1 in mood 0, 1280x720, t = 10; a 120 s tour at one frame a second (960x540); the high
  view at 915x412 and 412x915, q0. Pictures in `shots/T13/m1-*`, `shots/T13/tour0/`, contact sheets
  `shots/T13/sheet-*.png`. Baseline file 17,522 bytes. What is wrong, worst first (observed):
  1. **Air traffic fills the sky.** In ave100, sun300, plaza and edge the band from the horizon to
     well above it is dozens of horizontal streaks, every craft a different palette colour, in front
     of the skyline and the sun. Each streak is a 45 to 135 m trail at L2. The plaza view is the worst:
     the trails are most of what is in the sky.
  2. **Mid-distance facades wash out.** From 300 to 600 m (sun300, h600, edge) everything past about
     400 m is pink-grey boxes with neon outlines: windows have faded to their dim average and the
     sunset fog lifts them to the sky's colour. The reference's mid-distance towers keep coloured
     window texture and read against the sky; ours read as a wireframe. Mood 1 (midnight) holds up
     best because its fog is dark.
  3. **Near facades are walls of big saturated windows.** The tour spends much of its time low in
     street canyons (tour0 frames 30, 60-65, 85-95, 110-119) where the frame is two facades of
     2-4 m windows covering about 80% of the wall, almost all lit in full palette colours. The
     reference's facades are darker with smaller lit windows.
  4. **The road is a mirror at street level** (street, canyon): reflections of facades are crisp and
     strong; the reference's road is wet, with smeared, dimmer reflections.
  5. **Quality 0 looks empty** (q0 h600, h1500, phone 915x412): past about 900 m there is only fogged
     ground grid, and the density of 0.4 leaves gaps; the 600 m view is mostly ground.
  6. **Sun stripes** are soft but legible at 1280x720; the stars are points at 1280x720 and at
     915x412 (not the streaks the orchestrator saw, at least in these stills).
  7. Draw calls: the harness reports 34 per frame against the 30 of section 11.3 (not a picture
     fault; noted for T14).

- [x] 2026-11-18 M2 light balance, first pass: c01 to c14 below (seven kept, seven tried and
  reverted). Air traffic, near facades and the wet road are better; the mid-distance wash and the
  sun stripes are not (see Surprises). The tour changes c10 to c12 belong to M4 but were made here
  because the survey's tour was where the facade problem showed. `npm run check` OK (109 tests),
  `npm run verify` OK (4 views, 0 differing pixels), `npm run smoke` OK (1920x1080, p95 8.1 ms on
  the headless 8 ms clock). File 17,522 bytes. Committed.

- [x] 2026-11-18 M3 distance and repetition. High views at 900 and 1500 m at q0 and q2
  (`shots/T13/m3/`). No tile repeat is visible (R1 is under half the tile). What shows from high up is
  the empty fogged plain past the far fade, worst at q0 (fade 900 to 1300 m), and from 1500 m a dim
  reflected sun in that plain (c15, reverted). The fade radii and the q0 density are contract numbers
  (`src/contracts.ts`), so they are left alone; the fog density lever (c13) did nothing visible. The
  tour never goes above about 400 m, so these views are free-flight only.
- [x] 2026-11-18 M4 motion. Frame sequences: flying forward at 60 m/s over the city (`shots/T13/mot/fly_*`,
  1/30 s apart), air traffic from the plaza (`mot/air_*`), one beat (`beat0`, `beat1`). No shimmer or
  crawling seen in consecutive frames of facades, roads or trails; craft move steadily. Beat pulse
  strengthened (c16). Tour pacing: c10 to c12. Traffic speeds and flicker rates were looked at in the
  sequences and left as they are.
- [x] 2026-11-18 M5 quality 0 at 915x412 and 412x915 (`shots/T13/m5/`): readable in both
  orientations, sun, ridge, avenue traffic and buildings all legible; the city was sparse, so c17
  draws more buildings at q0. Frame time on this desktop, idle, headless Chromium 151, RTX 4070
  SUPER, `npm run smoke` on the packed file with the tour driving: 1920x1080, 10 s, 1,269 frames,
  rAF intervals median 8.0 ms, p95 8.1, p99 8.1, worst 8.1; 2560x1440, 10 s, 1,271 frames, median
  8.0, p95 8.1, p99 8.1, worst 8.2; no frame over 50 ms. Headless Chromium here ticks rAF every 8 ms,
  so this shows only that no frame missed that clock at either size; it is not a GPU time and says
  nothing about a phone.

### Change log

Every change, in the order made. "Kept" changes are in the tree; "reverted" ones were tried, looked
at and undone. Before/after pictures are `shots/T13/<id>/` against the previous id (the survey views
named), with side-by-side sheets `shots/T13/sheet-<id>*.png`. Bytes are the `npm run build` size of
`dist/synthwave-city.html` after the change. Exceptions to the folder naming: c10 to c12 are judged
on the tour sequences `shots/T13/tour0` to `tour3` (one folder per change, 120 frames at 1 s);
c13's before and after are `shots/T13/c11*` and `c12*`; c14's are `c12` to `c16`.

| Id | File | Old | New | Why, and what the pictures showed | Bytes |
|---|---|---|---|---|---|
| c01 | `src/air/air.glsl` (trail length) | `laps * 1.5 + len * 2.0` | `laps * 0.5 + len * 2.0` | Trails were 1.5 s of flight (45 to 135 m) and crossed the sky as long streaks. At 0.5 s the sky reads as craft with tails (plaza, sun300, edge). Kept. | 17,522 |
| c02 | `src/air/air.glsl` (craft colour) | `pal(q.y * 6.0)`, a colour per craft | `pal(hash(float(stream * 2 + k % 2 + 7000)) * 6.0)`, a colour per sub-lane | Every craft was a different colour, so no lane read as a stream. Now each sub-lane is one colour: rows of green, rows of magenta (plaza). Kept. | 17,522 |
| c03 | `src/buildings/buildings.glsl` (far facade average) | `0.06 * lit * (cA + cB)` | `0.12 * lit * (cA + cB)` | Tried to lift mid-distance facades. The average of two opposed hues is grey, so the far city got greyer, not more colourful (sun300, h600). Reverted. | n/a |
| c04 | same | `0.06 * lit * (cA + cB)` | `0.12 * lit * cA` | One hue instead of the grey mix. Barely visible change, slightly more tint. Reverted with c03. | n/a |
| c05 | `src/common.glsl` `fogColor` warm, and `src/backdrop/sky.glsl` horizon | warm sunset `(0.36, 0.08, 0.18)`, miami `(0.34, 0.10, 0.30)`; sky haze `f * 1.7` | `(0.22, 0.05, 0.11)`, `(0.21, 0.06, 0.19)`; `f * 2.4` | Darker fog towards the sun with the horizon haze kept about as bright, so the fogged far ground is darker than the sky above the ridge, as in the reference. Small but visible at h1500 (more contrast in the city, darker ring beyond it); sun300 almost unchanged. Kept. | 17,530 |
| c06 | `src/buildings/buildings.glsl` (window fade) | `smoothstep(0.2, 0.5, ...)` in `grid()` and `far` | `smoothstep(0.3, 0.7, ...)` | Keeps windows to about 1.4 px. A few more facades show window texture at 400-600 m (megafar crop), with visible moire and a shimmer risk against the two-pixel rule of Agents.md, for little change in the overall read. Reverted. | n/a |
| c07 | `src/buildings/buildings.glsl` (window size) | `grid(c.x, 0.1)`, `grid(c.y, 0.08 + 0.2 * fract(h.y * 7.0))` | `grid(c.x, 0.2)`, `grid(c.y, 0.14 + 0.16 * fract(h.y * 7.0))` | Windows covered about 80% of a wall; now about 45 to 60%, with real frames between them. Near facades read as buildings with windows rather than walls of coloured tiles (street, canyon, junction). Also brings the near average closer to the far average, which T05 had set at about half of it. Kept. | 17,530 |
| c08 | `src/backdrop/ground.glsl` (wet strength) | `(car * 0.5 + walk * 0.15) * (0.3 + 0.9 * noise(...))` | `(car * 0.3 + walk * 0.1) * (0.2 + 1.0 * noise(...))` | The road was a mirror at street level. Reflections are now about 60% as strong and patchier: the street reads wet, the facades' reflections no longer compete with the facades (street, canyon). Kept. | 17,530 |
| c09 | `src/backdrop/ground.glsl` (reflection ripple) | uv offset `* 0.008` | `* vec2(0.006, 0.03)` | Ripple stretched vertically, the way wet asphalt smears lights into streaks. Reflection edges break up more and read less like glass (crops in `sheet-c09.png`). A mild change. Kept. | 17,530 |
| c10 | `src/camera/tour.ts` (avenue preference) | `> ST_HALF) * 2` | `> ST_HALF) * 3` | T11's suggestion. Over an hour (`.tmp/T13/tourstat.ts`, seed 1984): time on avenues 77.4% to 98.4%, time in a street canyon (below the roofs on both sides of a 20 m street) 7.3% to 0.6%; altitude mix and megatower passes about the same. The 36 m avenues show more of the city than the 20 m streets, which were mostly two walls. Kept; a judgement call. | 17,530 |
| c11 | `src/camera/tour.ts` (pitch at altitude) | `.06 - .5 * smooth(10, 300, y)` | `.06 - .3 * smooth(10, 300, y)` | Above 200 m the drone looked 25 degrees down at roofs and lost the horizon (tour1 frames 70-80). Now about 14 degrees at 300 m: the skyline and the ridge stay in frame (tour2 frame 70). Kept. | 17,530 |
| c12 | `src/camera/tour.ts` (bank) | `clamp(turn rate * .35, .4)` | `clamp(turn rate * .25, .25)` | Bank reached 0.37 rad (21 degrees) in a junction turn (tour2 frames 60, 65), tilting the whole city. Now 0.23 at the same moment (tour3). Kept. | 17,522 |
| c13 | `src/engine.ts` (fog density) | `1.2 / R1` | `1.6 / R1` | Tried to hide the empty ground past the far fade at q0. No visible difference at q0 or q2 (`sheet-c12.png`): from altitude the height-weighted fog is thin whatever the ground density. Reverted. | n/a |
| c14 | `src/backdrop/sky.glsl` (sun) | disc `* 5.0`; halo `0.5`, `0.6`; stripe gap `clamp(0.25 - v * 0.35, ...)` | tried disc 3.0 and 2.5, halo 0.25 and 0.3, gap `clamp(0.3 - v * 0.5, ...)` | To make the stripes crisper. None of the four tries made a visible difference at 1280x720 (`sheet-c13.png` to `sheet-c16.png`): the gaps are 3 to 12 px without post (`diag/sun-post0.png`), and what fills them under post is the horizon haze, not the disc's bloom. Reverted. | n/a |
| c15 | `src/backdrop/ground.glsl` (far reflection) | far `wet` average `0.1` | `0.05` | From 1500 m a second, dim sun shows in the fogged plain below the ridge: the mirror pass's sky in the far wet average. Halving it only dimmed the ghost a little (`shots/T13/m3/h1500flat-q2*.png`) and dulled the far avenues at 300 m (`sheet-c15m3.png`). Reverted; left as an observation. | n/a |
| c16 | `src/lights/beam.glsl`, `src/lights/holo.glsl` (beat pulse) | `(0.8 + 0.4 * uTime.w)` | `(0.6 + 0.8 * uTime.w)` | The city's pulse was the beams and billboards moving by +/-20%, which a sequence across one beat (`shots/T13/beat0`, frame mean 81.9 to 81.0) barely showed. At 0.6 to 1.4 the beams visibly flare on the beat and settle (`beat1`, `sheet-beat1.png`); the decay shape is unchanged, so it reads as a pulse, not a strobe. Kept. | 17,530 |
| c17 | `src/buildings/index.ts` (drawn prefix) | `boxCount * density` | `boxCount * (density * .6 + .4)` | At quality 0 (density 0.4) many blocks were empty lots and the 600 m and avenue views were mostly ground (`shots/T13/m5/*-915x412.png`). Buildings now draw 64% at q0, 82% at q1, 100% at q2; streets, air and lights keep the shared density. The q0 views fill in (`sheet-c16.png` in `shots/T13/m5/`). Costs vertex work on a phone that nobody has measured. Kept; a judgement call. | 17,538 |

## 9. Surprises and discoveries

- 2026-11-18. The pink-grey mid-distance city is not mainly fog. With only the backdrop, buildings
  and post (`shots/T13/diag/bb.png`), facades past 400 m already read mauve-grey: their faded average
  is dim (about 0.05 linear), the gamma lifts that to about a quarter of full scale, and the fog adds
  its pink. Darkening the fog (c05) changed little; brightening the average (c03) made it greyer,
  because the two window colours of a building are often opposite hues.

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

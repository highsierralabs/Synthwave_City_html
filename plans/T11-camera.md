---
id: T11-camera
title: Tour, free flight and input
status: done
depends_on: [T00, T03]
owns: [src/camera/**, tests/camera/**, plans/T11-camera.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/engine.ts, src/plan.ts]
budget: 2200
executor: opus/medium
updated: 2026-11-18
---

# T11: camera

## 1. Purpose

Endless travel. By default the viewer is carried through the city by a drone that never stops, never
repeats itself in any way they would notice, and never hits anything: down an avenue among the
traffic, banking through a junction, climbing past a megatower, dropping back to the street. They can
look around while it flies, or take the controls and fly themselves.

## 2. Context and orientation

Read §5.4 (the grid; the air above every road corridor is free at any height), §8 and §10.3 (the pose
`P`, including the angle conventions). `src/camera/index.ts` exists as a stub with the final export
signatures; keep them. `cameraInit(element)` attaches the input listeners to the element the app
shell gives it and registers one update with `addUpdate`; each frame that update writes `P`.
`cameraMode()` toggles between tour and free flight and returns the new mode.

`heightAt(x, z)` from `src/plan.ts` is the only collision query: the tallest roof at a point, 0 over
roads and plazas. `megas` lists the megatowers.

Keep the tour's mathematics in `src/camera/tour.ts`, importing only `contracts.ts` and `plan.ts`, with
no DOM, so Vitest can fly it for hours. `index.ts` holds the listeners and the glue.

The screenshot tool can drive this module: `node scripts/shot.mjs --layers all --tour 1 --t 30`
advances the tour in fixed steps from 0 to 30 seconds and draws that frame. So the tour must depend
only on the accumulated `dt` it is given, never on `Date` or `performance.now`.

This module ships in the file; read Agents.md, "Writing for the packer", before writing it.

## 3. Scope

Owned: `src/camera/**`, `tests/camera/**`.

Must have:

- **Tour.** Travels along road corridors, choosing at junctions (seeded) between straight on and a
  turn, preferring avenues and steering toward megatowers often enough that one is usually in view.
  Altitude wanders smoothly between street level (about 6 m) and well above the roofs (about 400 m),
  spending most of its time between 30 and 200 m, where the traffic and the facades are. Turns are
  arcs with bank, never a snap. Speed 40 to 90 m/s, slower near the street. The view leads the motion
  a little and tilts with altitude: looking down from high, level or slightly up from low.
- **Free look on the tour.** Dragging (one finger, or the mouse with the button down) turns the view
  away from the tour's own heading; a second or two after release it eases back.
- **Free flight.** `W A S D` move, `Q` and `E` go down and up, `Shift` boosts, drag looks. On touch:
  one finger looks, a second finger held down flies forward. The camera cannot enter a building or
  the ground: it is pushed up or out using `heightAt`. Returning to the tour (`cameraMode()` again)
  rejoins the nearest road smoothly.
- `prefers-reduced-motion`: the tour flies at half speed with no bank.

Optional, cut first if over budget, in this order: wheel or pinch to change the field of view,
arrow keys as a second way to look, a slow orbit of a megatower as a tour segment.

Not in scope: buttons and key bindings other than flight keys (T12 owns `M`, `R`, `N`, `F`, `H`,
`Space`, `1`–`3` and calls `cameraMode()` for `Space`), pointer lock, gamepad.

## 4. Interfaces

Consumes: `addUpdate` from `src/engine.ts`; `P`, `P_*`, the grid constants and `SEED` from
`src/contracts.ts`; `heightAt`, `megas`, `megaCount` from `src/plan.ts`.

Provides the `camera` row of §10.4, exactly as in the stub. Writes `P` and nothing else. Listeners
must not swallow keys they do not use.

## 5. Plan of work

**M1. The tour as pure code, with its invariants as tests.** Fly it in Vitest at 60 steps a second:
(a) for two simulated hours the camera is always either inside a road corridor or more than 10 m
above `heightAt` at its position; (b) no step moves more than 2 m or turns more than 3 degrees, so
there is no snap; (c) no value is ever NaN or infinite, and position stays bounded modulo the tile;
(d) over an hour it visits at least half of the avenues and passes within 300 m of every megatower;
(e) two runs with the same steps give the same poses. Show one of these failing first.

**M2. See it.** Frame sequences through `shot.mjs --tour 1` with whatever layers exist (`probe` at
least): one frame a second for a minute. *Proof:* looked at, described; the horizon is level in
straights and banks in turns; the camera is never inside a box.

**M3. Free look and free flight.** Pointer and key handling, collision with `heightAt`. Test the
flight step as pure code too: starting inside a box always ends outside it. *Proof:* a scripted
Playwright run in `.tmp/T11/` that holds `W` toward a tower and shows the camera sliding over or
round it, with shots.

**M4. Touch.** Pointer events with `touch-action: none` on the element; multi-touch by pointer id.
*Proof:* scripted with synthetic pointer events; say plainly that no real finger was involved.

**M5. Measure.** `npm run size -- camera`; trim or cut toward the budget.

## 6. Validation and acceptance

- `npx vitest run tests/camera` passes with the invariants of M1; one was seen to fail first.
- The one-minute sequence was looked at and described in this plan.
- Switching tour to flight and back leaves no jump of more than a few metres or degrees in one frame
  (measured in the scripted run).
- `npm run check:task -- T11` exits 0. Measured bytes are recorded against the budget.

Human checks: whether the tour is pleasant to watch for ten minutes, and whether touch control feels
right on the operator's Android phone and tablet. Neither can be judged from stills.

## 7. Idempotence and recovery

Shots go in `shots/T11/`, scratch in `.tmp/T11/`. Both can be deleted at any time.

## 8. Progress

- [x] 2026-11-18 Read Agents.md, architecture.md (sections 3-5, 8, 10, 14), contracts.ts, engine.ts, plan.ts,
  dev/harness.ts, scripts/shot.mjs. Status set in-progress.
- [x] 2026-11-18 M1: `src/camera/tour.ts` (pure: tour, free flight, hand-over, fixed steps) and
  `tests/camera/tour.test.ts` (13 tests). Invariants (a)-(e) pass; (a) and (b) were seen failing with a
  sabotaged turn radius (see Validation evidence).
- [x] 2026-11-18 M2: one frame a second for a minute through `shot.mjs --tour 1` with `probe`, and 20
  frames six seconds apart with `--layers all`; looked at and described below.
- [x] 2026-11-18 M3 and M4: `src/camera/index.ts` listeners; scripted run `.tmp/T11/flight.mjs` (mouse
  drag, Shift+W into the city toward megatower 0, CDP touch with one and two fingers, both mode
  switches) with shots in `shots/T11/fl_*.png`.
- [x] 2026-11-18 M5: `npm run size -- camera` = 2,142 bytes against 2,200, with two optional items in.
- [x] 2026-11-18 `npm run check:task -- T11` PASS. Status done.
- Left: the orbit segment (optional, not built), pinch zoom (not built; wheel only), the human checks.

## 9. Surprises and discoveries

- The harness hands the first frame the whole `--t` as one dt (`frame(30)` after boot gives dt = 30,
  unclamped; only the live loop clamps to 0.1). So the camera sub-steps internally: fixed 1/60 s steps
  from an accumulator, and P interpolated between the last two steps. Evidence: test (e), 1,800 updates of
  1/60 and one update of 30 give the same pose to 3 decimals; the probe shot at `--t 30` and the
  sequence frame 29 (t = 30 reached by 1 s steps) print the same pose `3072,84.208,2849.833,-3.142,...`.
- Interpolating between steps makes P lag the newest step by up to one step (16.7 ms): a drag shows in P
  one update later. The tests account for it.
- With an altitude target picked at every junction (a leg is about 2 s), the altitude never settled and
  never reached the street: 0% of an hour below 12 m. Holding a target for about five junctions fixed it.
- Steering to megatowers dominated the altitude mix at first (only 41% of the time in 30..200 m, 53% above
  200 m), because climbing near a tower re-triggered at every junction; climbs now start inside 600 m of
  the goal and end when it is passed. Measured over one hour (seed 1984): below 12 m 6.9%, 12-30 m 4.9%,
  30-100 m 24.9%, 100-200 m 45.6%, 200-300 m 16.8%, 300-400 m 0.9%; peak about 355 m. These numbers came
  from a throwaway test since deleted; the kept test asserts > 50% in 30..200 m and some time below 12 m
  and above 300 m.
- Avenue preference: weight 1 gave 44.5% of the hour in an avenue corridor, weight 3 gave 98.5% (never a
  street), weight 2 gives 79.1%. Kept 2.
- `npm run smoke` fails on the UTF-16 file with "Failed to fetch" while the `.safe.html` build boots, makes
  its canvas and reports no page error. Decoding the UTF-16 payload in Node gives 16,960 bytes of which
  raw inflate consumes 16,959: one trailing zero byte after the final deflate block, which
  `DecompressionStream` rejects (Agents.md, Build tools). This is in the container (T01, `tools/pack`), not
  in this module; reported, not fixed. It is data-dependent, so any change to the payload may hide or show
  it. Scripts: `.tmp/T11/decode.cjs`, `.tmp/T11/errs.mjs`.

## 10. Decision log

- 2026-11-18 All the mathematics (tour, flight, collision, hand-over, stepping) lives in `tour.ts`, so the
  flight step is unit-tested too; `index.ts` only writes input into a `Float32Array` with exported index
  constants (no objects, per "Writing for the packer").
- 2026-11-18 The tour flies the corridor centre lines only, with quarter arcs of radius 2 x the smaller
  corridor half-width (20 m, or 36 m where two avenues cross). An arc of radius r stays inside the two
  corridors when r <= 3.41 h; 2 h keeps the eye about 0.59 h plus the 2 m lot setback from the inner
  corner. So invariant (a) holds by construction and altitude needs no roof query on the tour.
- 2026-11-18 Each leg's turn is chosen when the leg starts; since every leg begins with a straight of at
  least 56 m, the view can look 0.7 s ahead without knowing the next choice. View yaw turns at most
  1.3 rad/s, which keeps a step under 3 degrees and turns a 0.5 s arc into a smoother sweep.
- 2026-11-18 Speed: 40 m/s at the street to 90 m/s from 150 m up, braking at 20 m/s^2 toward
  2.4 rad/s x radius before an arc (48 m/s on a 20 m arc, 86 m/s on a 36 m arc).
- 2026-11-18 Free flight collision samples `heightAt` at four points 2 m around the eye and keeps the eye
  2 m above the result; on contact it slides (drops the x or the z move), else pushes up. Head-on into a
  wall it stops; at an angle it slides.
- 2026-11-18 Back to the tour: the nearest road line, heading the way along it closest to the view; the
  position offset decays with a 1 s time constant, altitude continues from the flight, and the view eases
  through the normal rate-limited filters. During that blend the eye is held above `heightAt`, which can
  lift it in one step if the blend line crosses a taller box (not seen in the scripted run).
- 2026-11-18 Drag is "grab" style (drag right turns the view left) for mouse and touch alike, 0.004 rad
  per CSS pixel. The release delay is 1.5 s, then the look offset eases back with a 0.67 s time constant.
- 2026-11-18 Keys by `e.code` (layout independent). No `preventDefault` anywhere. Keys clear on `blur`.
- 2026-11-18 Optional items: wheel zoom of the field of view (0.5..1.6 rad, 48 bytes) and arrow keys as a
  second way to look (48 bytes) are in; pinch and the megatower orbit are out (budget).

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**Result against Purpose.** By default the drone flies the road grid without end: down avenues (79% of the
time in an avenue corridor), banking through junctions, climbing toward and past megatowers (within 300 m
of all seven in the first hour), dropping to the street now and then (about 7% of the time below 12 m).
It cannot hit a building: it never leaves the corridors. Drag looks around and eases back. `cameraMode()`
switches to free flight (WASD, Q/E, Shift, drag, wheel, arrows; on touch one finger looks and a second
held finger flies) and back, rejoining the nearest road with no jump. Reduced motion halves the speed and
removes the bank.

**Bytes.** `npm run size -- camera`: **2,142** marginal packed bytes against a budget of 2,200 (2,046
before the two optional items). Possible cuts: arrow keys about 48 bytes, wheel zoom about 48 bytes; the
reduced-motion support, the rejoin blend and the slide-before-push collision are each estimated at a few
dozen bytes [I, not measured].

**Validation evidence** (all run on 2026-11-18 in this session):

- `npx vitest run tests/camera`: 13 passed, about 3.4 s. (a) two hours, 0 steps outside a corridor and
  under roof + 10 m; (b) max step <= 2 m and <= 3 degrees; (c) no NaN, |x|, |z| < TILE + 256; (d) one hour,
  >= 8 of 16 avenues travelled along and every megatower within 300 m; (e) same steps same poses, and one
  dt of 30 equals 1,800 dts of 1/60 to 3 decimals; altitude mix; reduced motion (no roll, 15..45 m/s
  mean); free look turns and eases back; wheel zoom; arrow look; flight from inside each megatower ends
  above it; Shift+W toward a tower is never inside; tour -> flight -> tour moves < 4 m and < 5 degrees per
  frame.
- Seen failing first: with the turn radius set to 4 x the half-width, (a) failed (`t=646.90
  532.12,18.00,3561.92 ...` outside a corridor below the roofs) and (b) failed (a 253 m step); restored.
- `npm run check:task -- T11`: typecheck 0 errors in T11, tests ok, import rules 0 violations, plan 0
  problems, PASS.
- `node scripts/shot.mjs --layers probe --tour 1 --t 30` (RTX 4070 SUPER, D3D11): no console or shader
  errors; pose 3072,84.208,2849.833. Looked at `shots/T11/t30.png`: 84 m up in a street canyon heading +z,
  level horizon, walls both sides, the road lines running to the vanishing point.
- One minute, one frame a second (`--layers probe --tour 1 --t 1 --frames 60 --dt 1`), contact sheets
  `shots/T11/sheet_a.png`, `sheet_b.png`, looked at: frames 0, 17, 36 and 45 bank in turns (roll 0.25 to
  0.38 rad) and the horizon is level on every straight (roll 0.000); altitude wanders 7 to 240 m; 37-43
  cruise an avenue at 7 m with level view; 47-59 climb to 240 m in the downtown and look down (pitch
  -0.45 at frame 59). No frame shows the inside of a box. Many low frames on streets are close walls on
  both sides (narrow 20 m corridors among tall buildings).
- Real siblings (`--layers all --tour 1 --t 40 --frames 20 --dt 6`, sheet `shots/T11/sheet_all.png`):
  near `all_0.png` (7 m on an avenue among traffic, lit facades both sides, level), from above
  `all_14.png` (158 m, pitch -0.24, roofs and beams over the grid to the horizon), high banked turn
  `all_3.png` (236 m, roll 0.32, a tower face filling the right half). No console or shader errors.
- Scripted run `node .tmp/T11/flight.mjs` (synthetic input only: Playwright mouse and keyboard, CDP touch
  events; no real finger): tour -> flight first frames move 2.06 / 1.80 / 1.57 m at 30 fps (the tour's own
  speed carried over, then decaying), 0.11 degrees; mouse drag 30 px changed yaw by 0.12 rad; Shift+W
  12 s from 600 m east of megatower 0 at 150 m: 0 frames inside a box, the eye stopped against towers and
  slid along their faces in z (x held at 2164 then 1908 while z ran on), shots `fl_2_w_*.png` show a face
  2 m away, not its inside; one-finger touch drag 200 px turned yaw 0.72 rad; two fingers held 2 s flew
  31.9 m; flight -> tour first frames 0.22 / 0.42 / 0.41 m and 1.2 / 2.5 / 2.5 degrees, max over 8 s
  2.38 m and 2.52 degrees per 1/30 s frame, 0 frames inside a box; 0 shader and 0 console errors.
- `shot.mjs --app 1`: the unminified app boots with the tour driving behind T12's start card.

**Not verified.** Frame times (nine agents share this GPU; none reported). The packed UTF-16 file under
smoke (fails in the container, see Surprises). Real touch on a phone or tablet, `setPointerCapture` with
a real finger, `prefers-reduced-motion` from the OS (only the flag path is tested), keyboard layouts other
than US, and whether ten minutes of the tour is pleasant to watch: these are the human checks. The
"slides over" half of M3 (pushed up over a roof while flying) is tested only in the unit test of starting
inside a box, not in the scripted run.

**For the art pass.** Turns at street junctions are tight (20 m radius, about 0.5 s) and look dramatic at
200 m+ (`all_3.png`); low flight down 20 m streets between tall buildings shows mostly walls. Numbers to
tune in `tour.ts`: speeds (40/90, 15 m/s^2), view lead 0.7 s, yaw rate 1.3 rad/s, bank 0.35 x rate capped
at 0.4 rad, pitch curve, altitude mix, avenue weight 2, climb radius 600 m.

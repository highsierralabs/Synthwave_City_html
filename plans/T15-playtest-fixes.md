---
id: T15-playtest-fixes
title: Fixes from the operator's first play test
status: done
depends_on: [T04, T06, T11, T14]
owns: [plans/T15-playtest-fixes.md]
reads: [architecture.md, Agents.md, src/camera/**, src/backdrop/ground.glsl, src/street/**, src/engine.ts, src/gl.ts, scripts/**, dev/**, docs/release/**, SIZE.md, README.md]
budget: 100          # packed bytes added to the shipped file by all three fixes together
executor: orchestrator
updated: 2026-11-19
---

# T15: Fixes from the operator's first play test

## 1. Purpose

The operator played the shipped file (17,146 bytes) on 2026-11-19 and reported three defects. After
this task:

1. Dragging turns the view the way the three.js Synthwave City does: drag right to look right, drag
   down to look down.
2. In free flight a finger held on the screen flies forward while it steers, and a second finger
   boosts, as in the three.js Synthwave City.
3. The headlights of the street traffic no longer flicker in step.

## 2. Context and orientation

The operator's words: "The free look controls are reversed from the left and right look. It moves
the opposite of the original Synthwave City. The headlights of the street vehicles flicker, all at
the same time. In free flight pressing the screens with a finger does not move the camera forward.
It only allows free look. To move forward you have to use two fingers, spreading them apart, to
move. But it doesn't work well."

- The camera is `src/camera/index.ts` (listeners) and `src/camera/tour.ts` (mathematics), plan T11.
  Positive yaw turns left and positive pitch looks up (`src/engine.ts`, the basis built from `P`).
- The reference for both control reports is the parent project's input mapper,
  `C:\highsierralabs\Synthwave_City\src\camera\input.ts`: `lookYaw -= dx * sensitivity`,
  `lookPitch -= dy * sensitivity` ("drag right to look right, drag up to look up"), and in free
  flight `forward += touching`, `boost = fingers > 1` ("The first finger steers and flies; a second
  one boosts"). On the tour a finger only looks.
- The ground is one quad 80 km wide drawn by `src/backdrop/ground.glsl` (plan T04). Car bodies and
  lights are `src/street/body.glsl` and `src/street/light.glsl` (plan T06).
- This task has no paths of its own beyond this file. It edits paths owned by T04, T06, T11, T00
  (`scripts/**`, `dev/**`, `package.json`) and T14 (`SIZE.md`, `README.md`, `docs/release/**`),
  as the orchestrator, and leaves a Progress line pointing here in each of those plans.

## 3. Scope

In: the three defects, a test for each that was seen failing first, the rebuilt release files and
ladder, and the records. Out: pinch zoom, a double-tap take-over, gamepad input and anything else
the parent project has and this build never had. The brake lights (15% of cars, picked again for
every car on each whole second) are deliberate and were not changed.

## 4. Interfaces

- `src/camera/tour.ts` gains one input slot, `I_TOUCH = 6` (touch and pen pointers down), and `IN`
  grows from 6 to 7 floats. Both are internal to `src/camera`. The exports of
  `src/camera/index.ts` (architecture.md section 10.4) are unchanged.
- No contract file changes.

## 5. Plan of work

**M1. Reproduce the flicker.** It is the report with an unknown cause, so it goes first.
Proof: a frame sequence in which the headlights change in step, and a number for it.

**M2. Fix the flicker and keep the picture.** Proof: the number from M1 falls to the level of a
steady sequence, and the GPU pictures before and after are the same.

**M3. Drag direction and touch flight.** Unit tests in `tests/camera/tour.test.ts` seen failing,
then passing; then the real listeners driven by real mouse and touch events in Chromium.

**M4. Gates, release files, ladder, records.**

## 6. Validation and acceptance

- `npm run check`: `CHECK OK`.
- `npm run input`: `INPUT OK`, nine lines.
- `npm run steady`: `STEADY OK`; with the `gl_FragDepth` line in `ground.glsl` commented out it must
  print `STEADY FAILED`.
- `npm run verify`: `VERIFY OK`; `npm run verify -- --sabotage`: `VERIFY FAILED`.
- `npm run smoke`: `SMOKE OK`.
- `docs/release/synthwave-city.html` is byte-identical to `dist/synthwave-city.html`.

**Human checks (the operator's):** all three fixes on the device and browser where the defects were
seen. In particular the flicker fix is proven only on Chromium's software rasteriser; see section 12.
Done by the operator on 2026-11-19: see Progress.

## 7. Idempotence and recovery

Every command above can be re-run. `git revert` of this task's commit restores the shipped
17,146-byte build; `docs/release/` holds whatever was built last.

## 8. Progress

- [x] 2026-11-19 M1. Not reproducible on the RTX 4070 SUPER (D3D11): fixed camera, tour and the live
  packed app all showed steady headlights. Reproduced with Chromium's software rasteriser
  (SwiftShader on Vulkan): `node scripts/shot.mjs --layers all --tour 1 --t 20 --frames 6 --dt
  0.0166667 --post 0 --mode software`. Near-white pixels over the road ahead, frame by frame:
  989 1185 970 1217 1202 1208, a mean change of 12.0% a frame against 1.7% on the GPU. Enlarged, the
  low frames show every headlight sprite cut to a thin horizontal sliver.
- [x] 2026-11-19 M2. `gl_FragDepth = 0.99999` in `ground.glsl`; car bodies clamped at the road in
  `body.glsl`. Software: 1206 1185 1196 1217 1202 1208, 1.2%. GPU before and after, pixels differing
  by more than 8/255: tour frames 4 and 0 of 921,600, street view 3, far view (1,500 m up) 0.
- [x] 2026-11-19 M3. Three new unit tests; the drag test and the touch-flight test failed first
  ("expected 0.3999999761581421 to be less than -0.2", "expected 0 to be greater than 15"). One
  older test compared a dragged yaw with the tour's yaw six seconds later and failed by accident of
  the new sign; it now compares at the same moment. `npm run input`: 9 of 9.
- [x] 2026-11-19 M4. See the evidence in section 12.
- [x] 2026-11-19 Human check. The operator re-tested the 17,208-byte build and reported: "The
  flickering is gone and the camera now works as expected." Which device and browser was not stated.

## 9. Surprises and discoveries

- **The flicker does not exist on the development GPU.** Six ways of looking for it on D3D11 found
  nothing: a fixed camera at 60 frames a second, the tour, the live packed file sampled every
  animation frame, a 16-bit depth buffer, the pools painted bright green. It appeared at once on a
  different rasteriser. A defect in depth precision cannot be ruled out on one GPU.
- **The ground quad was the cause, not the lights.** With the body clamp in place and only the
  `gl_FragDepth` line removed, the software frames flicker again exactly as before (989 1185 970
  ...). Where the ground's interpolated depth came out too near, it hid the lower part of every
  sprite standing on it, in the same frames for all of them.
- Red tail lights were cut in the same frames; the white ones are simply the most visible.
- Chromium's scripted touch input (`Input.dispatchTouchEvent`) cannot lift one finger of two: listing
  only the remaining point, moved or not, leaves both down. The hand-over check in `scripts/input.mjs`
  therefore sends `PointerEvent`s straight to the element.
- A contact sheet scaled down for viewing showed "flicker" that was not there at full size. The first
  reading of the GPU tour frames was wrong for that reason; counts and 4x crops settled it.

## 10. Decision log

- 2026-11-19. **Match the parent project on both axes of the drag**, not only left and right. The
  operator named left and right and said the view moves opposite to the original; the original turns
  the view with the pointer on both axes, and this build had both the other way round. The arrow
  keys were already right and are unchanged.
- 2026-11-19. **One finger flies only in free flight.** On the tour a finger looks and nothing else,
  as in the parent. A mouse press never flies: `W` does.
- 2026-11-19. **When the steering finger lifts, the next finger that moves steers.** Before, a
  remaining finger kept flying but could not turn until every finger was lifted. One line.
- 2026-11-19. **The ground gets a constant depth instead of a better one.** Nothing is ever below the
  ground, so it only has to be behind the city and in front of the sky. 0.99999 is the depth of a
  point 50 km away (depth = 1 - 0.5 / distance); everything in the city is nearer, and the sky is at
  1.0. Considered and dropped: writing the true depth from `vPos` (it leans on the same interpolation
  across the same quad), a smaller quad (the quad still runs from the near plane to the horizon), a
  depth bias on the lights (treats one victim of several), and drawing the sky first with the ground
  not writing depth (the sky shader would then run on every pixel in both passes).
- 2026-11-19. **Car bodies stop at the road.** They used to reach 0.45 m below it, hidden by the
  ground's depth. `l.y = max(l.y, 0.0)` before the pattern coordinate is taken, so the stripe and the
  light bars stay where they were.
- 2026-11-19. **Done by the orchestrator, not by a subagent.** The work was diagnosis first, and the
  three changes together are about twenty lines.
- 2026-11-19. **Two new gates,** `npm run input` and `npm run steady`, so neither defect can come
  back unseen. `steady` runs the software rasteriser on purpose.

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**Result against Purpose.**

1. Drag direction: fixed on both axes, on the tour and in free flight. Proven by a unit test seen
   failing first and by real mouse and touch drags in Chromium (`npm run input`).
2. Finger flight: one finger flies forward at 30 m/s while its drag steers, two fly at 150 m/s, a
   mouse press only looks, and the remaining finger takes over the steering when the first lifts.
   Proven the same two ways. Measured in the browser check: 21.6 m in the first second with one
   finger (the speed eases in), 133.9 m in a second with two.
3. Headlight flicker: reproduced on Chromium's software rasteriser and removed there (12.0% mean
   change a frame in near-white pixels over the road, down to 1.2%). It matched the description (every car light, in step, most visible on the white ones) but was
   never seen on the development GPU. **The operator re-tested and reported the flicker gone**
   (2026-11-19), so the defect removed here was, as far as the operator's device shows, the one seen.

**Bytes.** 17,146 to 17,208, +62, against a budget of 100. ASCII twin 22,253 to 22,333. Smallest
rung 12,370 to 12,396. `npm run size`: camera 2,200 of 2,200, street 1,204, backdrop 1,436.

**Evidence, final tree, 2026-11-19, run by the orchestrator.**

- `npm run check`: typecheck ok, 115 tests in 10 files, import rules ok, plans:check ok, `CHECK OK`.
- `npm run verify`: `VERIFY OK` (0 of 518,400 pixels differ in each view); `--sabotage`:
  `VERIFY FAILED`.
- `npm run smoke -- --no-build --file docs/release/synthwave-city.html`: `SMOKE OK`, 635 frames in
  5 s, median 8.0 ms, worst 9.1. The same on `docs/release/ladder/synthwave-city-r14.html`: `SMOKE OK`.
- `npm run input`: `INPUT OK`, 9 of 9.
- `npm run steady`: 1206 1185 1196 1217 1202 1208, 1.2%, `STEADY OK`. With the `gl_FragDepth` line
  commented out: 989 1185 970 1217 1202 1208, 12.0%, `STEADY FAILED`.
- `cmp dist/synthwave-city.html docs/release/synthwave-city.html`: identical.
- Ladder rebuilt (`.tmp/T14/ladder-run3.txt`): 17,208 16,880 16,246 16,086 16,038 15,790 14,714
  14,336 14,208 14,120 13,814 13,686 12,836 12,572 12,396; every rung type-checks and prints
  `SMOKE OK`.

**Not verified.**

- Any of the three fixes on a real phone or tablet, or with a real finger, by anyone but the operator;
  the operator's report does not name the device or browser.
- Firefox and Safari, as before.
- The ladder's pictures, draw counts and pixel differences were not re-made, and the measurements
  of SIZE.md M1 to M3, the unpacker timings and Roadroller were not repeated on the new build.

**Retrospective.** The reversed drag got through T11 because its scripted run exercised the gestures
without asserting which way the view turned, and through the unit tests because the one test of the
drag only checked that the view moved. Touch flight was built to the wrong rule (second finger
flies) with nobody comparing it with the parent project. The flicker could not have been found on
the development GPU at all. All three now have a check that fails when the defect returns.

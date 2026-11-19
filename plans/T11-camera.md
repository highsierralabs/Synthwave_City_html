---
id: T11-camera
title: Tour, free flight and input
status: ready
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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

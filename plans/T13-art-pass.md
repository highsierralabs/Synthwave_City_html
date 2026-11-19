---
id: T13-art-pass
title: Balance the picture
status: draft
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

This plan is `draft` until wave 2 has landed; the orchestrator revises it then with what the wave
actually produced, and sets it `ready`.

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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

---
id: T14-squeeze-release
title: Ledger, cut ladder and release
status: draft
depends_on: [T13]
owns: [SIZE.md, README.md, LICENSE, docs/release/**, plans/T14-squeeze-release.md]
reads: [architecture.md, Agents.md, src/**, tools/**, scripts/**, plans/**]
budget: 0
executor: opus/high
updated: 2026-11-18
---

# T14: squeeze and release

## 1. Purpose

Answer the question the project was started for, with evidence: **what is the smallest file that
keeps the Synthwave City experience?** Make the shipped file as small as it will go without losing
anything a viewer would miss, measure what every feature costs, and show how much smaller the file
gets as features are given up, down to the smallest version that still passes the experience
checklist of §3.5.

## 2. Context and orientation

This plan is `draft` until T13 is done; the orchestrator revises it then and sets it `ready`.

It runs alone and may edit any path to save bytes, provided the picture does not change
(`npm run verify` compares pixels; for changes that legitimately alter pixels, before and after shots
are looked at) and every change is logged here with the bytes it saved. Changes that saved nothing
are reverted and logged too: a negative result is a result.

`npm run size` gives marginal costs per module (§3.5). Finer attribution, per feature inside a
module, is made by deleting the feature in a scratch copy or behind a build-time flag and rebuilding.

## 3. Scope

Owned: `SIZE.md`, `README.md`, `LICENSE`, `docs/release/**`, this plan. A serial window to edit any
path to save bytes.

Not in scope: new features; changing the look (T13 decided it).

## 4. Interfaces

None of its own.

## 5. Plan of work

**M1. Baseline.** The file size, the per-module table, and the split between JavaScript and GLSL in
the minified text, into `SIZE.md`.

**M2. Lossless squeeze.** In rough order of expected return; measure each, keep what helps:
terser option sets (and esbuild's own minifier as another candidate); shader minifier options
(unused-function removal, local name reuse); zopfli iterations and block splitting; repeated idioms
made textually identical across layers; near-duplicate helpers merged into `common.glsl` or `gl.ts`;
strings (CSS, markup, messages) shortened; tables turned into generators or packed strings; dead
exports and unreachable paths removed; unpacker golf.

**M3. A time-boxed experiment with a stronger packer.** A context-mixing packer in the Roadroller
family in place of deflate: measure the file size and the time to first frame on this desktop and
under 4x CPU throttling. Adopt it only if the saving is material and start-up stays under about a
second on the desktop and three throttled; otherwise record the numbers and why not.

**M4. The cut ladder.** Starting from the full build, remove features in the order that costs the
least experience per byte saved (the optional items listed in each plan first), rebuilding and taking
the same three screenshots at each rung. Stop at the smallest build that still passes all seven
points of the checklist in §3.5. `SIZE.md` gets the ladder as a table: rung, what was removed, file
size, what a viewer loses. The rungs are built from flags or scratch copies; the shipped file is the
full build unless the operator chooses a lower rung.

**M5. Release.** `README.md` (what it is, how to open it on a PC and a phone, the controls, the size
and the ladder, what was and was not tested, how to build, credits to the parent project and to the
two demos that prompted it), `LICENSE` (MIT, the same holder as the parent project), a copy of the
final file and its `.safe.html` twin under `docs/release/` so the product itself is in the
repository. Check every tracked file for user-home paths, host names and secrets before the final
commit. No remote is added and nothing is pushed.

## 6. Validation and acceptance

- `npm run check`, `npm run verify` and `npm run smoke` pass on the final tree.
- `SIZE.md` holds the baseline, the squeeze log with bytes per change, the experiment's numbers, and
  the ladder with a picture per rung.
- The final file opens from disk in Chromium and draws; its size is stated to the byte.
- The statement of what was not tested (Firefox, Safari, a real phone) is in the README.

Human checks: the operator opens `docs/release/synthwave-city.html` on their Android phone and
tablet, and decides which rung of the ladder is "the" answer.

## 7. Idempotence and recovery

Each squeeze step is one commit, so any of them can be reverted alone.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

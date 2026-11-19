---
id: T14-squeeze-release
title: Ledger, cut ladder and release
status: in-progress
depends_on: [T13]
owns: [SIZE.md, README.md, LICENSE, docs/release/**, plans/T14-squeeze-release.md]
reads: [architecture.md, Agents.md, src/**, tools/**, scripts/**, plans/**]
budget: 0
executor: opus/high
updated: 2026-11-19
---

# T14: squeeze and release

## 1. Purpose

Answer the question the project was started for, with evidence: **what is the smallest file that
keeps the Synthwave City experience?** Make the shipped file as small as it will go without losing
anything a viewer would miss, measure what every feature costs, and show how much smaller the file
gets as features are given up, down to the smallest version that still passes the experience
checklist of §3.5.

## 2. Context and orientation

Revised by the orchestrator on 2026-11-18 after T13; see "State after T13" below.

It runs alone and may edit any path to save bytes, provided the picture does not change
(`npm run verify` compares pixels; for changes that legitimately alter pixels, before and after shots
are looked at) and every change is logged here with the bytes it saved. Changes that saved nothing
are reverted and logged too: a negative result is a result.

`npm run size` gives marginal costs per module (§3.5). Finer attribution, per feature inside a
module, is made by deleting the feature in a scratch copy or behind a build-time flag and rebuilding.


### State after T13 (orchestrator, 2026-11-18)

The full build is **17,538 bytes** (`dist/synthwave-city.html`, utf16; the ascii twin is about 22.8
kB), with every optional item of every plan in it. `npm run check` (109 tests), `npm run verify`
(0 differing pixels in four views) and `npm run smoke` pass. That is already 47% under the gate, so
this task is not a rescue: it is the measurement. The ladder starts at 17.5 kB and goes down.

Marginal costs today (`npm run size`): core 3,824, container 518, plan 1,244, backdrop 1,508,
buildings 1,012, street 1,228, air 850, lights 2,046, post 602, audio 1,604, camera 2,134, main
1,588. Every plan's Outcomes lists what its author thought could be cut, mostly as estimates; your
job is to replace those estimates with measurements.

Things to settle here, beyond the plan below:

1. **The unpacker is quadratic** (T01, decision 6): 55 to 110 ms on this desktop at 25 to 35 kB, and
   unmeasured on a phone. Measure time from navigation to first frame for the shipped file at 1x, 4x
   and 6x CPU throttling (Chromium's `Emulation.setCPUThrottlingRate` through Playwright's CDP
   session), and the same for T01's linear block variant (about 108 bytes more; described in
   `plans/T01-packer.md`, not built). Ship whichever the numbers justify, and say which and why. A
   throttled desktop is a stand-in, not a phone; say so.
2. **Draw calls** are 34 per frame at quality 2 against a budget of 30 (§11.3). Either merge draws
   where that also saves bytes, or state the measured number and why it is acceptable.
3. **After a context loss the engine's frame loop keeps running** on a dead context (T12's note).
   Fix it if it costs a few bytes; otherwise record it.
4. **`docs/screenshots/*.png` are 1.5 to 1.8 MB each** (8 MB for five) because of film grain. They
   are T13's, kept as they are unless you can make them much smaller without losing the look
   (smaller size, or shot with a flag that leaves the grain out); the README must not pull in megabytes
   for a 17 kB product. Your call; say what you did.
5. **Documentation drift:** `architecture.md` and `Agents.md` belong to the orchestrator. Report every
   line that is no longer true (T13 already found §5.5's plan numbers) and the orchestrator applies
   them after you finish.

The ladder needs builds without a feature. Do not leave feature flags in the shipped sources: use
scratch copies under `.tmp/T14/` or a build-time define that the minifier removes, so the full build
stays byte-for-byte what it would be without the experiment.

You run alone, so **you commit your own work**: one commit per squeeze step or milestone, plain
messages saying what changed and what it saved, using the repository's configured identity, with no
co-author or AI attribution trailer of any kind. Never push, never add a remote.

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

- [x] 2026-11-19 M1 baseline: `npm run build` 17,538 bytes (deflate 16,974 + container 564); `npm run
  size` table recorded in `SIZE.md`; minified text 39,416 characters, of which GLSL 19,935 (8,295
  deflated alone) and JavaScript 19,399 (9,193 deflated alone).
- [x] 2026-11-19 M2 S01 zopfli iterations: no gain (log in `SIZE.md`).
- [x] 2026-11-19 M2 S02 terser option sets and esbuild's minifier: no gain.
- [x] 2026-11-19 M2 S03 glslmin names locals per function scope: 17,538 -> 17,224 (-314). Kept.

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

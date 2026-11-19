---
id: T14-squeeze-release
title: Ledger, cut ladder and release
status: done
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
- [x] 2026-11-19 M2 S04 locals ordered by whole-corpus count: +18, reverted.
- [x] 2026-11-19 M2 S05 flat packed program (no IIFE, no "use strict"): 17,224 -> 17,202 (-22). Kept.
- [x] 2026-11-19 M2 S06 engine blit DEV-only: 17,202 -> 17,128 (-74). Kept.
- [x] 2026-11-19 Item 3: frame loop stops after context loss: 17,128 -> 17,146 (+18). Kept.
- [x] 2026-11-19 Item 1: linear unpacker `utf16l` built as a packer option, start-up measured at 1x, 4x,
  6x; not shipped (+100 bytes).
- [x] 2026-11-19 M3 Roadroller 2.1.0 in `.tmp/T14/rr`: 14,978 bytes, 4.2 s first frame at 4x. Not
  adopted.
- [x] 2026-11-19 Item 2: draw calls counted (34 at q2, 23 at q0); left as they are, reason in `SIZE.md`.
- [x] 2026-11-19 Item 4: README pictures re-encoded as JPEG into `docs/release/screenshots/`
  (1.18 MB for five, against 8.3 MB of PNG); T13's PNGs left untouched.
- [x] 2026-11-19 M4 ladder: 15 rungs built, smoke-tested and photographed (17,146 down to 12,370).
- [x] 2026-11-19 M5 README, LICENSE, SIZE.md, `docs/release/` (product, twin, smallest rung, ladder
  sheets, measurement scripts); tracked files scanned; final check, verify and smoke pass.
- [x] 2026-11-19 Reopened and closed by T15 (plans/T15-playtest-fixes.md), by the orchestrator: the
  release files and the ladder were rebuilt from the fixed sources. Shipped 17,208 bytes (was 17,146),
  ASCII twin 22,333, rung 14 12,396 (was 12,370); all fifteen rungs type-check and print `SMOKE OK`.
  `ladder.mjs` rung r02 carries the corrected drag direction. SIZE.md and README.md updated; the
  ladder's pictures, draw counts and pixel differences, sections M1 to M3 and the Roadroller and
  unpacker measurements were not repeated.

## 9. Surprises and discoveries

- **Locals were the biggest lossless lever left.** glslmin gave every identifier in every shader its
  own name from one global map, so the parameters and locals of every function took names from the
  same long list, many of them two letters. Naming them per function scope saved 314 bytes, more than
  every other step together. Evidence: S03 in `SIZE.md`; `npm run verify` 0 differing pixels.
- **"core" in `npm run size` fell by 1,708 bytes when the blit went DEV-only, but only 74 were
  saved.** With every module stubbed and no blit, no shader is compiled, so `common.glsl` is now
  charged to the layers. The row is an attribution artefact, not a measure of the core's own code.
- **A Playwright wait calls `window.eval`.** A first start-up timing showed the first frame before
  the payload's eval, because a later `eval` call overwrote the time stamp; recording only the first
  call fixed it (`startup.mjs`).
- **The cold first page costs about a second.** The first navigation in a fresh browser took 1.1 to
  1.2 s to the first frame, the warm ones 0.1 s; the tables use warm runs after one discarded load.
- **Six of the fifteen rungs change no pixel** (shell, free flight, moods at mood 0, the second
  station, the touch bar, the plain track): their savings are invisible in pictures by construction.
- **The pictures are dominated by grain.** T13's PNGs are 1.5 to 1.8 MB because film grain defeats
  PNG; JPEG at quality 0.85 keeps the look at about 0.2 MB each (compared by eye on `skyline`).

## 10. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-19 | Ship the quadratic unpacker; keep `utf16l` as a packer option | First frame 466 ms at 6x throttle against 302 ms for linear; both far inside the 1 s budget, and linear costs 100 bytes. A throttled desktop is not a phone: the operator's phone decides |
| 2026-11-19 | Do not adopt Roadroller | 12.6% smaller, but 3.9 to 4.2 s to the first frame at 4x (the plan's bar is about 3 s) and a 153 MB decoder by default. Listed for the operator |
| 2026-11-19 | Keep 34 draw calls | No merge found that also saves bytes; the frame clock held on every rung; rungs from r11 down are at 19 or fewer |
| 2026-11-19 | Fix the context-loss loop (+18 bytes) | Section 12 asks the app to stop; T12 found it did not |
| 2026-11-19 | Roadroller installed only in `.tmp/T14/rr` with `--ignore-scripts`, never in `package.json` | Agents.md forbids adding development packages outside T00; the experiment needed the tool, the project does not |
| 2026-11-19 | Ladder rungs as scratch copies under `.tmp/T14/ladder/`, defined in one script kept as `docs/release/scripts/ladder.mjs` | No feature flags in the shipped sources; every rung reproducible from the script |
| 2026-11-19 | README pictures as JPEG copies under `docs/release/screenshots/`; T13's PNGs untouched | 8.3 MB of pictures for a 17 kB product; `docs/screenshots/` is T13's path |
| 2026-11-19 | The shipped file stays the full build | The plan says so unless the operator picks a lower rung |
| 2026-11-19 | The two demos that prompted the project are credited without names | No record in the repository names them; not guessed |

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**Result against Purpose.** Answered with measurements: the shipped file is **17,146 bytes** with
every feature (from 17,538: -410 of savings and +18 for a robustness fix), and the smallest rung built
that still passes the seven-point checklist, as far as it could be judged here, is **12,370 bytes**
(rung 14). The ladder in `SIZE.md` gives the bytes of every step between them and what a viewer loses
at each. Points 6 and 7 of the checklist were checked only by script; the operator's ears and phone
are the open checks. No contract change was needed: `src/engine.ts` and `tools/` changed inside this
task's serial window with every export signature unchanged.

**Measured bytes.** Budget 0 (this task ships nothing of its own). Squeeze: S03 -314, S05 -22, S06
-74, item 3 +18. Per-module table before and after in `SIZE.md`.

**Acceptance evidence (2026-11-19, this machine).**

- `npm run build`: `dist/synthwave-city.html 17,146 bytes`, change 0 on a rebuild; ascii twin 22,253.
  `docs/release/synthwave-city.html` and `.safe.html` are byte-identical to `dist/` (`cmp`).
- `npm run check`: typecheck ok, tests 112 passed, import rules ok, plans:check ok, `CHECK OK`.
- `npm run verify`: four views, `same` in each, `VERIFY OK`; with `--sabotage` 43,770 to 292,944
  differing pixels per view and `VERIFY FAILED`, so the gate still fails when it should after the
  glslmin change.
- `npm run smoke`: renderer ANGLE NVIDIA RTX 4070 SUPER D3D11, canvas 1920x1080, 638 frames in 5 s,
  p95 8.1 ms, `SMOKE OK`; the same on `docs/release/synthwave-city.html`.
- `node tools/glslmin/browser-test.mjs`: `PASS: 31 programs` (the street shader files do not build on
  their own, as before: their layer concatenates them with `car.glsl`).
- New tests seen failing before passing: the two local-name tests (reuse disabled; shadow guard
  removed) and the `utf16l` round trip (decoder block step sabotaged).
- Ladder: 15 rungs, every one `typecheck ok`, `SMOKE OK`, three shots, AudioContext `running` after a
  click with 60 to 62 sources in 4 s. Rungs 0 and 14 also under phone emulation (412x915, scale
  2.625, touch): audio started on a tap, `SMOKE OK`. Full-size pictures of rung 13 (= rung 14) opened
  and judged point by point in `SIZE.md`.
- Tracked files scanned for user-home paths, host names, addresses and secrets: none found. Absolute
  paths to the sibling project remain as records in `Agents.md` (lines 12, 92) and one line each in
  `plans/T00`, `T01`, `T04`, `T05`, `T06`, `T07`, `T09`, `T13`, and in code at
  `tools/pack/browser-test.mjs:34` (T01's stand-in input). `127.0.0.1` appears in `scripts/dev.mjs`
  (the dev server). Tracked PNGs carry no text chunks.

**Not verified.** Firefox, Safari, any real phone or tablet; start-up on a phone; whether the music
is good; GPU frame time anywhere but this RTX (headless rAF ticks at 8 ms); point 1 on rung 14 with a
frame sequence (inferred from unchanged tour and placement code); window-property collisions of the
flat program in browsers other than Chromium; the marginal cost of sub-features not made into rungs.

**Operator decisions.** Which rung is the answer, and whether to ship a lower one; Roadroller
(-2,168 bytes for 0.9 s desktop and about 4 s throttled start-up); the linear unpacker if the phone
starts slowly (+100 bytes); naming the two demos in the README credits.

**Documentation drift** in `architecture.md` and `Agents.md` (not mine to edit) is listed in the
report to the orchestrator.

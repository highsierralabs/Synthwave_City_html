---
id: T00-foundation
title: Toolchain, contracts, GL helper, engine, harness and gates
status: done
depends_on: []
owns: [package.json, package-lock.json, tsconfig.json, tsconfig.tests.json, vitest.config.mjs, .gitignore, .gitattributes, CLAUDE.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/engine.glsl, src/glsl.d.ts, dev/**, scripts/**, tests/contracts/**, plans/README.md, plans/T00-foundation.md]
reads: [architecture.md, Agents.md, tools/pack/index.mjs, tools/glslmin/index.mjs, src/plan.ts]
budget: 2600
executor: opus/high
updated: 2026-11-19
---

# T00: foundation

## 1. Purpose

After this task a contributor can draw into the city and know what it costs: `shot.mjs` renders any
set of layers at a fixed camera and time, `npm run build` produces the single file and prints its
size, `npm run size` says what each module costs, and `npm run verify` proves the packed file draws
what the sources draw. Nine wave-2 tasks then build against a helper and an engine that are proven on
the GPU, not just compiled.

## 2. Context and orientation

The repository starts with a scaffold written by the orchestrator: `package.json` with the pinned
development packages already installed, `tsconfig.json`, `src/contracts.ts` and `src/common.glsl`
(the frozen contracts, as a first draft that has **never been compiled by a GPU**), stub files for
every module with the export signatures of §10.4, and identity stubs for the two build tools
(`tools/pack/index.mjs`, `tools/glslmin/index.mjs`) whose real versions T01 and T02 are writing at
the same time as you work.

`src/gl.ts` and `src/engine.ts` are stubs with signatures only. You write them. Their exported names
in §10.4 are what the wave-2 plans were written against; you may refine parameter lists where a run
shows the draft is wrong or wasteful, and you must leave each export documented in a comment above it,
because for wave 2 **the files are the reference**.

The parent project has working versions of several scripts you need, written for three.js and Vite:
`C:\highsierralabs\Synthwave_City\scripts\` (`shot.mjs`, `smoke.mjs`, `check-task.mjs`,
`plans-check.mjs`, `lib/browser.mjs`). Read them for the approach (finding the cached Chromium, GPU
flags, image statistics, plan frontmatter parsing) and write new ones for this toolchain. Do not
import from that folder.

## 3. Scope

Owned: the paths in the frontmatter. Read-only: everything else, including the two tool folders; you
call them through the signatures in their stub files.

Not in scope: any layer, post effect, audio, camera or app code beyond what the probe in `dev/` needs.
The probe is a harness tool, not a product feature, and never ships.

## 4. Interfaces

Provides: everything in §10.1 to §10.3, §10.5 and §10.6, and the `gl.ts` and `engine.ts` rows of §10.4.
Consumes: `pack()` from `tools/pack/index.mjs`, `minifyShaders()` from `tools/glslmin/index.mjs`,
`buildPlan` and friends from `src/plan.ts`, each as documented in its file.

Commands you must provide are the ones listed in Agents.md, "Commands". If a flag has to differ from
what is written there, keep the listed spelling working if you can; otherwise record the difference
under Outcomes as a documentation correction for the orchestrator.

## 5. Plan of work

**M1. Prove the risky GL assumptions first.** Write the smallest `gl.ts` and a throw-away page that
shows, in Chromium on the GPU: (a) an instanced draw whose only attributes have divisor 1, with
geometry from `gl_VertexID`; (b) a draw with no attributes at all using `gl_InstanceID`; (c) the
`std140` block `F` fed from the `Float32Array` with every member landing in the slot §10.2 gives it
(render each slot to a colour and read it back in the test page, not in a frame); (d) an `RGBA16F`
colour target with a depth renderbuffer, values above 1 surviving, with linear filtering; (e) every
function in `common.glsl` compiling in both a vertex and a fragment shader. Fix `common.glsl` where
the GPU disagrees with the draft. *Proof:* a script under `scripts/` that prints pass or fail per item
and exits non-zero on any failure; keep it as `npm run probe`.

**M2. Helper and engine.** `gl.ts`: context creation (no antialias, no depth, no alpha), `prog` with
the header, common chunk, block binding, sampler units and one compile check that reports to
`console.error` and `window.__E`; `buf`, `inst`, `tex`, `target`, `state`, `tri`, plus whatever
bind helpers make layer code shortest. `engine.ts`: `boot`, the registries, the clock (double
precision, wrapped at `LOOP`, `dt` clamped), the default beat from `BPM0`, pose to matrices, the
mirror pass and the main pass with their targets, the cell texture on unit 2, the mirror texture on
unit 1, quality and density, the adaptive render scale, mood easing, `frame(seconds)` for frozen
frames, and a plain blit to the canvas when no post is set. *Proof:* M3's probe pictures.

**M3. Harness and screenshots.** `dev/harness.ts` reads its parameters from `location.hash`, imports
only the layers the bundle was built with, and sets `window.__READY` after drawing the requested
frame. `dev/probe/` holds a probe layer: flat-shaded, fogged instanced cubes at the plan's boxes and
a ground grid, enough to show wrap, far fade, the mirror pass and fog. `scripts/shot.mjs` bundles
harness plus named layers into `.tmp/`, opens it from `file://`, and reports as Agents.md describes.
`--app 1` shoots the unminified `src/main.ts` instead of the harness. `scripts/dev.mjs` serves the
same bundle with rebuild on save on a free port. *Proof:* probe shots from a street, from 300 m and
from 1,500 m; a sequence flying 5 km in a straight line showing no pop and no seam at the wrap.

**M4. Build.** `scripts/build.mjs` as §3.4: esbuild bundle with `DEV` defined false, `.glsl` through
`minifyShaders` (all shaders in one call, one name map), terser candidates, `pack`, outputs in
`dist/`, and a printed line with the size, the gate, and the change since the previous
`dist/size.json`. A `--no-rename` flag passes strip-only to the shader minifier. It must work with
the stub tools and with the real ones. *Proof:* `dist/synthwave-city.html` opens from disk and draws.

**M5. Gates.** `scripts/verify.mjs` (the full pipeline applied to the harness entry with every layer,
compared pixel for pixel against the unminified harness at three or more cameras and times; it must
fail when you break a shader rename on purpose), `scripts/smoke.mjs` (the shipped file from
`file://`: no console errors, `window.__E` empty, non-empty frame, frame-time percentile with vsync
on), `scripts/size.mjs` (marginal cost per module by rebuilding with the module replaced by a stub
generated from its export names; fast deflate for the comparison; budgets read from plan
frontmatter), `scripts/check.mjs` (typecheck, tests, the import rules of §4.2, plans-check),
`scripts/check-task.mjs`, `scripts/plans-check.mjs`. Unit tests in `tests/contracts/`: constants in
`contracts.ts` equal those in `common.glsl`; the block in `common.glsl` matches the slot table.

**M6. Hand-over.** Every export in `gl.ts` and `engine.ts` has a comment saying what it does, what it
costs, and one example line. Record measured bytes for the core.

## 6. Validation and acceptance

- `npm run probe` prints pass for (a) to (e) on a renderer string that names the NVIDIA GPU.
- `npm run check` exits 0. `npm run plans:check` exits 0.
- `node scripts/shot.mjs --layers probe --cam 2048,300,2048,0.6,-0.3 --t 5 --out shots/T00/probe.png`
  writes an image in which boxes stand on a street grid, fade with distance into a coloured fog, and
  (quality 2) appear mirrored in the ground. You opened it and wrote down what you saw.
- A 5 km straight flight as a frame sequence shows no pop at the far fade and no seam at the tile
  edge.
- `npm run build` writes `dist/synthwave-city.html`; `npm run smoke` passes on it.
- `npm run verify` passes, and fails when a rename is broken on purpose (show both).
- `npm run size` prints a table with one row per module and a total.

Human checks: none.

## 7. Idempotence and recovery

Every script writes only under `dist/`, `.tmp/` and `shots/`, all git-ignored and safe to delete.
`npm ci` restores `node_modules`. Nothing here touches the parent project.

## 8. Progress

- [x] 2026-11-18 Scaffold by the orchestrator: packages installed, contracts drafted, stubs in place.
- [x] 2026-11-18 Started by the T00 executor (opus/high): read Agents.md, architecture.md, this plan.
- [x] 2026-11-18 M1: `src/gl.ts` written; `dev/gltest/` (probe page and seven test shaders) and
  `scripts/probe.mjs`. First run failed every program on a `common.glsl` bug (below); fixed; all items
  pass, also with every shader through T02's minifier (`--minified`).
- [x] 2026-11-18 M2: `src/engine.ts` and `src/engine.glsl` (the default blit) written.
- [x] 2026-11-18 M3: `dev/harness.ts`, `dev/probe/` (boxes, roof glows, ground, sky), `scripts/shot.mjs`,
  `scripts/dev.mjs`, `scripts/lib/{browser,bundle,png}.mjs`. Probe shots and the 5 km flight taken
  and looked at.
- [x] 2026-11-18 M4: `scripts/build.mjs`; product build reproducible; works with T01's real packer
  and T02's real minifier, which landed during this task.
- [x] 2026-11-18 M5: `verify`, `smoke`, `size`, `check`, `check-task`, `plans-check`,
  `scripts/lib/{plans,imports}.mjs`, `tests/contracts/`. tsconfig split into product and tests.
- [x] 2026-11-18 M6: every export of `gl.ts` and `engine.ts` documented (what, cost, example line);
  core measured.
- Left for later tasks: `npm run smoke` on the product passes only once wave-2 layers draw something
  (today the product frame is black by design; see Outcomes).
- [x] 2026-11-19 T15 (plans/T15-playtest-fixes.md), by the orchestrator: two gates added.
  `npm run input` (`scripts/input.mjs`, page `dev/input/index.ts`) drives the camera's real pointer
  listeners with mouse and touch events and checks the pose. `npm run steady` (`scripts/steady.mjs`)
  renders six consecutive tour frames on Chromium's software rasteriser and fails when the car
  lights blink in step. Neither is part of `npm run check`; both need a browser.

## 9. Surprises and discoveries

- **`place()` in the draft `common.glsl` did not compile:** it read `d.z` from a `vec2`, so every
  program failed (`ERROR: 0:151: 'z' : vector field selection out of range`, probe run 1). Fixed to
  `d.y`.
- **ANGLE warns on dynamic vector indexing** (`p[a] = s` in the draft `cube()`): "Performance: dynamic
  indexing of vectors and matrices is emulated and can be slow", in every program's info log. `cube()`
  rewritten with `equal()` and swizzles; probe (e) now reports no warnings and (f) shows the winding
  is still counter-clockwise.
- **Height fog evaluated at the mean height nearly vanished from altitude**: from 1,500 m the horizon
  had almost no fog (shot `far.png`, first version). Replaced by the exact integral of
  `exp(-h / 350)` along the ray; the horizon now fogs out from 1,500 m.
- **From 1,500 m the far-fade circle of the 4 km tile is visible** as the edge of the city, even with
  the fixed fog (`shots/T00/far.png`). Expected from the tile size; relevant to T11 (how high the tour
  goes) and T13 (fog). Not changed here.
- **The default uniform-block binding is enough:** probe (c) reads `UNIFORM_BLOCK_BINDING` 0 and all 64
  slots right with no `uniformBlockBinding` call, so `prog()` makes none.
- **terser option set C (`booleans_as_integers`) turns `true` into `1`**: the harness's
  `window.__READY = true` became `= 1`, and the scripts' `=== true` wait timed out once set C won.
  Scripts now test truthiness. Product code must never compare a boolean with `=== true`.
- **Headless Chromium ticks requestAnimationFrame every 8.0 ms here** (median and p95 8.0 to 8.1 ms, 632
  and 638 frames in 5 s), not 16.7; whether that is the display's refresh was not established.
- **`tsconfig.json` has `types: []`**, so a test importing `node:fs` failed typecheck. Product stays
  DOM-only; tests get Node types through `tsconfig.tests.json`.
- **My first `--sabotage` hit a shader that was not in the bundle** (`dev/gltest/all.glsl`), so the
  sabotaged verify passed. Sabotage now happens in the loader, on a shader actually bundled.

## 10. Decision log

- 2026-11-18 **One `.glsl` file per program for both stages** (`prog(src, src)`, fragment code under
  `#ifdef FS`), as in `dev/probe/` and `src/engine.glsl`. Varyings are declared once per stage in the
  same file. Fewer files and one text for deflate; separate files still work.
- 2026-11-18 **`inst(buffer, sizes)` takes a buffer** (as §10.4 says), not data: `inst(buf(data), [4, 4])`.
  A layer that rewrites its buffer keeps the handle from `buf(data, 35048)`.
- 2026-11-18 **`tex(w, h, data, float, t)` takes bytes, not a canvas.** One `texImage2D` call: TypeScript
  cannot pick the overload for a union, and a cast is not allowed. A canvas goes in as
  `ctx.getImageData(0, 0, w, h).data`. The stub's comment said "or a canvas"; T08 must use that idiom.
- 2026-11-18 **Added exports beyond §10.4**, all in my files: `gl.ts` `drawInst`, `bindTarget`,
  `bindTex`, `floatTargets`, the `Target` type and the state modes `OPAQUE`, `TWO_SIDED`, `ADD`, `SKY`,
  `FULL`; `engine.ts` `time`, `quality`, `scale`, and `setMood(m, snap)`. `target()` gained `old` for
  resizing in place and returns `[fb, tex, rb, w, h]`.
- 2026-11-18 **State modes are bits** (1 depth test, 2 depth write, 4 additive, 8 cull). Depth func
  LEQUAL and blend ONE, ONE are set once in `glInit`.
- 2026-11-18 **Infinite-far projection, near 0.5 m**: depth reaches 1 only at infinity, so the sky at
  `z = w` is always behind. With a 24-bit depth buffer the resolution at 2 km is about 0.5 m (arithmetic,
  not measured); coplanar faces that far are fogged.
- 2026-11-18 **Mirror pass = uVP times diag(1, -1, 1)** with `frontFace(CW)`; the ground samples `T1` at
  its own `gl_FragCoord`. `uCam.w` = 1 in that pass so `ray()` flips.
- 2026-11-18 **The engine binds unit 0 to null each frame** so no scene program can form a feedback
  loop with the texture post left there.
- 2026-11-18 **Fog density = 2.2 / R1** at each quality; T13 may retune.
- 2026-11-18 **Default beat**: `uTime.w = uMix.x = (1 - fract(beats))^2`, `uMix.yz = 0.5`, written
  before the updates so audio overwrites them.
- 2026-11-18 **Adaptive render scale**: steps down by 0.85 after 0.5 s averaging over 20 ms, back up after
  4 s under 17.5 ms, between 0.5 and 1. Not exercised on a slow device.
- 2026-11-18 **The default blit ships** (about 150 bytes estimated, not isolated: removing it also
  removes `common.glsl` while every layer is a stub, which makes the measurement meaningless). It is a
  T14 cut once T09's post always exists.
- 2026-11-18 **`"use strict"` kept**: esbuild emits it because tsconfig is `strict`; removing it saves
  8 bytes (measured, quick size). Strict semantics are worth more; listed for T14.
- 2026-11-18 **smoke budget is p95 18 ms** of rAF intervals, not 16.6: a frame that keeps up with a
  60 Hz display measures about 16.7 ms, so 16.6 could never pass. Agents.md's own definition of the
  budget (16.6 ms, p95) should be read as "keeps up with 60 Hz".
- 2026-11-18 **verify compares screenshots**, both builds at `DEV=false`, four views across all three
  qualities and moods, and demands identical pixels; it also fails when the reference frame is
  nearly empty.
- 2026-11-18 **Owned paths added: `src/engine.glsl` and `tsconfig.tests.json`** (frontmatter). The tests project gives tests Node types while the product stays DOM-only. The engine's blit needs a shader the
  minifier sees; GLSL inside a TypeScript string would not be renamed with the rest.

## 11. Contract change requests

None filed. T00 owns the contracts; these changes to `src/common.glsl` were made before the freeze,
as M1 requires, and are listed so the orchestrator can check them:

- `place()`: `d.z` -> `d.y` (compile fix).
- `cube()`: same output, rewritten without dynamic indexing; faces in order -x +x -y +y -z +z.
- `fogAmount()`: exact height-fog integral along the ray; same signature.
- Comments only: none else. `src/contracts.ts` unchanged.

## 12. Outcomes and retrospective

**Result against Purpose.** A contributor can draw into the city and know what it costs: `shot.mjs`
renders any set of layers at a fixed camera and time; `npm run build` produces the single file and
prints its size; `npm run size` gives each module's marginal cost against its plan's budget; `npm run
verify` proves the packed harness draws exactly what the sources draw. The helper and engine are
proven on the GPU by `npm run probe` and by the probe layer.

**Measured bytes** (`npm run size`, 2026-11-18): core (contracts, gl, engine, common.glsl,
engine.glsl) **2,678** against a budget of 2,600, deflate only, so 78 over. The product file today is
**3,856 bytes** (container 520 + deflate 3,336; every layer still a stub). What the core buys: context,
programs with error reporting, instancing, targets with in-place resize, five state modes, the clock and
default beat, the camera matrices, mirror and main passes, quality and density, adaptive render scale,
mood easing, the blit. Cuts available: the blit once post exists, `"use strict"` (8 bytes).

**Acceptance evidence** (all run 2026-11-18 on this machine):

- `npm run probe`: renderer `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 SUPER ... Direct3D11 ...)`;
  PASS float targets, (a) quadrants (1,0,0,1) (0,1,0,1) (0,0,1,1) (1,1,0,1), gap 0, gl error 0;
  (b) instance values 1,2,3,4; (c) 64/64 slots, binding 0, 256 bytes; (d) 2, 6, linear 4, after ADD 8,
  complete; (e) linked, no errors, no warnings; (f) +z seen, -z with CW. `PROBE OK`. The same with
  `--minified`.
- `npm run check`: typecheck ok, tests 8 files 94 passed, import rules ok, plans:check ok, `CHECK OK`.
  `npm run plans:check`: 15 plans, `OK`. `npm run check:task -- T00`: `PASS T00-foundation`.
- Gates shown failing: a contract constant changed (`AV_ROAD` 12) fails `tests/contracts` ("expected
  12 to be 13"); an import of `./buildings/index` from `engine.ts` is reported as a section 4.2
  violation. Both reverted.
- `shot.mjs --layers probe --cam 2048,300,2048,0.6,-0.3 --t 5 --out shots/T00/probe.png`: looked at.
  Boxes in pastel palette tints stand in blocks on a grid of magenta curbs, fade into pink sunset
  fog with distance, megatowers on the left, roof glows. Street level (`street.png`): wet road
  mirroring the boxes on both sides and the fog-coloured sky; the crossing street's curb 3 m ahead is
  a thick band at the bottom edge. 1,500 m (`far.png`): the grid runs to a fogged horizon; the city
  sinks smoothly into the ground at the far fade. Top (`top.png`): every road clear, curbs on both
  sides, sky reflection in the avenue crossing. Quality 0, mood 1 (`q0-mood1.png`): sparser boxes
  (3,125 instances against 15,620), midnight-blue fog. Street, quality 0, mood 2: no reflection on
  the road, pink haze.
- 5 km flight, 250 frames of 20 m along -z at 150 m (`shots/T00/flight/`): frame-to-frame difference
  median 2.81, p95 5.42, max 15.03 at step 116, which is a near tower leaving the frame (frames 115,
  116 looked at). The tile edge is crossed at step 105; frames 104 and 106 show the same corridor
  continuing, and those steps are not among the five largest differences. No pop and no seam seen.
- `npm run build`: `dist/synthwave-city.html 3,856 bytes`, `change 0` on a second run (reproducible);
  `--no-rename` gives 5,060.
- `npm run smoke` on the product: boots from file:// through T01's container, 632 frames, no console
  or shader errors, canvas 1920x1080, **fails "the frame is black"** because no layer draws yet.
  `smoke --file` on the packed probe harness (full pipeline): mean 100.3, 638 frames, p95 8.1 ms,
  `SMOKE OK`.
- `npm run verify`: four views (q 2, 2, 1, 0; moods 0, 1, 2, 0), 0 of 518,400 pixels differ in each,
  `VERIFY OK`. With `--sabotage` (fog() renamed wrongly in `dev/probe/box.glsl`): shader compile
  errors and 180,346 differing pixels at the top view, `VERIFY FAILED`.
- `npm run size`: a table of 12 rows and a total (above).

**Not verified.** Firefox, Safari, any phone; the adaptive render scale on a slow GPU; frame time at
2560x1440 on the real city; whether headless rAF at 8 ms matches the display; context loss (T12); the
dev server's live reload in a browser (it built, served and watched; no page was reloaded by it);
`shot --app 1` beyond producing a black frame of the stub app.

**Documentation corrections for the orchestrator** (Agents.md and architecture.md are not mine):
see the report.

### Orchestrator changes after hand-over (2026-11-18)

- `src/engine.ts`: fog density `2.2 / R1` to `1.2 / R1`; `src/common.glsl`: the warm and cool fog
  colours dimmed by about a third. Reason: the probe frame was a pink wash at 220 m, while the parent
  project's pictures have a thin haze and dark silhouettes (§6.3). Starting values for wave 2; T13
  owns the final numbers. `npm run check` and `npm run verify` pass after the change.
- Documentation corrections reported by T00 to T03 applied to `architecture.md` and `Agents.md`.

---
id: T00-foundation
title: Toolchain, contracts, GL helper, engine, harness and gates
status: ready
depends_on: []
owns: [package.json, package-lock.json, tsconfig.json, vitest.config.mjs, .gitignore, .gitattributes, CLAUDE.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/glsl.d.ts, dev/**, scripts/**, tests/contracts/**, plans/README.md, plans/T00-foundation.md]
reads: [architecture.md, Agents.md, tools/pack/index.mjs, tools/glslmin/index.mjs, src/plan.ts]
budget: 2600
executor: opus/high
updated: 2026-11-18
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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

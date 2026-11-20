# Agents.md

Synthwave City 64k is one self-contained HTML file: an endless synthwave megacity you fly through,
written in TypeScript and GLSL on raw WebGL2 and Web Audio, with no runtime dependency and no asset
file, packed as small as it will go.

Design lives in [architecture.md](architecture.md) and is not repeated here. This file is how to work
on the project. `§n` means section n of architecture.md. Read §3, §4, §5, §6.2, §10 and your row in §14
before your first change.

**Evidence tags.** `[O]` observed in this project on this machine. `[SC]` observed in the parent
project Synthwave City (`C:\highsierralabs\Synthwave_City`, three.js on WebGL2) on this machine and
carried over; not yet re-run here. `[W]` from a web source listed at the end. `[I]` inferred, not
tested. `[M]` from memory. When you confirm an `[SC]`, `[I]` or `[M]` item here, change its tag to
`[O]`. When one turns out wrong, fix the line. A practice is only "proven" once it carries `[O]`.

## Start here

### Commands

Run from `Synthwave_City_html/`. The Bash tool and PowerShell 5.1 both work for these.

```
npm ci                         # install exactly what the lockfile says
npm run build                  # dist/synthwave-city.html and friends; prints the size and the change
npm run size                   # build, then the marginal cost of every module against its budget
npm run size -- street         # the same for one module
npm run verify                 # the packed build draws the same pixels as the unminified sources
npm run smoke                  # the packed file boots from file://, no errors, frame-time budget
npm run typecheck              # tsc --noEmit on both projects (tsconfig.json: the product; tsconfig.tests.json: tests)
npm run probe                  # the GL assumptions, proven on the GPU: instancing, block F, float targets, common.glsl
npm run input                  # the camera listeners under real mouse and touch events: drag direction, finger flight
npm run steady                 # car lights do not blink in step on the software rasteriser (coarse depth)
npm test                       # vitest run
npm run check                  # typecheck + tests + import boundaries + plans:check, whole repo
npm run check:task -- T05      # the same gates, reported only for the paths that plan owns
npm run plans:check            # every plan parses, and no path is owned by two plans
npm run dev -- --layers backdrop,buildings    # dev harness with rebuild on save; blocks; prints its URL

node scripts/shot.mjs --layers backdrop,buildings --cam 2048,180,2048,0.6,-0.15 --t 12 --out shots/T05/a.png
npx vitest run tests/plan/plan.test.ts -t "deterministic"
```

`shot.mjs` is self-contained: it bundles the harness with the layers you name into `.tmp/`, opens it
from disk in Chromium on the GPU, prints the WebGL renderer string, console errors, shader logs and
image statistics, and writes a PNG. It needs no server, so any number of agents can run it at once.
Run it with no arguments for every flag: `--layers` (comma list or `all`; `probe` is T00's example
layer), `--cam x,y,z,yaw,pitch`, `--view street|high|far|top|edge`, `--t seconds` (freezes time),
`--q 0|1|2`, `--mood n`, `--post 0`, `--size WxH`, `--frames N --dt s --move dx,dy,dz` for a sequence,
`--tour 1` to let `src/camera` drive, `--app 1` to shoot the unminified `src/main.ts` instead of the
harness. `verify` takes `--sabotage` (it must then fail) and `--no-rename`; `smoke` takes `--file`,
`--no-build`, `--budget` and `--size`.

### Source of truth, highest first

1. The operator's instruction in the current session.
2. `architecture.md` for design; `src/contracts.ts`, `src/common.glsl` and the export signatures of
   §10.4 for interfaces. If they disagree, stop and report it; do not pick one.
3. What the browser actually does, shown by a run on this machine. It beats this file, blog posts and
   memory.
4. This file, for how to work.
5. Your plan, for scope and steps inside the paths you own.

### Never

- Edit a path your task does not own (§14). That includes `src/contracts.ts`, `src/common.glsl`,
  `src/gl.ts` and `src/engine.ts` unless you are T00.
- Change the exported names or signatures of your module (§10.4). Other tasks compile against them.
- Write code for a task whose plan does not exist yet.
- Add a runtime dependency. There are none, and there will be none.
- Install, remove or upgrade a development package outside T00.
- Run `npx playwright install` or `npm audit fix --force` [SC].
- Add an asset file (image, model, font, sound), or make the shipped file fetch anything.
- Ship debugging code. Wrap it in `if (DEV)`; the build removes it.
- Push, add a remote, or change git history.

### Windows

- PowerShell 5.1 has no `&&`: write `A; if ($?) { B }`.
- In the Bash tool use forward slashes; backslashes in `C:\...` get mangled [SC].
- A command line has a length limit: a heredoc of a few hundred lines fails with `ENAMETOOLONG` [O].
  Write long files with the file tools.
- The session scratchpad folder is shared by every agent in a session, and siblings have overwritten
  each other's files there [SC]. Keep scratch work in `.tmp/T##/` and `shots/T##/` inside the
  repository; both are git-ignored.
- Paths resolve case-insensitively on this disk, so a wrong-case import passes here and fails on Linux
  [SC]. Match case exactly.
- `core.autocrlf=true` is set machine-wide. `.gitattributes` pins LF and marks `*.html` binary. Leave
  it: the packed file is UTF-16 and any line-ending rewrite destroys it.

### Loading this file

Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md` in the working folder or
above it, and `C:\highsierralabs\CLAUDE.md` exists [SC]. So a `CLAUDE.md` beside this file contains
`@Agents.md`. Do not add a second copy under another casing; both names are the same file here.

## Writing for the packer

The only size that counts is the final file. `npm run build` prints it with the change since the last
build. **Measure every size idea; keep it only if the file got smaller.** Intuition about minified
size is often wrong after deflate.

**Structure beats golf.** terser already does the syntax tricks (`!0`, comma chains, `.5`, dropped
braces). Hand-golfed source is harder to read and rarely smaller. What terser cannot do is change the
shape of the program, so that is where to spend the effort:

- **Module scope, not objects.** State is module-level `let` and typed arrays; behaviour is top-level
  functions. The bundler puts every module in one scope and terser renames every top-level name to one
  or two characters. Names you choose are free; be descriptive.
- **Property names are not renamed.** Every `.foo` you invent ships as `foo`, every time it appears.
  So: no classes, no `this`, no option bags, no records. A record becomes parallel typed arrays or a
  stride into one array, with exported `const` numbers for the offsets.
- **Platform names are not renamed either.** `createBiquadFilter`, `bindFramebuffer` and
  `addEventListener` ship in full. Deflate makes the second use cheap, so use few *distinct* API
  methods and reuse them, rather than avoiding repetition.
- **Constants are exported `const` numbers,** which the minifier inlines. Never an object or an array
  of constants, and never a TypeScript `enum`, which emits a run-time object. Namespaces, parameter
  properties and decorators emit code too.
- **Same idea, same text.** Deflate rewards exact repetition and punishes near-misses. Write the same
  operation the same way everywhere: same helper, same argument order, same spelling of the same
  number. Prefer calling a helper in `gl.ts` or `common.glsl` to a private variant that is slightly
  better.
- **Generate, do not tabulate.** A seed and a hash instead of a table. Where a table is the honest
  answer (a chord progression, a pattern), pack it in a string and read it with `charCodeAt`.
- **One string for markup.** A single `innerHTML` assignment and a single `<style>` text, not a chain
  of `createElement` calls.
- **No defensive code** beyond what §12 lists. No argument checks, no fallbacks for browsers outside
  §1.4, no messages other than the ones §12 names.
- **Types are free.** Annotate everything; cast nothing. `import type` for type-only imports.
- **Never compare a boolean with `=== true` or `=== false`,** and never rely on `typeof x ===
  'boolean'`. The winning terser set turns `true` into `1` [O: T00].
- **`DEV`** is a build-time boolean. `if (DEV) { ... }` vanishes from the shipped file. Use it for
  logs, assertions and harness hooks.
- Target is ES2022 with no down-levelling, so nothing needs a helper. Use what the language has.

**In GLSL,** the minifier renames every identifier declared in project shaders, strips comments and
space, and shortens numbers. Everything global (functions, globals, block members, varyings) shares
one map across all shaders; locals and parameters are named per function, so every function reuses
the same few short names [O: T14, 314 bytes]. So:

- Write clear names and comments; they cost nothing.
- Reserved names it will not touch: `F`, `T0`–`T7`, `X0`–`X3`, `FS`, `main` (§10.6). Use them only for
  what §10.6 says.
- Anything that looks like a declaration is renamed [O: T02]. Not renamed: names after a `.`, struct
  field declarations, interface block names, and members of a block that has an instance name. Do
  not rely on a name's spelling: no token pasting, no name built inside a macro.
- **A uniform or sampler JavaScript looks up must have a reserved name.** Any other name is renamed
  and `getUniformLocation` will not find it in the packed build.
- Do not hide a type behind a macro (`#define V vec3`, then `V p;`): the declaration is not seen and
  not renamed. Do not give your own things the names of built-ins; such names are never renamed.
- Top-level functions and `const` globals that no shader refers to are dropped from the packed
  build, so an unused helper in `common.glsl` costs nothing. That only works because every shader
  goes through one minify call: all GLSL lives in `.glsl` files, never in TypeScript strings.
  Every `.glsl` under `src/` goes into that call even when nothing imports it, so delete a shader
  you stop using: a stale file keeps the helpers it calls alive in the shipped build [O: T14].
- A helper used by two shaders belongs in `common.glsl`; ask for it with a contract change request.
  Two private copies cost twice.
- A literal used once is cheaper than a named `const`. A value used in many shaders belongs in
  `common.glsl` or the uniform block.

## TypeScript 6

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and
  `isolatedModules` are on. `moduleResolution` is `bundler` [SC].
- **esbuild strips types without checking them** [M]. A page that runs proves nothing about types; run
  `npm run typecheck`.
- `noUncheckedIndexedAccess` applies to typed arrays: `a[i]` is `number | undefined`. Write `a[i]!`,
  which is erased. Do not write `?? 0`, which ships a branch and hides out-of-range bugs [SC].
- Imports name the file with its extension as the stubs do (`'../contracts'` style is set by T00 in
  `tsconfig.json`; copy what the stub in your folder uses).
- `.glsl` files import as strings. The idiom is **one file per program, serving both stages**:
  `import car from './car.glsl'` and `prog(car, car)`, with the fragment code inside `#ifdef FS` and
  the vertex code in its `#else` (`dev/probe/` is the example). `src/glsl.d.ts` declares them.
- Destructuring a `number[]` gives `number | undefined` under `noUncheckedIndexedAccess`. Declare a
  tuple type instead of casting [O: T03].
- Never route round a contract with `any` or a cast. File a contract change request (see Plan files).

## Raw WebGL2

`src/gl.ts` wraps the calls below. Layers use the helper, never `gl.createShader` and friends directly;
one way of doing a thing is smaller than two.

**Programs**

- Every shader is `header + common.glsl + your text`. The header is `#version 300 es`, the precision
  lines and, for fragment shaders, `#define FS`. Do not write your own `#version` or `precision`.
- Block `F` needs no binding call: every uniform block starts at binding point 0, where the engine
  keeps `F` [O: probe]. The helper sets samplers `T1`–`T7` to units 1–7 at link time; `T0` is unit 0
  by default. A program never looks up a uniform by name at draw time.
- Compile everything in `init`, before the first frame. Compile and link status are checked once,
  there; a failure goes to `console.error` and `window.__E` and the layer draws nothing.
- Never call `gl.getError`, `readPixels` or `finish` in a frame; each one stalls the pipeline [M].

**Geometry and instancing**

- A cube and a quad come from `gl_VertexID` through `cube()` and `quad()` in `common.glsl`. No vertex
  buffer holds positions.
- One vertex array per kind of thing, holding only per-instance attributes with divisor 1, at
  `layout(location = n)`. One instanced draw call for all of them.
- Drawing with every enabled attribute instanced and none per vertex works, and so does a draw with
  no attributes at all, from `gl_VertexID` and `gl_InstanceID` [O: probe].
- Fill instance buffers once in `init` with `STATIC_DRAW`. Shuffle them, and draw
  `count * density` instances, so a lower quality draws an even sample (§11.1).
- Per-frame CPU animation is the exception. If you need it, update one small buffer with
  `bufferSubData`, with no allocation.

**Targets and state**

- The canvas has no depth buffer and no antialiasing; the scene is drawn into the engine's own
  half-float target. Layers never bind a framebuffer; `post` does, through `target()`.
- Rendering to `RGBA16F` needs `EXT_color_buffer_float` or `EXT_color_buffer_half_float`
  [W: mdn-cbf]. The helper asks for both and falls back to `RGBA8`. Linear filtering of half-float
  textures works without an extension [O: probe]. `tex()` takes bytes, not a canvas: pass
  `ctx.getImageData(0, 0, w, h).data`.
- GL enums are written as numbers with the name in a comment (`gl.depthFunc(515); // LEQUAL`): a
  `gl.FOO` property ships its name, a number does not. Follow `src/gl.ts`.
- Set blend and depth state through `state(mode)` at the top of every `draw`. Never assume what the
  previous layer left.
- The mirror pass flips winding; the engine sets `frontFace`. Do not touch it.
- The final pass must write alpha 1; `alpha: false` on the context does not make the canvas opaque
  [SC].
- On `webglcontextlost` everything is gone. The app shows a notice and reloads on restore (§12); no
  module rebuilds resources.

**Hot paths**

In a `draw` or an update: no `new`, no closures, no array literals, no spread, `.map`, `.slice()`,
`.subarray()` or template strings. Keep scratch arrays at module scope.

## GLSL ES 3.00

- **Place everything with `place(anchor, local)`** and multiply by `uVP` (§5.1). Never write your own
  wrap, and never apply the wrap per vertex.
- **Move along lanes with `fract(laps * uTime.y + phase)`, `laps` an integer** (§5.3). Use `uTime.x`
  only for cosmetic flicker.
- **Write light on the shared scale** (§6.2). Unlit surfaces stay under 0.15, large lit areas under
  1.0, neon 1.5 to 4, small cores up to 10. Run every opaque colour through `fog()` before output.
  **Additive colour is scaled by `1.0 - fogAmount(p)` instead:** `fog()` would add the fog colour a
  second time [O: T00].
- **Filter anything periodic.** Take `fwidth` of the coordinate before `fract`, and fade a pattern to
  its average once a cell is smaller than about two pixels. Use the filtered-line helpers in
  `common.glsl` for thin lines; a raw `step` shimmers at distance [SC]. There is no MSAA here, so this
  is the only antialiasing the city gets.
- `road(c).x` jumps by `CELL` in the middle of each block. `fwidth` is meaningless across that jump,
  so mask `line()` there, as `dev/probe/ground.glsl` does [O: T00].
- Take derivatives before any branch that depends on per-pixel data, and do not `return` or `discard`
  under a non-uniform condition above derivative-dependent code. On D3D11 that drew outlines around
  cells [SC].
- **Per-instance values go to the fragment shader as `flat` varyings.** An interpolated constant is not
  bit-exact across a triangle, and the hashes turn that into speckle on every facade [SC].
- **Hashes:** use the integer ones in `common.glsl`, and feed them exact values: `floor`ed cell
  indices and integer seeds. `fract(sin(x) * 43758.5453)` differs between GPUs [M].
- **Clamp before `pow`, `sqrt`, `exp`, `log` or a division.** One NaN is smeared by bloom into a black
  block over half the frame, and `--post 0` hides it, so test with post on [SC].
- Avoid undefined built-ins: `smoothstep` with `edge0 >= edge1`, `clamp` with min above max, `pow`
  with a negative base, `%` on negative ints [M]. Write `1.0 - smoothstep(a, b, x)` with `a < b`.
- `patch` is a reserved word in this GLSL compiler [SC]. So are `sample`, `filter`, `input`, `output`,
  `common`, `active` and `partition` in ESSL 3.00 [M]. The minifier removes the risk in the packed
  build but not in the dev build, where they still fail.
- Everything is `highp`. ESSL 3.00 requires `highp` support in fragment shaders [M], and this desktop
  cannot show a `mediump` bug anyway [SC].
- Fragment-only code (anything using `fwidth`, `dFdx`, `gl_FragCoord`, `discard`) goes inside
  `#ifdef FS`. Vertex-only code (`gl_VertexID`, `gl_InstanceID`) goes outside it or in `#ifndef FS`.
- **Do not depth-test against a polygon that runs from the camera to the horizon.** The ground is one
  quad 80 km wide; its interpolated depth is exact enough on this GPU and wrong on Chromium's
  software rasteriser, where it cut every car light to a sliver in alternate frames [O: T15]. The
  ground writes a constant `gl_FragDepth` behind the whole city instead, so nothing may be modelled
  below y = 0: there is no longer anything to hide it.
- **One GPU cannot rule out a precision defect.** Before calling a flicker unreproducible, render
  the same frames with `shot.mjs --mode software`, and judge by counts or full-size crops: a contact
  sheet scaled down for viewing shows flicker that is not there [O: T15].
- Additive ribbons face the camera and are drawn with culling off (`state` has a mode for it); with
  culling on, about half vanish [SC].
- ANGLE's performance warnings appear in the shader info log, and WebGL `INVALID_OPERATION`
  messages go to `console.warn` [O: T00]. `shot.mjs` prints both. Dynamic indexing of a vector
  (`p[i]` with a variable `i`) draws one such warning in every program; use swizzles.

## Web Audio

- Create or resume the `AudioContext` inside a gesture handler (`pointerup`, `click`, `keydown`). One
  made earlier starts `suspended` [SC].
- Schedule with a lookahead timer: a `setInterval` of about 25 ms that schedules everything due in the
  next 100 ms with `start(t)` and `setValueAtTime`. Never schedule from `requestAnimationFrame` [SC].
- Source nodes are one-shot; a second `start()` throws. Make a new source per note, reuse the
  `AudioBuffer`, and cap polyphony [SC].
- Use `AudioParam` methods for anything timed, not `.value` [SC].
- On hidden: suspend, stop the timer, and reset the next-note time on return so no burst plays [SC].
- Keep the master bus under a `DynamicsCompressorNode` and start quiet. Nothing may be louder than
  -6 dBFS peak [I].
- A phone speaker has no bass. Give the kick and the bass line harmonics above 150 Hz, or the track
  disappears there [M].

## Canvas 2D glyph atlas

- Draw once in `init`, upload once, never redraw.
- Generic font stacks only (`sans-serif`, `monospace`); capitals and digits only. Do not depend on a
  glyph being present; lean on shapes [SC].
- Invented words only. No real brands, logos, people or song titles.

## Build tools (Node 24, `.mjs`)

- Standard library first. A new development dependency goes through T00.
- Tools are pure functions with a thin command line on top, so Vitest can call them directly.
- Deflate output must be **raw** (`deflateRawSync`, or zopfli with the raw format).
  `DecompressionStream('deflate-raw')` rejects a zlib header, and rejects trailing bytes after the
  final block, zero bytes included, so padding goes in front of the stream [O: T01].
- A build must be reproducible: the same sources give the same bytes. No timestamps, no random names.

## Vitest 5

- Pure logic only, in the `node` environment. No jsdom; anything needing a DOM or WebGL is checked in
  the browser with `shot.mjs`, `verify` or `smoke`.
- A module that imports `.glsl` cannot be imported in a unit test. Keep testable logic in files that
  do not.
- `tsconfig.json` has no Node types, so the product cannot use a Node global by accident. Tests are
  checked by `tsconfig.tests.json`, which has them.
- `plan.ts` must be deterministic: same seed, same bytes. Test that, and test invariants (no box inside
  a road corridor) rather than golden numbers the art pass will move [SC].
- Use `vitest run`; bare `vitest` can sit in watch mode [SC].
- A gate that cannot fail is not evidence. Show a new test failing once before it passes.

## Playwright 1.64

- Used as a library from `scripts/*.mjs`, not through its test runner.
- The cached Chromium is revision 1234 (version 151), older than this Playwright expects, so the
  scripts pass an explicit `executablePath` found by `scripts/lib/browser.mjs` [SC, O].
- Pages are opened from `file://`, as a user would open the product. That works [O].
- Headless Chromium here ticks `requestAnimationFrame` every 8.0 ms [O: T00]. `smoke` holds the 95th
  percentile of frame intervals under 18 ms by default.
- GPU flags: `--ignore-gpu-blocklist --use-angle=d3d11`. `--disable-gpu` gives SwiftShader, not "no
  WebGL"; `--disable-3d-apis` gives no WebGL [SC]. The scripts print the renderer string; check it
  says NVIDIA and not SwiftShader before believing a frame time.
- `recordVideo` does not run here [SC]. For motion, take a frame sequence with `--frames`.
- **Never judge smoothness with vsync off,** and measure only when the machine is idle: other agents'
  runs inflate frame times severalfold [SC].
- Keep review screenshots at or under 1920 px wide so they are viewed unscaled [SC].

## Plan files

Plans follow OpenAI's ExecPlans [W: execplans], with ownership fields added so tasks can run in
parallel [W: speckit], and agree with Anthropic's notes on long-running agents [W: harness]. These are
practitioner guidance, carried over from the parent project, where fifteen plans were run this way
[SC]. They are not measured results.

### When a plan is required

- Every task in §14 has a plan, written before that task's first line of code.
- After that: any change that spans several files, has more than one reasonable approach, or touches a
  contract, ownership or a gate gets a plan (a new one, or a revision of the owning one).
- Skip it only for a small fix inside one module you own that an existing check proves. Note the fix
  under Progress in that module's plan.

### Where plans live

- `plans/T##-slug.md`, with the ids from §14. `plans/README.md` is the index.
- In the repository, not in a tool's private store such as `~/.claude/plans/`: other agents and later
  sessions must be able to read them.
- Plans are never moved, renamed or deleted. A finished plan stays as the record.

### What a plan contains

A plan must be **self-contained**: an agent with only the plan, this file, `architecture.md` and the
contracts can do the task without asking anyone. It is also a **living document**, kept current as
work proceeds. Frontmatter carries ownership; prose carries reasoning; checkboxes appear only in
Progress.

```yaml
---
id: T05-buildings
title: Neon towers
status: ready        # draft | ready | in-progress | blocked | done | abandoned
depends_on: [T00, T03]
owns: [src/buildings/**, plans/T05-buildings.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2800         # marginal packed bytes, measured by `npm run size`
executor: opus/medium
updated: 2026-11-18
---
```

Then these headings, in this order:

1. **Purpose.** What a viewer will see or be able to do that they could not before.
2. **Context and orientation.** The paths, terms and assumptions a newcomer needs.
3. **Scope.** Owned paths, what is read-only, explicit non-goals, and what is optional and goes first
   if the budget is short.
4. **Interfaces.** What the task consumes and provides, cited by path. Do not copy contract text into
   a plan; copies drift.
5. **Plan of work.** Milestones. Each one has a goal, the work, and a proof, and each is verifiable on
   its own. Put the riskiest or most uncertain part first, as a prototype if need be.
6. **Validation and acceptance.** Commands and what they must print, and what must be visible in which
   screenshot. Behaviour a person can check, not internal attributes. End with any **human checks**:
   things only eyes, ears or a real device can judge.
7. **Idempotence and recovery.** What is safe to re-run, and how to get back to a clean state.
8. **Progress.** Dated checkboxes. Every stopping point is recorded: what is done, what is left.
9. **Surprises and discoveries.** Unexpected behaviour, each with short evidence.
10. **Decision log.** Decision, reason, date.
11. **Contract change requests.** What is needed, why, the exact additive diff, and its state.
12. **Outcomes and retrospective.** Result against Purpose, measured bytes against budget, gaps, and
    what was not verified.

### Status

| Status | Meaning |
|---|---|
| `draft` | Being written. No code yet. |
| `ready` | Checked against `architecture.md` and the contracts by the orchestrator. May be executed. The operator may veto or amend any plan at any time. |
| `in-progress` | Being executed. A `done` plan returns here if a defect is found in its paths. |
| `blocked` | Waiting on a contract change, a dependency or a decision; the reason is in Progress. |
| `done` | Acceptance has run, evidence is in the plan, Outcomes is written. |
| `abandoned` | Stopped on purpose, with the reason in Outcomes. |

Status lives only in the plan's frontmatter. Bump `updated` with every change.

### Keeping a plan alive

- Update Progress at every stop, so a fresh agent can resume from the plan alone.
- Log surprises and decisions when they happen, not at the end.
- If the plan and the disk disagree about what exists, the disk wins and the plan is corrected.
- Once a plan is `ready`, run it through without waiting for approval of each step. Stop only for a
  contract change or a decision that belongs to the operator.

### Deviations

- **Small course change:** amend the plan and add a Decision log entry.
- **Contract change needed:** do not widen a type or edit a frozen file locally. File the request in
  section 11, work around it inside your own paths if you can, set `blocked` only if you cannot, and
  say so in your report. The orchestrator applies granted changes between waves.
- **Defect in another task's paths:** do not edit it. Record it in your plan with evidence and report
  it; the owner reopens their plan.
- **Over budget:** not a failure. Record the measured bytes and what they bought; list what could be
  cut and what each cut would save.
- **Acceptance:** never loosen a threshold to get a pass without a Decision log entry saying why.

### Parallel tasks

1. **Disjoint `owns` globs.** `npm run plans:check` fails if two plans own the same path. Run it before
   starting executors.
2. **Shared files have one owner.** T00 owns `package.json`, the lockfile, configs, contracts, the
   helper, the engine and the scripts. Everyone else asks.
3. **Contracts freeze before parallel work starts.**
4. **One executor per plan,** and only the executor writes to that plan.
5. **No shared server.** `shot.mjs` bundles only the layers you name, so a sibling's half-written file
   cannot break your picture. If a whole-app command (`build`, `size`, `verify`) fails in a file you
   do not own, wait a minute and retry; do not fix it.
6. **Scratch goes in `shots/T##/` and `.tmp/T##/`,** which are git-ignored.
7. **Use `npm run check:task -- T##` while siblings are running.** The whole-repo `npm run check` is
   for the orchestrator once the batch has landed.
8. **Parallel executors do not commit.** The orchestrator commits each task's owned paths when the task
   reports done, so the git index is never contended.
9. **Executors run on Opus or Sonnet at the effort the plan's `executor` field names,** never on the
   session model (operator direction, 2026-11-18).

### On completion

1. Run the acceptance list and paste the short evidence into the plan.
2. Write Outcomes, including measured bytes and what was not verified.
3. Set `status: done` and bump `updated`.
4. Do not extend scope quietly. Follow-ups go in a new plan or a change request.

## Definition of done

A task is done only when all of these are true, each from a run you made yourself in this session:

1. The plan's acceptance list passes, with evidence in the plan.
2. `npm run check:task -- T##` exits 0.
3. **For anything visual, you looked.** Take screenshots with `shot.mjs`, open the images, and write
   down what you saw: at least one near view, one far view, and one from above. A still cannot show
   shimmer, so anything periodic also needs a short sequence with the camera or time stepping.
4. The shot output shows no console errors and no shader warnings you have not explained.
5. **You measured.** `npm run size -- <module>` is in the plan, against the budget.
6. Your report lists what ran, what the result was, and what was not verified.

Never claim a check you did not run. A check proves only what it tested: `tsc` proves types, a
screenshot on the RTX says nothing about a phone, and "it renders" is not "it looks good".

## Git

- Branch `main`. The remote `origin` is the private `highsierralabs/Synthwave_City_html` (created by
  the operator, 2026-11-19). Push only when the operator asks; making it public is the operator's
  decision. `.github/workflows/pages.yml` deploys `docs/release/` to Pages on every push to `main`
  once the repository is public, so check a commit for home paths, host names and secrets before it
  goes up.
- Commit small and often with a plain message saying what changed; one commit per finished milestone
  or task is the norm. During a parallel wave only the orchestrator commits.
- Commits use the repo-local identity already configured. No AI attribution or co-author trailers.
- Not tracked: `node_modules/`, `dist/`, `shots/`, `.tmp/`, `test-results/`. The product itself is
  tracked as a copy in `docs/release/`.
- Never rewrite history or delete a branch.

## Sources

[execplans]: https://developers.openai.com/cookbook/articles/codex_exec_plans
[speckit]: https://github.com/github/spec-kit/blob/main/spec-driven.md
[harness]: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
[mdn-cbf]: https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float

The first three were fetched and read for the parent project on 2026-11-14 and are cited through its
notes; they were not re-read here. The fourth was fetched and read on 2026-11-18.

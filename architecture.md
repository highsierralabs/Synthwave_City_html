# Synthwave City 64k: architecture

Synthwave City 64k is the [Synthwave City](https://github.com/highsierralabs/Synthwave_City) experience
rebuilt the way a demoscene 64k intro is built: **one self-contained HTML file**, as small as it can be
made, that a person opens on a PC or a phone and flies through an endless neon megacity with flying
traffic, busy streets and a synthesized soundtrack. No server, no install, no asset files, no library.

The question this project exists to answer is: **what is the smallest file that keeps the Synthwave
City experience?** The answer is measured, not guessed (§3.5). It is a new implementation, not a port:
the parent project is the reference for how the city should feel, and no three.js code survives.

This file is the design. How to work on the project is in [Agents.md](Agents.md). `§n` means section n
of this file. Numbers given here are starting values; the art pass and the squeeze may retune numbers,
never structure (§14).

**Evidence tags**, used here and in Agents.md: `[O]` observed in this project on this machine;
`[SC]` observed in the parent project Synthwave City on this machine and carried over, not yet re-run
here; `[W]` from a web source; `[I]` inferred, not tested; `[M]` from memory.

## 1. Overview

### 1.1 What the viewer gets

The same city, by the same means: emission, fog and bloom.

- **Endless travel.** A drone tour that never stops and never reaches an edge, or free flight.
- **A lit-up city.** Neon towers with window grids, edge trim, sign panels, lit crowns and spires; a
  few megatowers that dwarf the rest.
- **Flying vehicles.** Thousands of craft in stacked sky lanes with engine glow and light trails.
- **Busy streets.** Dense traffic with headlights and tail lights, people on the sidewalks, street
  lamps, wet asphalt that mirrors the neon.
- **A light show.** Searchlights, beacon pillars, floating holographic billboards.
- **A synthwave sky.** Dusk gradient, stars, a striped sun, a wireframe mountain ridge.
- **A soundtrack** synthesized live, two stations, with the neon pulsing on the beat.

### 1.2 Requirements

| Id | Requirement |
|---|---|
| R1 | **One file.** `dist/synthwave-city.html` runs when opened from disk (`file://`), from a phone's file manager, and from any static host, whatever charset header that host sends. It makes no network request. |
| R2 | **Small.** Hard ceiling 65,536 bytes. Build gate at 32,768 bytes. The goal is the smallest file that still passes the experience checklist (§3.5), and every byte is attributed to a feature. |
| R3 | No asset files and no runtime dependencies. Geometry, textures, text and audio are generated at run time. |
| R4 | Endless. No world edge, no loading pauses, no precision decay however far or long you fly. |
| R5 | Deterministic picture: the same build, camera and time give the same frame, so the unpacked and the packed build can be compared pixel for pixel. |
| R6 | Runs on a desktop GPU at the display's refresh rate and on a current phone at a playable rate, by scaling resolution and density, not by shipping a second code path. |
| R7 | WebGL2. A clear message, not a blank page, when WebGL2 is missing or the context is lost. |
| R8 | Keyboard and mouse, and touch. Starts silent; audio begins on the first gesture. |

### 1.3 What changes from the parent build

| Parent (three.js, 980 kB `dist/`) | Here |
|---|---|
| three.js + postprocessing | raw WebGL2 through a helper of about a hundred lines |
| 6.4 km tile, 40 x 40 cells | 4.096 km tile, 32 x 32 cells (§5.1) |
| Plan with lanes, sites and landmarks as data | Plan is boxes and cells; lanes and sites are derived from the grid (§5.5) |
| Canvas-drawn ad atlas, 1,200 lines | A small glyph atlas from `fillText`, composed into panels in the shader |
| Wire holograms, ticker rings, laser fans, hero ships | Cut first if the budget needs it; each is listed in its plan as optional |
| Five radio stations | Two |
| Three moods, menu, settings store, gamepad, viewpoints | Three moods as a few numbers; keys and a small touch bar; no menu, no gamepad |
| MSAA, pmndrs effect chain | Analytic filtering in shaders; a hand-written bloom and grade pass |
| Vitest suite of 341 tests | Unit tests for the pure parts only: plan, tour, packer, shader minifier |

### 1.4 Non-goals

Gameplay, a menu system, saved settings, multiplayer, a day-night cycle, WebGPU, pixel parity with the
parent, and support for browsers without `DecompressionStream` (older than about May 2023 [W: mdn-ds]).

## 2. Tech stack

Language: **TypeScript 6** (strict) for the program, **GLSL ES 3.00** for shaders, plain **ES modules
(`.mjs`) on Node 24** for the build tools. Types cost nothing in the output and are the only thing
that keeps a dozen independently written modules honest.

### 2.1 What ships in the file

| Piece | Choice | Why |
|---|---|---|
| Rendering | **WebGL2**, hand-written | Instancing, `gl_VertexID`, uniform blocks, integer hashes, float targets. Every current browser and phone has it. No library: three.js alone is about 150 kB gzipped [SC], five times the whole budget |
| Shading | **GLSL ES 3.00** | Every surface is procedural and emissive |
| Audio | **Web Audio API** | Native oscillators, filters, delay and a generated reverb impulse. No samples, nothing rendered ahead of time |
| Billboard glyphs | **Canvas 2D** `fillText` into one small texture | Text for a few dozen bytes; the system font is the asset |
| Unpacking | **`DecompressionStream('deflate-raw')`** | The browser's own inflate; the unpacker is about 250 characters |
| Input | Pointer Events, keyboard, Fullscreen API | |

Runtime dependencies: **none**.

### 2.2 What builds the file (development only)

| Tool | Version | Job |
|---|---|---|
| **TypeScript** | 6.0.3 | Type checking only (`tsc --noEmit`) |
| **esbuild** | 0.28.2 | Strips types, bundles every module into one scope, serves the dev harness |
| **terser** | 5.51.2 | Minifies with top-level mangling; the build tries several option sets and keeps the smallest packed result |
| **glslmin** (in this repo, `tools/glslmin`) | n/a | Strips and renames GLSL across all shaders with one shared name map |
| **pack** (in this repo, `tools/pack`) | n/a | Deflates and writes the self-extracting container (§3.3) |
| **@gfx/zopfli** | 1.0.15 | Better deflate than zlib at the same format. Optional: the packer falls back to Node's zlib |
| **Vitest** | 5.1.0 | Unit tests of pure logic and of the build tools |
| **Playwright** (library) | 1.64.1 | Screenshots, the packed-build smoke run and the pixel comparison, in real Chromium on the GPU |

TypeScript, Vitest and Playwright are pinned to the versions already proven together on this machine
in the parent project [SC]. Node is `>=24.14.1 <25`.

### 2.3 Rejected

| Option | Why not |
|---|---|
| three.js, or any WebGL wrapper | Size (§2.1) |
| Ray-marching the whole city in one fragment shader | Smallest code of all, but a full-screen march at phone resolution cannot hold a playable rate [I], and thousands of independent vehicles are awkward to march. Instanced rasterising is proven for this city [SC] |
| WebGPU, as in the two demos that prompted this | Narrower reach on phones; nothing here needs compute |
| Plain JavaScript without types | Saves a build step that costs no bytes; loses the contract checks between parallel tasks |
| A Latin-1 (`windows-1252`) binary container | 1.6% overhead, the smallest measured, but the file breaks on any host that sends `charset=utf-8` [O], which includes GitHub Pages [M] |
| Base64 payload | Works everywhere, costs 33.5% [O] |
| A context-mixing packer (Roadroller and its kind) | Likely 10 to 15% smaller than deflate [M], but unpacking is seconds of JavaScript on a phone for an input this size [I]. Left as a time-boxed experiment for T14 |
| Aliasing WebGL method names at run time (`gl[k[0]+k[6]]`) | Depends on property enumeration that differs between browsers [M]; deflate already makes repeated names cheap |
| Rendering music to a buffer at start-up (tracker-style players) | A start-up stall and megabytes of samples on a phone; live scheduling starts at once |

## 3. Size strategy

Size is the product requirement, so it has its own section. The measure is always the **final file in
bytes**. Minified size, gzipped size and line counts are not measures; a change that shrinks one of
those can grow the file.

### 3.1 Where the bytes go

An estimate before anything is built [I]; §11.2 has the per-task budgets that add up to it.

```
unpacker and container overhead      ~1.3 kB
runtime core (GL helper, engine)     ~2.6 kB
city, layers, post                  ~15.0 kB     about half of it GLSL
audio                                ~3.4 kB
camera, input, app shell             ~3.8 kB
                                    --------
                                    ~26 kB       gate: 32,768     ceiling: 65,536
```

For scale: the two single-file demos that prompted this are 127,617 and 99,514 bytes, not packed
[O: GitHub API, 2026-11-18].

### 3.2 Levers, largest first

1. **Not shipping a library.** Decided in §2.
2. **Doing less on the CPU.** Geometry comes from `gl_VertexID`, motion from `uTime` in vertex shaders,
   variety from integer hashes of a per-instance seed. The JavaScript mostly fills a few typed arrays
   once.
3. **One world, shared.** The grid, wrap, fog, palette and hashes live once in `src/common.glsl` and
   are used by every shader. Repeated text is nearly free under deflate; *similar but different* text
   is not, so layers follow the same idioms on purpose (Agents.md, "Writing for the packer").
4. **Code that minifies.** No classes, no object bags crossing modules, no long property names of our
   own: modules export functions and typed arrays, which the bundler flattens into one scope and
   terser renames to single letters.
5. **A shared uniform block.** One `std140` block `F`, mirrored by one `Float32Array`. Shared state
   crosses from JavaScript to GLSL by slot number, so no uniform name is ever looked up by string.
6. **Shader minifying with one name map** for all shaders (`tools/glslmin`).
7. **Deflate with zopfli**, then a container with about 3% overhead (§3.3).
8. **Cutting features**, last, in the order their cost per unit of experience says (§3.5).

### 3.3 The container

The file has to carry compressed bytes through the HTML parser, because a page opened from disk cannot
read its own file (`fetch` of a `file:` URL is refused [M]). Three containers were built and loaded in
Chromium 151 from disk, over HTTP, and over HTTP with `Content-Type: text/html; charset=utf-8`, with an
82,832-byte deflate stream [O: spike, 2026-11-18]:

| Container | Overhead | From disk | HTTP | HTTP, `charset=utf-8` |
|---|---|---|---|---|
| `utf16`: UTF-16LE with a byte order mark, payload as 16-bit code units in a string literal | 3.6% (3.1% + 510 bytes) | runs | runs | runs |
| `latin1`: `windows-1252`, payload after `<plaintext>` | 1.6% | runs | runs | **fails** |
| `ascii`: base64 `data:` URL | 33.5% | runs | runs | runs |

**`utf16` is the shipped container.** The byte order mark `FF FE` makes the browser decode the file as
UTF-16LE whatever the server or a `<meta>` says: "the byte-order mark overrides any encoding
declaration in the HTTP header" [W: w3c-bom]. Each pair of payload bytes is one code unit. The 3% of
units the parser or a string literal would damage (NUL, CR, LF, `"`, `\`, `<`, the surrogates
`D800`–`DFFF`, a few others) are written as an escape unit followed by the unit XOR `0x1000`. The
unpacker undoes that, inflates, and evaluates the result:

```
<body><script>s="…";b=new Uint8Array(N);for(i=j=0;j<N;)c=s.charCodeAt(i++),
c==4352&&(c=s.charCodeAt(i++)^4096),b[j++]=c,b[j++]=c>>8;new Response(new Blob([b]).stream()
.pipeThrough(new DecompressionStream("deflate-raw"))).text().then(eval)</script>
```

Not yet shown: Firefox, Safari and a real phone [I]. The packer keeps `ascii` as a second output
(`dist/synthwave-city.safe.html`) for anywhere `utf16` turns out not to work, and T01 tests what this
machine can reach. The page title, viewport `<meta>` and CSS are created by the payload, so they are
compressed too.

A consequence to know: the shipped file is not text. Editors show noise, and it must travel as a file
(download, attachment), not as pasted text.

### 3.4 The build

```
src/**/*.ts, src/**/*.glsl
   |  esbuild: strip types, bundle to one scope; .glsl through glslmin; DEV code removed
   v
one JavaScript text
   |  terser: several option sets
   v
candidates --> pack each (deflate-raw) --> keep the smallest --> zopfli on the winner
   v
dist/synthwave-city.html (utf16)      dist/synthwave-city.safe.html (ascii)
dist/app.js (the winning minified text, for reading)      dist/size.json
```

`npm run dev` and the screenshot tool use the same sources **unminified and unpacked**. The gate that
makes aggressive minifying safe is R5: `npm run verify` renders the same camera and time from the
unminified bundle and from the packed file and requires the same pixels (§13).

### 3.5 Answering "how small"

`npm run size` prints, for the current tree:

- the final file size against the gate;
- **the marginal cost of each module**: the build is repeated with that module replaced by an empty
  stub, and the difference is what that feature costs. These numbers are what a cut would really save,
  which is less than a module's share of the minified text because deflate shares context;
- each plan's `budget` against its measured cost.

T14 turns that into the answer: the ledger in `SIZE.md` lists every feature with its cost, and a
**cut ladder**: the order in which features would go and the file size at each rung, with a
screenshot per rung. The experience checklist that defines "still Synthwave City" is:

1. the tour runs without end and without a visible edge or pop;
2. towers are lit with window grids and neon trim, with a megatower in most views;
3. flying traffic moves in lanes between the towers;
4. streets carry moving traffic with head and tail lights;
5. the sky has the striped sun; the frame has bloom and fog;
6. at least one music track plays and the city pulses with it;
7. it runs from one file on a PC and on a phone.

The smallest rung that still passes all seven is the answer to the question. Rungs above it are what
the remaining bytes buy.

## 4. System design

### 4.1 Modules

```
src/
  contracts.ts    constants, uniform-block slots, the shared state arrays        T00  frozen
  common.glsl     the GLSL every shader starts with                             T00  frozen
  gl.ts           WebGL2 helper: programs, buffers, textures, targets            T00
  engine.ts       boot, frame loop, uniform block, passes, layer registry        T00
  plan.ts         the deterministic city plan and height query (no DOM, no GL)   T03
  backdrop/       sky and the ground plane with its street lamps                 T04
  buildings/      towers                                                        T05
  street/         ground traffic and people                                     T06
  air/            flying vehicles                                               T07
  lights/         searchlights, pillars, holographic billboards                 T08
  post/           bloom and grade                                               T09
  audio/          the two stations and the beat                                 T10
  camera/         tour, free flight, input                                      T11
  main.ts         the app shell: start card, keys, touch bar, messages           T12
dev/              harness entry used by the dev server and the screenshot tool   T00
tools/pack/       container and unpacker                                        T01
tools/glslmin/    shader minifier                                               T02
scripts/          build, dev, shot, verify, smoke, size, check, plans-check      T00
tests/            unit tests, one folder per owner
plans/            one plan file per task
```

### 4.2 Dependency rules

- `contracts.ts` imports nothing. `plan.ts` imports only `contracts.ts` and is pure: no DOM, no GL, no
  `Math.random`, no `Date`.
- `gl.ts` imports `contracts.ts`. `engine.ts` imports `contracts.ts`, `gl.ts` and `plan.ts`.
- A layer (`backdrop`, `buildings`, `street`, `air`, `lights`) and `post` import `contracts.ts`,
  `gl.ts`, `engine.ts` and `plan.ts`, and nothing else. **A layer never imports another layer.**
- `audio` imports `contracts.ts` and `engine.ts`. `camera` adds `plan.ts`.
- `main.ts` is the only module that imports everything.

`npm run check` enforces this by reading the import lines.

### 4.3 How modules talk

There are no objects passed around. Modules share three things:

1. **`F`**, a `Float32Array(64)` in `contracts.ts`: the CPU mirror of the uniform block (§10.2). Time,
   beat, camera, resolution and mood live here, and the engine uploads it before each pass.
2. **`P`**, a `Float32Array(8)` in `contracts.ts`: the camera pose (§10.3). Whoever drives the camera
   writes it; the engine reads it.
3. **Registries in `engine.ts`**: `addLayer(order, draw, reflect)`, `addUpdate(fn)`, `onResize(fn)`,
   `setPost(fn)`.

Every module exports plain functions with the exact signatures of §10.4. Those signatures exist as
stub files from the first commit, so every module compiles, the whole app bundles, and `npm run size`
works from day one; a task replaces its stub.

### 4.4 Frame flow

```
requestAnimationFrame(ts)
  clock: time, dt (clamped), loop phase, default beat      engine
  updates run in registration order                        camera writes P; audio writes the beat
  engine wraps P, builds the matrices, fills F
  mirror pass   (quality 1 and up)  F uploaded with the mirrored camera; layers with reflect = 1
  main pass     F uploaded; every layer in `order`
  post(sceneTexture)                bloom, grade, to the canvas
```

Almost everything that moves is animated in vertex shaders from `uTime`, so per-frame CPU work is a
few dozen array writes and about a dozen draw calls.

### 4.5 Layers

A layer is one visual subsystem in `src/<id>/index.ts`. It exports `init()`, which compiles its
programs, fills its instance buffers from the plan or from hashes, and registers one or more draw
functions:

```ts
addLayer(order: number, draw: (pass: number) => void, reflect?: number): void
```

`draw` binds its program and vertex array, sets its own blend and depth state through the helper, and
issues its draw calls. The engine has already bound the target, the viewport and the uniform block.
`pass` is `0` for the main pass and `1` for the mirror pass.

Order bands: opaque `0`–`49` (ground 10, buildings 20, vehicles 30), sky `50` (at the far plane, after
the opaques, so it fills only what they left), additive `60`–`99` (beams 60, holograms 70, glow
sprites 80).

## 5. World model

### 5.1 One tile, wrapped

The city is a single square **tile**, `TILE = 4096` m on a side, that repeats in x and z. Nothing is
streamed or regenerated. Every shader places its geometry relative to the camera, wrapped:

```glsl
vec2 d = anchor.xz - uCam.xz;        // both in tile coordinates, 0..TILE
d -= TILE * floor(d / TILE + 0.5);   // nearest copy: -TILE/2 .. TILE/2
```

The wrap is applied to an object's **anchor** (a building's centre, a vehicle's position), never per
vertex, so objects stay whole. The camera sits at `(0, y, 0)` in render space and only rotates; its own
x and z are wrapped into `0..TILE` on the CPU. So R4 holds by construction: no GPU coordinate exceeds
a few thousand metres however far the viewer flies, and nothing loads or unloads [SC].

All placement goes through one function in `common.glsl`, `place(anchor, local)`. No layer writes its
own wrap.

The parent tile is 6.4 km. A power of two and a quarter of the instances suit a phone and the byte
budget; the cost is a shorter view, which the fog is tuned to (§15, D-04).

### 5.2 The far fade

Between `R0` and `R1` (1500 m and 1950 m at full quality), `place` scales heights towards zero, so
buildings, vehicles and beams sink into the ground before the wrap distance instead of popping. The
ground is one large plane under the camera whose shader draws the periodic street pattern to the
horizon, so the city reads as continuing forever.

### 5.3 Time

`uTime.x` is seconds in `[0, LOOP)` with `LOOP = 4096` s, and `uTime.y = time / LOOP`. Both are computed
in double precision on the CPU and wrapped there.

- Motion along a lane is loop-periodic: `s = fract(laps * uTime.y + phase) * TILE` with integer `laps`,
  so the wrap at the end of the loop is seamless and speed is a multiple of 1 m/s.
- Cosmetic flicker may use `uTime.x` directly; a one-frame discontinuity every 68 minutes is accepted.
- No shader accumulates time, and no module keeps its own clock.

### 5.4 The street grid

The tile is `32 x 32` cells of `CELL = 128` m. A road runs along every cell boundary in both axes.
Every fourth line is an **avenue**.

| | Street | Avenue |
|---|---|---|
| Corridor half-width (centre line to building line) | 10 m | 18 m |
| Carriageway half-width | 7 m | 13 m |
| Lanes per direction, metres from the centre line | 2, at 2 and 5 | 3, at 3.5, 7 and 10.5 |
| Sidewalk | 3 m | 5 m |

Traffic keeps right. The ground shader, the plan, the traffic and the tour all derive the grid from
these constants (`contracts.ts`, mirrored in `common.glsl`, held equal by a unit test). Road surface is
`y = 0`.

**Air above every road corridor is free of buildings at any height.** That one invariant makes street
traffic, sky lanes and the tour collision-free by construction.

### 5.5 The city plan

`plan.ts` turns a seed into typed arrays:

- **`cells`**: 4 bytes per cell: district (`low`, `mid`, `high`, `plaza`, `mega`), tallest roof in the
  cell in units of 4 m, a seed byte, and one spare. The engine uploads it as a 32 x 32 texture on unit
  2 for the ground and anything else that wants district colour.
- **`boxes`**: every building is one or more axis-aligned boxes (podium, shaft, setbacks, spire),
  8 floats each: centre x, base y, centre z, seed; half-width x, height, half-width z, kind. Boxes of
  one building share a seed. The order is shuffled, so drawing a prefix draws an even sample.
- **`megas`**: x, z and height of the megatowers, for the tour and for beacons.
- **`heightAt(x, z)`**: the tallest roof at a point, wrap-aware; zero over any road corridor.

Lanes and sites are not data. Street lanes follow from §5.4; sky lanes sit above avenues at fixed
altitudes, with x-running and z-running lanes on different levels so crossing traffic never meets;
beacons, searchlights and billboards pick their spots by scanning `boxes` and `megas` in their own
`init`.

Skyline: a low-frequency height field with a few downtown peaks sets each cell's district. Typical
roof heights are 12 to 50 m in `low`, 50 to 160 m in `mid`, 150 to 400 m in `high`, and 500 to 800 m
for the handful of megatowers, which reach about 950 m with spire. Expected sizes [I]: 1,024 cells,
about 2,500 buildings and 5,000 boxes.

## 6. Look

### 6.1 Art direction

Garish on purpose. The darks are deep indigo, never grey or black; everything else is saturated light.
Surfaces carry almost no diffuse light; the picture is made of emission, fog and bloom.

| Index | Name | sRGB | Use |
|---|---|---|---|
| 0 | Hot magenta | `#ff2bd6` | signature trim, curbs |
| 1 | Electric cyan | `#19f0ff` | signature trim, holograms |
| 2 | Ultraviolet | `#9b4dff` | fills, fog accents |
| 3 | Sunset orange | `#ff7a1a` | sun, warm windows |
| 4 | Laser yellow | `#ffe14d` | accents, headlights |
| 5 | Acid green | `#49ff7a` | rare accent |
| 6 | Signal red | `#ff2740` | tail lights, aviation lights |
| 7 | Ice white | `#dff4ff` | cores, stars |

`pal(i)` in `common.glsl` returns these in linear light. Layers pick colours by index so a mood can
re-tint the whole city.

### 6.2 Light levels

The frame is rendered in linear HDR. Bloom keys on luminance, so what glows is decided by how bright a
surface writes, on one shared scale [SC]:

| Band | Linear value | What |
|---|---|---|
| L0 | 0.00 to 0.15 | unlit surfaces: asphalt, walls, hulls |
| L1 | 0.4 to 1.0 | lit windows, screens seen far away; reads as lit, barely blooms |
| L2 | 1.5 to 4 | neon trim, signs, holograms, light trails; blooms |
| L3 | 4 to 10 | small hot cores: headlights, beacons, the sun's disc, strobe peaks |

Large areas stay at or under L1; L3 is for small things. A layer that paints a whole facade at L3
whites out the frame.

### 6.3 Fog and distance

Exponential fog, denser near the ground, tinted by direction: warm towards the sun, violet away from
it. The fog is dimmer than the horizon sky, so distant towers stand as dark silhouettes against the
glow. Every colour goes through `fog()` before it is written; L2 and L3 survive it and are what you
see far away.

### 6.4 Per-layer techniques

- **Sky:** one full-screen triangle at the far plane. Gradient, hashed stars with twinkle, the sun
  (disc with scrolling horizontal cut-outs and a halo), a ridge of wireframe mountains, a haze band.
- **Ground:** one plane. The fragment shader derives streets, lane markings, crossings, glowing curbs
  and plaza grids from tile coordinates and the cell texture, filters every line against its pixel
  footprint, and adds the mirrored city from the mirror pass, roughened by wet asphalt. Street lamps
  are instanced.
- **Buildings:** instanced cubes from `gl_VertexID`; the fragment shader builds the facade in metres:
  window grid with hashed lit pattern, edge trim, bands, storefronts at street level, sign panels,
  beat-driven equaliser facades, lit crowns. Window detail fades to its average when a window is
  smaller than a pixel.
- **Street life:** instanced low-poly cars placed along lanes in the vertex shader, with additive
  sprites for head and tail lights; people are small instanced impostors on the sidewalks.
- **Air traffic:** instanced craft in sky lanes with engine glow, strobes and stretched light trails.
- **Lights:** camera-facing ribbons for searchlights and pillars with shimmer; billboards composed in
  the shader from the glyph atlas, with scanlines, flicker and glitch.

### 6.5 Blending rule

Every translucent effect is **additive**, with depth test on and depth write off. Nothing needs
back-to-front sorting, which the wrapped world could not provide anyway [SC].

### 6.6 Frame pipeline

1. **Mirror pass** (quality 1 and up): layers registered with `reflect` drawn from a camera mirrored in
   the road plane into a half-size target on texture unit 1.
2. **Main pass** into a half-float target with depth (`RGBA16F`; rendering to it needs
   `EXT_color_buffer_float` or `EXT_color_buffer_half_float` [W: mdn-cbf]; without either the engine
   falls back to 8 bits and the brightest values clip).
3. **Bloom**: a five-level down and up chain. **Grade**: a tone curve that keeps neon saturated, a
   little chromatic aberration, vignette, scanlines and grain, gamma, alpha 1.

### 6.7 Moods

`uMood.x` runs from 0 to 3: `0` sunset, `1` midnight, `2` miami, fractions blend. `common.glsl` and the
sky derive their colours from it. `N` steps to the next mood and the engine eases the value.

## 7. Audio

One `AudioContext`, created on the first gesture. A lookahead scheduler plays generated music from
native nodes: four-on-the-floor kick, snare, hats, a sixteenth-note bass arpeggio, side-chained pad
chords and a sparse lead with delay, through a generated reverb impulse and a limiter.

A **station** is a small table: tempo, key, chord progression, pattern seeds and patch numbers. Two
ship. Music never ends: patterns are generated bar by bar from the station's seed.

The beat drives the picture. While audio runs it writes the beat count and pulse and three band levels
into `F`; otherwise the engine supplies the same slots from its clock, so the city pulses either way.

## 8. Camera and input

- **Tour** (default): a drone that follows the road grid, since road corridors are clear at every
  height: cruising an avenue, banking through an intersection, climbing past a megatower, dropping to
  street level. Deterministic from the seed and the clock, endless.
- **Free look on the tour:** drag (finger or mouse) to turn the view while the tour flies on; it eases
  back when released.
- **Free flight:** `W A S D`, `Q`/`E` for down and up, `Shift` to boost, drag to look; on touch, drag
  to look and hold a second finger to fly. The camera is kept out of buildings with `heightAt`.
  `Space` returns to the tour.

The camera writes `P` and nothing else.

## 9. App shell

`main.ts` builds the page from nothing: title, viewport `<meta>`, CSS, the canvas, a start card and a
row of touch buttons. It boots the engine, the plan, the layers, post and camera, and starts drawing
at once; audio starts on the first gesture.

Keys: `M` mute, `R` next station, `N` next mood, `F` fullscreen, `Space` tour or free flight, `1` `2`
`3` quality, `H` hide the interface.

## 10. Frozen contracts

`src/contracts.ts`, `src/common.glsl` and the export signatures in §10.4 are written before parallel
work starts and then frozen. Changing one needs a contract change request (Agents.md). Additive
changes are cheap; anything else needs every consumer checked.

### 10.1 Constants

`TILE`, `CELLS`, `CELL`, `AVE`, the road dimensions of §5.4, `LOOP`, `BPM0` (the tempo when audio is
off), the far-fade radii, the box layout (`BOX = 8` and the kinds), the district ids, the order bands
and the slot numbers below. `common.glsl` repeats the ones shaders need; `tests/contracts` keeps the
two equal.

### 10.2 The uniform block

One `std140` block named `F`, bound at point 0 in every program by the helper. All members are `vec4`
or `mat4`, so slot `n` in the `Float32Array` is member offset `n` floats.

| Slot | Member | Contents |
|---|---|---|
| 0 | `mat4 uVP` | view-projection for this pass; the camera is at x = z = 0 |
| 16 | `vec4 uCam` | x, z: camera position in tile coordinates; y: height; w: pass (0 main, 1 mirror) |
| 20 | `vec4 uTime` | x: seconds in `[0, LOOP)`; y: `x / LOOP`; z: beats since the start, modulo 64; w: beat pulse, 1 on the beat falling to 0 |
| 24 | `vec4 uRes` | x, y: target size in pixels; z: quality 0, 1, 2; w: density 0..1 |
| 28 | `vec4 uFade` | x: `R0`; y: `R1`; z: fog density; w: exposure |
| 32 | `vec4 uRight` | xyz: camera right; w: `tan(fov / 2) * aspect` |
| 36 | `vec4 uUp` | xyz: camera up; w: `tan(fov / 2)` |
| 40 | `vec4 uFwd` | xyz: camera forward; w: spare |
| 44 | `vec4 uSun` | xyz: direction to the sun; w: spare |
| 48 | `vec4 uMix` | x: kick level; y: bass level; z: lead level; w: station |
| 52 | `vec4 uMood` | x: mood 0..3; yzw: spare |
| 56 | `vec4 uX0`, `uX1` | spare |

### 10.3 The pose

`P`: `[0..2]` position x, y, z in metres (x and z may be any value; the engine wraps them), `[3]` yaw,
`[4]` pitch, `[5]` roll, in radians, `[6]` vertical field of view in radians. Yaw 0 looks along `-z`;
positive yaw turns left; positive pitch looks up.

### 10.4 Module exports

| Module | Exports |
|---|---|
| `contracts.ts` | the constants, `F`, `P` |
| `gl.ts` | `gl`; `glInit(canvas)`; `prog(vs, fs)`; `buf(data)`; `inst(buffer, sizes)` making a vertex array of per-instance attributes; `tex(...)`; `target(...)`; `state(mode)` for blend and depth; `tri()`, the full-screen triangle |
| `engine.ts` | `boot(canvas)` returning false without WebGL2; `addLayer`; `addUpdate`; `onResize`; `setPost`; `run()`; `frame(seconds)` for the harness; `setQuality(q)`; `setMood(m)`; `sceneW`, `sceneH` |
| `plan.ts` | `buildPlan(seed)`; `boxes`; `boxCount`; `cells`; `megas`; `megaCount`; `heightAt(x, z)` |
| each layer, `post` | `init()` |
| `audio` | `audioStart()` (call inside a gesture); `audioMute()` toggling and returning the state; `audioStation()` stepping and returning the index; `audioHidden(hidden)` |
| `camera` | `cameraInit(element)`; `cameraMode()` toggling tour and free flight and returning the mode |

The exact TypeScript is in the files; this table is the index.

### 10.5 The GLSL chunk

`common.glsl` declares the block `F` and provides: integer hashes and value noise; `place` (wrap and
far fade); `fog` and `fogColor`; `pal`; `cube` and `quad`, which build a unit cube and a quad from
`gl_VertexID`; `ray`, the view ray of a fragment for full-screen passes; road-grid helpers that mirror
§5.4; filtered-line helpers; and `ribbon`, a camera-facing strip between two points for beams and
trails. The helper prepends `#version 300 es`, precision lines and this chunk to every shader.

### 10.6 Names shared between JavaScript and GLSL

The shader minifier renames every identifier declared in project GLSL. The few names JavaScript must
know are written short already and are **reserved**: the block `F`, samplers `T0`–`T7` (the helper
binds `Tn` to texture unit `n`), and per-program uniforms `X0`–`X3` for the rare program that needs
one. Vertex attributes use `layout(location = n)`. Nothing else crosses by name.

Texture units: `0` pass input (post), `1` mirror, `2` cells, `3` glyph atlas, `4`–`7` free to `post`.

## 11. Quality and budgets

### 11.1 Quality

| Quality | Pixel ratio cap | Mirror pass | Density | Far fade `R0`/`R1` |
|---|---|---|---|---|
| 0 | 1 | off | 0.4 | 900 / 1300 |
| 1 | 1.5 | half size | 0.7 | 1200 / 1650 |
| 2 | 2 | half size | 1 | 1500 / 1950 |

Instance buffers are built once at full density and drawn as a prefix (`count * uRes.w`), so quality
changes live, with no reload. The engine picks 0 on a touch-first device and 2 otherwise, and within a
quality it lowers the render scale when frames run long and raises it when there is headroom.

### 11.2 Byte budgets

Marginal packed bytes per task, as measured by `npm run size` (§3.5). Estimates [I]; the ledger
replaces them with measurements.

| Task | Budget | | Task | Budget |
|---|---|---|---|---|
| T00 core, contracts, `common.glsl` | 2,600 | | T08 lights | 2,600 |
| T01 container overhead | 1,300 | | T09 post | 1,400 |
| T03 plan | 1,100 | | T10 audio | 3,400 |
| T04 backdrop | 2,600 | | T11 camera | 2,200 |
| T05 buildings | 2,800 | | T12 app shell | 1,600 |
| T06 street life | 2,200 | | **Sum** | **26,100** |
| T07 air traffic | 2,300 | | Gate / ceiling | 32,768 / 65,536 |

A task over its budget is not failed; it says so in its plan with what the bytes bought, and T13 and
T14 decide.

### 11.3 Performance budgets

| What | Budget |
|---|---|
| Frame time, quality 2, 2560x1440, reference GPU (RTX 4070 SUPER) | 16.6 ms, 95th percentile, on the tour |
| Draw calls | 30 |
| Per-frame allocation | none |
| Time from open to first frame, desktop | 1 s |

## 12. Robustness

- No WebGL2: a styled message, no canvas.
- Context lost: stop, show a notice, reload on restore.
- Tab hidden: the loop stops, audio suspends, and the clock does not jump on return.
- A shader that fails to compile is reported on the console and in `window.__E`, and its layer draws
  nothing; the rest of the city still renders. The packed build keeps this check.
- `prefers-reduced-motion`: the tour flies slower and without banking.

## 13. Verification

| Kind | Command | Proves |
|---|---|---|
| Types | `npm run typecheck` | types only |
| Unit | `npm test` | plan determinism and invariants; contract parity between TypeScript and GLSL; container round trips; minifier behaviour |
| Boundaries and ownership | `npm run check`, `npm run plans:check` | §4.2; no path owned by two plans |
| Screenshots | `node scripts/shot.mjs` | what a layer or the whole city looks like at a fixed camera and time; the author must open the image and look |
| Pixel identity | `npm run verify` | the packed file draws the same frames as the unminified sources, so the minifiers and the container changed nothing |
| Smoke | `npm run smoke` | the packed file boots from `file://`, reports no errors, draws a non-empty frame and holds a frame-time budget |
| Size | `npm run size` | the gate, and each module's marginal cost |

Tested here: Chromium on Windows with an NVIDIA GPU. The operator has an Android phone and tablet.
Firefox and Safari are not tested by any command in this repository, and nothing claims otherwise.

## 14. Task decomposition

Each task owns its paths exclusively, has one plan in `plans/`, and can be built against the contracts
without reading any other task's code.

| Task | Plan | Owns | Needs |
|---|---|---|---|
| T00 | `T00-foundation` | `package.json`, lockfile, configs, `CLAUDE.md`, `src/contracts.ts`, `src/common.glsl`, `src/gl.ts`, `src/engine.ts`, `src/glsl.d.ts`, `dev/**`, `scripts/**`, `tests/contracts/**`, `plans/README.md` | none |
| T01 | `T01-packer` | `tools/pack/**`, `tests/pack/**` | none |
| T02 | `T02-glslmin` | `tools/glslmin/**`, `tests/glslmin/**` | none |
| T03 | `T03-city-plan` | `src/plan.ts`, `tests/plan/**` | contracts |
| T04 | `T04-backdrop` | `src/backdrop/**` | T00, T03 |
| T05 | `T05-buildings` | `src/buildings/**` | T00, T03 |
| T06 | `T06-street-life` | `src/street/**` | T00, T03 |
| T07 | `T07-air-traffic` | `src/air/**` | T00, T03 |
| T08 | `T08-lights` | `src/lights/**` | T00, T03 |
| T09 | `T09-post` | `src/post/**` | T00 |
| T10 | `T10-audio` | `src/audio/**` | T00 |
| T11 | `T11-camera` | `src/camera/**`, `tests/camera/**` | T00, T03 |
| T12 | `T12-app-shell` | `src/main.ts` | T00 |
| T13 | `T13-art-pass` | no paths of its own; a serial window in which it may retune numbers anywhere and log each change | all above |
| T14 | `T14-squeeze-release` | `SIZE.md`, `README.md`, `LICENSE`, `docs/**`; a serial window in which it may edit any path to save bytes, logging each change | all above |

Every task also owns its own plan file.

```
wave 1:  T00  T01  T02  T03          in parallel
wave 2:  T04 .. T12                  in parallel, against the frozen contracts
wave 3:  T13, then T14               alone
```

## 15. Decision log

| Id | Decision | Why |
|---|---|---|
| D-01 | A new implementation on raw WebGL2, not a port of the three.js build | The library is five times the budget |
| D-02 | Instanced rasterising, not ray marching | Phones, and thousands of vehicles (§2.3) |
| D-03 | The `utf16` container | Smallest container that survives a forced charset header [O] (§3.3) |
| D-04 | A 4.096 km tile of 32 x 32 cells | A quarter of the parent's instances; power-of-two wrap; fog hides the shorter view |
| D-05 | Lanes and sites derived from the grid, not planned as data | The grid is regular; data and the code to build it would cost bytes for nothing |
| D-06 | One uniform block mirrored by one `Float32Array`, as the shared state | No uniform lookups by name, no objects crossing modules |
| D-07 | Modules are flat functions and typed arrays; every signature stubbed from the first commit | Minifies to single letters; lets nine tasks build at once |
| D-08 | TypeScript, checked but never emitted by `tsc` | Free in bytes; the contract check between tasks |
| D-09 | Live music from native audio nodes, two stations | No start-up stall; the operator asked for one track, or two if possible |
| D-10 | The packed file is proven against the unminified build pixel for pixel | The only gate that makes aggressive minifying safe |
| D-11 | Size is reported as marginal cost per module | It is what a cut would save; shares of minified text mislead under deflate |
| D-12 | Quality changes live through a drawn prefix of shuffled instances | No reload path, no second set of buffers |

## 16. Open risks

| Risk | Mitigation |
|---|---|
| The `utf16` container is shown only in Chromium | The spec says the byte order mark wins [W: w3c-bom]; `ascii` ships beside it; the operator's phone is the real test |
| A file manager or a chat app re-encodes or previews the file as text | README says to send it as a file; the `ascii` variant is the fallback |
| The shader minifier renames something it should not | `npm run verify` compares pixels; the build can fall back to strip-only minifying with one flag |
| A phone lacks float colour targets | 8-bit fallback (§6.6); stated as untested |
| The mirror pass doubles scene cost | Half-size target; off at quality 0 |
| Bloom washes the frame out | The L0 to L3 bands (§6.2); T13 balances layers against each other |
| Glyphs differ between systems | Art leans on shapes and colour; only plain capitals and digits are drawn |
| The budget estimate is wrong | It is an estimate [I]. The ledger and the cut ladder (§3.5) are the answer, whatever the number turns out to be |

## Sources

[w3c-bom]: https://www.w3.org/International/questions/qa-byte-order-mark
[mdn-ds]: https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream
[mdn-cbf]: https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float

Fetched and read on 2026-11-18. The first says the byte order mark "overrides any encoding declaration
in the HTTP header" and adds that, when it was written, not every browser did so; Chromium 151 does [O].
The second says `DecompressionStream` has "been available across browsers since May 2023" and lists
`deflate-raw`; per-browser version numbers were not retrieved.

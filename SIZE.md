# SIZE.md: what the bytes buy

The ledger of task T14 (`plans/T14-squeeze-release.md`). The only measure is the final file in bytes,
as printed by `npm run build`. Everything here was measured on 2026-11-19 on one Windows 10 desktop
(Ryzen 9 3900X, RTX 4070 SUPER) in Playwright's Chromium 151 on the GPU, unless it says otherwise.

The measurement scripts named below are kept in `docs/release/scripts/`. They are copies of scratch
scripts written for `.tmp/T14/` (and `.tmp/T14/rr/` for the two Roadroller ones, which also need
`npm install roadroller@2.1.0` in that folder): copy them there and run them from the repository
root, for example `node .tmp/T14/ladder.mjs 0 14`.

## The answer

- **Shipped: 17,208 bytes** (`docs/release/synthwave-city.html`; ASCII twin 22,333 bytes). Every
  feature that was built, after a lossless squeeze from 17,538 to 17,146 and then 62 bytes of fixes
  from the operator's first play test (T15, below).
- **Smallest rung built that still passes the seven-point checklist, as far as it could be judged
  here: 12,396 bytes** (rung 14, `docs/release/ladder/synthwave-city-r14.html`). It keeps the endless
  tour with drag-to-look, lit towers with window grids, trim, crowns, spires and megatower bands, the
  sky lanes of craft, street traffic with head and tail lights, the striped sun, bloom and fog, one
  music track (kick, snare, hats, bass, pad) that drives the beat, the phone start-up path and the
  robustness of architecture.md section 12. It gives up everything listed in the ladder below.
- Points 6 (the music plays and the city pulses with it) and 7 (it runs on a phone) were checked only
  as far as a script can: the code path exists, the file boots, the audio context runs and schedules
  notes after a click, and the beat values in the uniform block move. Listening, and a real phone, are
  the operator's checks. **Which rung is "the" answer is the operator's decision.**
- Rungs further down were not built: every remaining cut removes a checklist item (air traffic,
  street traffic, the music, the tour) or a robustness item.

## After the first play test (T15, 2026-11-19)

The operator played the 17,146-byte file and found three defects: the drag turned the view the
wrong way, a finger did not fly in free flight, and the headlights flickered in step
(`plans/T15-playtest-fixes.md`). The fixes cost **62 bytes: 17,146 to 17,208**. `npm run size` puts
the camera at 2,200 (was 2,144, budget 2,200), the street at 1,204 and the backdrop at 1,436. The
ladder was rebuilt from the fixed sources, every rung type-checked and smoke-tested again; its byte
and saving columns below are the new ones.

Not repeated on the new build, so still as measured on the 17,146-byte one: sections M1 to M3, the
unpacker timings, the Roadroller experiment, and the ladder's draw counts, pixel differences and
pictures. The fixes change no draw call, and on this GPU they changed at most 4 of 921,600 pixels
in four views of the full build.

## M1. Baseline (before the squeeze)

`npm run build`: **17,538 bytes** = deflate stream 16,974 + container 564. Minified program 39,416
characters (terser set A won; B and C were within 32 bytes on the quick estimate), bundled 58,929.

Split of the minified text (`docs/release/scripts/split.mjs`): GLSL 19,935 characters (8,295 bytes
deflated on its own), JavaScript 19,399 characters (9,193 bytes deflated on its own). Together they
deflate to 16,974, so the two halves share little context.

`npm run size`, marginal bytes per module (each module replaced by a stub, the difference in the
quick-packed size; terser A, zlib level 9, so the rows rank and attribute but do not add up to the
file):

| Module | Before | After the squeeze | Budget |
|---|---|---|---|
| core (contracts, gl, engine, common.glsl) | 3,824 | 2,116 (see note) | 2,600 |
| container | 518 | 518 | 600 |
| plan | 1,244 | 1,238 | 1,100 |
| backdrop | 1,508 | 1,428 | 2,600 |
| buildings | 1,012 | 972 | 2,800 |
| street | 1,228 | 1,204 | 2,200 |
| air | 850 | 844 | 2,300 |
| lights | 2,046 | 2,024 | 2,600 |
| post | 602 | 626 | 1,400 |
| audio | 1,604 | 1,606 | 3,400 |
| camera | 2,134 | 2,144 | 2,200 |
| main (app shell) | 1,588 | 1,582 | 1,600 |
| **file** | **17,538** | **17,146** | gate 32,768 |

Note on core: "core" is measured with every module stubbed. Before the squeeze the engine's own blit
program was still in the shipped file and pulled `common.glsl` into that stubbed build; it is now
DEV-only (S06), so the stubbed build compiles no shader at all and `common.glsl` is charged to the
layers instead. The 1,708-byte drop is a change in attribution, not a saving; the saving was 74 bytes.

## M2. Squeeze log

Each step measured with `npm run build`; a kept step left `npm run verify` (0 differing pixels in
four views), `npm run check` and `npm run smoke` passing. The packed size moves in steps of about 8
bytes because the container pads the stream to whole 64-bit words.

| Step | What | Before | After | Change | Result |
|---|---|---|---|---|---|
| S01 | zopfli at 15 to 1,000 iterations, block-split limits 0, 15, 30 (`zop.mjs`, on the winning text) | 17,546 | 17,546 to 17,538 | 0 to -8 | Not kept: the build's `max` level already tries several counts and gets the -8 |
| S02 | terser options (passes 5, unsafe, unsafe_comps, keep_fargs, hoist_vars, inline 3, sequences, join_vars, collapse_vars, reduce_vars, arrows) and esbuild's minifier alone and before terser (`terser.mjs`) | 17,546 | 17,546 to 18,148 | 0 to +602 | Not kept: nothing beat set A |
| S03 | glslmin names local variables and parameters per function scope, so every function reuses the same one-letter names; globals keep one shared map. Two new unit tests, both seen failing first | 17,538 | 17,224 | **-314** | Kept (commit 2687ac0) |
| S04 | S03 with locals ordered by whole-corpus count instead of in-scope count | 17,224 | 17,242 | +18 | Reverted |
| S05 | Packed program as flat top-level code: no IIFE and no `"use strict"` (the unpacker's indirect eval runs it in global scope). 143 top-level names checked against Chromium's 1,003 window properties: no collision (`globals.mjs`) | 17,224 | 17,202 | **-22** | Kept (2350ace) |
| S06 | The engine's plain blit program only in DEV builds (the harness's `post=0`); post always replaces it in the shipped file | 17,202 | 17,128 | **-74** | Kept (3c0c3c3) |
| S07 | The frame loop stops after a context loss (`gl.isContextLost()`); robustness fix asked for by T12, not a saving. `lost.mjs`: rAF calls in the second after `loseContext()` 127 before, 0 after; restore still reloads; no errors | 17,128 | 17,146 | +18 | Kept (5be6d4f) |
| S08 | Linear-time unpacker (`utf16l`, below) | 17,146 | 17,246 | +100 | Not shipped; kept as a packer option |

Looked at and not built, with the reason: unpacker golf (each character of the 237-character tail
costs 2 bytes; no shorter equivalent of the digit mapping, the word split or the `Response` chain was
found on paper, so nothing was measured); shortening the CSS and markup, the camera key table and
other shell strings (expected tens of bytes, judged not worth the risk to a passing shell); dropping
`precision highp int` / `sampler2D` from the shader header (changes precision semantics, not
lossless).

## The unpacker: quadratic or linear

The shipped unpacker rebuilds one big number from the whole stream, which is quadratic in its length.
The block variant `utf16l` (T01's V5: 253 digits per 63-word block) is linear and costs **100 bytes
more** at this size. Time from navigation to the payload being evaluated and to the first rAF frame,
median of 7 warm runs per cell, 1280x720, CPU slowed with `Emulation.setCPUThrottlingRate`
(`startup.mjs`):

| CPU | utf16 (shipped, 17,146 B): eval / first frame | utf16l (17,246 B) | ascii twin (22,253 B) |
|---|---|---|---|
| 1x | 39 / 108 ms | 13 / 73 ms | 10 / 63 ms |
| 4x | 154 / 303 ms | 48 / 199 ms | 80 / 241 ms |
| 6x | 246 / 466 ms | 79 / 302 ms | 137 / 374 ms |

**Decision: ship the quadratic unpacker.** The linear one saves about 165 ms at 6x, but the shipped
file starts in under half a second even there, well inside the 1 s desktop budget, and the 100 bytes
are 0.6% of the file. A throttled desktop is a stand-in for a phone, not a phone: if the operator's
phone shows a slow start, switching is one option (`container: 'utf16l'` in `scripts/build.mjs`).

## M3. A stronger packer: Roadroller

Roadroller 2.1.0 (a context-mixing JavaScript packer), installed in a scratch folder only, never added
to the project. Input: the shipped build's minified program (`roadroller-run.mjs`,
`roadroller-mem.mjs`).

| Variant | Bytes |
|---|---|
| Shipped (deflate in the utf16 container) | 17,146 |
| Roadroller output as a plain UTF-8 `<script>` page | 19,266 |
| Roadroller output, deflated, in the utf16 container (level 0 optimisation) | **14,978** (-2,168, -12.6%) |
| the same, level 1 optimisation | 14,986 |
| the same with the decoder's memory capped at 64 / 32 / 16 MB | 15,066 / 15,146 / 15,276 |

The default decoder allocates two typed arrays of 51 million entries (about 153 MB). First frame,
median of 5 runs:

| CPU | Shipped | Roadroller, 153 MB | Roadroller, 32 MB |
|---|---|---|---|
| 1x | 108 ms | 892 ms | 809 ms |
| 4x | 305 ms | 4,218 ms | 3,897 ms |
| 6x | 464 ms | 6,656 ms | 5,976 ms |

**Not adopted.** The plan's bar was under about 1 s on the desktop and about 3 s with the CPU slowed
four times; Roadroller takes 3.9 to 4.2 s at 4x, and the default decoder wants 153 MB. The saving is
real and large, so it is listed as an operator decision.

## M4. The cut ladder

Built by `docs/release/scripts/ladder.mjs`: each rung is a fresh copy of the repository under
`.tmp/T14/ladder/rNN` with the cuts of every rung up to it applied, type-checked, built with the same
pipeline, smoke-tested from `file://` (`SMOKE OK` on every rung, no console or shader errors, frame
clock p95 8.1 ms) and photographed in three views: a skyline from 250 m, a street-level view and one
tour frame (`--cam 3712,250,504,0,-0.1 --t 12`, `--cam 2042,3,2300,0,0.04 --t 30`, `--tour 1 --t 60`,
all layers, 960x540). On every rung a click started the AudioContext (`running`, 60 or 62 sources in
4 s) and the beat values in the uniform block moved (`beat.mjs`). The shipped sources are untouched.

| Rung | Removed (cumulative) | Bytes | Saved | Draws | Pixels changed from the rung above (skyline / street / tour, of 518,400) | Picture |
|---|---|---|---|---|---|---|
| r00 | nothing: the shipped file | 17,208 | | 34 | | [r00](docs/release/ladder/r00.jpg) |
| r01 | Toasts, the key list on the start card, fullscreen (F and its button), H to hide the interface, the blocked context menu | 16,880 | 328 | 34 | 0 / 0 / 0 | as r00 |
| r02 | Free flight (WASD, Q/E, Shift, second finger, Space and its button), arrow-key look, wheel zoom; the tour and drag-to-look stay | 16,246 | 634 | 34 | 0 / 0 / 0 | as r00 |
| r03 | The midnight and miami moods (N and its button) | 16,086 | 160 | 34 | 0 / 0 / 0 | as r00 |
| r04 | The second station (R and its button) | 16,038 | 48 | 34 | 0 / 0 / 0 | as r00 |
| r05 | The touch bar and the 1 2 3 quality keys (quality follows the device type; render scale still adapts) | 15,790 | 248 | 34 | 0 / 0 / 0 | as r00 |
| r06 | Holographic billboards, tickers, face signs, the glyph atlas | 14,714 | 1,076 | 30 | 28,779 / 16,639 / 7,871 | [r06](docs/release/ladder/r06.jpg) |
| r07 | The people on the sidewalks | 14,336 | 378 | 28 | 0 / 18,981 / 0 | [r07](docs/release/ladder/r07.jpg) |
| r08 | Street lamps and their pools of light | 14,208 | 128 | 26 | 6,274 / 52,687 / 5,438 | [r08](docs/release/ladder/r08.jpg) |
| r09 | Chromatic fringe, vignette, scanlines, film grain | 14,120 | 88 | 26 | whole frame (grain) | [r09](docs/release/ladder/r09.jpg) |
| r10 | Stars and the wireframe mountain ridge | 13,814 | 306 | 26 | 41,796 / 10,599 / 28,697 | [r10](docs/release/ladder/r10.jpg) |
| r11 | The mirror pass: the wet road no longer reflects the city (sheen and sun streak stay) | 13,686 | 128 | 19 | 21,654 / 187,532 / 23,463 | [r11](docs/release/ladder/r11.jpg) |
| r12 | Searchlights, beacon pillars, laser fans, aviation lights, plaza octahedra (the lights layer) | 12,836 | 850 | 17 | 169,329 / 39,851 / 74,206 | [r12](docs/release/ladder/r12.jpg) |
| r13 | Sign panels, storefronts, equaliser facades, floor lines, roof slats, rings and dots, switching window runs | 12,572 | 264 | 17 | 134,494 / 217,916 / 308,517 | [r13](docs/release/ladder/r13.jpg) |
| **r14** | **The lead and its echo, toms, the noise riser and swell** | **12,396** | **176** | 17 | 0 / 0 / 0 | as r13 |

Bytes and savings are from the rebuild of 2026-11-19 after T15 (before it: 17,146 at the top, 12,370
at the bottom). The pictures are contact sheets (skyline, street, tour) at 480x270 each, from the
first build of the ladder. Rungs r01 to r05 and r14 draw
exactly the pixels of the rung above, because they cut the shell, the camera's input and the audio.

**Checklist, rung 14** (the full-size pictures were opened and looked at):

1. *Tour without end, no edge or pop.* The tour code is the shipped one minus free flight, and the
   world placement is untouched. Inferred, not re-checked with a frame sequence on this rung.
2. *Lit towers with window grids and neon trim, a megatower in most views.* Seen: window grids and
   trim on every tower in all three views; a megatower with its bands in the centre of the
   skyline view. Pass.
3. *Flying traffic in lanes.* Seen: streams of craft over the avenues in the skyline and street views,
   craft passing the camera in the tour frame. Pass.
4. *Street traffic with head and tail lights.* Seen: cars in lanes, white headlights coming, red tail
   lights going, in the street and tour views. Pass.
5. *Striped sun, bloom, fog.* Seen: the sun with its cut-outs (clearest in the tour frame), glow
   around lights and trim, haze towards the horizon. Pass.
6. *Music plays and the city pulses.* Checked by script: the AudioContext runs after a click, 60
   sources started in 4 s, the beat count and pulse in the uniform block move (pulse 0 to 0.996).
   Whether it sounds like music is not checked.
7. *One file, PC and phone.* The file boots from `file://` on this desktop with no errors, and also
   with phone emulation (412x915, device scale 2.625, touch): audio starts on a tap and the frame
   clock holds. A real phone is not checked.

What rung 14 looks like next to the shipped file: the street is plainer (dark road without
reflections, blank ground floors, no people or lamps), the skyline has no searchlights or billboards,
and the grade is clean instead of filmic. The cuts that cost the most experience per byte were taken
last; r06 (billboards, 1,082 bytes) and r12 (searchlights, 850) are the two big steps.

Draw calls: 34 per frame at quality 2 in the shipped file (23 at quality 0), against the budget of 30
in architecture.md section 11.3. Eleven of them are post's full-screen passes over the bloom levels
(down to 1/32 size), ten are the half-size mirror pass and thirteen the main pass. No merge was found that would also
save bytes. The count was left as it is: the cost of a frame here is fill and vertex work, not the
number of calls [I]; on this desktop every rung held the 8 ms frame clock. Rung 11 and below are at 19
or fewer.

## Not measured

Firefox, Safari, any real phone or tablet; start-up on a phone (throttling is a stand-in); GPU frame
time on anything but this RTX 4070 SUPER (headless Chromium ticks every 8 ms, so the smoke numbers only
show that no frame missed that tick); the marginal cost of features inside a layer that were not made
into a rung (air ships and strobes, buses and motorcycles, headlight pools, brake flicker, crowns and
spires); whether the music is good.

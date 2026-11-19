---
id: T08-lights
title: Searchlights, pillars and holographic billboards
status: done
depends_on: [T00, T03]
owns: [src/lights/**, plans/T08-lights.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts, src/plan.ts]
budget: 2600
executor: opus/medium
updated: 2026-11-18
---

# T08: lights

## 1. Purpose

The light show above the roofs: searchlights sweeping the fog, pillars of light rising out of sight
from the megatowers, red aviation lights blinking on tall roofs, and holographic billboards hanging
in the air with scanlines and glitches. These are the garish accents that make the skyline a
synthwave one.

## 2. Context and orientation

Read §5, §6 (especially §6.2 and the additive rule of §6.5) and §10. How a layer works is §4.5:
`src/lights/index.ts` exports `init()` and registers draw functions with `addLayer`. `src/gl.ts` and
`src/engine.ts` document every helper in comments above each export; `dev/probe/` is a small working
layer to copy idioms from.

Sites are chosen here, in `init`, by scanning the plan (§5.5): `megas` for pillars and the biggest
searchlights; the tallest boxes for roof lights and more searchlights; billboards on the faces of
tall boxes that front an avenue, or floating above avenue junctions and plazas (`cells` gives the
district). Write the chosen sites into small per-instance buffers once.

Beams are camera-facing strips from `ribbon()` in `common.glsl`: a soft cross-section, falloff along
the length, shimmer from noise scrolling along the beam, a slow sweep from `uTime.x`. All additive,
depth test on, depth write off, culling off.

Billboards are quads. Their content is composed in the fragment shader from a **glyph atlas**: draw
capitals and digits once into a small canvas with `fillText` in a generic font, upload it to texture
unit 3 (`T3`), and let each panel pick a few glyph cells by hashing its seed, so every panel shows a
different invented word, plus bars, frames and blocks of colour. Then scanlines, flicker, a glitch
band that jumps on the beat, and a little colour fringing. Invented words only: no real brands.

## 3. Scope

Owned: `src/lights/**` (`index.ts` and `.glsl` files).

Must have: beacon pillars on every megatower; a dozen or more sweeping searchlights; blinking red
roof lights on tall buildings; forty or more billboards of varied size and colour that are readable
as signs from a few hundred metres; everything pulsing a little with `uTime.w` (the beat).

Optional, cut first if over budget, in this order: wireframe solids rotating over plazas, laser fans
from tower crowns, ticker rings around megatowers.

Not in scope: neon on the buildings themselves (T05), vehicle lights (T06, T07).

## 4. Interfaces

Consumes: `prog`, `inst`, `tex`, `state` and the instanced draw helper from `src/gl.ts`; `addLayer`
from `src/engine.ts`; `boxes`, `boxCount`, `cells`, `megas`, `megaCount` from `src/plan.ts`; `BOX`,
`B_*`, `K_*`, `D_*`, `O_BEAM`, `O_HOLO`, `O_GLOW` from `src/contracts.ts`; the block `F`, `quad`,
`ribbon`, `place`, `fog`, `pal`, hashes, noise and sampler `T3` from `src/common.glsl`.

Provides: `init()` from `src/lights/index.ts`. Texture unit 3 belongs to this layer.

## 5. Plan of work

**M1. Beams.** Pillars and searchlights with the NaN discipline of Agents.md (clamp before `pow` and
`exp`; test with post on once T09 has landed). *Proof:* a skyline shot from 300 m with pillars
rising out of frame and searchlights crossing; an eight-frame sequence at 0.5 s per frame showing the
sweep.

**M2. Glyph atlas and billboards.** *Proof:* a shot 150 m from a panel where its word is readable;
a skyline shot where panels read as coloured signs; a sequence showing flicker and glitch.

**M3. Roof lights.** *Proof:* a far overview at two times half a second apart showing the blink.

**M4. Clearance.** With `--layers buildings,lights` (or `probe,lights`): no panel is buried in a
building, and beams start at roofs. *Proof:* shots.

**M5. Optional items, then measure.** `npm run size -- lights`; trim or cut toward the budget.

## 6. Validation and acceptance

- Shots, each opened and described in this plan: skyline from 300 m; a billboard up close; a junction
  with floating panels from street level; 1,200 m overview; straight down from 800 m.
- Beams are L2 with small L3 cores and do not white out the frame when several overlap.
- No black blocks or speckle anywhere with post on (a NaN shows up that way).
- No console errors or unexplained shader warnings in `shot.mjs` output.
- `npm run check:task -- T08` exits 0. Measured bytes are recorded against the budget.

Human checks: glyphs depend on the system font; the operator's phone will show different letter
shapes than this desktop.

## 7. Idempotence and recovery

Shots go in `shots/T08/`, scratch in `.tmp/T08/`. Both can be deleted at any time.

## 8. Progress

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan, contracts, common.glsl, gl.ts, engine.ts, plan.ts, dev/probe; looked at the parent screenshots skyline, plaza, rooftops. Status in-progress.
- [x] 2026-11-18 M1 beams: `src/lights/beam.glsl`. Beacon pillar on each of the 7 megatower spires, a 7-beam laser fan from each spire base, a sweeping searchlight on every megatower segment and on about 16% of shafts and crowns topping 170 m. Both ends are faded: falloff along the length, and a fade over the last part, so a beam has no cut-off tip.
- [x] 2026-11-18 M2 glyph atlas and billboards: `src/lights/holo.glsl` and the atlas in `index.ts` (8 x 5 cells of 32 px; vowels, consonants, digits). Signs on one face of about 40% of shafts over 40 m tall, horizontal or stacked vertically; floating turning signs over plazas and about half the avenue junctions.
- [x] 2026-11-18 M3 roof lights: red blinking sprites on the corners of crowns and megatower segments above 120 m, and at the tip of small spires.
- [x] 2026-11-18 M4 clearance: checked by eye in `probe,lights` and `backdrop,buildings,lights,post` shots. Face signs sit 1.5 m out from the shaft wall, within its width and height. Beams start at box tops, or at the corners of a segment top, outside the narrower segment above. Floating signs are no wider than 32 m, over corridors that are 36 m wide at an avenue junction.
- [x] 2026-11-18 M5 optional items. Wire octahedra over plazas, with a column of light, from a second draw over cells. Ticker bands on all four faces of every megatower segment. The laser fans of M1 come from the megatower spires only, not from every crown. Measured 2,064 bytes against the 2,600 budget.
- [x] 2026-11-18 Acceptance run, evidence below. Status done.

### Acceptance evidence (2026-11-18)

All shots are from `node scripts/shot.mjs` on `ANGLE (NVIDIA ... RTX 4070 SUPER ... D3D11)`. None of these runs printed a console error, a warning or a shader log. Each image was opened and looked at.

- **Skyline from 300 m:** `shots/T08/final_skyline.png` (`--layers all --cam 2700,300,2700,-2.4,0.12`). Two megatowers. The pillars rise out of the top of the frame. Laser fans spread from the spires, and cyan, magenta and yellow searchlights cross above downtown. Plaza columns and octahedra are visible in the distance on the right. Overlapping beams do not white out the frame (the shot reports 0.00% clipped). The horizontal streaks across the frame are T07's air traffic, not this layer.
- **Sweep sequence:** `shots/T08/sweep_0..7.png` (`--frames 8 --dt 0.5`). The beam pattern in frame 7 differs visibly from frame 0, and the downtown towers stay fixed.
- **Billboard up close:** `shots/T08/close2.png` (camera about 150 m from the junction sign at 2048,1536) and `close3.png` (about 100 m). The word OHYR is readable in a red frame on an orange-red panel. In `close_only.png` (`--layers lights`), other words read clearly: 02238, YDOFOG, a vertical EGID, a vertical YPYZ, BYZ.
- **Flicker and glitch:** `shots/T08/glitch_0..5.png` (`--dt 0.15`). In frame 2 a band of the OHYR panel is shifted sideways and its frame is broken; frame 0 is clean. The panel also turns between frames.
- **Junction from street level:** `shots/T08/final_junction_q0.png` (`--layers all --q 0`, eye 3 m). A floating vertical sign reading YCOPO hangs above a plaza, with the wire octahedron and the magenta light column under it.
- **1,200 m overview:** `shots/T08/far.png`. Beams fan up from downtown on the left. Across the far fade, plaza columns and searchlights fade out instead of lying flat.
- **Straight down from 800 m:** `shots/T08/top.png`. Wire octahedra show over three plazas: magenta, cyan with its column, and violet. The floating signs are seen edge-on as thin lines.
- **Roof-light blink:** `shots/T08/blink_0.png` and `blink_1.png` (0.8 s apart). Some red corner lights are bright in frame 0 and dim in frame 1, and others light up in frame 1 (the megatower segment corners).
- **Tickers:** `shots/T08/ticker.png`. Bands of text go round the megatower segments. The text is pale and small at this distance.
- **No NaN blocks:** every shot with post on reports `black 0.0%`, and none shows a black block or speckle.
- `npm run check:task -- T08`: `PASS T08-lights` (typecheck 0 errors, import rules 0 violations, plan 0 problems).
- `npm run verify`: `VERIFY OK`, with 0 differing pixels on every pose. `src/main.ts` calls `lights()`, so the packed build draws this layer the same as the sources.
- `npm run size -- lights`: **2,064 bytes** against a budget of 2,600 (file 17,330 at the time).

## 9. Surprises and discoveries

- With the far fade, `place()` flattens the whole of a beam onto the ground, because its anchor sinks. With `--layers lights` this showed as horizontal streaks on the horizon (`shots/T08/close_only.png`, before the fix). Beams now fade out over `uFade.x..uFade.y` as well (evidence: `far.png`).
- The camera can sit inside a plaza column, and the camera-facing ribbon then washed the whole frame violet (`shots/T08/plaza_only.png`, mean 180/255). Every beam now fades to zero within 80 m of the eye.
- A JS port of `hashU` (`.tmp/T08/sites.mjs`) reproduces the shader's site choice, which helped in placing cameras.

## 10. Decision log

- 2026-11-18: Sites are chosen in the vertex shaders from the plan's box buffer, not on the CPU. Both programs share one vertex array over `boxes`, and a slot that is not used is dropped with a zero-area triangle. Reason: no site-scanning code ships, and one buffer serves both draws. Cost: about 3,904 x 48 beam vertices and 3,904 x 30 panel vertices each frame, most of them dropped. This has not been measured on a phone.
- 2026-11-18: Pieces that hang over cells (floating signs and plaza pieces) take instances 0 to 1023 of the same draw and read them as cell ids, with `texelFetch(T2)` for the district. The plaza pieces need more vertices than a box does, so they come from a second call, `gl.drawArraysInstanced(4, 48, 78, 1024)`, whose `first` argument numbers their vertices from slot 8 onwards. The helper `drawInst` has no `first`, so this one call goes to `gl` directly.
- 2026-11-18: Beams are kept at least about 1.5 px wide, with intensity scaled down by the same factor, so thin lasers do not shimmer at distance.
- 2026-11-18: Words alternate consonant and vowel (`AEIOUY` and then 17 consonants in the atlas), or are all digits on about 15% of panels. Words are random, so a real word can turn up by chance. With 3 to 6 letters and no brand list, a match with a real brand name has not been ruled out.
- 2026-11-18: Optional items. Octahedra over plazas and tickers on megatowers are built. The laser fans from the spires were already built, so "laser fans from tower crowns" is covered for megatowers only.

## 11. Contract change requests

- None needed. Nice to have, not filed as blocking: an optional `first` argument on `drawInst` in `src/gl.ts` (`drawInst(vao, verts, count, first = 0)`) would replace this layer's one direct `gl.drawArraysInstanced` call. The saving is a few bytes at most.

## 12. Outcomes and retrospective

The skyline has the parent's light show. Beacon pillars rise from all seven megatowers, laser fans turn at their spires, and about 60 sweeping searchlights (an estimate from the box counts, not counted on screen) cross in cyan, magenta and yellow. Red aviation lights blink on crowns and segments. Invented-word billboards hang on facades, float and turn over junctions and plazas, and scroll as tickers round the megatowers, with scanlines, flicker, beat glitch and colour fringing. Wire octahedra and light columns stand over the plazas. Everything pulses with `uTime.w`.

Measured: **2,064 packed bytes** against a budget of 2,600, optional items included. If bytes are needed, these cuts are candidates. Their savings were not measured; each would need `npm run size -- lights` with the item removed.
- tickers (the `ticker` branch in holo.glsl);
- plaza octahedra and columns (the `b > 7` block in beam.glsl and the second draw call);
- colour fringing (two extra texture samples);
- laser fans.

Not verified:
- Frame time. Nine agents were sharing the GPU, so no frame-time number from this session means anything; no perf or smoke run is claimed.
- Any phone, Firefox or Safari. The glyph shapes depend on the system font.
- The mirror pass. Both draws are registered with `reflect = 1`, but no shot was examined for their reflection in the wet street.
- Moods 1 and 2: only mood 0 was looked at.
- Whether every face sign is clear of neighbouring buildings. This was judged by eye in a handful of shots, not tested.
- Brightness balance against T05's facade signs. T05 was still changing; that balance belongs to T13. At distance the face signs read small and fairly dim next to T05's facades.

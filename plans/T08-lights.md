---
id: T08-lights
title: Searchlights, pillars and holographic billboards
status: ready
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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

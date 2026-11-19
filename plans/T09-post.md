---
id: T09-post
title: Bloom and grade
status: ready
depends_on: [T00]
owns: [src/post/**, plans/T09-post.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/common.glsl, src/gl.ts, src/engine.ts]
budget: 1400
executor: opus/medium
updated: 2026-11-18
---

# T09: post

## 1. Purpose

The glow. The scene is drawn in linear HDR where neon is simply a number bigger than one; this task
turns those numbers into light that bleeds, a tone curve that keeps the colours saturated instead of
bleaching them to white, and the last touches of an 80s picture: a little chromatic fringing, a
vignette, scanlines and grain.

## 2. Context and orientation

Read §6.2 (the light bands are the contract between every layer and this task), §6.6 and §10.
`src/post/index.ts` exports `init()`, which builds its targets and programs and calls
`setPost(fn)`; the engine then calls `fn(sceneTexture)` once per frame after the main pass, and this
task draws the final picture to the canvas. `onResize(fn)` tells you when the scene size changes (it
changes with the window and with the adaptive render scale, so it must be cheap and must not leak
targets). `src/gl.ts` and `src/engine.ts` document every helper in comments above each export.

Full-screen passes are `tri()` with a fragment shader; texture units 0 and 4 to 7 are yours (§10.6).
A program that needs a value the uniform block does not carry (a texel size, a level) uses the
reserved per-program uniforms `X0`–`X3`, as `src/gl.ts` documents.

The scene target is smaller than the canvas when the render scale is below 1; the final pass upscales
with linear filtering.

## 3. Scope

Owned: `src/post/**` (`index.ts` and `.glsl` files).

Must have: bloom from a down and up chain of about five levels with a soft threshold near the top of
L1, wide enough that an L3 core has a halo tens of pixels across at 1080p; a tone curve applied per
channel in a way that keeps hue (neon magenta stays magenta at L2, only L3 cores go to white);
exposure from `uFade.w`; gamma to sRGB; alpha 1.

Optional, cut first if over budget, in this order: grain, scanlines, chromatic aberration, vignette.
(Vignette is nearly free; it is listed last so it goes last.)

Not in scope: the mirror pass and the scene target (engine), fog (layers), any per-layer glow sprite.

## 4. Interfaces

Consumes: `prog`, `target`, `tri`, the bind helpers and `gl` from `src/gl.ts`; `setPost`, `onResize`,
`sceneW`, `sceneH` from `src/engine.ts`; the block `F` from `src/common.glsl`.

Provides: `init()` from `src/post/index.ts`.

## 5. Plan of work

**M1. A test scene you control.** The city layers are being written at the same time, so do not wait
for them: use `--layers probe` (flat boxes and a grid) and, if the probe has nothing bright enough,
a scratch layer of your own under `.tmp/T09/` that draws patches at exactly 0.1, 0.7, 2, 4 and 10 in
each palette colour. *Proof:* a shot of the patches with post off.

**M2. Bloom.** Downsample with a small tent or 13-tap filter (no single-pixel flicker from bright
dots), upsample and add. *Proof:* the patch shot with post on: 0.1 and 0.7 have no halo, 2 has a
clear one, 10 a wide one; an eight-frame sequence with a slowly moving camera shows no flicker in the
halos of small bright points.

**M3. Tone and grade.** *Proof:* in the patch shot each colour at L2 is still that colour, and only
the L3 patches approach white; the image statistics show no clipping across most of the frame.

**M4. Resize and scale.** Change the window size and the render scale many times; target count stays
constant (count `createTexture` calls under `DEV`, or watch memory in the page). *Proof:* numbers in
this plan.

**M5. Cost.** Measure the pass with vsync on at 2560x1440 when the machine is idle (Agents.md,
Playwright). Then `npm run size -- post`; trim or cut toward the budget.

## 6. Validation and acceptance

- The patch shots of M2 and M3, opened and described in this plan.
- With whatever city layers exist by the end (`--layers all`): the picture glows without washing out,
  described in this plan with the caveat that T13 balances it.
- A NaN written by a layer must not spread: clamp the scene sample to a finite range before the first
  downsample, and show it with a scratch layer that writes a NaN on purpose.
- The final pass writes alpha 1 (a `shot.mjs` PNG has no transparent pixel).
- No console errors or unexplained shader warnings in `shot.mjs` output.
- `npm run check:task -- T09` exits 0. Measured bytes are recorded against the budget.

Human checks: whether the amount of bloom matches the parent's pictures
(`C:\highsierralabs\Synthwave_City\docs\screenshots\`).

## 7. Idempotence and recovery

Shots go in `shots/T09/`, scratch in `.tmp/T09/`. Both can be deleted at any time.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

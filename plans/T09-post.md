---
id: T09-post
title: Bloom and grade
status: done
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

- [x] 2026-11-18 Read Agents.md, architecture.md (6.1, 6.2, 6.6, 10, 11), gl.ts, engine.ts, common.glsl,
  dev/probe; opened the parent's skyline.png and street.png. Status set to in-progress.
- [x] 2026-11-18 M1: scratch layers `.tmp/T09/patch` (palette patches at 0.1, 0.7, 2, 4, 10 plus a 3 px
  dot of each) and `.tmp/T09/nan` (a NaN half and a +inf half), shot with `.tmp/T09/shot9.mjs` (a copy
  of `scripts/shot.mjs` whose entry may name those two scratch layers; `shot.mjs` itself only loads
  `src/` and `dev/` layers). Post-off shot: `shots/T09/m1_patch_post0.png`.
- [x] 2026-11-18 M2: bloom, five levels down, four up, one program (`src/post/post.glsl`).
- [x] 2026-11-18 M3: tone and grade; tuned against the patches and against `--layers all`.
- [x] 2026-11-18 M4: 30 resizes, texture count constant (evidence in Outcomes).
- [ ] M5 frame cost at 2560x1440 with vsync on, idle machine: not measured (nine agents on the GPU;
  `npm run smoke` currently fails before the canvas appears, in the app shell, not in post).
- [x] 2026-11-18 Size measured (594 bytes against 1,400), check:task passes, verify passes.

## 9. Surprises and discoveries

- `clamp(NaN, 0, 64)` does not give 0 on this GPU (ANGLE D3D11), and a sum-and-compare guard
  (`c.r + c.g + c.b < 200.0`) was not trusted to catch a NaN either. Testing the exponent bits
  (`floatBitsToUint(c) & 0x7f800000u`) does catch both NaN and infinity. Evidence:
  `shots/T09/m4_nan_unguarded.png` (guard removed: a 380 x 320 px black block, 7.9 % black pixels)
  against `shots/T09/m4_nan4.png` (guard in: the 96 x 54 px NaN/inf patch is dark, nothing around it
  is affected, 0.0 % black).
- My first NaN layer wrote `z / z` with z = 0 at run time; the compiler folded it to 1, so that test
  proved nothing (the patch came out grey). `uintBitsToFloat(0x7fc00000u + uint(z))` gives a real NaN
  (the engine's plain blit then shows it black, and +inf white: `shots/T09/nan4_post0.png`).
- `shot.mjs --layers` takes only `src/<name>` and `dev/<name>`, so the plan's scratch layer under
  `.tmp/T09/` needs its own runner (`.tmp/T09/shot9.mjs`, built on `scripts/lib/*`).
- Sibling layers changed between my shots (the backdrop's mountains grew between two `--layers all`
  shots taken minutes apart), so before/after comparisons of the city are confounded; the patch shots
  are the controlled comparison.

## 10. Decision log

- 2026-11-18 One program for every pass, `X0.x` choosing it (0 first downsample, 1 blur, 2 final).
  Down and up use the same 3 x 3 tent of bilinear taps one source texel apart; the texel size comes
  from `textureSize`, so no per-pass size uniform. The scene stays on unit 4 for every pass and the
  level being read on unit 0, so the first downsample and the final pass read the scene the same way.
- 2026-11-18 Bloom keys on the brightest channel, not luminance (architecture 6.2 says luminance).
  With these palette colours luminance would leave ultraviolet (luminance about 0.2 of its peak) and
  magenta (about 0.26) far below the knee at L2, so they would not glow; every palette colour has a
  peak channel of 1, so the peak equals the light band. Soft knee from 0.9 to 1.7: 0.7 keeps 0 %,
  2 keeps 35 %, 10 keeps 87 %.
- 2026-11-18 Firefly control: in the first downsample each tap is weighted by 1 / (1 + peak).
- 2026-11-18 Tone on the peak channel, curve `1 - exp(-1.2 m^2 / (m + 0.1))` (a toe that keeps L0
  darks deep, a shoulder that reaches about 0.99 by 4). Hue is c / m. The whitening of L3 cores
  (`smoothstep(4, 16, peak of the scene)`) is decided by the scene before the bloom is added; when it
  used the bloomed value, large L2 patches went pastel (`shots/T09/m2_patch_post.png`).
- 2026-11-18 Saturation by raising the chroma c / m to the power 1.3. A linear push away from grey
  (`mix(luma, c, 1.3)`) looked right on the city but drew dark rings where a red halo met the indigo
  background (`shots/T09/m6_patch.png`): channels went negative and were clamped. The power cannot go
  negative (`shots/T09/m7_patch.png`, no rings). Without any saturation step the city looked muted
  and brownish (`shots/T09/all_high_nosat.png`).
- 2026-11-18 Bloom strength 0.2 of the summed levels; chromatic offset 0.0015 of the distance from
  centre (about a pixel at the corners at 1600 px; at 0.006 it split thin magenta lines into red and
  blue); vignette 0.5 * |d|^2; scanlines 5 % at a 3 px period of the canvas; grain +-0.02 after gamma,
  new each 1/30 s. All are first guesses for T13's art pass.
- 2026-11-18 The optional items (grain, scanlines, chromatic aberration, vignette) all stay: the module
  is at 594 bytes against 1,400.

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

Result: `src/post/index.ts` (one program, five half-float levels resized in place in `onResize`,
eleven full-screen draws a frame) and `src/post/post.glsl`. The picture has bloom from L2 up,
hue-keeping tone, L3 cores going to white with coloured halos, deep indigo darks, chromatic fringe,
vignette, scanlines, grain, gamma and alpha 1. With the sibling layers as they stood on 2026-11-18 it
glows without washing out (`shots/T09/all_high_pow.png`, `shots/T09/final_views.png`); T13 balances it.

Measured: `npm run size -- post` = 594 bytes, and 602 on a re-run minutes later while siblings were
editing (the marginal cost moves with the shared deflate context), against a budget of 1,400 (whole file 16,952 bytes at
that run). Possible cuts if ever needed: grain, scanlines, chromatic fringe and vignette are one line
of GLSL each, probably 20 to 60 packed bytes each [I, not measured one by one].

Acceptance evidence (all 2026-11-18, RTX 4070 SUPER through ANGLE D3D11, unminified harness unless
said):

- Patch shots: `shots/T09/m1_patch_post0.png` (post off: flat patches, 4 and 10 clip to pastel or
  white) and `shots/T09/m7_patch.png` (post on, final code). Seen: 0.1 and 0.7 have no visible halo;
  2 has a clear halo; 4 a stronger one; 10 a wide halo (roughly 60 to 100 px) with the patch near
  white and the halo in the patch's colour. At 2 and 4 every row keeps its colour (magenta stays
  magenta, ultraviolet stays violet). Image statistics: clipped 0.00 %.
- Flicker: `shots/T09/seq_*.png` (probe, 8 frames, camera stepping 0.7 m x and 0.4 m z per frame) and
  `shots/T09/seqall_*.png` (all layers). The mean brightness of 160 x 100 px crops around small glows
  varied by at most 0.1/255 (probe) and 0.4/255 (all layers) between frames; `shots/T09/seq_montage.png`
  shows the halos steady. Headlight points in `shots/T09/seqall_montage.png` still alias as geometry
  (street's concern), not as halo flicker.
- NaN: see Surprises; the guard was shown to fail when removed.
- Alpha: every shot reports transparent 0.0 %.
- Resize: `node .tmp/T09/shot9.mjs --layers patch,nan,post --t 10 --resize 30` printed
  "textures created: 7 after the first frame, 7 after 30 resizes" (counted by wrapping
  `gl.createTexture` in the scratch layer: scene, mirror and five levels). That the scene size changed
  on every step is inferred from the viewport changes, not printed.
- The patch, probe and all-layer shots printed no console errors, shader errors or warnings.
- `npm run check:task -- T09`: PASS. `npm run verify`: VERIFY OK on four views, 0 differing pixels
  (post included, so `X0` and `T4` survive the GLSL renaming).
- Views looked at with final code: near `shots/T09/final_street.png` (sun core white with an orange
  halo, tail lights glowing red, saturated facades, wet reflections), far `shots/T09/final_far.png`
  (searchlights glowing, magenta haze), top `shots/T09/final_top.png` (saturated trims, modest glow),
  and `shots/T09/all_far_q0_m1.png` (quality 0, midnight: indigo, no artefacts). What looks open: the
  far view's sky is a flat mauve and that frame is softer than the parent's skyline.png; the area
  round the sun is milky in `all_high_pow.png`. Either may be layer brightness rather than post; T13
  decides.

Not verified: frame cost (M5: the machine is shared, and `npm run smoke` timed out waiting for a
canvas on two runs, which points at the app shell still being written, not at post); any device other
than this RTX; the RGBA8 fallback (no float targets), where everything above 1 clips before post; the
human check against the parent's pictures.

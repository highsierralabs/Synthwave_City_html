---
id: T12-app-shell
title: Start card, keys and touch bar
status: ready
depends_on: [T00]
owns: [src/main.ts, plans/T12-app-shell.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/engine.ts, src/gl.ts, src/plan.ts, src/audio/index.ts, src/camera/index.ts]
budget: 1600
executor: sonnet/high
updated: 2026-11-18
---

# T12: app shell

## 1. Purpose

What a person meets when they open the file: the city already flying behind a small title card that
says how to start the music, then nothing in the way: a few keys on a PC, a row of small buttons on a
phone. And a plain message instead of a blank page when the browser cannot run it.

## 2. Context and orientation

Read §9, §12 and §10.4. `src/main.ts` is the entry point of the shipped file and the only module that
imports every other. It exists as a stub that already boots the engine and initialises every module
in the right order; keep that order and build the interface around it.

The unpacker evaluates this bundle after the HTML parser has finished a document that contains almost
nothing: `<body>` and a script. There is no `<head>` content, no doctype (so the page is in quirks
mode), no viewport `<meta>`, no title, no CSS. **This module creates all of it**, so it is compressed
with everything else. In quirks mode `html` and `body` do not fill the window by themselves: size the
canvas with `position: fixed; inset: 0; width: 100%; height: 100%`, and check it in a real page.

The sibling modules are being written at the same time as this one, against the same signatures:
`audioStart`, `audioMute`, `audioStation`, `audioHidden` from `src/audio/index.ts`; `cameraInit`,
`cameraMode` from `src/camera/index.ts`; `boot`, `run`, `setQuality`, `setMood` from
`src/engine.ts`. Their stubs do nothing but have the right types, so your code compiles and runs now
and gains behaviour as they land.

This module ships in the file; read Agents.md, "Writing for the packer", before writing it. In
particular: one `innerHTML` string and one `<style>` text; one `keydown` listener with a lookup on
the key; buttons that call the same functions the keys call.

## 3. Scope

Owned: `src/main.ts`.

Must have:

- Page set-up: `document.title`, a viewport `<meta>` (`width=device-width, initial-scale=1,
  viewport-fit=cover`), dark background, no margins, no scrolling, no text selection, no long-press
  menu on the canvas, `touch-action: none`.
- The canvas, full window, resized by the engine.
- A **start card** over the running city: the name, one line saying tap or press a key for sound, and
  one line of key hints on devices with a keyboard. The first `pointerup` or `keydown` anywhere
  starts audio (`audioStart()` must be called synchronously inside that handler) and fades the card.
- **Keys:** `M` mute, `R` next station, `N` next mood, `F` fullscreen, `Space` tour or free flight,
  `1` `2` `3` quality, `H` hide or show the interface. Flight keys belong to T11; do not handle them
  and do not call `preventDefault` on them.
- A **touch bar**: a row of small translucent buttons along the bottom edge for mute, station, mood,
  flight mode, quality and fullscreen, drawn with plain text or simple Unicode symbols (no icon font,
  no image), at least 40 CSS pixels tall, inside the safe area. It fades out after a few seconds
  without input and returns on any touch or mouse move.
- A short toast naming what a key or button just did ("Station 2", "Muted", "Free flight").
- **No WebGL2** (`boot` returns false): a styled message in place of the canvas.
- **Context lost:** a notice; reload when the context is restored.
- **Hidden tab:** call `audioHidden(document.hidden)`; the engine pauses its own loop.

Optional, cut first if over budget, in this order: the toast, hiding the cursor after a few seconds
without movement, a screen wake lock while visible, the key-hint line.

Not in scope: flight controls (T11), anything drawn in WebGL, saved settings, a menu.

## 4. Interfaces

Consumes: the exports named in section 2, as documented in each file.

Provides: the program's entry point. Nothing imports it.

## 5. Plan of work

**M1. The page from nothing.** Build the document, boot, run. Check it in the real container, not
only in the dev harness: `npm run build`, then open `dist/synthwave-city.html` (or
`node scripts/shot.mjs --app 1`, which shoots the unminified app the same way; `src/engine.ts` and
`scripts/shot.mjs` document what exists). *Proof:* a shot at 1920x1080 and one at 412x915 (a phone in
portrait) with the canvas filling the window and the start card legible.

**M2. Keys, buttons, toast.** *Proof:* a scripted Playwright run under `.tmp/T12/` that presses each
key and clicks each button and records the calls (wrap the imported functions under `DEV`, or read
the toast text), with a shot of the touch bar on the phone-sized page.

**M3. First gesture.** *Proof:* in the scripted run, `audioStart` is called exactly once, inside the
first gesture, and the card is gone afterwards.

**M4. Failure messages.** *Proof:* a shot from a browser launched with `--disable-3d-apis` showing
the no-WebGL2 message; a scripted context loss (`WEBGL_lose_context`) showing the notice.

**M5. Measure.** `npm run size -- main` (or whatever name `scripts/size.mjs` gives this module);
trim or cut toward the budget. Markup and CSS strings are where the bytes are.

## 6. Validation and acceptance

- The shots of M1, M2 and M4 were opened and described in this plan.
- The scripted run shows every key and every button reaching the right function once.
- `npm run smoke` passes on the built file (it may fail for a sibling's reason during the wave; say
  so if it does).
- `npm run check:task -- T12` exits 0. Measured bytes are recorded against the budget.

Human checks: the touch bar and the start card on the operator's Android phone and tablet, in both
orientations; whether the first tap starts the music there.

## 7. Idempotence and recovery

Shots go in `shots/T12/`, scratch in `.tmp/T12/`. Both can be deleted at any time.

## 8. Progress

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

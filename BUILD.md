# BUILD.md: how the file is made, checked and measured

The detail behind the [README](README.md). Measurements are from one Windows 10 desktop (Ryzen 9
3900X, NVIDIA RTX 4070 SUPER) in Playwright's Chromium 151 on the GPU, from `file://`, unless a line
says otherwise. The full ledger of sizes is [SIZE.md](SIZE.md).

## The two files

| File | Bytes | What it is |
|---|---|---|
| [`docs/release/synthwave-city.html`](docs/release/synthwave-city.html) | 17,208 | The product. UTF-16 with a byte order mark: the program is deflated and stored as one big number, one character per digit, and a 237-character unpacker turns it back into JavaScript. |
| [`docs/release/synthwave-city.safe.html`](docs/release/synthwave-city.safe.html) | 22,333 | The same program as plain ASCII (base64), for anything that damages the first file. |

The first file is not text. An editor shows noise, and pasting it somewhere breaks it.

It needs WebGL2 and `DecompressionStream` (available across browsers since May 2023, according to
MDN); without WebGL2 it says so. Any static host works if it sends the file as `text/html`; a server
that sends no `Content-Type` at all makes Chromium show the file as text. On a phone, copy the file
with something that sends files as files (a download, a USB copy, a file-sharing app) and open it
from the file manager with Chrome.

Within a quality level the render scale drops when frames run long. The touch buttons fade after a
few seconds and come back on a touch.

## The pipeline

The sources are TypeScript and GLSL under `src/`. The build bundles them with esbuild, minifies the
shaders with the in-repo `tools/glslmin` and the JavaScript with terser, deflates with zopfli and
writes the container with `tools/pack`. Design and reasons: [architecture.md](architecture.md).

```
npm run build      # dist/synthwave-city.html and .safe.html; prints the size
npm run check      # types, unit tests, import rules, plan ownership
npm run verify     # packed build against the unminified sources, pixel for pixel, on the GPU
npm run smoke      # the packed file boots from file:// with no errors
npm run size       # what each module costs in the final file
npm run input      # the camera's listeners under scripted mouse and touch events
npm run steady     # car lights steady from frame to frame on the software rasteriser
```

Playwright's cached Chromium is used for the browser checks; the scripts find it themselves.
`docs/release/` holds a copy of the last build; it should be byte-identical to `dist/`.

## What the bytes buy

The features were cut one at a time, from the least missed to the most, and each version was built,
booted and photographed. Every one still passes the checklist below as far as it could be judged
here; the table with pictures and the judgement per rung is in [SIZE.md](SIZE.md).

| Bytes | What this version gives up (each row also gives up everything above it) |
|---|---|
| **17,208** | Nothing: the shipped file |
| 16,880 | Messages naming each action, the key list on the start card, fullscreen, hiding the interface |
| 16,246 | Free flight; the drone tour and drag-to-look stay |
| 16,086 | The midnight and miami moods |
| 16,038 | The second music track |
| 15,790 | The touch buttons and the quality keys |
| 14,714 | Holographic billboards and signs with invented words |
| 14,336 | People on the sidewalks |
| 14,208 | Street lamps |
| 14,120 | Film grain, scanlines, vignette, colour fringing |
| 13,814 | Stars and the wireframe mountains |
| 13,686 | Reflections in the wet road |
| 12,836 | Searchlights, beacon pillars, laser fans |
| 12,572 | Shop fronts, sign panels, equaliser facades and roof details on the towers |
| **12,396** | The lead melody, toms and swells; kick, snare, hats, bass and chords stay |

The checklist ("still Synthwave City"): the tour runs without end and without a visible edge or pop;
towers are lit with window grids and neon trim, with a megatower in most views; flying traffic moves
in lanes between the towers; streets carry moving traffic with head and tail lights; the sky has the
striped sun and the frame has bloom and fog; at least one music track plays and the city pulses with
it; it runs from one file on a PC and on a phone.

About 12.4 kB keeps the experience as the checklist defines it; the other 4.8 kB buy free flight, the
moods, the second track, the touch controls and the richer light show. **The operator chose the full
17,208-byte build as the release (2026-11-19).** The smallest rung is kept as
[`docs/release/ladder/synthwave-city-r14.html`](docs/release/ladder/synthwave-city-r14.html); it was
built before the track order was swapped, so its one track is the 104 bpm one that now plays second
in the full build.

A stronger compressor (Roadroller 2.1.0, a context-mixing packer) makes the file 12.6% smaller, but
the page then takes 0.9 s to start on this desktop and over 4 s with the CPU slowed four times, so it
is not used. Start-up of the shipped file is about 0.1 s on this desktop and about 0.47 s with the CPU
slowed six times.

## What was tested, and what was not

Tested here:

- the file boots, reports no errors and draws (`npm run smoke`), and its frame clock held the
  headless browser's 8 ms tick at 1920x1080;
- the packed build draws exactly the same pixels as the unminified sources in four views, for the
  render layers and post-processing (`npm run verify`; the app shell, audio and camera are not part of
  that comparison);
- after a click the audio context runs, notes are scheduled, and the beat values the city reads move
  at the first track's tempo (a script, not a listening test);
- losing the WebGL context shows a notice, stops drawing, and reloads the page when the context
  returns (a script using `WEBGL_lose_context`);
- the container format, earlier in the project, also in Chrome 157, Edge 157 and Brave 158, from disk
  and over HTTP with several charset headers.

Not tested here: Firefox and Safari (nothing in this repository runs them), any real phone or tablet
(phone-sized pictures and start-up times under CPU throttling are desktop stand-ins), and frame rate
on any GPU other than this one.

The screenshots in the README were taken on this desktop at 1280x720 during the art pass, before the
squeeze, which changed no pixel (`npm run verify`), and re-encoded as JPEG.

## Play tests

**2026-11-19, first.** The operator found three defects in the 17,146-byte build: the drag turned the
view the wrong way, a finger did not fly forward in free flight, and the headlights flickered in
step. All three were fixed for 62 bytes ([plans/T15-playtest-fixes.md](plans/T15-playtest-fixes.md)).
The flicker never showed on this desktop's GPU; it was reproduced and fixed on Chromium's software
rasteriser. On re-testing, the operator reported the flicker gone and the camera working as expected
(device and browser not recorded).

**2026-11-19, second.** The operator judged both tracks good and asked for the second to play first;
the two were swapped at no cost in bytes ([plans/T16-track-order-docs.md](plans/T16-track-order-docs.md)).

## Credits

- [Synthwave City](https://github.com/highsierralabs/Synthwave_City), the three.js original this file
  rebuilds; its pictures were the reference for the look.
- Two single-file WebGPU demos prompted the idea of doing it in one file:
  [Afterglow City](https://github.com/J-o-h-n-M/afterglow-city) by J-o-h-n-M (127,617 bytes) and
  [Abyssal Garden](https://github.com/Noniv/abyssal-garden) by Noniv (99,514 bytes), which Afterglow
  City is based on. No code is taken from either.
- The packer measurement used [Roadroller](https://github.com/lifthrasiir/roadroller) 2.1.0 by Kang
  Seonghoon, run in a scratch folder; it is not part of the build.

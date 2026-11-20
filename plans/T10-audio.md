---
id: T10-audio
title: Two stations and the beat
status: done
depends_on: [T00]
owns: [src/audio/**, plans/T10-audio.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/engine.ts]
budget: 3400
executor: opus/medium
updated: 2026-11-19
---

# T10: audio

## 1. Purpose

The soundtrack: synthwave that starts when the viewer first touches the page and never ends, with two
stations to switch between, and a beat the whole city pulses to. No sample, no file: oscillators,
noise, filters and a scheduler.

## 2. Context and orientation

Read §7, §10.2 (the `uTime` and `uMix` slots) and the Web Audio section of Agents.md.
`src/audio/index.ts` exists as a stub with the final export signatures; keep them. The app shell
(T12, written at the same time) calls `audioStart()` from inside the first gesture, `audioMute()` and
`audioStation()` from keys and buttons, and `audioHidden(hidden)` when the tab is hidden or shown.

While music plays, this module is the beat source: it registers an update with `addUpdate` and each
frame writes `F[U_TIME + 2]` (beats since the start, modulo 64, as a float with the fraction being
the position inside the beat), `F[U_TIME + 3]` (a pulse that is 1 on the beat and falls to 0 before
the next), and `F[U_MIX]` to `F[U_MIX + 3]` (kick, bass and lead levels as smooth envelopes in 0..1,
and the station index). Derive them from `AudioContext.currentTime` and the schedule, not from an
analyser, so they are exact and cost nothing. When audio is not running the engine fills the same
slots from its own clock at `BPM0`; when you start, take over from the engine without a visible jump
if that is cheap, and do not worry if it is not.

A **station** is data: tempo, root note, scale, a chord progression, pattern seeds and a few patch
numbers. Bars are generated one at a time from the station's seed and the bar number, so the music is
endless but has structure: sections of 8 or 16 bars, drums dropping out and returning, a lead that
comes and goes. Write the engine once and the two stations as two short rows of numbers.

This module ships in the file and has the largest budget of any, so read Agents.md, "Writing for the
packer", before writing it. Voices should share one envelope helper and one note-to-frequency helper.

## 3. Scope

Owned: `src/audio/**`.

Must have: kick, snare or clap, closed hat; a sixteenth-note bass arpeggio; a pad playing the chords,
ducked by the kick; a lead with a feedback delay; a reverb from a generated noise impulse; a
compressor on the master bus; two stations that are clearly different (for example 104 bpm in a minor
key, warm and slow; 124 bpm, brighter and driving); mute; station change without clicks; suspend and
resume on hidden and shown without a burst of late notes.

Optional, cut first if over budget, in this order: a second lead patch, tom fills at section ends,
vinyl or city-hum noise bed, a filter sweep into each section.

Not in scope: any interface (T12), any visual.

## 4. Interfaces

Consumes: `addUpdate` from `src/engine.ts`; `F`, `U_TIME`, `U_MIX` from `src/contracts.ts`.

Provides the `audio` row of §10.4, exactly as in the stub.

## 5. Plan of work

**M1. A way to hear it without ears.** You cannot listen. Build the graph in a function that takes
any `BaseAudioContext`, so that under `DEV` the same code renders into an `OfflineAudioContext`.
Write a scratch script under `.tmp/T10/` (Playwright, cached Chromium, a page that imports the
unminified module) that renders 60 seconds of each station offline, writes each as a WAV into
`shots/T10/` for the operator, and prints measurements: peak and RMS level, energy in a few bands
(below 120 Hz, 120 to 500, 500 to 2 k, above 2 k), and the onset times of the kick against the
schedule. *Proof:* the measurements, in this plan.

**M2. Scheduler and drums.** Lookahead scheduling as Agents.md describes. *Proof:* kick onsets within
a millisecond or two of the grid in the offline render; no growth in live node count over two
minutes of real-time playback (count nodes created against nodes ended under `DEV`).

**M3. Bass, pad, lead, effects, the two stations.** *Proof:* the band energies show bass, mids and
highs all present; peak at or under -6 dBFS; the two stations differ in tempo and in spectrum.

**M4. Beat slots.** *Proof:* in a real-time page, log `F[U_TIME + 2]`, `F[U_TIME + 3]` and `F[U_MIX]`
for ten seconds: the beat count rises at the station's tempo, the pulse peaks on each beat, the kick
level follows the kick pattern.

**M5. Mute, station change, hidden and shown.** *Proof:* scripted in the scratch page with no
exception and no late-note burst (the scheduler's next-note time is ahead of `currentTime` after
resuming).

**M6. Measure.** `npm run size -- audio`; trim or cut toward the budget.

## 6. Validation and acceptance

- The measurements of M1 to M5 are in this plan, and the two WAV files exist in `shots/T10/`.
- A real `AudioContext` in headless Chromium needs the launch flag
  `--autoplay-policy=no-user-gesture-required`; say whether you used it or dispatched a real click.
- No exception on the console in any scripted scenario.
- `npm run check:task -- T10` exits 0. Measured bytes are recorded against the budget.

Human checks, which decide whether this task succeeded: the operator listens to the two WAV files,
and to the page on a phone speaker. Nothing an agent can measure says the music is good; say so in
Outcomes and describe what you composed (key, progression, pattern) so the operator knows what to
expect.

## 7. Idempotence and recovery

Scratch in `.tmp/T10/`, renders in `shots/T10/`. Both can be deleted at any time.

## 8. Progress

- [x] 2026-11-18 Read Agents.md, architecture.md (sections 3, 4, 5.3, 7, 10, 11, 12), this plan,
  src/engine.ts, src/contracts.ts, scripts/lib/browser.mjs and bundle.mjs. Status set to in-progress.
- [x] 2026-11-18 M1: `src/audio/synth.ts` builds the graph on any `BaseAudioContext`. Scratch
  `.tmp/T10/offline.ts` + `render.mjs` + `analyse.mjs` render 60 s of each station into an
  `OfflineAudioContext` in the cached Chromium, write `shots/T10/station0.wav` and `station1.wav`, and
  print peak, RMS, band shares, RMS per second and kick onset errors (kick-only render, DEV `setMask`).
- [x] 2026-11-18 M2: lookahead scheduler (25 ms timer, 100 ms ahead), kick, snare (noise, bandpass),
  closed hats. Kick onsets: constant +6.2 ms, spread 0.1 ms (evidence below).
- [x] 2026-11-18 M3: sixteenth bass arpeggio, pad (3 chord tones x 2 detuned saws) ducked by the kick,
  lead with feedback delay, convolution reverb from a generated noise impulse, compressor and master
  gain, two stations as two 17-character rows.
- [x] 2026-11-18 M4: `beat()` registered with `addUpdate` writes F[U_TIME+2..3] and F[U_MIX..+3] from
  `currentTime` and a ring of what was scheduled. Logged 10 s in a real page (evidence below).
- [x] 2026-11-18 M5: mute, station change, hidden and shown scripted in `.tmp/T10/live.mjs`, then
  2 minutes of real-time playback with node counts. No exception.
- [x] 2026-11-18 Optional items, all four built (well under budget): second lead patch (part 3, octave
  up, other wave), tom fills on a section's last bar, a low noise bed (one soft lowpassed noise swell
  per bar), a noise riser into each section.
- [x] 2026-11-18 M6: `npm run size -- audio` = 1,606 bytes against 3,400.
- [x] 2026-11-18 Packed-build check (`.tmp/T10/packed.mjs`): `dist/synthwave-city.safe.html` boots, a
  click starts audio, `R` and `M` run without error. The UTF-16 `dist/synthwave-city.html` fails to
  boot in this session for a reason outside T10 (see Surprises).
- [x] 2026-11-19 Reopened and closed by T16 (plans/T16-track-order-docs.md), by the orchestrator, at
  the operator's request: the two rows of `ROWS` swapped, so the 124 bpm D major track plays first.
  0 bytes; the beat probe measures 124 bpm after the click.
## 9. Surprises and discoveries

- Kick onsets in the offline render are 6.2 ms after their scheduled time, every one (spread 0.1 ms).
  Inferred cause: the `DynamicsCompressorNode`'s fixed look-ahead delay (Chromium's compressor delays
  its signal by about 6 ms [M]; not isolated by a render without the compressor). It is constant, so
  the grid is exact; the picture's beat leads the sound by 6 ms, which nobody can see.
- First live run: a station change made the picture's beat step back 0.08 beats, because `begin()`
  computed the wait with the old tempo and then counted with the new one. Fixed by setting the new
  tempo first; the re-run showed 21.856 -> 21.999 across the change (forward, at the new tempo).
- The packed UTF-16 file `dist/synthwave-city.html` fails in this session with `pageerror: Failed to
  fetch`, and `node scripts/smoke.mjs --no-build` times out (`SMOKE FAILED`), with or without T10's
  scratch init script. The ASCII variant `synthwave-city.safe.html` of the same build runs. Not in
  T10's paths (container or a sibling's state); not investigated, per the parallel-work rules.
- `npm run size -- audio` measures all four exports: T12's `src/main.ts` already calls `audioStart`,
  `audioMute`, `audioStation` and `audioHidden`, so none was tree-shaken.

## 10. Decision log

- 2026-11-18: The synth lives in `src/audio/synth.ts`, working on any `BaseAudioContext`;
  `src/audio/index.ts` keeps exactly the four stub exports and holds only the live context and timer.
  Reason: the offline measurement page imports synth.ts directly, so no DEV hook has to ship. The
  DEV-only exports in synth.ts (`setMask`, `kicks`, `made`, `ended`, `next`) are unused by the product
  and absent from `dist/app.js` (grep: no `onended`, `setMask`, `kicks`).
- 2026-11-18: Each station change builds a fresh bus with its own reverb and delay (`chain()`) and
  fades the old bus out (time constant 50 ms), disconnecting it after 1 s. Reason: no clicks and no old
  pad chord ringing into the new station, without tracking voices. Cost: one convolver per change.
- 2026-11-18: A station starts on the picture's next beat at least 0.1 s ahead, at the new tempo from
  the moment of the call, and the beat count continues from what the picture shows (`base`), so
  neither the first start nor a change makes the beat jump.
- 2026-11-18: Hidden and shown: `suspend()` and `resume()` plus stopping and restarting the timer. The
  audio clock stops while suspended, so the next-step time stays ahead of `currentTime` and nothing
  has to be reset. As a second guard `pump()` skips (does not play) any step already in the past, so a
  throttled timer can never cause a burst of late notes.
- 2026-11-18: Mute ramps the master gain (time constant 30 ms) and keeps the scheduler running, so
  the city still pulses to the beat while muted. Muting before the first start is honoured.
- 2026-11-18: Levels in F: kick, bass and lead are the scheduled velocities decaying exponentially
  (rates per sixteenth 1.5, 0.5, 0.3), read from a 32-step ring per channel. The pulse uses the
  engine's own shape `(1 - frac)^2` so the hand-over looks the same.
- 2026-11-18: Master `LEVEL` 0.42 after the compressor (which adds make-up gain): peak -7.5 and -7.9
  dBFS in the two renders, under the -6 dBFS ceiling with 1.5 dB of margin.
- 2026-11-18: Built all four optional items, since the must-haves came in at about 1,500 bytes.

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

**What was composed** (so the operator knows what to expect):

- Station 0, "warm": 104 bpm, A natural minor, progression Am F C G (i VI III VII), one chord per bar.
  8-bar sections cycling through four parts: 0 kick, snare, hats, bass, pad; 1 adds the lead; 2 is a
  breakdown (pad, hats, lead; no kick, snare or bass); 3 is full, with the lead an octave up on the
  other wave. Bass: sawtooth sixteenths on the chord root with octave and fifth jumps from a fixed
  per-station pattern, low cutoff (360 Hz). Lead: sawtooth, chord tones (root, 3rd, 5th, 7th) on
  eighths, a motif that repeats every 2 bars and changes per section, dotted-eighth echo. Few extra
  hats (30 %).
- Station 1, "bright, driving": 124 bpm, D major, progression Bm G D A (vi IV I V), 16-bar sections,
  square-wave lead, filters 2.5 times brighter, extra sixteenth hats at 70 %.
- Both: triangle kick with a pitch drop (150 -> 50 Hz; a triangle has harmonics at 150 and 250 Hz for
  phone speakers), noise snare through a falling bandpass, highpassed noise hats, a pad of three chord
  tones as six detuned saws ducked by the kick, reverb from a 3 s noise impulse, snare roll and
  falling toms on a section's last bar, a noise riser into each section, a soft low noise swell each
  bar.

**Acceptance evidence.** Offline renders: `node .tmp/T10/render.mjs 60`. Live: `node .tmp/T10/live.mjs 120`.
Both in the cached headless Chromium with the GPU flags. The live page was started by a real
Playwright mouse click dispatching `pointerup`, **not** by `--autoplay-policy=no-user-gesture-required`;
the context reported `state: 'running'`.

```
station 0 (60 s): peak -7.5 dBFS, RMS -25.5 dBFS, 0 samples over 1.0, 780 sources
  band share: <120 53.4%  120-500 35.4%  500-2k 9.2%  >2k 2.0%
  per 10 s window (dB re total, same bands): 40 s window [-50.4 -18.7 -18.0 -25.9] = the breakdown
station 1 (60 s): peak -7.9 dBFS, RMS -23.6 dBFS, 0 samples over 1.0, 1361 sources
  band share: <120 55.5%  120-500 29.1%  500-2k 12.5%  >2k 2.9%
  500-2k rises from -19.8 to -15.2 dB at the 30 s window = the lead entering at bar 16
kick-only renders: station 0 71 of 71 onsets, onset - schedule min 6.21 max 6.28 ms
                   station 1 123 of 123 onsets, min 6.21 max 6.32 ms
live, 10 s: 1313 frames; beats 2.979 -> 20.867 over 10.320 s of audio = 104.00 bpm
  18 beat crossings; pulse on the first frame after a crossing min 0.964, mean 0.979
  mean kick level by quarter of the beat: 0.491 0.109 0.024 0.005
  mean bass level 0.533; lead 0.000 (part 0 of station 0 has no lead, by design); station 0
mute -> true, unmute -> false, no error
station -> 1: beat 21.856 before, 21.999 shortly after; F[U_MIX+3] 0 -> 1
hidden: state 'suspended', currentTime frozen at 13.98 for 3 s; shown: state 'running',
  next step - currentTime = 0.156 s, then 0.115 s one second later (ahead: no late burst)
live nodes (sources started - ended), every 20 s for 2 min after that: 38, 30, 31, 33, 29, 28, 33, 45
console errors [] warnings [] in every scenario
packed safe.html: click -> AudioContext 'running', R and M pressed, errors []
npm run check:task -- T10: typecheck 0 errors in T10, import rules 0, plan 0 problems, PASS
npm run size -- audio: 1,606 bytes (budget 3,400)
```

WAV files: `shots/T10/station0.wav` and `shots/T10/station1.wav` (60 s, 44.1 kHz, 16-bit stereo).

**Bytes:** 1,606 of 3,400. If cuts are ever needed (estimates, not measured one by one): each optional
item (riser, bed, toms, second lead patch) is a few tens of bytes, since it reuses `voice()`; the
per-station `chain()` rebuild could become one fixed graph with a master dip on change (perhaps 60 to
100 bytes, at the cost of the old pad ringing on into the new station).

**Not verified:** whether the music is good. Nothing measured here says so; the operator's listening
to the two WAVs and to the page on a phone speaker decides it. The phone speaker itself. Station 1's
later sections (breakdown from about 62 s, part 3 from about 93 s) were not rendered, only reasoned.
The compressor as the cause of the 6 ms onset offset. The UTF-16 packed file (it failed to boot in
this session for a reason outside T10). Lead and bass levels in F during a lead section, live (the
10 s live log covered part 0 only). Sessions longer than about 2.5 minutes. Frame-time effects: the
machine is shared with eight other executors, and nothing was timed. There is no visual output of
this module, so no screenshots were taken.

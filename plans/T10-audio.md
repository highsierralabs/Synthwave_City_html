---
id: T10-audio
title: Two stations and the beat
status: ready
depends_on: [T00]
owns: [src/audio/**, plans/T10-audio.md]
reads: [architecture.md, Agents.md, src/contracts.ts, src/engine.ts]
budget: 3400
executor: opus/medium
updated: 2026-11-18
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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

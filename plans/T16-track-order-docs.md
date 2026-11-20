---
id: T16-track-order-docs
title: Track order, the size decision, a laconic README
status: done
depends_on: [T10, T14, T15]
owns: [plans/T16-track-order-docs.md, BUILD.md]
reads: [architecture.md, Agents.md, src/audio/**, docs/release/**, SIZE.md, README.md, ../Laconic_tests/directive/laconic_v2.md]
budget: 0            # packed bytes added to the shipped file
executor: orchestrator
updated: 2026-11-19
---

# T16: Track order, the size decision, a laconic README

## 1. Purpose

The operator's second round of feedback, 2026-11-19, verbatim: "Music: The two tracks are good. Just
switch the track order. Track 2 should play first. Smallest version: I'm happy with the build size
for all the features that it includes. The read me is a little long. Apply laconic principles to the
readme. Move the minutiae of the build to a separate document."

After this task the 124 bpm D major track plays first and `R` steps to the 104 bpm A minor one; the
full 17,208-byte build is recorded as the chosen release; `README.md` says what the file is, how to
run and control it, its status and how to build it, and `BUILD.md` holds the rest.

## 2. Context and orientation

- The stations are two rows of one string, `ROWS` in `src/audio/synth.ts` (plan T10); the current
  station `cur` indexes the row and starts at 0. Everything a station plays, its pattern seed
  included, is read from its row, so swapping the rows swaps the tracks whole. `F[U_MIX + 3]` carries
  `cur` to the shaders, and no shader reads it (`uMix.w`); the toast reads "Station" + (`cur` + 1).
- "Laconic principles" is the operator's own directive, `Laconic_tests/directive/laconic_v2.md`:
  lead with the result, keep what would change an action, drop the rest, honest unknowns stay.
- `README.md` and `SIZE.md` are owned by T14, `src/audio/**` by T10; this task edits them as the
  orchestrator and leaves a Progress line in each owning plan.

## 3. Scope

In: the row swap, the ladder script's one-station rung, rebuilt release files, the README rewrite,
the new `BUILD.md`, the records. Out: rebuilding the ladder (the operator closed the size question;
see the Decision log), any change to the tracks themselves, `BPM0`.

## 4. Interfaces

None changed. Station numbers in the toast and the `R` key behave as before; only which track is
station 1 changed.

## 5. Plan of work

M1. Swap the rows and their comment table; patch rung r04 of `ladder.mjs` (both copies) to keep the
new first row. M2. Build, gates, beat probe, release copies. M3. README and BUILD.md. M4. Records.

## 6. Validation and acceptance

- `npm run build`: 17,208 bytes, change 0. `npm run check`: `CHECK OK`.
- `npm run smoke -- --no-build --file docs/release/synthwave-city.html`: `SMOKE OK`.
- `.tmp/T14/beat.mjs` (copy of `docs/release/scripts/beat.mjs`) on the release file: about 6.2 beats
  in the last 3 s after the click (124 bpm), against about 5.2 (104 bpm) before.
- `DRY=1 node .tmp/T14/ladder.mjs 0 14`: every rung's edits apply and type-check.
- `docs/release/synthwave-city.html` byte-identical to `dist/`.

## 7. Idempotence and recovery

All commands can be re-run. Reverting this task's commit restores the old track order and README.

## 8. Progress

- [x] 2026-11-19 M1. Rows swapped; comment table reordered; r04 now keeps `'|&024579;5304751@'`.
- [x] 2026-11-19 M2. Build 17,208 bytes, change 0 (the release file differs from the previous one in
  content, not size). `CHECK OK` (115 tests). `SMOKE OK`, 635 frames in 5 s, median 8.0 ms. Beat
  probe after a click: F beat 2.880..9.080 over 3 s (6.20 beats, 124 bpm), 79 sources in 4 s; the
  previous build measured the same way: 2.533..7.733 (5.20 beats, 104 bpm), 62 sources. Ladder dry
  run: r00 to r14 edits ok, typecheck ok. `cmp dist docs/release`: identical.
- [x] 2026-11-19 M3. README from 177 lines to 71; BUILD.md takes the file format, serving, pipeline
  and every gate, the ladder table and checklist, the packer and start-up measurements, what was
  tested and not, the play tests and the full credits.
- [x] 2026-11-19 M4. SIZE.md, architecture.md, plans T10 and T14, plans/README.md.

## 9. Surprises and discoveries

- On resuming, `plans/T15-playtest-fixes.md` in the working tree held its older text (identical to
  commit `05653a3`), undoing the re-test record of commit `32a475f`. It was restored from `HEAD`;
  nothing was lost. What rewrote it is not known.

## 10. Decision log

- 2026-11-19. **Swap the rows, not the starting index.** Starting at `cur = 1` would play the right
  track first but call it "Station 2" after the first `R`. With the rows swapped, the track that plays
  first is station 1. Same bytes.
- 2026-11-19. **`BPM0` stays 104.** It is the picture's beat before sound starts; the music aligns to
  the picture's next beat when it starts, as it does on every station change.
- 2026-11-19. **The ladder is not rebuilt.** The operator chose the full build, so the ladder is a
  record of the question answered. Its script is patched so a rebuild would keep the track that now
  plays first; `synthwave-city-r14.html` still carries the 104 bpm track, as BUILD.md says.
- 2026-11-19. **README keeps the pictures, run instructions, controls, status, build and credits;**
  everything else moves to `BUILD.md`, a new file owned here. `SIZE.md` stays the size ledger.

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

Tracks swapped at 0 bytes; 124 bpm plays first (observed by the beat probe, not by ear). The size
question is closed with the full build. README 71 lines, BUILD.md the detail. Not verified: the new
order by ear or on the operator's device; the ladder files were not rebuilt.

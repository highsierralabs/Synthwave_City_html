---
id: T02-glslmin
title: Shader minifier
status: done
depends_on: []
owns: [tools/glslmin/**, tests/glslmin/**, plans/T02-glslmin.md]
reads: [architecture.md, Agents.md, src/common.glsl]
budget: 0
executor: opus/high
updated: 2026-11-18
---

# T02: glslmin

## 1. Purpose

About half the shipped text is GLSL. This tool makes it as small as it can be without changing what
it draws, so shader authors can write long names and comments for free.

## 2. Context and orientation

Shaders are `.glsl` files under `src/`. At run time every program's source is
`header + common.glsl + the shader's own text` (§10.5), where the header is `#version 300 es`, the
precision lines and, for fragment shaders, `#define FS`. The header is added in JavaScript and never
passes through this tool, so the tool sees **fragments**, not complete shaders: `common.glsl` on its
own, and each shader body on its own, each referring to names the other declares.

That is why the rename map must be **global**: one identifier, one short name, in every file. Then a
varying matches between a vertex and a fragment shader, a call in a body matches its definition in
the common chunk, and the uniform block's members agree everywhere.

Names JavaScript knows are reserved and must come through unchanged (§10.6): `F`, `T0`–`T7`,
`X0`–`X3`, `FS`, `main`. So must every GLSL ES 3.00 keyword, built-in function, built-in variable
(`gl_*`) and type, and anything after a `.` (swizzles and struct fields cannot be told apart, so
neither is renamed; struct field declarations therefore keep their names too).

`tools/glslmin/index.mjs` exists as a stub with the final signature. Keep the signature.

## 3. Scope

Owned: `tools/glslmin/**`, `tests/glslmin/**`. Tests are `.test.mjs` files run by Vitest.

Not in scope: the build script that calls this tool, and any shader under `src/`. A full GLSL parser
is not required and not wanted: a tokenizer and a declaration finder are enough, and the pixel gate
(`npm run verify`, T00) catches what they miss.

## 4. Interfaces

Provides, from `tools/glslmin/index.mjs` (the stub's comments are the contract):

`minifyShaders(sources, options)` returning `{ out, names }`: `sources` maps a path to GLSL text, all
of them minified together; `out` maps the same paths to minified text; `names` is the rename map, for
debugging. Options: `rename` (default true; false gives strip-only output, the build's fallback),
`reserved` (extra names to leave alone).

## 5. Plan of work

**M1. Tokenizer and strip.** Tokens: identifiers, numbers (decimal, hex, `u` suffix, exponents,
leading or trailing dot), operators, punctuation, preprocessor lines, comments, space. Output drops
comments and every space that is not needed to keep two tokens apart, keeps each preprocessor line
on its own line with a newline before and after, and shortens float literals (`1.0` to `1.`, `0.5` to
`.5`, `10.0` to `10.`) without ever turning a float into an int or touching an int, hex or `u`
literal. Unit tests for each token kind and for the dangerous joins (`a - -b`, `a + +b`, `1. .x` is
not valid but `1..xx` must not be produced, `x / *y`, a number before an identifier).

**M2. Declarations and renaming.** Find declared names: variables (including several in one
statement, array declarators, `for` loop variables), function names and parameters, struct type
names, block member names inside `uniform NAME { ... }`, `#define` macro names and their parameters,
`in`/`out`/`uniform`/`const` globals with and without `layout(...)` and qualifiers such as `flat`.
Collect them over all sources, count uses, and give the most used the shortest names. Generated names
must not be keywords, built-ins, reserved names, or any identifier that appears in the sources and is
not being renamed. A name is renamed everywhere it appears as an identifier token, except after `.`
and inside the name position of a preprocessor directive that is not a macro you renamed
(`#ifdef FS` stays).

**M3. Prove it on the GPU.** `tools/glslmin/browser-test.mjs` (Playwright, cached Chromium): for a
corpus of complete programs, compile and link the original and the minified version and require both
to succeed; then draw each pair with fixed uniforms and require identical pixels. The corpus is
`src/common.glsl` as it stands plus fixtures you write under `tests/glslmin/fixtures/` that exercise
what real shaders here will use: the uniform block, instanced attributes with `layout(location=n)`,
`flat` varyings, `gl_VertexID` and `gl_InstanceID`, integer hashes with hex and `u` literals, array
constructors, `#ifdef FS` / `#else` / `#endif`, a macro with arguments, `for` loops, ternaries,
`out` parameters, overloaded functions, a struct. Overloads matter: two functions with one name must
keep one name.

**M4. Optional, measured.** Removing functions and globals that no source refers to; reusing the same
short names for locals in different functions when that makes the deflated output smaller. Keep each
only if a deflate of the realistic corpus gets smaller and M3 still passes.

## 6. Validation and acceptance

- `npx vitest run tests/glslmin` passes. One renaming test was seen to fail first.
- `node tools/glslmin/browser-test.mjs` reports every corpus program compiling, linking and drawing
  identical pixels before and after, and prints the renderer string.
- The plan records, for the corpus: bytes of source, bytes strip-only, bytes renamed, and each of
  those after `deflateRawSync` level 9.
- Minifying the same input twice gives identical output.
- Known limits are written down under Outcomes, as rules a shader author must follow.

Human checks: none.

## 7. Idempotence and recovery

A pure function; scratch output under `.tmp/T02/`. Safe to re-run.

## 8. Progress

- [x] 2026-11-18 Status set to in-progress. Read Agents.md, architecture.md (sections 3, 10, 13, 14),
  this plan, `src/common.glsl` and the `src/gl.ts` stub (header not written yet by T00).
- [x] 2026-11-18 M1: `tools/glslmin/lex.mjs` (tokenizer, `needSpace`, `shortFloat`) and the emitter in
  `index.mjs`; `tests/glslmin/lex.test.mjs`, 19 tests passing.
- [x] 2026-11-18 Renaming tests (`tests/glslmin/rename.test.mjs`) written first and run against the
  strip-only `index.mjs`: 11 failed (8 renaming, plus 3 M1 expectations of mine that were wrong; see
  Surprises).
- [x] 2026-11-18 M2: declaration finder and global rename map in `index.mjs`, names in `names.mjs`;
  31 of 31 tests pass.
- [x] 2026-11-18 Object-like macros now always get a space before their body (see Surprises).
- [x] 2026-11-18 M3: seven fixture programs under `tests/glslmin/fixtures/` (`programs.json` lists
  them), `tools/glslmin/corpus.mjs` (corpus loader and the assembly prog() in `src/gl.ts` uses, header
  read from that file), `tools/glslmin/chromium.mjs` (own finder for the cached Chromium),
  `tools/glslmin/browser-test.mjs`. All variants identical; the mutant is caught.
- [x] 2026-11-18 Size table: `tools/glslmin/size.mjs`.
- [x] 2026-11-18 M4, dead code: `tools/glslmin/prune.mjs`, option `prune` (default true); 5 tests in
  `tests/glslmin/prune.test.mjs`. Kept: smaller deflated, M3 still passes.
- [x] 2026-11-18 M4, reusing short names for locals per function: measured an upper bound and not
  built (see Decision log).
- [x] 2026-11-18 Browser test extended to compile and link every real `.glsl` under `src/` and `dev/`
  (T00's probe and gltest shaders, `src/engine.glsl`) before and after minifying.
- [x] 2026-11-18 Null directive (`#` alone) fixed in the rename pass, with a test; corpus tests in
  `tests/glslmin/corpus.test.mjs`. 42 of 42 tests pass.
- [x] 2026-11-18 Ran T00's `npm run build` and `npm run verify` with this tool in place: both pass.
- [ ] Not possible: `npm run check:task -- T02` and `npm run plans:check`; `scripts/check-task.mjs` and
  `scripts/plans-check.mjs` do not exist yet (T00 owns them).

## 9. Surprises and discoveries

- Three of my own M1 expectations were wrong and the tool was right: `100.0` is shortest as `1e2`
  (3 bytes, not `100.`), the space in `#define M(a,b) ((a)+(b))` after the parameter list is not
  needed, and `a-- - b` joins safely as `a---b` under maximal munch.
- A C-style preprocessor reads a number and any following letter, digit, `_` or `.` as one
  *pp-number*, so `1.0.xx` would be one bad token. `needSpace` now always separates a number from
  those (and an `e`/`E` from `+`/`-`), so `1.0.xx` becomes `1. .xx`, never `1..xx`.
- Preprocessor directive words (`line`, `version`, `define`...) are not reserved as identifiers; first
  listing them as built-ins left `common.glsl`'s `line()` unrenamed. Removed; `defined` stays.
- `#define NEG -1.0` was first written as `#define aI-1.`. ANGLE accepted it and drew the same
  pixels, but C99 6.10.3 requires white space after an object-like macro's name, so another
  preprocessor could reject it. The emitter now always writes the space (costs one byte a macro).
- Everything the riskiest joins produce was accepted by ANGLE on D3D11 and drew identical bits:
  `return.5`, `g+++ ++g` (from `x++ + ++x`), `b--- --m`, `b---m`, `case 0:`, `a- -b`, `+ +a`,
  a body starting with `\n#ifdef FS`, `1e5`, `15e-6`, `602214076e15`, `117549435e-46` [O].
- `src/common.glsl` changed under me (T00, 8403 to 8656 bytes) between runs; the corpus is read fresh
  each run, and every run after the change passed.
- `dev/gltest/all.glsl` (T00) calls every function in the common chunk, so with `dev/` included
  nothing is pruned; pruning shows only in the shipped build, which leaves `dev/` out.
- `dev/gltest/c.glsl` (T00) prints ANGLE "dynamic indexing ... emulated" and D3D "X4000 potentially
  uninitialized variable" warnings, the same before and after minifying. Not a minifier effect; no
  fixture prints any warning.

## 10. Decision log

- 2026-11-18. An identifier the sources keep is forbidden as a generated name only if it appears
  somewhere *not* after a `.`. Swizzles (`x`, `xy`, `rgb`) live in another namespace, and forbidding
  them would cost 12 of the 52 one-letter names.
- 2026-11-18. Interface block names (`F` and any other) are never renamed: JavaScript binds blocks by
  name. Members of a block without an instance name are renamed; with one, they are kept like
  struct fields.
- 2026-11-18. Every directive gets a newline before it, even at the start of a fragment, and one
  after it, even at the end. That costs at most two bytes a file and makes the output safe however
  `gl.ts` joins header, common and body. The browser test proves both the real join (`"\n"`) and none.
- 2026-11-18. Numbers are kept apart from a following letter, digit, `_` or `.` as C pp-numbers,
  even where a GLSL lexer would not need it. Costs nothing in valid code except `1. .xx`-like forms.
- 2026-11-18. Float literals become the shortest text with the same *decimal* value (`100.0` to
  `1e2`, plain form on a tie). Proven bit-exact on ANGLE/D3D11 for 24 values; other compilers rely
  on correctly rounded decimal parsing [I].
- 2026-11-18. Pruning is on by default (option `prune: false` turns it off; `rename: false` implies
  it). The build already passes every shader in one call (`scripts/lib/bundle.mjs`), which is the
  condition for it. Measured: corpus deflated 3063 to 2990 bytes (-73), raw 6678 to 6451 (-227).
- 2026-11-18. The result gained a third field, `removed` (names pruned). Additive; callers that read
  `{ out, names }` are unaffected (`bundle.mjs` is one, and the build and verify pass with it).
- 2026-11-18. Not built: reusing short names for locals per function scope. Upper bound measured on
  the corpus: the 73 names longer than one character spend 171 bytes beyond one character each
  (2.7% of the 6451-byte output, before deflate, which shrinks it further). Scope analysis that
  stays safe with macros is the risky part. A candidate for T14 once real layers exist.

## 11. Contract change requests

None. The `minifyShaders(sources, options)` signature is kept; `options.prune` and the result's
`removed` field are additions.

## 12. Outcomes and retrospective

**Result.** `tools/glslmin` minifies all shaders in one call with one global rename map: comments and
needless space go, float literals shrink, every declared identifier gets a one- or two-letter name
(most used first), and unused top-level functions and constants are dropped. It is proven on the GPU
to change nothing: every fixture program compiles, links and draws bit-identical RGBA32F pixels
before and after, and every real shader on disk still compiles and links. T00's `npm run verify`
passes with it.

**Files.** `tools/glslmin/index.mjs` (entry point, declarations, rename, emit), `lex.mjs` (tokenizer,
joins, floats), `names.mjs` (keywords, types, built-ins, name generator), `prune.mjs`, `corpus.mjs`,
`chromium.mjs`, `browser-test.mjs`, `size.mjs`; `tests/glslmin/*.test.mjs` (42 tests) and
`tests/glslmin/fixtures/` (7 programs, 10 files).

**Acceptance evidence (2026-11-18, this machine).**

- `npx vitest run tests/glslmin`: `Test Files 4 passed (4)`, `Tests 42 passed (42)`. Seen failing
  first: the renaming tests run against the strip-only `index.mjs` gave 11 failures (Progress).
- `node tools/glslmin/browser-test.mjs`: exit 0. `renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 4070
  SUPER (0x00002783) Direct3D11 vs_5_0 ps_5_0, D3D11)`, `target: RGBA32F 160x120, compared bit for
  bit`. 7 fixture programs (common, boxes, sky, beams, dual, literals, tricky) x 3 minified variants
  (strip, renamed+pruned, renamed joined with no newline): 21 of 21 `ok (identical)`, diff 0. The
  mutant (one literal changed in the renamed boxes fragment) differs in 4372 pixels, so the gate can
  fail. 12 real shaders (`src/engine.glsl`, `dev/probe/*`, `dev/gltest/*`): 12 of 12 compile and link
  after minifying. Final line: `PASS: 19 programs, every variant compiled, linked and matched`.
- Reference images (`--png`, in `shots/T02/`) opened and looked at: boxes show coloured window grids
  on dark facades with neon edges, sky shows a striped sun disc over violet with star speckles, beams
  show cyan and magenta vertical ribbons and white sprites, dual shows a 4x4 grid of coloured rings.
  The fixtures draw real content, not a clear colour (lit pixels 5364 to 19200 of 19200).
- `node tools/glslmin/size.mjs` (corpus: `src/common.glsl` as on disk plus the 10 fixture files):

  | Variant | Bytes | deflateRawSync L9 |
  |---|---|---|
  | source | 16515 | 6655 |
  | strip-only | 7892 | 3412 |
  | renamed (prune off) | 6678 | 3063 |
  | renamed + pruned (default) | 6451 | 2990 |

  `common.glsl` alone: source 8656 / 3632, strip 3176 / 1417, renamed 2764 / 1269 (bytes / deflated).
  Every real `.glsl` under `src/` and `dev/` in one call: source 15565 / 5952, strip 6751 / 2551,
  renamed 5855 / 2304 (nothing pruned, see Surprises).
- Same input twice gives identical output: `deterministic: yes` from `size.mjs`, and the corpus tests
  (also independent of file order).
- T00's gates with this tool in place: `npm run build` produced `dist/synthwave-city.html 3,856 bytes`;
  `npm run verify` printed `differing pixels 0/518400` at four cameras and `VERIFY OK`.

**Budget.** 0 bytes: this is a build tool and ships nothing.

**Rules a shader author must follow (known limits).**

1. A name JavaScript looks up must be one of the reserved names (`F`, `T0`-`T7`, `X0`-`X3`, `FS`,
   `main`) or passed in `options.reserved`. Every other declared name is renamed, including uniforms
   and samplers (`uniform sampler2D uTex;` would be unreachable from `getUniformLocation`).
2. Interface block names are never renamed. Block members are renamed unless the block has an
   instance name; then they keep their names, like struct fields.
3. Struct field names and anything after `.` keep their spelling, so short field names save bytes.
4. A declaration is found as `type name`. A type hidden behind a macro (`#define V vec3` then `V p;`)
   is not seen, so `p` is not renamed (correct, but bigger). Do not hide types in macros.
5. No token pasting (`##`), no names assembled inside macros. In `#if`/`#ifdef`/`#elif`/`#undef`
   lines only macro names are renamed.
6. Do not name a variable or function like a built-in (`step`, `length`, `noise1`...): such names are
   never renamed. Do not use ESSL reserved words (`patch`, `sample`, `filter`, `common`...).
7. Pruning is only correct when every shader that will be linked is in the same call. Do not build
   GLSL text in TypeScript strings; import `.glsl` files. Anything referenced from any source
   (including a macro body or a `dev/` file in the call) is kept.
8. Each preprocessor line costs two newlines in the output; prefer few `#ifdef`s.
9. Compile errors from the packed build report line numbers of the minified text, where only
   directives start new lines. Debug with the unminified dev build.
10. Float literals are rewritten to the shortest decimal form of the same value. Proven bit-exact on
    ANGLE/D3D11 only.

**Not verified.** Any GPU or browser other than Chromium 151 on ANGLE/D3D11 with the RTX 4070 SUPER:
no Firefox, Safari, Android (Adreno/Mali) or other ANGLE back end was tried, so the pp-number,
object-like macro and float-literal choices rest on the C rules [I] there. Pixel identity is proven for
the fixtures and, through T00's verify, for the probe layers; the wave-2 layer shaders do not exist
yet. `npm run check:task -- T02` and `npm run plans:check` could not be run (scripts not present).
The null-directive test was written after its fix and was not seen failing.

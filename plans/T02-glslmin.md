---
id: T02-glslmin
title: Shader minifier
status: ready
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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

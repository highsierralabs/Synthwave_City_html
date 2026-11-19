---
id: T01-packer
title: Self-extracting container
status: done
depends_on: []
owns: [tools/pack/**, tests/pack/**, plans/T01-packer.md]
reads: [architecture.md, Agents.md]
budget: 600
executor: sonnet/high
updated: 2026-11-18
---

# T01: packer

## 1. Purpose

Turn one JavaScript text into the single HTML file a person opens: compressed, self-extracting, and
running from disk or from any host. This task decides how many bytes the wrapper costs and proves
where the file runs.

## 2. Context and orientation

§3.3 has the design and the spike numbers. In short: the payload is raw deflate; the file is UTF-16LE
with a byte order mark so the browser's decoding cannot be overridden by a server header; each pair
of payload bytes is one 16-bit code unit inside a JavaScript string literal; units the HTML parser,
the UTF-16 decoder or a string literal would damage are escaped; a short unpacker rebuilds the bytes,
inflates them with `DecompressionStream('deflate-raw')` and evaluates the text.

The spike's unpacker, which ran in Chromium 151 from `file://`, over HTTP and over HTTP with
`charset=utf-8`:

```
<body><script>s="…";b=new Uint8Array(N);for(i=j=0;j<N;)c=s.charCodeAt(i++),
c==4352&&(c=s.charCodeAt(i++)^4096),b[j++]=c,b[j++]=c>>8;new Response(new Blob([b]).stream()
.pipeThrough(new DecompressionStream("deflate-raw"))).text().then(eval)</script>
```

with the escape set: `0x0000`, `0x000A`, `0x000D`, `0x0022`, `0x005C`, `0x003C`, `0xD800`–`0xDFFF`,
the escape unit `0x1100` itself, `0x2028`, `0x2029`, `0xFEFF`, `0xFFFE`, `0xFFFF`. `N` is the exact
deflate length; when it is odd the last unit carries one padding byte that the `Uint8Array` bound
drops.

`tools/pack/index.mjs` exists as a stub with the final signature. Keep the signature.

## 3. Scope

Owned: `tools/pack/**`, `tests/pack/**`. Tests are `.test.mjs` files run by Vitest.

Not in scope: minifying the JavaScript, the build script, anything under `src/`.

## 4. Interfaces

Provides, from `tools/pack/index.mjs` (the stub's comments are the contract):

- `pack(js, options)` resolving to `{ html, container, deflated, overhead }`, where `html` is a
  `Uint8Array` that is the whole file;
- `quickSize(js)`, a fast synchronous estimate (zlib level 9 through the same container arithmetic)
  that the build uses to choose between minifier candidates;
- `unpack(html)`, the inverse of `pack` in Node, for tests and for inspecting a built file.

Containers: `utf16` (default) and `ascii` (base64 `data:` URL, plain ASCII, for hosts or tools that
damage the first). Compressors: zopfli when `@gfx/zopfli` loads, Node's `deflateRawSync` level 9
otherwise, chosen automatically and reported.

## 5. Plan of work

**M1. Round trip in Node.** Implement both containers and `unpack`. Tests: random payloads; a payload
that contains every one of the 65,536 code units at both alignments; odd and even lengths; the empty
payload; a payload whose units spell `</script>` and `<!--`. For `utf16`, decode the file the way a
browser would (`TextDecoder('utf-16le')` after the mark), run the same loop as the unpacker, and
require the exact bytes. Show one test failing first by removing a unit from the escape set.

**M2. Round trip in a browser.** `tools/pack/browser-test.mjs` (Playwright, cached Chromium, see
Agents.md): for each container, open the file from `file://`, over HTTP with no charset, with
`charset=utf-8`, and with `charset=iso-8859-1`; the payload sets a global to a checksum of itself;
require it. Also confirm the two claims in Agents.md marked `[M]`: `deflate-raw` rejects a zlib
header, and rejects trailing bytes.

**M3. Compression.** Measure zopfli against zlib on a realistic input (the parent project's built
JavaScript under `C:\highsierralabs\Synthwave_City\dist\assets\` is a fair stand-in; read only).
Choose iteration counts by measurement: the build should take seconds, a `--max` setting may take a
minute. Record bytes and time for each.

**M4. Shrink the wrapper.** Every byte of unpacker costs two in UTF-16. Measure alternatives and keep
what is smaller and still passes M2: a shorter unpacker; choosing the escape unit and XOR mask per
payload to minimise escapes; pairing bytes at the other alignment; dropping `<body>` if the payload
never needs `document.body` before it creates it (ask what the payload assumes: it runs after the
parser has finished the document, from a promise). Report the final overhead as
`file size - deflate size` in bytes, against the 1,300 budget at a 25 kB payload.

**M5. Other browsers, as far as this machine allows.** Check whether Firefox or another engine is
installed and can be driven; if so run M2 there. If not, say so plainly. Never run
`npx playwright install`.

## 6. Validation and acceptance

- `npx vitest run tests/pack` passes; the escape test was seen to fail first.
- `node tools/pack/browser-test.mjs` prints a table of container against delivery with every `utf16`
  and `ascii` cell passing in Chromium, and the browser version.
- Packing the same input twice gives identical bytes.
- The plan records: zopfli against zlib in bytes and seconds; the wrapper overhead in bytes; which
  browsers were and were not tested.

Human checks: opening a packed file on the operator's Android phone (from its file manager) is the
test this machine cannot run.

## 7. Idempotence and recovery

Pure functions and scratch output under `.tmp/T01/`. Safe to re-run; delete `.tmp/T01/` to clean up.

## 8. Progress

- [x] 2026-11-18 Read Agents.md, architecture.md, this plan; checked the stub, `@gfx/zopfli` (loads; callback and
  `deflateAsync` API) and the browsers on this machine.
- [x] 2026-11-18 Claims in Agents.md marked `[M]` tested in Chromium (all four builds below): `deflate-raw`
  rejects a zlib header, rejects one trailing byte and rejects trailing zeros; accepts a stream with an empty
  stored block in front of it.
- [x] 2026-11-18 M1 round trip in Node: `tools/pack/container.mjs`, `deflate.mjs`, `index.mjs`;
  `tests/pack/container.test.mjs` and `pack.test.mjs`, 26 tests. The safety test was seen to fail first (Surprises 3).
- [x] 2026-11-18 M2 browser test: `tools/pack/browser-test.mjs`, `tools/pack/browser.mjs` (own browser finder).
- [x] 2026-11-18 M3 compression measured: zopfli against zlib, table in Outcomes; levels chosen from it.
- [x] 2026-11-18 M4 wrapper shrunk from 1,270 to 582 bytes of overhead at a 22 kB stream by replacing the escape
  scheme (Decision 1); alternatives measured and recorded in Outcomes.
- [x] 2026-11-18 M5 other browsers: Chrome 157, Edge 157 and Brave 158 are installed and were driven; no
  Firefox, no WebKit. Stated plainly in Outcomes.
- Left: nothing in this plan's scope. Not done, and recorded as open: a phone (human check), Firefox, Safari,
  a faster-decoding variant for very large payloads (Decision 6).

## 9. Surprises and discoveries

1. **The escape scheme was the cost, not the wrapper.** The spike's overhead is 3.1% of the stream in escapes plus a
   510-byte wrapper. Of the 3.1%, almost all is the surrogate range D800-DFFF (2,048 of 2,060 bad units), which
   cannot be written raw because a lone surrogate decodes to U+FFFD. At a 22,396-byte stream the spike's container
   costs 1,270 bytes of overhead; the number system that replaced it costs 582 (Outcomes). [O: `.tmp/T01/m4.mjs`]
2. **`DecompressionStream('deflate-raw')` rejects trailing bytes, even zeros**, in all four Chromium builds, which
   rules out padding a stream at its end. An empty stored block (`00 00 00 FF FF`) in front of the stream is
   accepted, so padding goes in front. [O: browser-test, "DecompressionStream" section]
3. **The safety test failed when it should.** With the alphabet's low offset changed from 128 to 32 in
   `digitToUnit`/`unitToDigit` (a consistent change, so the round trip still passes), `npx vitest run
   tests/pack/container.test.mjs` failed two tests: `Error: unit 21 at 0 is outside the alphabet` and `Error: unit 5e at 733
   is outside the alphabet`. Restored, both pass. [O] This is the plan's "remove a unit from the escape set"
   check, translated to the new scheme: the guard is `inAlphabet`, which forbids every unit below 0x80, the
   surrogates and U+FFFE/FFFF.
4. **Dropping `<body>` is unsafe.** Without it, a file delivered in slow chunks ran the payload with
   `document.body === null` (`body:false` at 271-278 ms in all four browsers, ascii container). The payload starts when
   the script has been parsed and the stream inflated, which can be before the parser sees the end of the
   connection. `<body>` costs 12 bytes and is kept in both containers; with it the slow-delivery column passes
   everywhere. [O]
5. **A server that sends no `Content-Type` shows the utf16 file as text.** Chromium sniffs a BOM'd file with no
   header as `text/plain` and prints the characters (`document.contentType` was `text/plain`, `characterSet`
   `UTF-16LE`). The ascii container is sniffed as HTML. Any `Content-Type: text/html` works, with or without a
   charset, including `charset=utf-8` and `charset=iso-8859-1`. `file://` is fine. Reported, not required, by the
   test ("no type" column). [O]
6. **Decode time is quadratic in the payload.** Rebuilding one big number costs 14 ms at 10 kB, 55 ms at 25 kB,
   108 ms at 35 kB, 315 ms at 60 kB and 943 ms at 100 kB of deflate stream, in Chromium 151 on this desktop
   (random bytes, `.tmp/T01/bench-decode.mjs`; the two loops summed). A phone will be slower by an
   unmeasured factor. A 253-digit block variant is linear and costs 108 bytes more at 22 kB (Decision 6).
7. **`for (c of s)` in the unpacker works on code points, not units.** Safe here because the alphabet holds no
   surrogates, so no pair can form.
8. **Zopfli is fast here and gains saturate early.** See the table in Outcomes: 15 iterations gets about 99% of the gain
   of 200 (1,020 of 1,029 bytes at 65 kB).

## 10. Decision log

| # | Decision | Reason | Date |
|---|---|---|---|
| 1 | The utf16 container writes the deflate stream as one big number in base 63,358, one code unit per digit, instead of 16-bit units with escapes. | Overhead 0.31% instead of 3.1% of the stream; no escape set to get wrong; the browser test of every alphabet unit passes. Same wrapper size (510 bytes). Saves 688 bytes at a 22 kB stream and 2,900 at 99 kB. The plan's M1 text describes the escape scheme; its tests are translated, not dropped (round trip of all 65,536 values at both alignments, `</script>` and `<!--`, odd and even lengths, empty payload, the shipped digit loop run on browser-decoded text). | 2026-11-18 |
| 2 | Alphabet: units 0x80-0xD7FF and 0xE000-0xFFFD (63,358). Nothing below 0x80, no surrogate, no U+FFFE/FFFF. | The ASCII range holds every unit the HTML parser or a string literal could damage (NUL, CR, LF, quote, backslash, `<`), and excluding all of it costs less than handling six units one by one. One range only (base 55,168) costs 1.6% instead of 0.3%: 248 bytes more at 22 kB, for 10 characters (20 bytes) less in the unpacker. | 2026-11-18 |
| 3 | The number is cut into 64-bit words with `BigUint64Array`, so the stream is padded to a multiple of 8 bytes by empty deflate blocks in front of it (`padStream`). Padding costs 0 to 14 bytes by construction (about 5 on average over the eight residues; 4 and 2 in the two measured cases). | 64-bit words are 8x fewer loop turns than bytes and `for(b=[];n;n>>=64n)b.push(n)` needs no length constant. The 8-byte version costs 16 more bytes of unpacker and is slower. `Uint8Array.fromHex` would save about 20 bytes but needs 2025-era browsers; not taken. Two prefix kinds are tried and inflate-checked: k empty fixed blocks (10 bits, shifts the stream) and k of them plus one empty stored block (byte-aligned, for streams with stored blocks). | 2026-11-18 |
| 4 | Keep `<body>` in both containers. | Surprise 4. | 2026-11-18 |
| 5 | Levels: `fast` zlib 9; `normal` zopfli 15 iterations, unlimited block splitting; `max` eight zopfli runs (15 to 250 iterations), keeping the smallest file. | M3 table. The file size, not the stream size, picks the winner, because padding depends on the stream length modulo 8. | 2026-11-18 |
| 6 | Not shipped: a block variant (253 digits = 63 words per block) that decodes in linear time. | 108 bytes more at 22 kB; the decode time at the expected payload (25-35 kB) is 55-110 ms on this desktop. The phone's time is not measured. If the operator's phone is slow, the orchestrator should ask for it: the change is the unpacker tail and `encodeUnits`/`decodeUnits` in `container.mjs`. | 2026-11-18 |
| 7 | `quickSize` returns the estimated whole-file size (zlib 9, padded, in the utf16 container), not the deflate size the stub returned. | The stub's comment says "packed size"; the build uses it to compare minifier candidates, for which the file size is the comparable number. It matches `pack(js, {level:'fast'})` to the byte in every case run (65 kB, 322 kB, the test inputs). | 2026-11-18 |
| 8 | `pack` returns one extra field, `compressor` (for example `zopfli-250/0`), and checks its own output by unpacking it before returning. | "Chosen automatically and reported" (section 4). The check costs one more big-number pass (a whole `fast` pack takes 2.5 s at 322 kB of JavaScript and 0.14 s at 65 kB). | 2026-11-18 |
| 9 | The browser test treats "no Content-Type" as information, not a requirement. | Surprise 5. | 2026-11-18 |

## 11. Contract change requests

None. `pack`, `quickSize` and `unpack` keep the stub's names and parameters. `pack` adds a field to its result
(`compressor`), which is additive.

## 12. Outcomes and retrospective

**Result against Purpose.** `tools/pack` turns JavaScript text into the one HTML file, as UTF-16LE with a byte
order mark. It loaded and ran from `file://`, from HTTP with no charset, with `charset=utf-8`, with `charset=iso-8859-1`,
and in slow chunks, in four Chromium-family builds. Measured against the 1,300-byte budget at a 25 kB payload:
**582 bytes of overhead at a 22,396-byte stream** (510 bytes of wrapper, 4 bytes of padding, 68 bytes of
number-system loss), 815 bytes at a 98,734-byte stream. The spike's container cost 1,270 and 3,720 at the same
streams.

**Wrapper.** The utf16 file is `FF FE` plus `<body><script>s="` plus one unit per digit plus a 237-character tail:
510 bytes of wrapper in all, constant (no length appears in it). The tail:

```
";n=0n;for(c of s)n=n*63358n+BigInt((c=c.charCodeAt())>55295?c-2176:c-128);for(b=[];n;n>>=64n)b.push(n);new Response(new Response(new BigUint64Array(b)).body.pipeThrough(new DecompressionStream("deflate-raw"))).text().then(eval)</script>
```

**Alternatives measured** (exact file bytes for the same zopfli stream; computed in `.tmp/T01/m4.mjs`, not run
in a browser unless it is the shipped one):

| Container | 22,396 B stream | 98,734 B stream |
|---|---|---|
| V0 the spike: escape 0x1100, xor 4096, byte loop | 23,666 (+1,270) | 102,454 (+3,720) |
| V1 escape unit 1..9 chosen per payload, `Uint16Array`, even stream | 23,620 (+1,224) | 102,408 (+3,674) |
| V4 big number, one range (base 55,168) | 23,226 (+830) | 100,766 (+2,032) |
| **V3 big number, two ranges (base 63,358): shipped** | **22,978 (+582)** | **99,548 (+814)** |
| V5 V3 in 253-digit blocks (linear time) | 23,086 (+690) | 99,724 (+990) |

Per-payload escape unit and the other pairing alignment (the plan's M4 list) were measured on the escape scheme: the
number of units needing an escape was 380 (little-endian, aligned), 341, 337 and 382 for the four alignments at
22 kB, so at best 43 units (86 bytes) of 760, against 688 bytes for the number system. Dropping `<body>`: rejected
(Surprise 4).

**Compression (M3).** Parent project JavaScript, read only. Seconds are wall-clock on this machine (Ryzen 9 3900X).

| Input | zlib 9 | zopfli 5 it | 15 it | 30 it | 60 it | 100 it | 200 it |
|---|---|---|---|---|---|---|---|
| 65,483 B (sky, beams, ground, glsl chunks) | 23,416 (3 ms) | 22,402 (0.32 s) | 22,396 (0.23 s) | 22,397 (0.34 s) | 22,393 (0.58 s) | 22,393 (0.90 s) | 22,387 (1.70 s) |
| 322,533 B (all chunks but three.js) | 103,624 (9 ms) | 98,773 (0.64 s) | 98,734 (1.11 s) | 98,727 (1.84 s) | 98,717 (3.24 s) | not run | not run |

Block-split limit: at 322 kB, 15 iterations gave 98,734 with a limit of 15 and 98,685 with 0 or 30 (1.9 s); at
65 kB all three were identical. Zopfli beats zlib 9 by 4.4% at 65 kB and 4.7% at 322 kB (1,020 and 4,890
bytes). Whole `pack` runs (file bytes; includes the container and the self-check):

| Input | `fast` | `normal` | `max` |
|---|---|---|---|
| 65 kB | 23,998 B, 0.14 s | 22,978 B, 0.47 s | 22,972 B, 8.4 s |
| 322 kB | 104,450 B, 2.5 s | 99,500 B, 6.0 s | 99,460 B, 62 s |

`max` buys 6 bytes at 65 kB and 40 at 322 kB for 18 and 10 times the time. Use `normal` for dev and `verify`, `max` for
the release build.

**Browsers.** Tested: Playwright Chromium 151.0.7922.34, Chrome 157.0.8103.79, Edge 157.0.4341.60, Brave
158.0.8127.42, all driven by path on this Windows 10 machine. These are one engine family; they are not independent
evidence for Firefox or Safari. Not tested: Firefox (not installed; Playwright cannot drive a stock Firefox and
`npx playwright install` is forbidden), Safari/WebKit (not installed), any phone. Output of
`node tools/pack/browser-test.mjs --browsers all` (utf16 and ascii: a 75,016-byte payload with a checksum of a
random 6,000-character string; "all units": a string literal holding all 63,358 alphabet units; times are
navigation start to payload start):

```
== playwright chromium: 151.0.7922.34
container     file://     http        http utf-8  http latin1 http slow   no type
utf16         PASS 154ms  PASS 137ms  PASS 132ms  PASS 142ms  PASS 409ms  fail (info)
ascii         PASS 31ms   PASS 15ms   PASS 12ms   PASS 13ms   PASS 274ms  PASS 18ms
all units     PASS 24ms   PASS 9ms    PASS 10ms   PASS 10ms   PASS 270ms  fail (info)
(chrome 157, edge 157 and brave 158: the same cells, all PASS, "no type" fail (info) for utf16 and all units)
DecompressionStream("deflate-raw"): raw accepted; zlib header rejected; trailing byte rejected;
  trailing zeros rejected; empty stored block in front accepted    (each as claimed, in all four)
all passed
```

The utf16 file for that payload is 34,862 bytes for a 34,245-byte stream.

**Tests.** `npx vitest run tests/pack`: 2 files, 26 tests passed, about 12.7 s. Same input twice gives identical bytes
at `fast`, `normal` and `max`, in both containers. `quickSize` was within 4 bytes in the test and equal in the
measured cases.

**Not verified.** A phone (the human check below); Firefox and Safari; the zopfli-missing fallback (`compress`
falls back to zlib when the import fails, but the failure was not simulated; `level: 'fast'` exercises the zlib
path); `npm run check:task -- T01` (`scripts/check-task.mjs` did not exist while this ran, so only the
Vitest run and `node --check` on every file were run); that a viewport `<meta>` inserted by the payload after load is
honoured on Android and iOS; that a payload does not need standards mode (the file has no doctype, so it
renders in quirks mode; a doctype costs 30 bytes); decode time on a phone.

**Human check still open.** Open a packed file on the operator's Android phone from its file manager. The test
file `.tmp/T01/browser/utf16.html` (34,862 bytes, regenerated by the browser test) only sets globals and shows
no picture; the real check is with the built product: that the file manager does not refuse or re-encode the
file, that it starts, and how long the decode takes (55 to 110 ms on this desktop at 25-35 kB).

**Retrospective.** The largest saving came from questioning the plan's premise (an escape set) rather than from
golfing the wrapper: the wrapper stayed at 510 bytes and the data overhead fell from 3.1% to 0.31%. What is
left to cut is small: `<body>` (12 bytes, unsafe to drop) and the padding (about 5 bytes). A file with no doctype
is already the cheapest; a doctype would cost 30 bytes.

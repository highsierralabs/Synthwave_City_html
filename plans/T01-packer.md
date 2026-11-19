---
id: T01-packer
title: Self-extracting container
status: ready
depends_on: []
owns: [tools/pack/**, tests/pack/**, plans/T01-packer.md]
reads: [architecture.md, Agents.md]
budget: 1300
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

## 9. Surprises and discoveries

## 10. Decision log

## 11. Contract change requests

## 12. Outcomes and retrospective

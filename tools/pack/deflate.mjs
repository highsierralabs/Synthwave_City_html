// Raw deflate compressors. Owner: T01.
//
// zopfli (@gfx/zopfli, WebAssembly) when it loads, Node's zlib level 9 otherwise. The output is always
// a raw deflate stream: DecompressionStream('deflate-raw') rejects a zlib header [O: T01 browser test].
import { deflateRawSync, inflateRawSync } from 'node:zlib';

let zopfliPromise;
function loadZopfli() {
  zopfliPromise ??= import('@gfx/zopfli').then(
    (m) => m.deflateAsync ?? m.default?.deflateAsync ?? null,
    () => null,
  );
  return zopfliPromise;
}

/** Iteration counts and block-split limits per level; chosen by measurement (see plans/T01-packer.md). */
export const LEVELS = {
  fast: { zopfli: null },
  // blocksplittingmax 0 (no limit) was smaller than 15 on the 322 kB input and equal on 65 kB (measured).
  normal: { zopfli: [{ numiterations: 15, blocksplittingmax: 0 }] },
  // Zopfli's result varies by a few bytes with the iteration count, and the container's padding depends on
  // the stream length modulo 8, so max tries several counts and keeps whichever makes the smallest file.
  max: {
    zopfli: [
      [250, 0],
      [200, 15],
      [150, 0],
      [100, 15],
      [60, 0],
      [40, 15],
      [30, 0],
      [15, 15],
    ].map(([numiterations, blocksplittingmax]) => ({ numiterations, blocksplittingmax })),
  },
};

/** zlib level 9, synchronous. */
export function zlibDeflate(js) {
  return deflateRawSync(Buffer.from(js, 'utf8'), { level: 9, memLevel: 9 });
}

export function inflate(z) {
  // Strict, like the browser: DecompressionStream('deflate-raw') rejects any byte after the final
  // block, while inflateRawSync alone ignores it. A stream that Node accepted and the browser refused
  // shipped once (a bit-shifted padding candidate that ended in a whole zero byte).
  const { buffer, engine } = inflateRawSync(z, { info: true });
  if (engine.bytesWritten !== z.length) throw new Error('inflate: bytes after the final deflate block');
  return buffer;
}

/**
 * Compresses the text. Returns every candidate stream (smallest first) so the caller can choose by
 * final file size: the padding the container adds depends on the stream's length modulo 8.
 *
 * @param {string} js
 * @param {'fast' | 'normal' | 'max'} level
 * @returns {Promise<{ streams: { bytes: Uint8Array, compressor: string }[] }>}
 */
export async function compress(js, level = 'normal') {
  const spec = LEVELS[level];
  if (!spec) throw new Error(`unknown level: ${level}`);
  const input = Buffer.from(js, 'utf8');
  const streams = [{ bytes: zlibDeflate(js), compressor: 'zlib-9' }];
  const zopfli = spec.zopfli && (await loadZopfli());
  if (zopfli) {
    for (const opts of spec.zopfli) {
      const bytes = await zopfli(input, { blocksplitting: true, ...opts });
      streams.push({ bytes, compressor: `zopfli-${opts.numiterations}/${opts.blocksplittingmax}` });
    }
  }
  streams.sort((a, b) => a.bytes.length - b.bytes.length);
  return { streams };
}

export async function zopfliAvailable() {
  return (await loadZopfli()) !== null;
}

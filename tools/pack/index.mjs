// Self-extracting container. Owner: T01 (plans/T01-packer.md). Design: architecture.md section 3.3.
//
// pack(js)      JavaScript text -> the one HTML file (utf16 container by default).
// quickSize(js) synchronous estimate of that file's size in bytes, for choosing between candidates.
// unpack(html)  the inverse, in Node, for tests and for inspecting a built file.
//
// Both containers carry a RAW deflate stream (DecompressionStream('deflate-raw')); the unpacker inflates
// it and evaluates the text as a classic script, indirectly, after the document has been parsed.
import { buildContainer, estimateContainer, extractStream, padStream } from './container.mjs';
import { compress, inflate, zlibDeflate } from './deflate.mjs';

export { UTF16_HEAD, UTF16_TAIL, ASCII_HEAD, ASCII_TAIL } from './container.mjs';

/**
 * Packs JavaScript text into one self-extracting HTML file.
 *
 * @param {string} js  the program. It is evaluated as a classic script (indirect eval) after the
 *        document has been parsed; document.body exists.
 * @param {{ container?: 'utf16' | 'ascii', level?: 'fast' | 'normal' | 'max' }} [options]
 *        level: fast = zlib 9 (milliseconds); normal = zopfli, 15 iterations (a second or less at
 *        65 kB); max = several zopfli runs, keeping the one that makes the smallest file (seconds).
 * @returns {Promise<{ html: Uint8Array, container: string, deflated: number, overhead: number, compressor: string }>}
 *        html: the whole file; deflated: bytes of the deflate stream; overhead: html - deflated.
 */
export async function pack(js, options = {}) {
  const container = options.container ?? 'utf16';
  if (container !== 'utf16' && container !== 'utf16l' && container !== 'ascii') throw new Error(`unknown container: ${container}`);
  const { streams } = await compress(js, options.level ?? 'normal');
  let best;
  for (const s of streams) {
    const stream = container === 'ascii' ? s.bytes : padStream(s.bytes, inflate);
    const html = buildContainer(stream, container);
    if (!best || html.length < best.html.length) best = { html, deflated: s.bytes.length, compressor: s.compressor };
  }
  // The file must give the text back exactly; this is cheap and catches any container fault at build time.
  if (Buffer.compare(inflate(extractStream(best.html).stream), Buffer.from(js, 'utf8')) !== 0) {
    throw new Error('pack: the packed file does not unpack to its input');
  }
  return {
    html: new Uint8Array(best.html.buffer, best.html.byteOffset, best.html.byteLength),
    container,
    deflated: best.deflated,
    overhead: best.html.length - best.deflated,
    compressor: best.compressor,
  };
}

/**
 * Fast synchronous estimate of the packed size of `js` in bytes, for choosing between candidates:
 * zlib level 9 through the same container arithmetic as pack (utf16 container).
 * @param {string} js
 * @returns {number}
 */
export function quickSize(js) {
  return estimateContainer(zlibDeflate(js), 'utf16', inflate);
}

/**
 * The inverse of pack, in Node: returns the JavaScript text inside a packed file.
 * @param {Uint8Array} html
 * @returns {Promise<string>}
 */
export async function unpack(html) {
  const { stream } = extractStream(html);
  return inflate(stream).toString('utf8');
}

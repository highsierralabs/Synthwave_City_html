// The containers: how a raw deflate stream is carried through an HTML file. Owner: T01.
//
// utf16 (shipped). The file is UTF-16LE with a byte order mark, so the browser decodes it as UTF-16
// whatever a server header or a <meta> says. The deflate stream is read as one big number (byte 0 is
// the least significant) and written in base B = 63358, one code unit per digit. The alphabet is every
// unit from 0x0080 to 0xD7FF and from 0xE000 to 0xFFFD: nothing below 0x80 (so no NUL, CR, LF, quote,
// backslash or "<"), no surrogate (a lone one would be decoded to U+FFFD) and no U+FFFE or U+FFFF.
// Nothing needs an escape, and the cost is 16 / log2(B) - 1 = 0.31 % over the deflate stream, where
// escaping the bad units one by one cost 3.1 %.
//
// The unpacker rebuilds the number with BigInt, cuts it into 64-bit words, and hands the words to
// DecompressionStream as bytes. Words are 8 bytes, so the packer pads the stream to a multiple of 8
// with empty deflate blocks in front of it (see padStream): DecompressionStream rejects trailing
// bytes, even zeros [O].
//
// ascii. A base64 data: URL, plain ASCII, for hosts or tools that damage the first.

/** Digit base: 55168 units in 0x80..0xD7FF plus 8190 units in 0xE000..0xFFFD. */
export const BASE = 63358;
const LOW_COUNT = 55168; // 0x80 .. 0xD7FF
const BASE_N = BigInt(BASE);
const BASE4 = BASE_N ** 4n;

const digitToUnit = (d) => (d < LOW_COUNT ? d + 128 : d + 2176);
const unitToDigit = (u) => (u > 55295 ? u - 2176 : u - 128);

/** True for a code unit the utf16 container may write. */
export function inAlphabet(u) {
  return (u >= 0x80 && u <= 0xd7ff) || (u >= 0xe000 && u <= 0xfffd);
}

/** The text before and after the units, in the utf16 container. Constant: the file has no length field. */
export const UTF16_HEAD = '<body><script>s="';
export const UTF16_TAIL =
  '";n=0n;for(c of s)n=n*63358n+BigInt((c=c.charCodeAt())>55295?c-2176:c-128);' +
  'for(b=[];n;n>>=64n)b.push(n);' +
  'new Response(new Response(new BigUint64Array(b)).body.pipeThrough(new DecompressionStream("deflate-raw"))).text().then(eval)</script>';

export const ASCII_HEAD = '<body><script>fetch("data:;base64,';
export const ASCII_TAIL =
  '").then(r=>new Response(r.body.pipeThrough(new DecompressionStream("deflate-raw"))).text()).then(eval)</script>';

const LOG2_BASE = Math.log2(BASE);

// ---- padding to a multiple of 8 bytes ----------------------------------------------------------

/** One empty block with fixed Huffman codes and BFINAL = 0: 10 bits, value 0b10, least significant bit first. */
const EMPTY_FIXED = 2;

/**
 * Returns the stream with empty deflate blocks added in front, so its length is a multiple of 8 and
 * as short as the options below allow. Two kinds of prefix are tried, each checked by inflating:
 * k empty fixed blocks (10 bits each, shifting the whole stream), and k empty fixed blocks followed by
 * one empty stored block (which ends byte-aligned, so the stream behind it is not shifted).
 *
 * @param {Uint8Array} z a complete raw deflate stream
 * @param {(b: Uint8Array) => Uint8Array} inflate used to check a candidate; throws when it is invalid
 * @returns {Uint8Array}
 */
export function padStream(z, inflate) {
  if (z.length % 8 === 0) return z;
  const want = inflate(z);
  let best;
  for (let k = 0; k <= 12; k++) {
    for (const stored of [false, true]) {
      const c = prefixed(z, k, stored);
      if (c.length % 8 || (best && c.length >= best.length)) continue;
      let ok = false;
      try {
        const back = inflate(c);
        ok = back.length === want.length && Buffer.compare(back, want) === 0;
      } catch {
        ok = false;
      }
      if (ok) best = c;
    }
  }
  if (!best) throw new Error('padStream: no valid padding found');
  return best;
}

/** k empty fixed blocks, then optionally one empty stored block, then z (shifted when not byte-aligned). */
function prefixed(z, k, stored) {
  const bits = [];
  for (let i = 0; i < k; i++) for (let j = 0; j < 10; j++) bits.push((EMPTY_FIXED >> j) & 1);
  let head;
  if (stored) {
    bits.push(0, 0, 0); // BFINAL 0, BTYPE 00
    while (bits.length % 8) bits.push(0);
    head = bitsToBytes(bits);
    head = Buffer.concat([head, Buffer.from([0, 0, 0xff, 0xff])]); // LEN 0, NLEN 0xFFFF
    return Buffer.concat([head, z]);
  }
  const p = bits.length;
  const out = Buffer.alloc(Math.ceil((p + 8 * z.length) / 8));
  for (let i = 0; i < p; i++) out[i >> 3] |= bits[i] << (i & 7);
  for (let i = 0; i < z.length; i++) {
    const off = p + 8 * i;
    const q = off >> 3;
    const r = off & 7;
    out[q] |= (z[i] << r) & 255;
    if (r) out[q + 1] |= z[i] >> (8 - r);
  }
  return out;
}

function bitsToBytes(bits) {
  const out = Buffer.alloc(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) out[i >> 3] |= bits[i] << (i & 7);
  return out;
}

// ---- the number system -----------------------------------------------------------------------------

/**
 * Bytes to code units. The stream is one little-endian number, written most significant digit first.
 * @param {Uint8Array} bytes
 * @returns {Uint16Array}
 */
export function encodeUnits(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).reverse().toString('hex') || '0'));
  const digits = [];
  while (n > 0n) {
    let r = n % BASE4;
    n /= BASE4;
    for (let j = 0; j < 4; j++) {
      digits.push(Number(r % BASE_N));
      r /= BASE_N;
    }
  }
  while (digits.length && digits[digits.length - 1] === 0) digits.pop();
  const units = new Uint16Array(digits.length);
  for (let i = 0; i < digits.length; i++) units[i] = digitToUnit(digits[digits.length - 1 - i]);
  return units;
}

/**
 * Code units to bytes, as the unpacker does it: the number is cut into 64-bit words, low word first,
 * so the result has a multiple of 8 bytes and no trailing all-zero word.
 * @param {ArrayLike<number>} units
 * @returns {Buffer}
 */
export function decodeUnits(units) {
  let n = 0n;
  for (let i = 0; i < units.length; i++) n = n * BASE_N + BigInt(unitToDigit(units[i]));
  if (n === 0n) return Buffer.alloc(0);
  let hex = n.toString(16);
  hex = hex.padStart(Math.ceil(hex.length / 16) * 16, '0');
  return Buffer.from(hex, 'hex').reverse();
}

/** Estimated number of code units for a padded stream of `len` bytes whose last byte is `top`. */
function estimateUnits(len, top) {
  const bits = 8 * (len - 1) + (top ? 32 - Math.clz32(top) : 0);
  return Math.ceil(bits / LOG2_BASE);
}

// ---- files ---------------------------------------------------------------------------------------------

/** UTF-16LE with a byte order mark. */
function utf16le(text, units) {
  const out = Buffer.alloc(2 + 2 * (text.head.length + units.length + text.tail.length));
  out.writeUInt16LE(0xfeff, 0);
  let o = 2;
  for (const ch of text.head) {
    out.writeUInt16LE(ch.charCodeAt(0), o);
    o += 2;
  }
  for (let i = 0; i < units.length; i++, o += 2) out.writeUInt16LE(units[i], o);
  for (const ch of text.tail) {
    out.writeUInt16LE(ch.charCodeAt(0), o);
    o += 2;
  }
  return out;
}

/**
 * Builds the container around a raw deflate stream.
 * @param {Uint8Array} z a complete raw deflate stream (already padded for utf16)
 * @param {'utf16' | 'ascii'} container
 * @returns {Buffer}
 */
export function buildContainer(z, container) {
  if (container === 'ascii') {
    return Buffer.from(ASCII_HEAD + Buffer.from(z).toString('base64') + ASCII_TAIL, 'latin1');
  }
  if (z.length % 8) throw new Error('utf16 needs a stream padded to a multiple of 8 bytes');
  const units = encodeUnits(z);
  return utf16le({ head: UTF16_HEAD, tail: UTF16_TAIL }, units);
}

/**
 * Estimated size in bytes of the container around a raw deflate stream of `len` bytes (utf16: after
 * padding; the estimate is exact to within a unit).
 * @param {Uint8Array} z
 * @param {'utf16' | 'ascii'} container
 * @param {(b: Uint8Array) => Uint8Array} inflate
 */
export function estimateContainer(z, container, inflate) {
  if (container === 'ascii') return ASCII_HEAD.length + Math.ceil(z.length / 3) * 4 + ASCII_TAIL.length;
  const p = padStream(z, inflate);
  return 2 + 2 * (UTF16_HEAD.length + estimateUnits(p.length, p[p.length - 1]) + UTF16_TAIL.length);
}

/**
 * The deflate stream inside a container, as the browser's unpacker would produce it (the utf16
 * stream comes back padded). Throws when the file is neither container.
 * @param {Uint8Array} html
 * @returns {{ container: 'utf16' | 'ascii', stream: Buffer }}
 */
export function extractStream(html) {
  const buf = Buffer.from(html.buffer, html.byteOffset, html.byteLength);
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    const text = buf.toString('utf16le', 2);
    if (!text.startsWith(UTF16_HEAD) || !text.endsWith(UTF16_TAIL)) throw new Error('not a utf16 container');
    const body = text.slice(UTF16_HEAD.length, text.length - UTF16_TAIL.length);
    const units = new Uint16Array(body.length);
    for (let i = 0; i < body.length; i++) units[i] = body.charCodeAt(i);
    return { container: 'utf16', stream: decodeUnits(units) };
  }
  const text = buf.toString('latin1');
  if (!text.startsWith(ASCII_HEAD) || !text.endsWith(ASCII_TAIL)) throw new Error('not a packed file');
  const b64 = text.slice(ASCII_HEAD.length, text.length - ASCII_TAIL.length);
  return { container: 'ascii', stream: Buffer.from(b64, 'base64') };
}

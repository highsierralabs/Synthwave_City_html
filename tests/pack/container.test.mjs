// M1: the container round trip in Node. The unpacker that ships (UTF16_TAIL) is the code under test:
// its digit loop is run here, unchanged, on the text a browser would give it.
import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import {
  ASCII_HEAD,
  BASE,
  UTF16_HEAD,
  UTF16_TAIL,
  buildContainer,
  decodeUnits,
  encodeUnits,
  extractStream,
  inAlphabet,
  padStream,
} from '../../tools/pack/container.mjs';

const inflate = (b) => inflateRawSync(b);
const asBuffer = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);

/** Decode a utf16 file the way a browser does, then run the shipped unpacker's digit loop on it. */
function browserDecode(file) {
  expect(file[0]).toBe(0xff);
  expect(file[1]).toBe(0xfe);
  const text = new TextDecoder('utf-16le').decode(file.subarray(2)); // the browser drops the mark itself; so does this
  expect(text.startsWith(UTF16_HEAD)).toBe(true);
  expect(text.endsWith(UTF16_TAIL)).toBe(true);
  // The HTML parser ends the script at the first "</script"; the string literal ends at the first quote.
  const body = text.slice(UTF16_HEAD.length);
  expect(body.indexOf('</script')).toBe(body.length - '</script>'.length);
  const lit = body.slice(0, body.indexOf('"'));
  const code = UTF16_TAIL.slice(2, UTF16_TAIL.indexOf('new Response')); // after the closing quote and ';', up to the stream calls
  const sandbox = { s: lit, b: undefined };
  runInNewContext(code, sandbox);
  return Buffer.from(new BigUint64Array(sandbox.b).buffer);
}

/** The properties that make a unit safe inside an HTML script's string literal in a UTF-16 file. */
function assertSafeUnits(units) {
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    // Below 0x80 holds NUL, CR, LF, quote, backslash and "<"; D800-DFFF would decode to U+FFFD; FFFE/FFFF are noncharacters.
    if (!inAlphabet(u)) throw new Error(`unit ${u.toString(16)} at ${i} is outside the alphabet`);
  }
}

function everyUnitBytes(alignment) {
  const out = Buffer.alloc(65536 * 2 + 16);
  for (let v = 0; v < 65536; v++) out.writeUInt16LE(v, alignment + v * 2);
  out[out.length - 1] = 0x55; // end on a nonzero byte, so the number has no trailing zero word
  return out;
}

function pad8(buf) {
  const len = Math.ceil(buf.length / 8) * 8;
  const out = Buffer.alloc(len);
  buf.copy(out);
  out[len - 1] = out[len - 1] || 0x77;
  return out;
}

describe('number system', () => {
  it('has the alphabet size the unpacker hard-codes', () => {
    let n = 0;
    for (let u = 0; u < 65536; u++) if (inAlphabet(u)) n++;
    expect(n).toBe(BASE);
    expect(UTF16_TAIL).toContain(`${BASE}n`);
  });

  it('round-trips random streams of many lengths, and writes only alphabet units', () => {
    for (const len of [8, 16, 24, 64, 1000, 4096, 8 * 777]) {
      const bytes = pad8(randomBytes(len));
      const units = encodeUnits(bytes);
      assertSafeUnits(units);
      expect(Buffer.compare(decodeUnits(units), bytes)).toBe(0);
    }
  });

  it('round-trips a stream containing every one of the 65,536 16-bit values, at both alignments', () => {
    for (const alignment of [0, 1]) {
      const bytes = pad8(everyUnitBytes(alignment));
      const units = encodeUnits(bytes);
      assertSafeUnits(units);
      expect(Buffer.compare(decodeUnits(units), bytes)).toBe(0);
    }
  }, 120000);

  it('round-trips streams that start or end in zero bytes and the smallest numbers', () => {
    for (const bytes of [
      Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
      Buffer.from([0, 0, 0, 0, 0, 0, 0x80, 0]).fill(0xff, 0, 1),
      Buffer.alloc(64, 0xff),
      Buffer.concat([Buffer.alloc(1000), Buffer.from([0, 0, 0, 0, 0, 0, 0, 9])]),
    ]) {
      expect(Buffer.compare(decodeUnits(encodeUnits(bytes)), bytes)).toBe(0);
    }
  });

  it('writes a number whose digits are all in the alphabet for the stream spelling </script> and <!--', () => {
    const text = Buffer.from('</script><!--</script></SCRIPT>--><script>"\\\r\n\0'.repeat(40) + 'abcdefg');
    const bytes = pad8(text);
    const units = encodeUnits(bytes);
    assertSafeUnits(units);
    expect(Buffer.compare(decodeUnits(units), bytes)).toBe(0);
  });
});

describe('padStream', () => {
  const real = (n) => deflateRawSync(Buffer.from('some text, repeated; '.repeat(n) + n), { level: 9 });

  it('makes any length a multiple of 8, inflates to the same bytes, and costs at most 14 bytes', () => {
    const seen = new Set();
    for (let n = 3; n < 400 && seen.size < 8; n++) {
      const z = real(n);
      seen.add(z.length % 8);
      const p = padStream(z, inflate);
      expect(p.length % 8).toBe(0);
      expect(p.length - z.length).toBeLessThanOrEqual(14);
      expect(Buffer.compare(inflate(p), inflate(z))).toBe(0);
    }
    expect(seen.size).toBe(8); // every residue was exercised
  });

  it('leaves a stream that is already a multiple of 8 alone', () => {
    let z = real(5);
    for (let n = 6; z.length % 8; n++) z = real(n);
    expect(padStream(z, inflate)).toBe(z);
  });

  it('copes with a stream that holds stored blocks (bit shifting would break their alignment)', () => {
    let z;
    for (let n = 1000; ; n++) {
      z = deflateRawSync(randomBytes(n), { level: 9 }); // incompressible: stored blocks
      if (z.length % 8 !== 0) break;
    }
    const p = padStream(z, inflate);
    expect(p.length % 8).toBe(0);
    expect(Buffer.compare(inflate(p), inflate(z))).toBe(0);
  });

  it('refuses an invalid stream', () => {
    expect(() => padStream(Buffer.from([1, 2, 3]), inflate)).toThrow();
  });
});

describe('utf16 file', () => {
  it('begins with the byte order mark and holds only alphabet units between the markers', () => {
    const z = padStream(deflateRawSync(Buffer.from('console.log(1)'.repeat(300)), { level: 9 }), inflate);
    const file = buildContainer(z, 'utf16');
    expect(file[0]).toBe(0xff);
    expect(file[1]).toBe(0xfe);
    const text = file.toString('utf16le', 2);
    const body = text.slice(UTF16_HEAD.length, text.length - UTF16_TAIL.length);
    for (let i = 0; i < body.length; i++) expect(inAlphabet(body.charCodeAt(i))).toBe(true);
  });

  it('is decoded as a browser decodes it, and the shipped digit loop gives back the exact stream', () => {
    for (const n of [1, 7, 100, 3000]) {
      const z = padStream(deflateRawSync(randomBytes(n * 3), { level: 9 }), inflate);
      const file = buildContainer(z, 'utf16');
      const back = browserDecode(file);
      expect(Buffer.compare(back, z)).toBe(0);
      expect(Buffer.compare(inflate(back), inflate(z))).toBe(0);
    }
  });

  it('carries the empty payload and one-character payloads', () => {
    for (const text of ['', ';', 'x', '</script>', '<!--']) {
      const z = padStream(deflateRawSync(Buffer.from(text), { level: 9 }), inflate);
      const file = buildContainer(z, 'utf16');
      expect(inflate(extractStream(file).stream).toString()).toBe(text);
      expect(inflate(browserDecode(file)).toString()).toBe(text);
    }
  });

  it('refuses a stream that is not a multiple of 8 bytes', () => {
    expect(() => buildContainer(Buffer.alloc(9, 1), 'utf16')).toThrow();
  });

  it('writes the same bytes every time', () => {
    const z = padStream(deflateRawSync(Buffer.from('abc'.repeat(999)), { level: 9 }), inflate);
    expect(Buffer.compare(buildContainer(z, 'utf16'), buildContainer(z, 'utf16'))).toBe(0);
  });
});

describe('ascii file', () => {
  it('is plain ASCII and round-trips odd and even stream lengths', () => {
    for (const n of [1, 2, 3, 50, 51, 1000]) {
      const z = deflateRawSync(randomBytes(n), { level: 9 });
      const file = buildContainer(z, 'ascii');
      for (const b of file) expect(b).toBeLessThan(128);
      expect(file.toString('latin1').startsWith(ASCII_HEAD)).toBe(true);
      const ex = extractStream(file);
      expect(ex.container).toBe('ascii');
      expect(Buffer.compare(ex.stream, z)).toBe(0);
    }
  });
});

describe('extractStream', () => {
  it('rejects a file that is not a packed one', () => {
    expect(() => extractStream(Buffer.from('<html></html>'))).toThrow();
    expect(() => extractStream(Buffer.from('﻿hello', 'utf16le'))).toThrow();
  });
});

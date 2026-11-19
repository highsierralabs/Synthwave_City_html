// The public API: pack, quickSize, unpack.
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { pack, quickSize, unpack } from '../../tools/pack/index.mjs';

const sample = (n) => {
  let s = '';
  for (let i = 0; i < n; i++) s += `function f${i}(a,b){return a*${i}+b*${i * 7 % 13}-Math.sin(a/${i + 1})}\n`;
  return s;
};

describe('pack and unpack', () => {
  it('round-trips both containers at every level, including text the HTML parser would damage', async () => {
    const texts = [
      sample(300),
      '',
      '</script><!-- <script> "quote" \ back \r\n \0 \u2028 \u2029 \ufeff \ud800 lone',
      'α β γ 日本語 😀 ' + sample(20),
    ];
    for (const js of texts) {
      for (const container of ['utf16', 'utf16l', 'ascii']) {
        for (const level of ['fast', 'normal']) {
          const r = await pack(js, { container, level });
          expect(r.container).toBe(container);
          expect(r.html).toBeInstanceOf(Uint8Array);
          expect(r.overhead).toBe(r.html.length - r.deflated);
          // a lone surrogate does not survive a UTF-8 text round trip; compare through the same encoding
          expect(await unpack(r.html)).toBe(Buffer.from(js, 'utf8').toString('utf8'));
        }
      }
    }
  });

  it('round-trips random text of odd and even deflate lengths', async () => {
    const seen = new Set();
    for (let n = 50; n < 400; n += 3) {
      const js = randomBytes(n).toString('base64');
      const r = await pack(js, { level: 'fast' });
      seen.add(r.deflated % 8);
      expect(await unpack(r.html)).toBe(js);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('defaults to the utf16 container and starts with the byte order mark', async () => {
    const r = await pack(sample(100));
    expect(r.container).toBe('utf16');
    expect([r.html[0], r.html[1]]).toEqual([0xff, 0xfe]);
    expect(r.html.length % 2).toBe(0);
  });

  it('gives identical bytes for the same input, at every level', async () => {
    const js = sample(80);
    for (const level of ['fast', 'normal', 'max']) {
      for (const container of ['utf16', 'utf16l', 'ascii']) {
        const a = await pack(js, { level, container });
        const b = await pack(js, { level, container });
        expect(Buffer.compare(a.html, b.html)).toBe(0);
      }
    }
  }, 120000);

  it('is smaller with more effort, and never larger than zlib', async () => {
    const js = sample(250);
    const fast = await pack(js, { level: 'fast' });
    const normal = await pack(js, { level: 'normal' });
    const max = await pack(js, { level: 'max' });
    expect(fast.compressor).toBe('zlib-9');
    expect(normal.html.length).toBeLessThanOrEqual(fast.html.length);
    expect(max.html.length).toBeLessThanOrEqual(normal.html.length);
  }, 120000);

  it('keeps the wrapper small: overhead under the 1,300-byte budget at a 25 kB stream', async () => {
    let js = '';
    let seed = 7;
    while (Buffer.byteLength(js) < 60000) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      js += `var v${seed % 977}=${seed % 99991}+${(seed >>> 8) % 9973};function g${seed % 313}(){return v${seed % 977}*${(seed >>> 4) % 17}}\n`;
    }
    const r = await pack(js, { level: 'fast' });
    expect(r.deflated).toBeGreaterThan(15000);
    expect(r.overhead).toBeLessThan(1300);
  });

  it('refuses an unknown container or level', async () => {
    await expect(pack('x', { container: 'nope' })).rejects.toThrow();
    await expect(pack('x', { level: 'nope' })).rejects.toThrow();
  });
});

describe('quickSize', () => {
  it('estimates the fast-level file size to within a few bytes, synchronously', async () => {
    for (const n of [5, 100, 900]) {
      const js = sample(n);
      const est = quickSize(js);
      const real = (await pack(js, { level: 'fast' })).html.length;
      expect(typeof est).toBe('number');
      expect(Math.abs(est - real)).toBeLessThanOrEqual(4);
    }
  });

  it('orders inputs the way pack does', () => {
    expect(quickSize(sample(50))).toBeLessThan(quickSize(sample(500)));
  });
});

describe('unpack', () => {
  it('rejects bytes that are not a packed file', async () => {
    await expect(unpack(new TextEncoder().encode('<body>hello'))).rejects.toThrow();
    await expect(unpack(new Uint8Array(0))).rejects.toThrow();
  });
});

// T14: the linear-time block variant, across block boundaries (504 bytes of stream per block).
describe('utf16l (linear decode)', () => {
  it('round-trips streams of one to several blocks', async () => {
    for (const n of [10, 300, 700, 1500, 4000]) {
      const js = randomBytes(n).toString('base64');
      const r = await pack(js, { container: 'utf16l', level: 'fast' });
      expect(r.container).toBe('utf16l');
      expect(await unpack(r.html)).toBe(js);
    }
  });
});

// Regression: the packed stream must end exactly at the end of the final deflate block.
// The browser rejects trailing bytes; Node's inflateRawSync alone does not, so the check is explicit.
import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { pack } from '../../tools/pack/index.mjs';
import { extractStream } from '../../tools/pack/container.mjs';
import { inflate } from '../../tools/pack/deflate.mjs';

function consumed(stream) {
  return inflateRawSync(stream, { info: true }).engine.bytesWritten;
}

describe('no bytes after the final deflate block', () => {
  it('strict inflate rejects a stream with a trailing zero byte', () => {
    const good = Buffer.from('4b4c4a06 00'.replace(/ /g, ''), 'hex'); // "abc", raw deflate
    expect(inflate(good).toString()).toBe('abc');
    expect(() => inflate(Buffer.concat([good, Buffer.from([0])]))).toThrow();
  });

  it('every padded stream is consumed to its last byte, across many lengths', async () => {
    let text = 'var a=0;';
    for (let n = 0; n < 60; n++) {
      text += `function f${n}(x){return x*${n * 7919 % 1013}+"${'q'.repeat(n % 9)}"}`;
      const { html } = await pack(text, { level: 'fast' });
      const { stream } = extractStream(Buffer.from(html));
      expect(stream.length % 8).toBe(0);
      expect(consumed(stream)).toBe(stream.length);
    }
  });
});

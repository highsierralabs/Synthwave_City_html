// Self-extracting container. Owner: T01 (plans/T01-packer.md).
//
// STUB: the final signatures, with an uncompressed inline script so the build works end to end.
// T01 writes the real one.
import { deflateRawSync } from 'node:zlib';

/**
 * Packs JavaScript text into one self-extracting HTML file.
 *
 * @param {string} js  the program. It is evaluated as a classic script (indirect eval) after the
 *        document has been parsed; document.body exists.
 * @param {{ container?: 'utf16' | 'ascii', level?: 'fast' | 'normal' | 'max' }} [options]
 * @returns {Promise<{ html: Uint8Array, container: string, deflated: number, overhead: number }>}
 *        html: the whole file; deflated: bytes of the deflate stream; overhead: html - deflated.
 */
export async function pack(js, options = {}) {
  const html = new TextEncoder().encode(`<body><script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
  return { html, container: options.container ?? 'stub', deflated: quickSize(js), overhead: 0 };
}

/**
 * Fast synchronous estimate of the packed size of `js` in bytes, for choosing between candidates.
 * @param {string} js
 * @returns {number}
 */
export function quickSize(js) {
  return deflateRawSync(Buffer.from(js, 'utf8'), { level: 9 }).length;
}

/**
 * The inverse of pack, in Node: returns the JavaScript text inside a packed file.
 * @param {Uint8Array} html
 * @returns {Promise<string>}
 */
export async function unpack(html) {
  const text = new TextDecoder().decode(html);
  return text.slice('<body><script>'.length, -'</script>'.length).replace(/<\\\/script/g, '</script');
}

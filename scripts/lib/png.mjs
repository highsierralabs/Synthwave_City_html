// Minimal PNG reader (8-bit RGB or RGBA, not interlaced: what Chromium screenshots are) and image
// statistics. Standard library only.
import { inflateSync } from 'node:zlib';

/** Decodes a PNG buffer to { width, height, data: RGBA bytes }. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('only 8-bit, non-interlaced PNG');
      type = body[9];
    } else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`PNG colour type ${type} not supported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = cur[x * bpp];
      data[o + 1] = cur[x * bpp + 1];
      data[o + 2] = cur[x * bpp + 2];
      data[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    cur.copy(prev);
  }
  return { width, height, data };
}

/** mean: average of R, G, B over all pixels (0..255); clipped: share of pixels with all three
 *  channels >= 250; black: share with every channel <= 4; transparent: share with alpha < 255;
 *  colours: number of distinct RGB values (capped at 100000). */
export function imageStats({ width, height, data }) {
  let sum = 0, clipped = 0, black = 0, transparent = 0;
  const seen = new Set();
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    sum += r + g + b;
    if (r >= 250 && g >= 250 && b >= 250) clipped++;
    if (r <= 4 && g <= 4 && b <= 4) black++;
    if (data[i * 4 + 3] < 255) transparent++;
    if (seen.size < 100000) seen.add((r << 16) | (g << 8) | b);
  }
  return { mean: sum / (3 * n), clipped: clipped / n, black: black / n, transparent: transparent / n, colours: seen.size };
}

export function formatStats(s) {
  return `mean ${s.mean.toFixed(1)}/255  clipped ${(s.clipped * 100).toFixed(2)}%  black ${(s.black * 100).toFixed(1)}%  transparent ${(s.transparent * 100).toFixed(1)}%  colours ${s.colours}`;
}

/** Compares two decoded images: { differing, maxDiff, total }. */
export function diffImages(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { differing: Infinity, maxDiff: 255, total: 0 };
  let differing = 0, maxDiff = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(a.data[i * 4 + k] - b.data[i * 4 + k]));
    if (d > 0) differing++;
    if (d > maxDiff) maxDiff = d;
  }
  return { differing, maxDiff, total: n };
}

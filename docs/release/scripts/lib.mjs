import zop from '@gfx/zopfli';
import { buildContainer, padStream } from '../../tools/pack/container.mjs';
import { inflate } from '../../tools/pack/deflate.mjs';
const deflateAsync = zop.deflateAsync ?? zop.default?.deflateAsync;
export async function fileSize(js, it = 15) {
  const z = await deflateAsync(Buffer.from(js), { numiterations: it, blocksplitting: true, blocksplittingmax: 0 });
  return { deflate: z.length, file: buildContainer(padStream(z, inflate), 'utf16').length };
}

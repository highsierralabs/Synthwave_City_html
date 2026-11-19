// Buildings (plans/T05-buildings.md). Owner: T05.
//
// Every plan box is one instance of a cube; one draw call draws them all, in the main pass and in
// the mirror pass. The look is all in buildings.glsl.
import { B_SEED, BOX, F, O_BUILD, U_RES } from '../contracts';
import { addLayer } from '../engine';
import { buf, drawInst, gl, inst, OPAQUE, prog, state } from '../gl';
import { boxCount, boxes } from '../plan';
import src from './buildings.glsl';

/** Compiles the program, uploads the plan's boxes once and registers the draw at O_BUILD. */
export function init(): void {
  const p = prog(src, src);
  const vao = inst(buf(boxes), [4, 4]);
  addLayer(O_BUILD, () => {
    // The density prefix (section 11.1), extended to the end of its last building, whose boxes are
    // contiguous, so no building is ever drawn cut in half.
    let n = boxCount * F[U_RES + 3]! | 0;
    while (boxes[n * BOX + B_SEED] == boxes[n * BOX - BOX + B_SEED]) n++;
    gl.useProgram(p);
    state(OPAQUE);
    drawInst(vao, 36, n);
  }, 1);
}

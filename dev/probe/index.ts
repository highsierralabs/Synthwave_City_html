// Probe layer: flat-shaded, fogged instanced boxes at the plan's boxes, roof glows, a ground grid
// with the mirrored city and a fog-coloured sky. Enough to show the wrap, the far fade, the mirror
// pass and the fog. A harness tool (`--layers probe`), never shipped.
//
// It is written as the example for every layer: init() compiles, uploads once and registers draw
// functions; each draw binds its program, sets state() and draws. Nothing is allocated in a draw.
import { F, O_BUILD, O_GLOW, O_GROUND, O_SKY, U_RES } from '../../src/contracts';
import { addLayer } from '../../src/engine';
import { ADD, OPAQUE, SKY, buf, drawInst, gl, inst, prog, state, tri } from '../../src/gl';
import { boxCount, boxes } from '../../src/plan';
import boxGlsl from './box.glsl';
import glowGlsl from './glow.glsl';
import groundGlsl from './ground.glsl';
import skyGlsl from './sky.glsl';

/** Compiles the probe's programs, uploads the boxes once and registers four draws. */
export function init(): void {
  // Boxes: one instanced draw of every box, as a density prefix (the plan is shuffled, so a prefix
  // is an even sample). Drawn in the mirror pass too (reflect = 1).
  const box = prog(boxGlsl, boxGlsl);
  const vao = inst(buf(boxes), [4, 4]);
  addLayer(O_BUILD, () => {
    gl.useProgram(box);
    state(OPAQUE);
    drawInst(vao, 36, boxCount * F[U_RES + 3]!);
  }, 1);

  // Roof glows: the same vertex array, a quad per box, additive.
  const glow = prog(glowGlsl, glowGlsl);
  addLayer(O_GLOW, () => {
    gl.useProgram(glow);
    state(ADD);
    drawInst(vao, 6, boxCount * F[U_RES + 3]!);
  }, 1);

  // Ground: one quad, no attributes. Main pass only: it is the mirror.
  const ground = prog(groundGlsl, groundGlsl);
  addLayer(O_GROUND, () => {
    gl.useProgram(ground);
    state(OPAQUE);
    drawInst(null, 6, 1);
  });

  // Sky: the full-screen triangle at the far plane, after the opaques; mirrored too.
  const sky = prog(skyGlsl, skyGlsl);
  addLayer(O_SKY, () => {
    gl.useProgram(sky);
    state(SKY);
    tri();
  }, 1);
}

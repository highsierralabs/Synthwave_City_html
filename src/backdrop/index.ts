// Backdrop (plans/T04-backdrop.md). Owner: T04.
// The stage the city stands on: the ground plane with its streets, the street lamps, and the sky.
// No buffers: the ground is one quad, the lamps come from gl_InstanceID, the sky is the full-screen
// triangle. Three programs, three draw calls per pass.
import { F, O_GROUND, O_SKY, U_RES } from '../contracts';
import { addLayer } from '../engine';
import { OPAQUE, SKY, drawInst, gl, prog, state, tri } from '../gl';
import groundGlsl from './ground.glsl';
import lampGlsl from './lamp.glsl';
import skyGlsl from './sky.glsl';

/** Compiles the programs of this module, fills its buffers and registers its draw functions. */
export function init(): void {
  // Ground: main pass only, since it is the mirror.
  const ground = prog(groundGlsl, groundGlsl);
  addLayer(O_GROUND, () => {
    gl.useProgram(ground);
    state(OPAQUE);
    drawInst(null, 6, 1);
  });

  // Lamps: 8192 posts and 8192 heads, as a density prefix; mirrored in the wet road.
  const lamp = prog(lampGlsl, lampGlsl);
  addLayer(O_GROUND, () => {
    gl.useProgram(lamp);
    state(OPAQUE);
    drawInst(null, 36, 16384 * F[U_RES + 3]!);
  }, 1);

  // Sky: the far plane after the opaques; mirrored too.
  const sky = prog(skyGlsl, skyGlsl);
  addLayer(O_SKY, () => {
    gl.useProgram(sky);
    state(SKY);
    tri();
  }, 1);
}

// Air traffic (plans/T07-air-traffic.md). Owner: T07.
//
// No CPU data at all: every craft is an instance number, and air.glsl derives its lane, speed,
// size and colour from it and moves it with uTime. Two draws of one program over the same
// instances: the hulls (vertices 0..35, opaque) and the lights (vertices 36..53, additive).
import { F, O_GLOW, O_VEHICLE, U_RES } from '../contracts';
import { addLayer } from '../engine';
import { ADD, OPAQUE, drawInst, gl, prog, state } from '../gl';
import air from './air.glsl';

/** Craft at full density: 96 streams (2 axes x 8 avenues x 3 levels x 2 directions) of 48. */
const CRAFT = 4608;

/** Compiles the craft program and registers the hull and light draws, both mirrored. */
export function init(): void {
  const p = prog(air, air);
  addLayer(O_VEHICLE, () => {
    gl.useProgram(p);
    state(OPAQUE);
    drawInst(null, 36, CRAFT * F[U_RES + 3]!);
  }, 1);
  addLayer(O_GLOW, () => {
    gl.useProgram(p);
    state(ADD);
    // drawInst always starts at vertex 0; the lights start at 36, so draw them directly.
    gl.bindVertexArray(null);
    gl.drawArraysInstanced(4, 36, 18, CRAFT * F[U_RES + 3]!); // TRIANGLES
  }, 1);
}

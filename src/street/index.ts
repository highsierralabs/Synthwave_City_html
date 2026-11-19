// Street life (architecture.md 6.4, plans/T06-street-life.md). Owner: T06.
//
// No buffers: every car and walker is computed in its vertex shader from gl_InstanceID and the
// clock (car.glsl explains the lane layout). 384 lane slots x 64 cars = 24,576 cars; each is two
// boxes (body, cabin), four light sprites and a pool of light on the road. 25 cells x 32 walkers = 800 people near the camera.
// Every count is drawn as a density prefix, which thins evenly by construction.
import { F, O_GLOW, O_VEHICLE, U_RES } from '../contracts';
import { addLayer } from '../engine';
import { ADD, OPAQUE, drawInst, gl, prog, state } from '../gl';
import bodyGlsl from './body.glsl';
import carGlsl from './car.glsl';
import lightGlsl from './light.glsl';
import peopleGlsl from './people.glsl';

/** Compiles the three programs and registers the bodies (opaque) and the lights and people
 *  (additive, also in the mirror pass, so the wet road reflects them). */
export function init(): void {
  const body = prog(carGlsl + bodyGlsl, carGlsl + bodyGlsl);
  addLayer(O_VEHICLE, () => {
    gl.useProgram(body);
    state(OPAQUE);
    drawInst(null, 36, 49152 * F[U_RES + 3]!);
  });
  const light = prog(carGlsl + lightGlsl, carGlsl + lightGlsl);
  const people = prog(peopleGlsl, peopleGlsl);
  addLayer(O_GLOW, () => {
    gl.useProgram(light);
    state(ADD);
    drawInst(null, 6, 122880 * F[U_RES + 3]!);
    gl.useProgram(people);
    drawInst(null, 6, 800 * F[U_RES + 3]!);
  }, 1);
}

// Lights (plans/T08-lights.md). Owner: T08.
//
// Searchlights, beacon pillars, laser fans, aviation lights (beam.glsl) and holographic billboards
// (holo.glsl). Both programs read the plan's boxes as instances and decide in the vertex shader which
// box carries what, so no site list is built on the CPU. The glyph atlas for the billboards is drawn
// once with fillText and lives on texture unit 3.
import { F, O_BEAM, O_HOLO, U_RES } from '../contracts';
import { addLayer } from '../engine';
import { ADD, bindTex, buf, drawInst, gl, inst, prog, state, tex } from '../gl';
import { boxCount, boxes } from '../plan';
import beamGlsl from './beam.glsl';
import holoGlsl from './holo.glsl';

/** Compiles the programs, draws the glyph atlas and registers the beam and billboard draws. */
export function init(): void {
  // Glyph atlas: 8 x 5 cells of 32 px. Vowels first, then consonants, then digits (holo.glsl).
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const c = canvas.getContext('2d')!;
  c.font = 'bold 27px sans-serif';
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  for (let i = 0; i < 33; i++) c.fillText('AEIOUYBCDFGHKLMNPRSTVXZ0123456789'[i]!, i % 8 * 32 + 16, (i >> 3) * 32 + 26);
  const atlas = tex(256, 160, c.getImageData(0, 0, 256, 160).data);

  const vao = inst(buf(boxes), [4, 4]);
  // Each draw: every box as an instance; then `extra` more vertices per instance, numbered on from
  // `verts`, over the first 1024 instances, which the shader reads as cells (plaza pieces).
  const layer = (order: number, p: WebGLProgram, verts: number, extra: number): void => addLayer(order, () => {
    gl.useProgram(p);
    state(ADD);
    bindTex(3, atlas);
    drawInst(vao, verts, boxCount * F[U_RES + 3]!);
    gl.drawArraysInstanced(4, verts, extra, 1024); // TRIANGLES
  }, 1);
  layer(O_BEAM, prog(beamGlsl, beamGlsl), 48, 78);
  layer(O_HOLO, prog(holoGlsl, holoGlsl), 30, 0);
}

// WebGL2 helper (architecture.md sections 10.4 to 10.6). Owner: T00.
//
// STUB: signatures only. T00 writes the bodies and may refine the parameter lists; when it is done,
// the comment above each export is the reference for every layer.
import common from './common.glsl';

/** The one context. Set by glInit. */
export let gl: WebGL2RenderingContext;

/** Creates the context (no antialias, no depth, no alpha). False when WebGL2 is missing. */
export function glInit(canvas: HTMLCanvasElement): boolean {
  gl = canvas.getContext('webgl2', { antialias: false, depth: false, alpha: false })!;
  return !!gl;
}

/** Compiles and links header + common.glsl + source for each stage, binds block F to point 0 and
 *  samplers T0..T7 to units 0..7. Failures go to console.error and window.__E. */
export function prog(vs: string, fs: string): WebGLProgram {
  void common; void vs; void fs;
  return gl.createProgram()!;
}

/** A static buffer holding `data`. */
export function buf(data: BufferSource): WebGLBuffer {
  void data;
  return gl.createBuffer()!;
}

/** A vertex array of per-instance attributes: `sizes[n]` floats at layout(location = n), all with
 *  divisor 1, interleaved in `data`. */
export function inst(data: Float32Array, sizes: number[]): WebGLVertexArrayObject {
  void data; void sizes;
  return gl.createVertexArray()!;
}

/** A texture. `data` may be null, bytes, or a canvas. `float` asks for RGBA16F. */
export function tex(w: number, h: number, data: ArrayBufferView | HTMLCanvasElement | null, float?: number): WebGLTexture {
  void w; void h; void data; void float;
  return gl.createTexture()!;
}

/** A render target: [framebuffer, colour texture]. `depth` adds a depth renderbuffer. */
export function target(w: number, h: number, depth?: number): [WebGLFramebuffer, WebGLTexture] {
  void w; void h; void depth;
  return [gl.createFramebuffer()!, gl.createTexture()!];
}

/** Sets blend, depth and culling for one of the draw modes (opaque, additive, sky, ...). */
export function state(mode: number): void {
  void mode;
}

/** Draws the full-screen triangle with the current program. */
export function tri(): void {}

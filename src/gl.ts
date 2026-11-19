// WebGL2 helper (architecture.md sections 10.4 to 10.6). Owner: T00.
//
// The only module that creates GL objects. Layers call these functions and `gl` itself for the few
// calls the helper does not wrap (useProgram, uniform*, bufferSubData). Every export has a comment
// saying what it does, what it costs at run time, and an example line; that comment is the reference.
//
// GL enums are written as numbers with their name beside them: a `gl.FOO` property ships its name in
// the packed file, a number does not.
import common from './common.glsl';

/** The one WebGL2 context. Valid after glInit returned true.
 *  Use it directly for what the helper does not wrap, e.g. `gl.useProgram(p)`. */
export let gl: WebGL2RenderingContext;

/** 1 when the GPU can render to half-float targets (EXT_color_buffer_float or _half_float), else 0
 *  and every target() is RGBA8: values above 1 clip. Read-only. */
export let floatTargets = 0;

/** Creates the context: no antialias, no depth, no alpha (the scene is drawn into the engine's own
 *  target). Sets depth func LEQUAL and blend func ONE, ONE once; nothing else ever changes them.
 *  Returns false when WebGL2 is missing. Called by boot(); layers never call it. */
export function glInit(canvas: HTMLCanvasElement): boolean {
  gl = canvas.getContext('webgl2', { antialias: false, depth: false, alpha: false })!;
  if (!gl) return false;
  floatTargets = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float') ? 1 : 0;
  gl.depthFunc(515); // LEQUAL
  gl.blendFunc(1, 1); // ONE, ONE
  return true;
}

// Prepended to every shader. highp everywhere (Agents.md, GLSL); sampler2D is lowp by default.
const HEAD = '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;\n';

function stage(p: WebGLProgram, type: number, text: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, HEAD + text);
  gl.compileShader(s);
  gl.attachShader(p, s);
  return s;
}

/** Compiles and links a program from two GLSL texts (imported .glsl files). Each stage is
 *  `#version 300 es` + precision lines + (fragment only) `#define FS` + common.glsl + your text, so
 *  never write #version or precision yourself. One file may serve both stages: `prog(src, src)` with
 *  the fragment code inside `#ifdef FS` and the vertex code in its `#else` (see dev/probe/).
 *
 *  - Block F needs no binding call: every uniform block starts at binding point 0, where the engine
 *    keeps F (GLES 3.0 default, shown on the GPU by `npm run probe` item c).
 *  - Samplers T1..T7 are set to texture units 1..7 here; T0 is unit 0 by default.
 *  - Per-program uniforms are the reserved names X0..X3. Look them up once, after prog:
 *    `const x0 = gl.getUniformLocation(p, 'X0');` then in draw `gl.uniform4f(x0, ...)`.
 *  - On a compile or link failure the logs go to console.error and window.__E, and the returned
 *    program is unusable: its draws do nothing and the rest of the city still renders.
 *  - Leaves the program bound. Cost: init only; call it in init(), never in a frame.
 *
 *  `const p = prog(boxGlsl, boxGlsl);` */
export function prog(vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  const v = stage(p, 35633, common + '\n' + vs); // VERTEX_SHADER
  const f = stage(p, 35632, '#define FS\n' + common + '\n' + fs); // FRAGMENT_SHADER
  gl.linkProgram(p);
  if (gl.getProgramParameter(p, 35714)) { // LINK_STATUS
    gl.useProgram(p);
    for (let i = 1; i < 8; i++) gl.uniform1i(gl.getUniformLocation(p, 'T' + i), i);
  } else {
    const log = gl.getShaderInfoLog(v)! + gl.getShaderInfoLog(f) + gl.getProgramInfoLog(p);
    (window.__E ||= []).push(log);
    console.error(log);
    if (DEV) {
      // Show the offending lines. Line numbers count from the start of the composed source.
      for (const [name, s, text] of [['vertex', v, HEAD + common + '\n' + vs], ['fragment', f, HEAD + '#define FS\n' + common + '\n' + fs]] as const) {
        const lines = text.split('\n');
        for (const m of (gl.getShaderInfoLog(s) ?? '').matchAll(/ERROR: \d+:(\d+):/g)) {
          const n = Number(m[1]);
          if (n <= lines.length) console.error(`${name} line ${n}: ${lines[n - 1]}`);
        }
      }
    }
  }
  return p;
}

/** A buffer holding `data`, bound to ARRAY_BUFFER. `usage` defaults to STATIC_DRAW (35044); pass
 *  DYNAMIC_DRAW (35048) for a buffer you rewrite each frame with
 *  `gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);` (no allocation).
 *  Cost: one upload. `const b = buf(boxes);` */
export function buf(data: BufferSource, usage = 35044): WebGLBuffer {
  const b = gl.createBuffer()!;
  gl.bindBuffer(34962, b); // ARRAY_BUFFER
  gl.bufferData(34962, data, usage);
  return b;
}

/** A vertex array whose attributes are all per instance (divisor 1), read from one interleaved
 *  float buffer: `sizes[n]` floats at `layout(location = n) in vec<sizes[n]>`, n = 0, 1, ... Sizes
 *  are 1 to 4; a record of 8 floats is [4, 4]. Positions never come from a buffer: geometry is
 *  built from gl_VertexID (cube(), quad() in common.glsl). Leaves the vertex array bound.
 *  Cost: init only. `const vao = inst(buf(boxes), [4, 4]);` */
export function inst(buffer: WebGLBuffer, sizes: number[]): WebGLVertexArrayObject {
  const v = gl.createVertexArray()!;
  gl.bindVertexArray(v);
  gl.bindBuffer(34962, buffer);
  let stride = 0, offset = 0;
  for (const s of sizes) stride += s * 4;
  sizes.forEach((s, n) => {
    gl.enableVertexAttribArray(n);
    gl.vertexAttribPointer(n, s, 5126, false, stride, offset); // FLOAT
    gl.vertexAttribDivisor(n, 1);
    offset += s * 4;
  });
  return v;
}

/** The instanced draw: `count` instances of `verts` vertices as triangles, from vertex array `vao`
 *  (null for a draw with no attributes, positions from gl_VertexID and gl_InstanceID). A fractional
 *  count is truncated, so a density prefix needs no rounding. Uses the program you bound.
 *  Cost: one draw call.
 *  `drawInst(vao, 36, boxCount * F[U_RES + 3]);`   36 = cube(), 6 = quad(), 3 = screen() */
export function drawInst(vao: WebGLVertexArrayObject | null, verts: number, count: number): void {
  gl.bindVertexArray(vao);
  gl.drawArraysInstanced(4, 0, verts, count); // TRIANGLES
}

/** Draws the full-screen triangle (screen() in common.glsl) with the program you bound.
 *  Cost: one draw call. `gl.useProgram(sky); state(SKY); tri();` */
export function tri(): void {
  drawInst(null, 3, 1);
}

/** A w x h RGBA texture with linear filtering, clamped at the edges, no mipmaps, left bound to the
 *  active unit. `data` is null or w*h*4 bytes (Uint8Array, or the Uint8ClampedArray of a canvas:
 *  `tex(w, h, ctx.getImageData(0, 0, w, h).data)`; rows go bottom to top in texture space).
 *  `float` = 1 makes it RGBA16F (data must be null), or RGBA8 when floatTargets is 0. `t` re-uses an
 *  existing texture (new storage, same handle). For exact texels use texelFetch in GLSL.
 *  Cost: one upload. `atlas = tex(256, 64, pixels);` */
export function tex(w: number, h: number, data: ArrayBufferView | null, float = 0, t: WebGLTexture = gl.createTexture()!): WebGLTexture {
  float &&= floatTargets;
  gl.bindTexture(3553, t); // TEXTURE_2D
  // RGBA16F, RGBA, HALF_FLOAT  or  RGBA8, RGBA, UNSIGNED_BYTE
  gl.texImage2D(3553, 0, float ? 34842 : 32856, w, h, 0, 6408, float ? 5131 : 5121, data);
  gl.texParameteri(3553, 10241, 9729); // MIN_FILTER LINEAR
  gl.texParameteri(3553, 10242, 33071); // WRAP_S CLAMP_TO_EDGE
  gl.texParameteri(3553, 10243, 33071); // WRAP_T CLAMP_TO_EDGE
  return t;
}

/** A render target: [framebuffer, colour texture, depth renderbuffer or null, width, height]. */
export type Target = [WebGLFramebuffer, WebGLTexture, WebGLRenderbuffer | null, number, number];

/** A w x h render target with an RGBA16F colour texture (RGBA8 without floatTargets) and, when
 *  `depth` is 1, a 24-bit depth renderbuffer. Pass the old target as `old` to resize it in place
 *  (same handles, new storage), so a resize never leaks. Leaves the framebuffer bound.
 *  Only the engine and post bind framebuffers; layers never do.
 *  Cost: allocation; call it in init and in onResize callbacks only.
 *  `half = target(w >> 1, h >> 1, 0, half);` */
export function target(w: number, h: number, depth = 0, old?: Target): Target {
  const t: Target = [old ? old[0] : gl.createFramebuffer()!, tex(w, h, null, 1, old?.[1]), old ? old[2] : depth ? gl.createRenderbuffer() : null, w, h];
  gl.bindFramebuffer(36160, t[0]); // FRAMEBUFFER
  gl.framebufferTexture2D(36160, 36064, 3553, t[1], 0); // COLOR_ATTACHMENT0
  if (t[2]) {
    gl.bindRenderbuffer(36161, t[2]); // RENDERBUFFER
    gl.renderbufferStorage(36161, 33190, w, h); // DEPTH_COMPONENT24
    gl.framebufferRenderbuffer(36160, 36096, 36161, t[2]); // DEPTH_ATTACHMENT
  }
  return t;
}

/** Draws into target `t` from now on, with the viewport set to its size; null is the canvas.
 *  For post only. Cost: two GL calls. `bindTarget(half); ... bindTarget(null);` */
export function bindTarget(t: Target | null): void {
  gl.bindFramebuffer(36160, t && t[0]);
  gl.viewport(0, 0, t ? t[3] : gl.drawingBufferWidth, t ? t[4] : gl.drawingBufferHeight);
}

/** Binds texture `t` (or null) to texture unit `unit`, where sampler T<unit> reads it. Units: 0 pass
 *  input (post), 1 mirror and 2 cells (both bound by the engine every frame), 3 glyph atlas (its
 *  owner binds it in its draw), 4 to 7 post. Cost: two GL calls. `bindTex(3, atlas);` */
export function bindTex(unit: number, t: WebGLTexture | null): void {
  gl.activeTexture(33984 + unit); // TEXTURE0
  gl.bindTexture(3553, t);
}

// ---- draw state --------------------------------------------------------------------------------
// state(mode) takes one of these. Bits: 1 depth test, 2 depth write, 4 additive blend, 8 cull back
// faces. Depth func is always LEQUAL and blending always ONE, ONE (section 6.5: every translucent
// effect is additive).

/** Depth test and write, back faces culled: walls, hulls, the ground. */
export const OPAQUE = 11;
/** Depth test and write, both faces drawn: thin panels, meshes seen from both sides. */
export const TWO_SIDED = 3;
/** Added to what is there (ONE, ONE), depth tested, no depth write, both faces: glows, beams,
 *  trails, sprites, billboards. Also post's upsample-and-add (its targets have no depth). */
export const ADD = 5;
/** Depth tested, nothing written to depth, both faces: the sky at the far plane after the opaques. */
export const SKY = 1;
/** No test, no blend: full-screen passes in post. */
export const FULL = 0;

function cap(c: number, on: number): void {
  on ? gl.enable(c) : gl.disable(c);
}

/** Sets depth test, depth write, blending and culling for one of the modes above. Call it at the
 *  top of every draw; never assume what the previous layer left. Front-face winding belongs to the
 *  engine (it flips it for the mirror pass). Cost: four GL calls. `state(OPAQUE);` */
export function state(mode: number): void {
  cap(2929, mode & 1); // DEPTH_TEST
  gl.depthMask(!!(mode & 2));
  cap(3042, mode & 4); // BLEND
  cap(2884, mode & 8); // CULL_FACE
}

// GPU probe page for `npm run probe` (plans/T00-foundation.md, M1). Not shipped.
// Proves the WebGL2 assumptions the helper and every layer rely on, on the real GPU, and reports
// pass or fail per item in window.__PROBE. scripts/probe.mjs prints it.
import { ADD, OPAQUE, bindTarget, bindTex, buf, drawInst, floatTargets, gl, glInit, inst, prog, state, target, tri } from '../../src/gl';
import { F } from '../../src/contracts';
import a from './a.glsl';
import b from './b.glsl';
import c from './c.glsl';
import d from './d.glsl';
import e from './e.glsl';
import f from './f.glsl';
import all from './all.glsl';

type Result = { item: string; ok: boolean; detail: string };
declare global {
  interface Window { __PROBE?: Result[]; __PROBE_INFO?: string }
}

const results: Result[] = [];
const report = (item: string, ok: boolean, detail: string): void => {
  results.push({ item, ok, detail });
};

function read(w: number, h: number): Float32Array {
  const out = new Float32Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, out);
  return out;
}
const px = (data: Float32Array, w: number, x: number, y: number): number[] => Array.from(data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const near = (u: number[], v: number[], eps = 1e-3): boolean => u.every((x, i) => Math.abs(x - v[i]!) <= eps);
const fmt = (v: number[]): string => '(' + v.map((x) => +x.toFixed(4)).join(', ') + ')';

function upload(): void {
  gl.bufferData(gl.UNIFORM_BUFFER, F, gl.DYNAMIC_DRAW);
}

function run(): void {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  document.body.append(canvas);
  if (!glInit(canvas)) {
    report('webgl2', false, 'no WebGL2 context');
    return;
  }
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__PROBE_INFO = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  report('float targets', floatTargets === 1, `floatTargets = ${floatTargets}`);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, gl.createBuffer());
  upload();

  // (a) instanced draw whose only attributes have divisor 1, corners from gl_VertexID.
  {
    const t = target(16, 16);
    bindTarget(t);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const p = prog(a, a);
    const data = new Float32Array([
      -0.5, -0.5, 0.25, 0, 1, 0, 0, 1,
      0.5, -0.5, 0.25, 0, 0, 1, 0, 1,
      -0.5, 0.5, 0.25, 0, 0, 0, 1, 1,
      0.5, 0.5, 0.25, 0, 1, 1, 0, 1,
    ]);
    const vao = inst(buf(data), [4, 4]);
    gl.useProgram(p);
    state(OPAQUE);
    drawInst(vao, 6, 4);
    const out = read(16, 16);
    const got = [px(out, 16, 4, 4), px(out, 16, 12, 4), px(out, 16, 4, 12), px(out, 16, 12, 12)];
    const want = [[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1], [1, 1, 0, 1]];
    const bg = px(out, 16, 8, 8);
    const ok = got.every((g, i) => near(g, want[i]!)) && near(bg, [0, 0, 0, 0]);
    report('(a) instanced, divisor-1 attributes only, gl_VertexID corners', ok, `quadrants ${got.map(fmt).join(' ')}; gap ${fmt(bg)}; gl error ${gl.getError()}`);
  }

  // (b) a draw with no attributes at all, using gl_InstanceID.
  {
    const t = target(16, 16);
    bindTarget(t);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const p = prog(b, b);
    gl.useProgram(p);
    state(OPAQUE);
    drawInst(null, 6, 4);
    const out = read(16, 16);
    const got = [px(out, 16, 4, 4)[0]!, px(out, 16, 12, 4)[0]!, px(out, 16, 4, 12)[0]!, px(out, 16, 12, 12)[0]!];
    const ok = near(got, [1, 2, 3, 4]);
    report('(b) no attributes, gl_InstanceID', ok, `instance values by quadrant ${fmt(got)}; gl error ${gl.getError()}`);
  }

  // (c) the std140 block F: every float slot lands where section 10.2 says, with no binding call.
  {
    for (let i = 0; i < 64; i++) F[i] = i + 1;
    upload();
    const t = target(64, 1);
    bindTarget(t);
    const p = prog(c, c);
    gl.useProgram(p);
    state(0);
    tri();
    const out = read(64, 1);
    const bad: string[] = [];
    for (let i = 0; i < 64; i++) if (out[i * 4] !== i + 1) bad.push(`${i}:${out[i * 4]}`);
    const idx = gl.getUniformBlockIndex(p, 'F');
    const binding = gl.getActiveUniformBlockParameter(p, idx, gl.UNIFORM_BLOCK_BINDING);
    const size = gl.getActiveUniformBlockParameter(p, idx, gl.UNIFORM_BLOCK_DATA_SIZE);
    report('(c) std140 block F slots 0..63', bad.length === 0 && binding === 0 && size === 256,
      `${64 - bad.length}/64 slots right${bad.length ? ' wrong: ' + bad.slice(0, 8).join(' ') : ''}; block binding ${binding}; data size ${size} bytes`);
    F.fill(0);
    upload();
  }

  // (d) RGBA16F target with a depth renderbuffer: values above 1 survive, depth rejects, and the
  // texture filters linearly.
  {
    const t = target(2, 1, 1);
    bindTarget(t);
    state(OPAQUE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = prog(d, d);
    gl.useProgram(p);
    const x0 = gl.getUniformLocation(p, 'X0');
    gl.disable(gl.CULL_FACE);
    gl.uniform4f(x0, 0, 2, 6, 0);
    drawInst(null, 6, 1);
    gl.uniform4f(x0, 0.5, 9, 9, 0); // farther: must be rejected
    drawInst(null, 6, 1);
    const first = read(2, 1);
    const left = first[0]!, right = first[4]!;
    const t2 = target(1, 1);
    bindTarget(t2);
    const q = prog(e, e);
    gl.useProgram(q);
    bindTex(0, t[1]);
    state(0);
    tri();
    const mid = read(1, 1)[0]!;
    // additive state onto the 1 x 1: 4 + 4 = 8
    state(ADD);
    tri();
    const added = read(1, 1)[0]!;
    const ok = left === 2 && right === 6 && Math.abs(mid - 4) < 0.01 && Math.abs(added - 8) < 0.02;
    report('(d) RGBA16F + depth: >1 survives, depth test, linear filter, additive blend', ok,
      `pixels ${left}, ${right} (want 2, 6; 9 means depth failed); linear sample ${mid} (want 4); after ADD ${added} (want 8); fb status ${gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? 'complete' : 'INCOMPLETE'}; gl error ${gl.getError()}`);
  }

  // (e) every function in common.glsl compiles in both stages.
  {
    const before = (window.__E ?? []).length;
    const p = prog(all, all);
    const errors = (window.__E ?? []).slice(before);
    const linked = gl.getProgramParameter(p, gl.LINK_STATUS) === true;
    const shaders = gl.getAttachedShaders(p) ?? [];
    const logs = shaders.map((s) => (gl.getShaderInfoLog(s) ?? '').trim()).filter((s) => s);
    report('(e) every common.glsl function compiles in vertex and fragment', linked && errors.length === 0,
      `linked ${linked}; errors ${errors.length ? errors.join(' | ') : 'none'}; warnings ${logs.length ? logs.join(' | ') : 'none'}`);
  }

  // (f) cube() winding: seen from +z with back faces culled, the +z face is what shows.
  {
    F.fill(0);
    F[0] = 0.5; F[5] = 0.5; F[13] = -0.25; F[10] = -0.5; F[15] = 1;
    upload();
    const t = target(8, 8, 1);
    bindTarget(t);
    state(OPAQUE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const p = prog(f, f);
    gl.useProgram(p);
    drawInst(null, 36, 1);
    const n = px(read(8, 8), 8, 4, 4);
    gl.frontFace(gl.CW);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawInst(null, 36, 1);
    const flipped = px(read(8, 8), 8, 4, 4);
    gl.frontFace(gl.CCW);
    report('(f) cube() is counter-clockwise from outside', near(n, [0, 0, 1, 1]) && near(flipped, [0, 0, -1, 1]),
      `normal seen ${fmt(n)} (want +z); with frontFace CW ${fmt(flipped)} (want -z)`);
    F.fill(0);
  }
}

try {
  run();
} catch (err) {
  report('exception', false, String(err));
}
window.__PROBE = results;

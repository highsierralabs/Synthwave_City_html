// Post (plans/T09-post.md, architecture.md section 6.6). Owner: T09.
//
// Each frame: five downsamples (scene -> 1/2 -> ... -> 1/32; the first one sanitises and thresholds),
// four upsamples each added onto the next larger level, then one full-screen pass to the canvas that
// adds the bloom to the scene and grades it. One program; X0.x picks the pass (post.glsl).
// Units: 4 holds the scene for every pass, 0 the level being read.
import { onResize, setPost } from '../engine';
import { ADD, FULL, bindTarget, bindTex, gl, prog, state, target, tri, type Target } from '../gl';
import postGlsl from './post.glsl';

/** Number of bloom levels; level i is the scene size divided by 2^(i+1). */
const LEVELS = 5;

const levels: Target[] = [];

/** Compiles the post program, sizes the bloom chain on every scene resize and registers the pass. */
export function init(): void {
  const p = prog(postGlsl, postGlsl);
  const x0 = gl.getUniformLocation(p, 'X0');
  onResize((w, h) => {
    for (let i = 0; i < LEVELS; i++) levels[i] = target(w >> i + 1 || 1, h >> i + 1 || 1, 0, levels[i]);
  });
  setPost((scene) => {
    gl.useProgram(p);
    bindTex(4, scene);
    state(FULL);
    for (let i = 0; i < LEVELS; i++) {
      bindTarget(levels[i]!);
      bindTex(0, i ? levels[i - 1]![1] : null);
      gl.uniform4f(x0, i ? 1 : 0, 0, 0, 0);
      tri();
    }
    state(ADD);
    for (let i = LEVELS; --i;) {
      bindTarget(levels[i - 1]!);
      bindTex(0, levels[i]![1]);
      tri();
    }
    bindTarget(null);
    bindTex(0, levels[0]![1]);
    state(FULL);
    gl.uniform4f(x0, 2, 0, 0, 0);
    tri();
  });
}

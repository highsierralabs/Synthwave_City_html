// Engine: boot, frame loop, uniform block, passes, registries (architecture.md section 4).
// Owner: T00.
//
// STUB: signatures only. T00 writes the bodies; when it is done, the comment above each export is
// the reference for every other module.
import { glInit } from './gl';
import { buildPlan } from './plan';
import { SEED } from './contracts';

/** Size of the scene target in pixels (canvas size times the render scale). */
export let sceneW = 1;
export let sceneH = 1;

/** Creates the context, builds the plan, makes the targets. False when WebGL2 is missing. */
export function boot(canvas: HTMLCanvasElement): boolean {
  if (!glInit(canvas)) return false;
  buildPlan(SEED);
  return true;
}

/** Registers a draw function. Lower `order` draws first (contracts.ts, O_*). `pass` is 0 for the
 *  main pass and 1 for the mirror pass; a layer is drawn in the mirror pass only if `reflect`. */
export function addLayer(order: number, draw: (pass: number) => void, reflect?: number): void {
  void order; void draw; void reflect;
}

/** Registers a per-frame update, called with dt in seconds before the frame is drawn. */
export function addUpdate(fn: (dt: number) => void): void {
  void fn;
}

/** Registers a callback for changes of the scene size. */
export function onResize(fn: (w: number, h: number) => void): void {
  void fn;
}

/** Sets the function that turns the finished scene texture into the picture on the canvas. */
export function setPost(fn: (scene: WebGLTexture) => void): void {
  void fn;
}

/** Starts the frame loop. */
export function run(): void {}

/** Draws one frame at a fixed time, with no clock. For the harness. */
export function frame(seconds: number): void {
  void seconds;
}

/** Sets quality 0, 1 or 2 (section 11.1). Takes effect on the next frame. */
export function setQuality(q: number): void {
  void q;
}

/** Sets the mood to ease towards: 0 sunset, 1 midnight, 2 miami. */
export function setMood(m: number): void {
  void m;
}

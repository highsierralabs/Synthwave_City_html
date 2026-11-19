// Camera: the listeners and the glue (architecture.md section 8). Owner: T11 (plans/T11-camera.md).
// The mathematics is in tour.ts; this file only turns pointer and key events into its input.
import { addUpdate } from '../engine';
import { camReset, camToggle, camUpdate, I_CALM, I_DOWN, I_DX, I_DY, I_KEYS, I_ZOOM, IN } from './tour';

/** Attaches pointer and key listeners to `element` and registers the update that writes P. */
export function cameraInit(element: HTMLElement): void {
  camReset();
  IN[I_CALM] = +matchMedia('(prefers-reduced-motion:reduce)').matches;
  addUpdate(camUpdate);
  element.style.touchAction = 'none';
  // The first pointer down looks; any further one held down flies forward (in free flight).
  let id = -1;
  let lx = 0;
  let ly = 0;
  element.addEventListener('pointerdown', (e) => {
    IN[I_DOWN] = IN[I_DOWN]! + 1;
    if (id < 0) id = e.pointerId, lx = e.clientX, ly = e.clientY, element.setPointerCapture(id);
  });
  element.addEventListener('pointermove', (e) => {
    if (e.pointerId == id) IN[I_DX] = IN[I_DX]! + e.clientX - lx, IN[I_DY] = IN[I_DY]! + e.clientY - ly, lx = e.clientX, ly = e.clientY;
  });
  const up = (e: PointerEvent): void => {
    IN[I_DOWN] = Math.max(0, IN[I_DOWN]! - 1);
    if (e.pointerId == id) id = -1;
  };
  element.addEventListener('wheel', (e) => IN[I_ZOOM] = IN[I_ZOOM]! + e.deltaY);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
  // W S A D Q E and the arrows by position (e.code), Shift from the event; nothing is prevented.
  const key = (e: KeyboardEvent): void => {
    const i = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.code);
    let k = IN[I_KEYS]! & 1023;
    if (i >= 0) k = e.type == 'keydown' ? k | 1 << i : k & ~(1 << i);
    IN[I_KEYS] = k | +e.shiftKey << 10;
  };
  addEventListener('keydown', key);
  addEventListener('keyup', key);
  addEventListener('blur', () => IN[I_KEYS] = 0);
}

/** Toggles between the tour (0) and free flight (1). Returns the new mode. */
export function cameraMode(): number {
  return camToggle();
}

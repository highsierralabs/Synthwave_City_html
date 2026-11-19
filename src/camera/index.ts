// Owner: T11 (plans/T11-camera.md). STUB: the final signatures, and a fixed pose so there is
// something to see before T11 lands.
import { P, P_FOV, P_PITCH, P_X, P_Y, P_YAW, P_Z } from '../contracts';

/** Attaches pointer and key listeners to `element` and registers the update that writes P. */
export function cameraInit(element: HTMLElement): void {
  void element;
  P[P_X] = 2048; P[P_Y] = 180; P[P_Z] = 2048; P[P_YAW] = 0.6; P[P_PITCH] = -0.15; P[P_FOV] = 1.1;
}

/** Toggles between the tour (0) and free flight (1). Returns the new mode. */
export function cameraMode(): number {
  return 0;
}

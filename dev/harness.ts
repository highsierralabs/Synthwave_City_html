// Dev harness: the entry used by scripts/shot.mjs, scripts/dev.mjs and scripts/verify.mjs.
// A generated entry imports this and only the layers it was asked for, then calls harness().
// Not shipped. Its own code does not use DEV, so it also runs inside a packed build (verify).
//
// Parameters come from location.hash, e.g.
//   #cam=2048,300,2048,0.6,-0.3&t=5&q=2&mood=0&post=1
//   cam   x,y,z,yaw,pitch[,roll,fov]   pose (contracts.ts P); overrides view
//   view  street | high | far | top | edge   named poses (VIEWS below)
//   t     seconds; freezes time and draws that one frame. Without t the loop runs live.
//   q     quality 0, 1, 2 (default 2)        mood  0, 1, 2 (default 0)
//   post  0 skips post's init (the engine's plain blit is used)
//   tour  1 lets the camera module drive (when the entry included it)
//
// window.__H (for scripts): go(hash) re-applies parameters and draws; step(t, dx, dy, dz) moves
// the camera and draws at time t; info() describes the run. window.__READY is set after the first
// requested frame.
import { boot, frame, run, sceneH, sceneW, setMood, setQuality } from '../src/engine';
import { gl } from '../src/gl';
import { P, P_FOV, P_PITCH, P_ROLL, P_X, P_Y, P_YAW, P_Z } from '../src/contracts';
import { boxCount, megaCount } from '../src/plan';

type Init = () => void;
type Info = {
  renderer: string; layers: string[]; draws: number; instances: number; scene: string;
  boxes: number; megas: number; errors: string[]; pose: number[]; ms: number;
};
declare global {
  interface Window {
    __READY?: boolean;
    __H?: {
      go(hash: string): void;
      step(t: number, dx: number, dy: number, dz: number): void;
      info(): Info;
    };
  }
}

/** Named poses: x, y, z, yaw, pitch. x = 2048 is an avenue line (2048 / 128 = 16, 16 % 4 = 0). */
const VIEWS: Record<string, number[]> = {
  street: [2051.5, 1.7, 2300, 0, 0.03], // right-hand lane of an avenue, eye height, looking -z
  high: [2048, 300, 2048, 0.6, -0.3],
  far: [2048, 1500, 2048, 0.6, -0.6],
  top: [2048, 600, 2048, 0, -1.5707],
  edge: [4090, 120, 2048, 1.5708, -0.1], // looking along -x across the tile edge at x = 0
};

let draws = 0;
let instances = 0;

function params(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of hash.replace(/^#/, '').split('&')) {
    const i = kv.indexOf('=');
    if (i > 0) out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
  }
  return out;
}

function pose(p: Record<string, string>): void {
  const v = p.cam ? p.cam.split(',').map(Number) : VIEWS[p.view ?? 'high'] ?? VIEWS.high!;
  P[P_X] = v[0] ?? 2048;
  P[P_Y] = v[1] ?? 300;
  P[P_Z] = v[2] ?? 2048;
  P[P_YAW] = v[3] ?? 0;
  P[P_PITCH] = v[4] ?? 0;
  P[P_ROLL] = v[5] ?? 0;
  P[P_FOV] = v[6] ?? 1.1;
}

export function harness(layers: [string, Init][], camera?: (el: HTMLElement) => void): void {
  document.title = 'harness';
  document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  document.body.append(canvas);
  let p = params(location.hash);
  const started = performance.now();
  if (!boot(canvas)) {
    document.body.textContent = 'no WebGL2';
    window.__READY = true;
    return;
  }
  // Count draw calls and instances, for info().
  const inner = gl.drawArraysInstanced.bind(gl);
  gl.drawArraysInstanced = (mode: number, first: number, count: number, n: number): void => {
    draws++;
    instances += Math.floor(n);
    inner(mode, first, count, n);
  };
  setQuality(Number(p.q ?? 2));
  const names: string[] = [];
  for (const [name, init] of layers) {
    if (name === 'post' && p.post === '0') continue;
    init();
    names.push(name);
  }
  // With tour=1 the camera module owns P from cameraInit on; cam and view are ignored.
  const tour = p.tour === '1' && camera;
  if (tour) camera(canvas);
  else pose(p);
  setMood(Number(p.mood ?? 0), 1);
  let ms = 0;

  const draw = (t: number): void => {
    draws = instances = 0;
    const t0 = performance.now();
    frame(t);
    ms = performance.now() - t0;
  };
  window.__H = {
    go(hash: string) {
      p = params(hash);
      setQuality(Number(p.q ?? 2));
      setMood(Number(p.mood ?? 0), 1);
      if (!tour) pose(p);
      draw(Number(p.t ?? 10));
    },
    step(t: number, dx: number, dy: number, dz: number) {
      P[P_X] = P[P_X]! + dx;
      P[P_Y] = P[P_Y]! + dy;
      P[P_Z] = P[P_Z]! + dz;
      draw(t);
    },
    info(): Info {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
        layers: names, draws, instances, scene: `${sceneW}x${sceneH}`, boxes: boxCount, megas: megaCount,
        errors: window.__E ?? [], pose: Array.from(P.slice(0, 7), (x) => +x.toFixed(3)), ms: +ms.toFixed(2),
      };
    },
  };
  if (p.t === undefined) {
    run();
  } else {
    draw(Number(p.t));
  }
  console.log(`harness: ${names.join(', ') || 'no layers'} in ${(performance.now() - started).toFixed(0)} ms`);
  window.__READY = true;
}

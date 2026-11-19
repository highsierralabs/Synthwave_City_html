// The app shell and the entry point of the shipped file. Owner: T12 (plans/T12-app-shell.md).
//
// STUB: boots everything in the required order with a bare canvas. T12 builds the page around it.
import { boot, run } from './engine';
import { init as backdrop } from './backdrop/index';
import { init as buildings } from './buildings/index';
import { init as street } from './street/index';
import { init as air } from './air/index';
import { init as lights } from './lights/index';
import { init as post } from './post/index';
import { cameraInit } from './camera/index';
import { audioStart } from './audio/index';

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
document.body.append(canvas);
if (boot(canvas)) {
  backdrop();
  buildings();
  street();
  air();
  lights();
  post();
  cameraInit(canvas);
  addEventListener('pointerup', audioStart, { once: true });
  run();
}

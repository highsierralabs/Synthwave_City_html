// The real camera listeners on a plain element, stepped by hand: the page behind `npm run input`
// (scripts/input.mjs), which sends it real mouse and touch events. Added after the play test of
// 2026-11-19 (plans/T15-playtest-fixes.md).
import { P, SEED } from '../../src/contracts';
import { buildPlan } from '../../src/plan';
import { cameraInit, cameraMode } from '../../src/camera/index';
import { camUpdate, IN } from '../../src/camera/tour';
buildPlan(SEED);
document.body.style.margin = '0';
const el = document.createElement('div');
el.style.cssText = 'position:fixed;inset:0';
document.body.append(el);
cameraInit(el);
camUpdate(0);
(window as unknown as { T: unknown }).T = {
  step: (n: number) => { for (let i = 0; i < n; i++) camUpdate(1 / 60); return Array.from(P.slice(0, 5)).concat(IN[3]!, IN[6]!); },
  mode: cameraMode,
};

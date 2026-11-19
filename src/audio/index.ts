// Audio: the two stations and the beat (architecture.md section 7). Owner: T10 (plans/T10-audio.md).
// The synthesizer and scheduler are in synth.ts; this file is the live AudioContext, the lookahead
// timer, and the four exports the app shell calls.
import { addUpdate } from '../engine';
import { beat, begin, init, LEVEL, master, pump, station } from './synth';

let live: AudioContext | undefined;
let timer = 0;
let muted = false;

/** Every 25 ms, schedule what is due in the next 100 ms (Agents.md, Web Audio). */
function tick(): void {
  pump(live!.currentTime + 0.1);
}

/** Creates the AudioContext and starts the music. Must be called inside a gesture handler.
 *  Calling it again does nothing. */
export function audioStart(): void {
  if (live) return;
  init(live = new AudioContext(), muted ? 0 : LEVEL);
  begin();
  timer = setInterval(tick, 25);
  addUpdate(beat);
}

/** Toggles mute. Returns true when now muted. */
export function audioMute(): boolean {
  muted = !muted;
  if (live) master.gain.setTargetAtTime(muted ? 0 : LEVEL, live.currentTime, 0.03);
  return muted;
}

/** Steps to the next station. Returns its index, 0 or 1. */
export function audioStation(): number {
  return station();
}

/** Suspends when the tab is hidden and resumes when it is shown again. The audio clock stops while
 *  suspended, so nothing scheduled is late on return; pump() skips any step that is. */
export function audioHidden(hidden: boolean): void {
  if (!live) return;
  clearInterval(timer);
  if (hidden) live.suspend();
  else live.resume(), timer = setInterval(tick, 25);
}

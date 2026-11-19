// Owner: T10 (plans/T10-audio.md). STUB: the final signatures, no behaviour yet.

/** Creates the AudioContext and starts the music. Must be called inside a gesture handler.
 *  Calling it again does nothing. */
export function audioStart(): void {}

/** Toggles mute. Returns true when now muted. */
export function audioMute(): boolean {
  return false;
}

/** Steps to the next station. Returns its index, 0 or 1. */
export function audioStation(): number {
  return 0;
}

/** Suspends when the tab is hidden and resumes when it is shown again. */
export function audioHidden(hidden: boolean): void {
  void hidden;
}

// The synthesizer: the graph, the two stations, the bar generator and the lookahead scheduler.
// Owner: T10 (plans/T10-audio.md).
//
// Everything here works on any BaseAudioContext, so the same code renders live (index.ts) and, in
// the scratch scripts of T10, into an OfflineAudioContext for measurement.
//
// Graph, rebuilt per station by chain() so a station change fades the old one out cleanly:
//
//   kick, hats, bass ------------------------------> bus --> compressor --> master --> speakers
//   snare ---------------------> wet --> bus           ^
//   pad --> duck (sidechain) --> wet --> reverb --> 0.4 -/
//   lead --> leadIn --> wet;  leadIn --> delay --> 0.5 --> wet;  delay --> 0.45 --> delay
//
// Time: step = a sixteenth note. Step 0 of the current station plays at audio time t0. The picture's
// beat count is `base` at t0 and rises one per beat (beat(), below).
import { BPM0, F, U_MIX, U_TIME } from '../contracts';

/** Master level after the compressor, which adds make-up gain. Tuned so the peak stays at or under
 *  -6 dBFS (plans/T10-audio.md, M3). */
export const LEVEL = 0.42;

// Two stations, one row of characters each (W per row). Field k of the current station is
// ROWS.charCodeAt(cur * W + k); digit fields subtract 48 ('0').
//   0      tempo in bpm (also the pattern seed)                 'h' = 104, '|' = 124
//   1      MIDI note of the bass root                            '!' = 33 (A1), '&' = 38 (D2)
//   2..8   the scale: semitones of degrees 0..6, '0' + n         A natural minor, D major
//   9..12  chord roots of the 4-bar progression, scale degrees   i VI III VII; vi IV I V
//   13     hat density: chance of an extra sixteenth hat, /10
//   14     brightness: filter cutoffs scale with it
//   15     lead wave: 0 sawtooth, 1 square
//   16     section length in bars, '0' + n                       '8' = 8, '@' = 16
const ROWS = 'h!023578:05263208' + '|&024579;5304751@';
const W = 17;
const get = (k: number): number => ROWS.charCodeAt(cur * W + k);

/** The current station, 0 or 1. */
export let cur = 0;
export let ac: BaseAudioContext;
export let master: GainNode;
let comp: DynamicsCompressorNode;
let noise: AudioBuffer;
let impulse: AudioBuffer;
let bus: GainNode;
let wet: GainNode;
let duck: GainNode;
let leadIn: GainNode;
/** Seconds per beat of the current station. Before the first start: the engine's tempo. */
let spb = 60 / BPM0;
let t0 = 0;
let step = 0;
let base = 0;
/** What played on each recent step, per channel (0 kick, 1 bass, 2 lead): 3 rings of 32 steps. */
const ring = new Float32Array(96);

// Development only: which parts play (bit 0 kick, 1 snare and toms, 2 hats, 3 bass, 4 pad, 5 lead, 6 riser
// and noise bed), the
// kick times as scheduled, and a count of source nodes started and ended.
export let mask = 127;
export const kicks: number[] = [];
export let made = 0;
export let ended = 0;
export function setMask(m: number): void {
  mask = m;
}

/** Builds the fixed part of the graph on context `c`, the master at `level`. */
export function init(c: BaseAudioContext, level: number): void {
  ac = c;
  master = gain(c.destination, level);
  comp = c.createDynamicsCompressor();
  comp.connect(master);
  noise = buffer(2, 0);
  impulse = buffer(3, 4);
}

/** Stereo noise, `sec` seconds long, shaped by (1 - t)^pow: flat for the drums, a decaying tail for
 *  the reverb impulse. */
function buffer(sec: number, pow: number): AudioBuffer {
  const n = ac.sampleRate * sec;
  const b = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** pow;
  }
  return b;
}

/** A gain node at `v`, connected to `to`. */
function gain(to: AudioNode, v: number): GainNode {
  const g = ac.createGain();
  g.gain.value = v;
  g.connect(to);
  return g;
}

/** A fresh bus with its own reverb and delay for the current station; the old one fades out and is
 *  disconnected a second later. */
function chain(): void {
  const old = bus;
  const verb = ac.createConvolver();
  const dly = ac.createDelay();
  bus = gain(comp, 1);
  verb.buffer = impulse;
  wet = gain(bus, 1);
  wet.connect(verb).connect(gain(bus, 0.4));
  duck = gain(wet, 1);
  leadIn = gain(wet, 1);
  dly.delayTime.value = spb * 0.75;
  leadIn.connect(dly).connect(gain(dly, 0.45));
  dly.connect(gain(wet, 0.5));
  if (old) {
    old.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    setTimeout(() => old.disconnect(), 1e3);
  }
}

/** Starts the current station on the next beat of the picture, at the new tempo from now on, so the
 *  beat count does not jump; at least 0.1 s from now. Used for the first start and for every station change. */
export function begin(): void {
  const b = F[U_TIME + 2]!;
  spb = 60 / get(0);
  let wait = (Math.ceil(b) - b) * spb;
  base = Math.ceil(b);
  if (wait < 0.1) wait += spb, base++;
  t0 = ac.currentTime + wait;
  step = 0;
  ring.fill(0);
  chain();
}

/** Steps to the other station and returns its index; restarts the music if it is playing. */
export function station(): number {
  cur ^= 1;
  if (ac) begin();
  return cur;
}

/** Schedules every step that starts before audio time `until`. A step already in the past (the
 *  timer was late) is skipped rather than played late, so a stall never ends in a burst. */
export function pump(until: number): void {
  for (let t; (t = t0 + step * spb / 4) < until; step++) if (t >= ac.currentTime) play(step, t);
}

const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
/** Semitones above the root of scale degree d (d >= 0; 7 is the octave). */
const semis = (d: number): number => (d / 7 | 0) * 12 + get(2 + d % 7) - 48;

/** Deterministic 0..1 from two integers and the station. */
function rnd(a: number, b: number): number {
  let x = Math.imul(a ^ Math.imul(b + get(0), 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ x >>> 16) >>> 0) / 4294967296;
}

/** Plays step s at audio time t. Sections of `len` bars cycle through four parts: 0 drums, bass and
 *  pad; 1 and 3 add the lead; 2 is a breakdown without kick, snare and bass. A section's last bar
 *  ends in a snare roll. The bass groove is fixed per station; the lead motif repeats every two bars
 *  and changes every section. */
function play(s: number, t: number): void {
  const bar = s >> 4;
  const i = s & 15;
  const len = get(16) - 48;
  const sec = bar / len | 0;
  const part = sec & 3;
  const chord = get(9 + (bar & 3)) - 48;
  const root = get(1);
  const bright = get(14) - 48;
  const end = bar % len == len - 1;
  const sx = spb / 4;
  let kick = 0;
  let bass = 0;
  let lead = 0;
  if (part != 2) {
    if (!(i & 3) && (!DEV || mask & 1)) {
      kick = 1;
      voice(t, 50, 'triangle', 0.9, 700, 0.07, bus, 3);
      duck.gain.setTargetAtTime(0.3, t, 0.005);
      duck.gain.setTargetAtTime(1, t + 0.04, 0.1);
      if (DEV) kicks.push(t);
    }
    if ((i == 4 || i == 12 || end && i > 11) && (!DEV || mask & 2))
      voice(t, 0, '', i & 3 ? 0.12 + i / 80 : 0.4, 2500, 0.06, wet, 1, 'bandpass');
    // Toms falling through beat 3 of a section's last bar.
    if (end && i > 7 && i < 12 && (!DEV || mask & 2))
      voice(t, hz(root + 36 - i * 2), 'triangle', 0.35, 1500, 0.08, wet, 1.5);
    const r = rnd(i, 0);
    bass = i & 3 ? 0.22 : 0.3;
    if (!DEV || mask & 8)
      voice(t, hz(root + semis(chord + (r < 0.3 ? 7 : r < 0.45 ? 4 : 0))), 'sawtooth', bass, 180 * bright, sx * 0.6, bus);
  }
  if ((i & 3) == 2 || rnd(i + 16, sec) * 10 < get(13) - 48)
    if (!DEV || mask & 4) voice(t, 0, '', (i & 3) == 2 ? 0.3 : 0.12, 6e3, 0.02, bus, 1, 'highpass');
  if (!i && (!DEV || mask & 16))
    for (let n = 0; n < 6; n++)
      voice(t, hz(root + 24 + semis(chord + (n >> 1) * 2)) * (n & 1 ? 1.006 : 0.994), 'sawtooth', 0.045, 350 * bright, spb * 1.6, duck, 1, 'lowpass', spb * 1.2);
  // Every bar: a soft swell of low noise (the city's hum), and on a section's last bar a noise riser
  // whose band climbs into the next section.
  if (!i && (!DEV || mask & 64)) {
    voice(t, 0, '', 0.03, 300, spb * 2, wet, 1, 'lowpass', spb * 2);
    if (end) voice(t, 0, '', 0.08, 6e3, spb * 1.5, wet, 1, 'bandpass', spb * 4, 0.05);
  }
  // Part 3 plays the lead an octave up with the other wave (the second lead patch).
  const alt = part >> 1 & part;
  const motif = i + (bar & 1) * 16;
  if (part && !(i & 1) && rnd(motif + 32, sec) < 0.45 && (!DEV || mask & 32)) {
    lead = 1;
    voice(t, hz(root + 24 + semis(chord + 7 + (rnd(motif + 64, sec) * 4 | 0) * 2) + alt * 12), get(15) - 48 ^ alt ? 'square' : 'sawtooth', 0.1, 500 * bright, sx * 2, leadIn, 1, 'lowpass', 0.01);
  }
  ring[s & 31] = kick;
  ring[32 + (s & 31)] = bass * 3;
  ring[64 + (s & 31)] = lead;
}

/** One note: an oscillator (or the looped noise buffer when `wave` is empty) through a filter whose
 *  cutoff moves from cut * from (default: twice cut, a fall) towards cut, and a gain that rises to vol in `atk` seconds and then decays with time
 *  constant `dec`. `bend` starts the pitch at f * bend, falling to f in 80 ms (the kick). */
function voice(
  t: number, f: number, wave: OscillatorType | '', vol: number, cut: number, dec: number, out: AudioNode,
  bend = 1, type: BiquadFilterType = 'lowpass', atk = 0.002, from = 2,
): void {
  let src: AudioScheduledSourceNode;
  if (wave) {
    const o = ac.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f * bend, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    src = o;
  } else {
    const b = ac.createBufferSource();
    b.buffer = noise;
    b.loop = true;
    src = b;
  }
  const flt = ac.createBiquadFilter();
  const g = ac.createGain();
  flt.type = type;
  flt.frequency.setValueAtTime(cut * from, t);
  flt.frequency.setTargetAtTime(cut, t, dec);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  g.gain.setTargetAtTime(0, t + atk, dec);
  src.connect(flt).connect(g).connect(out);
  src.start(t);
  src.stop(t + atk + dec * 7);
  if (DEV) {
    made++;
    src.onended = () => ended++;
  }
}

/** Writes the beat into F from the audio clock (a per-frame engine update): the beat count and pulse
 *  (F[U_TIME + 2..3]), the kick, bass and lead levels as decaying envelopes of what was scheduled
 *  (F[U_MIX..U_MIX + 2]) and the station (F[U_MIX + 3]). */
export function beat(): void {
  const e = (ac.currentTime - t0) / spb * 4;
  const b = (base + e / 4 + 64) % 64;
  F[U_TIME + 2] = b;
  F[U_TIME + 3] = (1 - b % 1) ** 2;
  for (let ch = 0; ch < 3; ch++) {
    let v = 0;
    for (let s = Math.floor(e), n = 16; n-- && s >= 0; s--)
      if (ring[ch * 32 + (s & 31)]) {
        v = ring[ch * 32 + (s & 31)]! * Math.exp((s - e) * 1.5 / (1 + 2 * ch));
        break;
      }
    F[U_MIX + ch] = v;
  }
  F[U_MIX + 3] = cur;
}

/** Development only: audio time of the next step to be scheduled. */
export function next(): number {
  return t0 + step * spb / 4;
}

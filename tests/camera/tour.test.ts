// Unit tests for src/camera/tour.ts: the tour and free flight flown as pure code at 60 steps a second.
// Invariants, not golden numbers, so the art pass can retune speeds and heights.
import { beforeAll, describe, expect, it } from 'vitest';
import { AV_HALF, AVE, CELL, P, P_FOV, P_PITCH, P_X, P_Y, P_YAW, P_Z, SEED, ST_HALF, TILE } from '../../src/contracts';
import { buildPlan, heightAt, megaCount, megas } from '../../src/plan';
import { camReset, camToggle, camUpdate, I_CALM, I_DOWN, I_DX, I_KEYS, I_ZOOM, IN } from '../../src/camera/tour';

const STEP = 1 / 60;
const DEG = Math.PI / 180;
const wrap = (v: number): number => v - TILE * Math.round(v / TILE);
const half = (i: number): number => (i % AVE ? ST_HALF : AV_HALF);
/** Distance to the nearest road line along one axis, and that line's index. */
const line = (c: number): [number, number] => {
  const i = Math.round(c / CELL);
  return [Math.abs(c - i * CELL), ((i % 32) + 32) % 32];
};
const inCorridor = (x: number, z: number): boolean => {
  const [ex, ix] = line(((x % TILE) + TILE) % TILE);
  const [ez, iz] = line(((z % TILE) + TILE) % TILE);
  return ex <= half(ix) || ez <= half(iz);
};
const pose = (): number[] => Array.from(P.slice(0, 6));
// P shows the pose interpolated between the last two steps, so input shows one step later.
const reset = (calm = 0): void => {
  IN.fill(0);
  IN[I_CALM] = calm;
  camReset();
  camUpdate(0);
};

type Stats = {
  bad: number; firstBad: string; maxMove: number; maxTurn: number; nan: number; maxAbs: number;
  avenues: Set<string>; megaNear: number[]; band: number; low: number; high: number; steps: number;
};

/** Flies the tour for `seconds` at 60 steps a second and gathers the invariants. */
function fly(seconds: number): Stats {
  reset();
  const s: Stats = {
    bad: 0, firstBad: '', maxMove: 0, maxTurn: 0, nan: 0, maxAbs: 0, avenues: new Set(),
    megaNear: Array<number>(megaCount).fill(1e9), band: 0, low: 0, high: 0, steps: 0,
  };
  let last = pose();
  for (let n = 0; n < seconds * 60; n++) {
    camUpdate(STEP);
    const p = pose();
    const [x, y, z, yaw] = p as [number, number, number, number];
    if (!p.every(Number.isFinite)) s.nan++;
    s.maxAbs = Math.max(s.maxAbs, Math.abs(x), Math.abs(z));
    if (!inCorridor(x, z) && !(y > heightAt(x, z) + 10)) {
      if (!s.bad) s.firstBad = `t=${(n / 60).toFixed(2)} ${p.map((v) => v.toFixed(2)).join(',')} h=${heightAt(x, z)}`;
      s.bad++;
    }
    s.maxMove = Math.max(s.maxMove, Math.hypot(wrap(x - last[0]!), y - last[1]!, wrap(z - last[2]!)));
    for (let i = 3; i < 6; i++) s.maxTurn = Math.max(s.maxTurn, Math.abs(p[i]! - last[i]!));
    // Travelling along an avenue: inside its corridor and heading along it.
    const [ex, ix] = line(((x % TILE) + TILE) % TILE);
    const [ez, iz] = line(((z % TILE) + TILE) % TILE);
    if (ex <= AV_HALF && ix % AVE == 0 && Math.abs(Math.sin(yaw)) < 0.2) s.avenues.add(`x${ix}`);
    if (ez <= AV_HALF && iz % AVE == 0 && Math.abs(Math.cos(yaw)) < 0.2) s.avenues.add(`z${iz}`);
    for (let m = 0; m < megaCount; m++) {
      s.megaNear[m] = Math.min(s.megaNear[m]!, Math.hypot(wrap(x - megas[m * 3]!), wrap(z - megas[m * 3 + 1]!)));
    }
    if (y >= 30 && y <= 200) s.band++;
    if (y < 12) s.low++;
    if (y > 300) s.high++;
    s.steps++;
    last = p;
  }
  return s;
}

describe('tour', () => {
  let two: Stats;
  beforeAll(() => {
    buildPlan(SEED);
    two = fly(7200);
  }, 300000);

  it('(a) is always in a road corridor or more than 10 m above the roofs, for two hours', () => {
    expect(two.firstBad).toBe('');
    expect(two.bad).toBe(0);
  });

  it('(b) never moves more than 2 m or turns more than 3 degrees in a step', () => {
    expect(two.maxMove).toBeLessThanOrEqual(2);
    expect(two.maxTurn).toBeLessThanOrEqual(3 * DEG);
  });

  it('(c) has no NaN or infinity, and x and z stay bounded', () => {
    expect(two.nan).toBe(0);
    expect(two.maxAbs).toBeLessThan(TILE + 2 * CELL);
  });

  it('(d) in the first hour visits half the avenues and passes within 300 m of every megatower', () => {
    const one = fly(3600);
    expect(one.avenues.size).toBeGreaterThanOrEqual(8);
    for (const d of one.megaNear) expect(d).toBeLessThan(300);
  }, 300000);

  it('spends most of its time between 30 and 200 m, and visits the street and the heights', () => {
    expect(two.band / two.steps).toBeGreaterThan(0.5);
    expect(two.low).toBeGreaterThan(0);
    expect(two.high).toBeGreaterThan(0);
  });

  it('(e) is deterministic, and depends only on the accumulated dt', () => {
    reset();
    for (let n = 0; n < 1800; n++) camUpdate(STEP);
    const a = pose();
    reset();
    camUpdate(30);
    const b = pose();
    reset();
    for (let n = 0; n < 1800; n++) camUpdate(STEP);
    expect(pose()).toEqual(a);
    for (let i = 0; i < 6; i++) expect(b[i]!).toBeCloseTo(a[i]!, 3);
  });

  it('flies at half speed and without bank under reduced motion', () => {
    reset(1);
    let dist = 0;
    let roll = 0;
    let last = pose();
    for (let n = 0; n < 60 * 120; n++) {
      camUpdate(STEP);
      const p = pose();
      dist += Math.hypot(wrap(p[0]! - last[0]!), wrap(p[2]! - last[2]!));
      roll = Math.max(roll, Math.abs(p[5]!));
      last = p;
    }
    expect(roll).toBeLessThan(1e-6);
    expect(dist / 120).toBeLessThanOrEqual(45);
    expect(dist / 120).toBeGreaterThanOrEqual(15);
  });

  it('free look turns the view while dragged and eases back after release', () => {
    reset();
    for (let n = 0; n < 60; n++) camUpdate(STEP);
    IN[I_DOWN] = 1;
    IN[I_DX] = 200;
    camUpdate(STEP);
    camUpdate(STEP);
    const turned = P[P_YAW]!;
    camUpdate(STEP);
    expect(Math.abs(P[P_YAW]! - turned)).toBeLessThan(0.05);
    IN[I_DOWN] = 0;
    for (let n = 0; n < 60 * 6; n++) camUpdate(STEP);
    // Compare with a run that never looked: same tour, so the yaw is back on it.
    const back = P[P_YAW]!;
    reset();
    for (let n = 0; n < 60 + 3 + 360; n++) camUpdate(STEP);
    expect(Math.abs(turned - P[P_YAW]!)).toBeGreaterThan(0.5);
    expect(Math.abs(back - P[P_YAW]!)).toBeLessThan(0.05);
  });
});

describe('optional input', () => {
  beforeAll(() => buildPlan(SEED));

  it('the wheel zooms the field of view within 0.5..1.6 rad', () => {
    reset();
    expect(P[P_FOV]!).toBeCloseTo(1.1, 5);
    IN[I_ZOOM] = -300;
    camUpdate(STEP);
    camUpdate(STEP);
    expect(P[P_FOV]!).toBeLessThan(1.1);
    IN[I_ZOOM] = 1e5;
    camUpdate(STEP);
    camUpdate(STEP);
    expect(P[P_FOV]!).toBeCloseTo(1.6, 5);
  });

  it('the left arrow turns the view left while held, on the tour', () => {
    reset();
    for (let n = 0; n < 60; n++) camUpdate(STEP);
    const a = P[P_YAW]!;
    reset();
    for (let n = 0; n < 30; n++) camUpdate(STEP);
    IN[I_KEYS] = 64;
    for (let n = 0; n < 30; n++) camUpdate(STEP);
    expect(P[P_YAW]! - a).toBeGreaterThan(0.6);
  });
});

describe('free flight', () => {
  beforeAll(() => buildPlan(SEED));

  it('starting inside a box always ends outside it', () => {
    for (let m = 0; m < megaCount; m++) {
      reset();
      camToggle();
      P[P_X] = megas[m * 3]!;
      P[P_Y] = 100;
      P[P_Z] = megas[m * 3 + 1]!;
      camToggle(); // back to tour
      camToggle(); // flight again, from inside the tower
      expect(P[P_Y]!).toBeLessThan(heightAt(P[P_X]!, P[P_Z]!));
      camUpdate(STEP);
      camUpdate(STEP);
      expect(P[P_Y]!).toBeGreaterThan(heightAt(P[P_X]!, P[P_Z]!));
    }
  });

  it('holding W toward a tower slides over or round it, never into it', () => {
    reset();
    for (let n = 0; n < 600; n++) camUpdate(STEP);
    expect(camToggle()).toBe(1);
    // Aim straight at the first megatower, level, 150 m up.
    const tx = megas[0]!;
    const tz = megas[1]!;
    P[P_X] = tx + 600;
    P[P_Y] = 150;
    P[P_Z] = tz + 3;
    P[P_YAW] = Math.PI / 2; // looking along -x
    P[P_PITCH] = 0;
    camToggle();
    camToggle();
    IN[I_KEYS] = 1 | 1024; // W with Shift
    let inside = 0;
    for (let n = 0; n < 60 * 20; n++) {
      camUpdate(STEP);
      if (P[P_Y]! < heightAt(P[P_X]!, P[P_Z]!)) inside++;
    }
    expect(inside).toBe(0);
    IN[I_KEYS] = 0;
  });

  it('switching tour to flight and back moves the view at most a few metres or degrees a frame', () => {
    reset();
    for (let n = 0; n < 60 * 20; n++) camUpdate(STEP);
    let last = pose();
    let move = 0;
    let turn = 0;
    const track = (): void => {
      const p = pose();
      move = Math.max(move, Math.hypot(wrap(p[0]! - last[0]!), p[1]! - last[1]!, wrap(p[2]! - last[2]!)));
      for (let i = 3; i < 6; i++) turn = Math.max(turn, Math.abs(p[i]! - last[i]!));
      last = p;
    };
    camToggle();
    track();
    IN[I_KEYS] = 1 | 4; // W and A: off the road line
    for (let n = 0; n < 60 * 3; n++) camUpdate(STEP), track();
    IN[I_KEYS] = 0;
    camToggle();
    track();
    for (let n = 0; n < 60 * 8; n++) camUpdate(STEP), track();
    expect(move).toBeLessThan(4);
    expect(turn).toBeLessThan(5 * DEG);
  });
});

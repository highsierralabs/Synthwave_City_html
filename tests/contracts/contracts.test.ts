// Contract parity (architecture.md section 10): the constants in src/contracts.ts equal those in
// src/common.glsl, and the uniform block F in common.glsl matches the slot table U_*.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as C from '../../src/contracts';

const glsl = readFileSync(new URL('../../src/common.glsl', import.meta.url), 'utf8');
const ts: Record<string, unknown> = C;

/** `const float NAME = value;` declarations in common.glsl. */
function glslConstants(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of text.matchAll(/^\s*const\s+float\s+([A-Z_0-9]+)\s*=\s*([-\d.eE]+)\s*;/gm)) out.set(m[1]!, Number(m[2]));
  return out;
}

/** Members of `uniform F { ... }` in order, with their types. */
function blockMembers(text: string): [string, string][] {
  const body = /uniform\s+F\s*\{([\s\S]*?)\}/.exec(text);
  if (!body) return [];
  const out: [string, string][] = [];
  for (const m of body[1]!.replace(/\/\/.*$/gm, '').matchAll(/(\w+)\s+(\w+)\s*;/g)) out.push([m[1]!, m[2]!]);
  return out;
}

describe('contracts and common.glsl agree', () => {
  const shared = ['TILE', 'CELLS', 'CELL', 'AVE', 'ST_HALF', 'ST_ROAD', 'AV_HALF', 'AV_ROAD'];
  const g = glslConstants(glsl);

  it('declares every shared constant in both', () => {
    for (const name of shared) {
      expect(typeof ts[name], `${name} in contracts.ts`).toBe('number');
      expect(g.has(name), `${name} in common.glsl`).toBe(true);
    }
  });

  it('gives every constant both declare the same value', () => {
    for (const [name, value] of g) if (name in ts) expect(value, name).toBe(ts[name]);
  });

  it('keeps the grid consistent', () => {
    expect(C.CELLS * C.CELL).toBe(C.TILE);
    expect(C.ST_ROAD).toBeLessThan(C.ST_HALF);
    expect(C.AV_ROAD).toBeLessThan(C.AV_HALF);
    expect(C.CELLS % C.AVE).toBe(0);
  });
});

describe('uniform block F', () => {
  const members = blockMembers(glsl);
  const size = { mat4: 16, vec4: 4 } as Record<string, number>;

  it('has only vec4 and mat4 members, so std140 adds no padding', () => {
    expect(members.length).toBeGreaterThan(0);
    for (const [type, name] of members) expect(size[type], `${name} is ${type}`).toBeDefined();
  });

  it('puts every member at the slot contracts.ts names (uVP -> U_VP, uCam -> U_CAM, ...)', () => {
    let offset = 0;
    for (const [type, name] of members) {
      const slot = 'U_' + name.slice(1).toUpperCase();
      expect(ts[slot], `${slot} for ${name}`).toBe(offset);
      offset += size[type]!;
    }
    expect(offset).toBe(C.F.length);
    expect(C.F.length).toBe(64);
  });

  it('names every U_* slot in the block', () => {
    const names = new Set(members.map(([, n]) => 'U_' + n.slice(1).toUpperCase()));
    for (const key of Object.keys(ts).filter((k) => k.startsWith('U_'))) expect(names.has(key), key).toBe(true);
  });
});

describe('pose P and the plan layout', () => {
  it('keeps P_* distinct and inside P', () => {
    const idx = [C.P_X, C.P_Y, C.P_Z, C.P_YAW, C.P_PITCH, C.P_ROLL, C.P_FOV];
    expect(new Set(idx).size).toBe(idx.length);
    for (const i of idx) expect(i).toBeLessThan(C.P.length);
  });

  it('keeps B_* distinct and inside one BOX record', () => {
    const idx = [C.B_X, C.B_Y, C.B_Z, C.B_SEED, C.B_HX, C.B_H, C.B_HZ, C.B_KIND];
    expect(new Set(idx).size).toBe(C.BOX);
    for (const i of idx) expect(i).toBeLessThan(C.BOX);
  });

  it('keeps the far fade inside half a tile at every quality', () => {
    for (const [r0, r1] of [[C.Q_R0_0, C.Q_R1_0], [C.Q_R0_1, C.Q_R1_1], [C.Q_R0_2, C.Q_R1_2]]) {
      expect(r0).toBeLessThan(r1!);
      expect(r1).toBeLessThan(C.TILE / 2);
    }
  });
});

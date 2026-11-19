// Dead code removal tests for tools/glslmin (plans/T02-glslmin.md, M4).
import { describe, it, expect } from 'vitest';
import { minifyShaders } from '../../tools/glslmin/index.mjs';

const common = [
  'const float USED = 2.0;',
  'const float UNUSED = 3.0;',
  'const vec3 TABLE[2] = vec3[2](vec3(1.0), vec3(2.0));',
  'float helper(float x) { return x * USED; }',
  'float onlyForDead(float x) { return x + 1.0; }',
  'float dead(float x) { return onlyForDead(x); }',
  'float over(float x) { return x; }',
  'float over(vec2 x) { return x.x; }',
  'float proto(float x);',
  'float proto(float x) { return x; }',
  'layout(std140) uniform F { vec4 uA; };',
  'uniform float uNeverRead;',
  'struct S { float a; };',
  'S makeS() { S s; s.a = 1.0; return s; }',
  '#ifdef FS',
  'float fragOnly() { return 1.0; }',
  '#endif',
].join('\n');

describe('prune', () => {
  it('removes what nothing uses, repeatedly, and keeps the rest', () => {
    const body = 'void main() { float y = helper(over(1.0)) + proto(2.0) + makeS().a; }';
    const { out, removed } = minifyShaders({ common, body });
    expect(removed).toEqual(['TABLE', 'UNUSED', 'dead', 'fragOnly', 'onlyForDead']);
    const all = out.common + out.body;
    expect(all).toContain('2.'); // USED stays
    expect(all).not.toContain('3.');
    expect(all).toContain('#ifdef FS\n#endif'); // directives stay, even if empty
    expect(all).toContain('uniform float'); // uniforms are never pruned
    expect((all.match(/float [a-zA-Z]+\(vec2/g) ?? []).length).toBe(1); // both overloads of a used name stay
  });

  it('keeps a name used only in a macro body', () => {
    const { removed } = minifyShaders({ a: 'float twice(float x) { return x * 2.0; }\n#define T2X(v) twice(v)\nvoid main() { float y = T2X(1.0); }' });
    expect(removed).toEqual([]);
  });

  it('never removes an item with a directive inside it', () => {
    const { removed } = minifyShaders({ a: 'float f() {\n#ifdef FS\nreturn 1.0;\n#else\nreturn 0.0;\n#endif\n}\nvoid main() {}' });
    expect(removed).toEqual([]);
  });

  it('is off with prune false and with rename false', () => {
    expect(minifyShaders({ common }, { prune: false }).removed).toEqual([]);
    expect(minifyShaders({ common }, { rename: false }).out.common).toContain('onlyForDead');
  });

  it('never removes main or a reserved name', () => {
    const { removed } = minifyShaders({ a: 'void main() {} float keepMe() { return 1.0; }' }, { reserved: ['keepMe'] });
    expect(removed).toEqual([]);
  });
});

// Declaration finding and renaming tests for tools/glslmin (plans/T02-glslmin.md, M2).
import { describe, it, expect } from 'vitest';
import { minifyShaders as minifyAll } from '../../tools/glslmin/index.mjs';

// These snippets are not whole programs, so their functions look unused: renaming is tested with
// pruning off. tests/glslmin/prune.test.mjs covers pruning.
const minifyShaders = (s, o = {}) => minifyAll(s, { prune: false, ...o });
import { lex } from '../../tools/glslmin/lex.mjs';
import { isLanguageName } from '../../tools/glslmin/names.mjs';

const ids = (s) => lex(s).filter((t) => t.t === 'id').map((t) => t.v);

describe('renaming', () => {
  it('gives one identifier one short name in every file', () => {
    const { out, names } = minifyShaders({
      common: 'float brightness(float value) { return value * 2.0; }',
      vert: 'out float vShade; void main() { vShade = brightness(1.0); }',
      frag: 'in float vShade; void main() { O = vec4(brightness(vShade)); }',
    });
    expect(names.brightness).toBeDefined();
    expect(names.vShade).toBeDefined();
    expect(names.value).toBeDefined();
    expect(names.brightness.length).toBeLessThanOrEqual(2);
    expect(out.common).toContain(`float ${names.brightness}(`);
    expect(out.vert).toContain(`${names.vShade}=${names.brightness}(1.)`);
    expect(out.frag).toContain(`in float ${names.vShade};`);
    expect(out.frag).toContain(`${names.brightness}(${names.vShade})`);
    expect(out.common).not.toContain('brightness');
  });

  it('gives overloads one name', () => {
    const { out, names } = minifyShaders({
      a: 'float grid(float c) { return c; } float grid(vec2 c) { return grid(c.x) + grid(c.y); }',
    });
    expect(names.grid).toBeDefined();
    expect(out.a.split(`${names.grid}(`).length - 1).toBe(4);
  });

  it('finds every kind of declaration', () => {
    const src = [
      'const float TILE = 4096.0;',
      'layout(std140) uniform F { mat4 uViewProj; vec4 uCamera; };',
      'layout(location = 0) in vec4 aAnchor;',
      'flat out vec4 vSeed;',
      'uniform sampler2D T0;',
      'struct Window { vec2 cell; float lit; };',
      '#define SCALE(value, factor) ((value) * (factor))',
      '#define LEVEL 2',
      'vec3 cube(out vec3 normal) { int face = 1, axis = face >> 1; float table[3], other = 1.0;',
      '  for (int index = 0; index < 3; index++) {} Window win; return vec3(0.0); }',
    ].join('\n');
    const { names } = minifyShaders({ a: src });
    for (const n of ['TILE', 'uViewProj', 'uCamera', 'aAnchor', 'vSeed', 'Window', 'SCALE', 'value',
      'factor', 'LEVEL', 'cube', 'normal', 'face', 'axis', 'table', 'other', 'index', 'win']) {
      expect([n, names[n] !== undefined]).toEqual([n, true]);
    }
    for (const n of ['F', 'T0', 'cell', 'lit', 'location', 'std140', 'main', 'vec3', 'gl_Position']) {
      expect([n, names[n]]).toEqual([n, undefined]);
    }
  });

  it('leaves names after a dot alone, and struct fields where they are declared', () => {
    const { out, names } = minifyShaders({
      a: 'struct Win { float seed; vec3 tint; }; float f(float seed) { Win w; w.seed = seed; return w.tint.x; }',
    });
    expect(names.seed).toBeDefined();
    expect(out.a).toContain('{float seed;vec3 tint;}');
    expect(out.a).toContain(`.seed=${names.seed};`);
    expect(out.a).toContain('.tint.x;');
  });

  it('leaves members of a block with an instance name alone', () => {
    const { out, names } = minifyShaders({ a: 'uniform Blk { vec4 member; } inst; float f() { return inst.member.x; }' });
    expect(names.member).toBeUndefined();
    expect(names.inst).toBeDefined();
    expect(out.a).toContain('{vec4 member;}');
  });

  it('keeps reserved names, built-ins and the language', () => {
    const { out, names } = minifyShaders({
      a: 'uniform vec4 X0; uniform sampler2D T3; out vec4 O; void main() { O = texture(T3, X0.xy) + vec4(fwidth(1.0)); }',
    }, { reserved: ['O'] });
    expect(names).toEqual({});
    expect(out.a).toBe('uniform vec4 X0;uniform sampler2D T3;out vec4 O;void main(){O=texture(T3,X0.xy)+vec4(fwidth(1.));}');
  });

  it('renames a macro in #ifdef but leaves #ifdef FS alone', () => {
    const { out, names } = minifyShaders({
      a: '#define USE_FOG 1\n#ifdef USE_FOG\nfloat x;\n#endif\n#ifdef FS\nfloat y;\n#endif\n#if defined(USE_FOG) && USE_FOG > 0\n#endif\n',
    });
    expect(names.USE_FOG).toBeDefined();
    expect(out.a).toContain(`#ifdef ${names.USE_FOG}\n`);
    expect(out.a).toContain('#ifdef FS\n');
    expect(out.a).toContain(`#if defined(${names.USE_FOG})&&${names.USE_FOG}>0\n`);
  });

  it('treats a null directive as a line of its own', () => {
    const { out, names } = minifyShaders({ a: '#\nfloat value = 1.0;\nfloat other = value;' });
    expect(out.a).toBe(`\n#\nfloat ${names.value}=1.;float ${names.other}=${names.value};`);
  });

  it('keeps a function-like macro function-like', () => {
    const { out, names } = minifyShaders({ a: '#define TWICE(x) ((x) * 2.0)\n#define PAREN (1.0)\nfloat y = TWICE(PAREN);' });
    expect(out.a).toContain(`#define ${names.TWICE}(${names.x})((${names.x})*2.)\n`);
    expect(out.a).toContain(`#define ${names.PAREN} (1.)\n`);
  });

  it('gives the most used names the shortest names', () => {
    const uses = 'float rare; float common_name; float f() { return common_name + common_name + common_name + rare; }';
    const { names } = minifyShaders({ a: uses });
    expect(names.common_name).toBe('a');
  });

  it('never generates a keyword, a built-in or a name the sources use and keep', () => {
    // 60 declared names push the generator past one letter; "a", "b" and "in" style names must be skipped.
    const decl = Array.from({ length: 60 }, (_, i) => `float name${i};`).join('');
    const { out, names } = minifyShaders({ a: decl + 'float g() { return a + b + do_ + Z; }' });
    const used = new Set(Object.values(names));
    expect(used.size).toBe(Object.keys(names).length);
    for (const n of used) {
      expect([n, isLanguageName(n)]).toEqual([n, false]);
      expect(['a', 'b', 'Z', 'F', 'FS', 'T0', 'X0', 'main', 'do', 'if', 'in'].includes(n)).toBe(false);
    }
    expect(ids(out.a)).toContain('a');
  });

  it('is deterministic', () => {
    const src = { x: 'float alpha; float beta; float f(){return alpha+beta;}', y: 'float g(){return beta;}' };
    expect(minifyShaders(src)).toEqual(minifyShaders(src));
  });

  it('with rename false, strips only and returns no names', () => {
    const { out, names } = minifyShaders({ a: 'float longName = 1.0; // c' }, { rename: false });
    expect(names).toEqual({});
    expect(out.a).toBe('float longName=1.;');
  });
});

// T14: locals are named per function scope, so different functions reuse the same short names.
describe('local names per function', () => {
  it('reuses short names for the locals of different functions', () => {
    const { out } = minifyShaders({
      a: 'float alpha(float first, float second) { float third = first * second; return third; }\n' +
        'float beta(vec2 other, float more) { float again = other.x + more; return again; }',
    });
    // Without reuse the six locals need six names; with it, the two functions share them.
    const locals = new Set([...out.a.matchAll(/(?:float|vec2) (\w+)[,)=]/g)].map((m) => m[1]));
    expect(locals.size).toBeLessThanOrEqual(4);
  });

  it('never gives a local the name of a global the function uses', () => {
    const src = 'uniform F { vec4 uTime; }; float helper(float x) { return x; }\n' +
      'float caller(float value) { float result = helper(value) + uTime.x; return result; }';
    const { out, names } = minifyShaders({ a: src });
    const body = out.a.slice(out.a.indexOf(`float ${names.caller}(`));
    const locals = [...body.matchAll(/float (\w+)[,)=;]/g)].map((m) => m[1]).filter((n) => n !== names.caller);
    expect(locals.length).toBe(2);
    for (const n of locals) {
      expect(n).not.toBe(names.helper);
      expect(n).not.toBe(names.uTime);
    }
  });
});

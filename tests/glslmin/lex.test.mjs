// Tokenizer, strip and float tests for tools/glslmin (plans/T02-glslmin.md, M1).
import { describe, it, expect } from 'vitest';
import { lex, needSpace, shortFloat, isPlainFloat } from '../../tools/glslmin/lex.mjs';
import { minifyShaders } from '../../tools/glslmin/index.mjs';

const kinds = (s) => lex(s).map((t) => `${t.t}:${t.v === '\n' ? '\\n' : t.v}`);
const strip = (s) => minifyShaders({ a: s }, { rename: false }).out.a;

describe('lex', () => {
  it('splits identifiers, numbers, operators and punctuation', () => {
    expect(kinds('vec3 a_1=b.xyz*2.0;')).toEqual([
      'id:vec3', 'id:a_1', 'op:=', 'id:b', 'op:.', 'id:xyz', 'op:*', 'num:2.0', 'op:;',
    ]);
  });
  it('reads every number form as one token', () => {
    for (const n of ['0', '17', '017', '0x7feb352du', '0XFFu', '255u', '1.', '.5', '1.5', '1e5', '1.5e-3',
      '2.5E+2', '.5e1', '3.0f']) {
      expect(kinds(n)).toEqual([`num:${n}`]);
    }
  });
  it('takes the longest operator', () => {
    expect(kinds('a<<=b>>=c<=d&&e||f^^g++--h!=i')).toEqual([
      'id:a', 'op:<<=', 'id:b', 'op:>>=', 'id:c', 'op:<=', 'id:d', 'op:&&', 'id:e', 'op:||', 'id:f',
      'op:^^', 'id:g', 'op:++', 'op:--', 'id:h', 'op:!=', 'id:i',
    ]);
  });
  it('drops comments and records the space they leave', () => {
    const t = lex('a/* x */b // y\nc');
    expect(t.map((x) => x.v)).toEqual(['a', 'b', 'c']);
    expect(t.map((x) => x.ws)).toEqual([false, true, true]);
  });
  it('marks directive lines and ends them', () => {
    expect(kinds('x;\n  # ifdef FS\ny;\n#endif')).toEqual([
      'id:x', 'op:;', '#:#', 'id:ifdef', 'id:FS', 'eol:\\n', 'id:y', 'op:;', '#:#', 'id:endif', 'eol:\\n',
    ]);
  });
  it('does not take a # mid-line as a directive', () => {
    expect(kinds('a # b')[1]).toBe('op:#');
  });
  it('splices backslash continuations', () => {
    expect(kinds('#define A 1 \\\n + 2\nA')).toEqual([
      '#:#', 'id:define', 'id:A', 'num:1', 'op:+', 'num:2', 'eol:\\n', 'id:A',
    ]);
  });
  it('throws on an unterminated block comment', () => {
    expect(() => lex('a /* b')).toThrow();
  });
});

describe('needSpace', () => {
  it('keeps words apart', () => {
    expect(needSpace('float', 'x')).toBe(true);
    expect(needSpace('return', '1.')).toBe(true);
    expect(needSpace('x', '+')).toBe(false);
  });
  it('protects the dangerous joins', () => {
    expect(needSpace('-', '-')).toBe(true);   // a - -b
    expect(needSpace('+', '+')).toBe(true);   // a + +b
    expect(needSpace('+', '++')).toBe(true);  // a + ++b
    expect(needSpace('/', '*')).toBe(true);   // x / *y would open a comment
    expect(needSpace('/', '/')).toBe(true);
    expect(needSpace('<', '<')).toBe(true);
    expect(needSpace('&', '&')).toBe(true);
    expect(needSpace('=', '=')).toBe(true);
    expect(needSpace('1', 'u')).toBe(true);   // a number before an identifier
    expect(needSpace('1.', 'e')).toBe(true);
    expect(needSpace('x', '.5')).toBe(false); // "return.5" lexes as return .5
    // A preprocessor reads a number and what follows it as one pp-number: "1.0.xx", "2u", "0x1E+1".
    expect(needSpace('1.', '.')).toBe(true);
    expect(needSpace('2', '_a')).toBe(true);
    expect(needSpace('0x1E', '+')).toBe(true);
    expect(needSpace('1.', '+')).toBe(false);
  });
});

describe('floats', () => {
  it('shortens without changing the decimal value', () => {
    const table = {
      '1.0': '1.', '0.5': '.5', '10.0': '10.', '0.0': '0.', '00.000': '0.', '1.': '1.', '.5': '.5',
      '100000.0': '1e5', '1000.0': '1e3', '100.0': '1e2', '0.001': '.001', '0.0001': '1e-4',
      '1.5e-5': '15e-6', '2.5E2': '250.', '1e10': '1e10', '1.0e+3': '1e3', '3.14159265': '3.14159265',
      '123.4560': '123.456', '6.02214076e23': '602214076e15', '0.050': '.05', '1e0': '1.',
      '1.17549435e-38': '117549435e-46',
    };
    for (const [a, b] of Object.entries(table)) expect([a, shortFloat(a)]).toEqual([a, b]);
  });
  it('knows what it may touch', () => {
    for (const v of ['1.0', '.5', '1e5', '2.']) expect(isPlainFloat(v)).toBe(true);
    for (const v of ['1', '017', '0x10', '1u', '3.0f', '0x1Fu']) expect(isPlainFloat(v)).toBe(false);
  });
  it('never turns a float into an int, and never touches ints, hex or u literals', () => {
    expect(strip('a=10.0;b=10;c=0x10u;d=16u;e=017;')).toBe('a=10.;b=10;c=0x10u;d=16u;e=017;');
  });
});

describe('strip', () => {
  it('removes comments and every space that is not needed', () => {
    expect(strip('// head\nfloat  f ( float x ) {\n  return x * 2.0 ; /* c */\n}\n'))
      .toBe('float f(float x){return x*2.;}');
  });
  it('keeps the dangerous joins apart', () => {
    expect(strip('c = a - -b;')).toBe('c=a- -b;');
    expect(strip('c = a + +b;')).toBe('c=a+ +b;');
    expect(strip('c = a - --b;')).toBe('c=a- --b;');
    expect(strip('c = a-- - b;')).toBe('c=a---b;'); // maximal munch reads it back the same
    expect(strip('c = x / *y;')).toBe('c=x/ *y;');
    expect(strip('return 0.5;')).toBe('return.5;');
  });
  it('never writes 1..xx', () => {
    expect(strip('v = 1.0.xx;')).toBe('v=1. .xx;');
    expect(strip('v = 1.5.xx;')).toBe('v=1.5 .xx;');
  });
  it('keeps each directive on its own line', () => {
    expect(strip('a;\n#ifdef FS\nb;\n#else\nc;\n#endif\nd;')).toBe('a;\n#ifdef FS\nb;\n#else\nc;\n#endif\nd;');
    expect(strip('#ifdef FS\nb;\n#endif')).toBe('\n#ifdef FS\nb;\n#endif\n');
  });
  it('strips space inside directives', () => {
    expect(strip('#  define   K ( 2.0 * 1.0 )  // c\nx=K;')).toBe('\n#define K (2.*1.)\nx=K;');
    expect(strip('#define M( a , b ) ( (a) + (b) )\n')).toBe('\n#define M(a,b)((a)+(b))\n');
    expect(strip('#define NEG -1.0\nx=NEG;')).toBe('\n#define NEG -1.\nx=NEG;');
    expect(strip('#define E\n')).toBe('\n#define E\n');
    expect(strip('#if defined( X ) && X > 1\n#endif\n')).toBe('\n#if defined(X)&&X>1\n#endif\n');
  });
  it('is deterministic', () => {
    const s = 'float f(float x){ return x * 2.0; }\n#ifdef FS\nout vec4 O;\n#endif\n';
    expect(strip(s)).toBe(strip(s));
    expect(strip(strip(s))).toBe(strip(s));
  });
});

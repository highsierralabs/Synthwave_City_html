// GLSL ES 3.00 tokenizer for the shader minifier. Owner: T02 (plans/T02-glslmin.md).
//
// Not a parser. It splits text into the tokens the minifier needs to re-join safely and to find
// declarations, and marks which tokens sit on a preprocessor line.
//
// Token: { t, v, ws, dir }
//   t   'id' | 'num' | 'op' | '#' (start of a directive) | 'eol' (end of a directive line)
//   v   the text
//   ws  true when space, a newline or a comment came before it in the source
//   dir true when the token is part of a preprocessor directive line

const OPS3 = new Set(['<<=', '>>=']);
const OPS2 = new Set(['++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '^^',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '##']);

const ID = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUM = /0[xX][0-9a-fA-F]+[uU]?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[uUfF]?/y;

const isDigit = (c) => c >= '0' && c <= '9';
const isIdStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';

/** Normalises line ends and splices backslash-newline continuations, as the preprocessor does. */
export function normalise(src) {
  return src.replace(/\r\n?/g, '\n').replace(/\\\n/g, '');
}

/** Tokenizes GLSL text. Throws on an unterminated block comment. */
export function lex(source) {
  const src = normalise(source);
  const toks = [];
  const n = src.length;
  let i = 0;
  let lineStart = true;
  let inDir = false;
  let ws = false;
  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      if (inDir) { toks.push({ t: 'eol', v: '\n', ws, dir: true }); inDir = false; }
      lineStart = true; ws = true; i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\f' || c === '\v') { ws = true; i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      ws = true;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new Error('glslmin: unterminated block comment');
      i = e + 2; ws = true;
      continue;
    }
    if (c === '#' && lineStart) {
      toks.push({ t: '#', v: '#', ws, dir: true });
      inDir = true; lineStart = false; ws = false; i++;
      continue;
    }
    lineStart = false;
    let t, v;
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      NUM.lastIndex = i; v = NUM.exec(src)[0]; t = 'num';
    } else if (isIdStart(c)) {
      ID.lastIndex = i; v = ID.exec(src)[0]; t = 'id';
    } else {
      const three = src.substr(i, 3), two = src.substr(i, 2);
      v = OPS3.has(three) ? three : OPS2.has(two) ? two : c;
      t = 'op';
    }
    toks.push({ t, v, ws, dir: inDir });
    ws = false;
    i += v.length;
  }
  if (inDir) toks.push({ t: 'eol', v: '\n', ws, dir: true });
  return toks;
}

/** The token texts of a string with no directives, for the re-join check. */
function texts(s) {
  return lex(s).map((t) => t.v);
}

const joinCache = new Map();

/** True when writing b straight after a would not give back the two tokens a and b.
 *  Numbers are treated as C pp-numbers: a preprocessor reads "1.0.xx", "2u_x" or "0x1E+1" as one
 *  token, so a number is never written against a letter, digit, "_" or ".", nor an e/E against +/-. */
export function needSpace(a, b) {
  const key = a + '\u0000' + b;
  let r = joinCache.get(key);
  if (r === undefined) {
    if (/^\.?\d/.test(a) && (/^[\w.]/.test(b) || (/[eE]$/.test(a) && /^[+-]/.test(b)))) {
      r = true;
    } else {
      let tt;
      try { tt = texts(a + b); } catch { tt = []; }
      r = !(tt.length === 2 && tt[0] === a && tt[1] === b);
    }
    joinCache.set(key, r);
  }
  return r;
}

/** True for a decimal floating-point literal the minifier may rewrite: has a dot or an exponent,
 *  is not hex, has no suffix. */
export function isPlainFloat(v) {
  return /^(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(v) && /[.eE]/.test(v);
}

/** The shortest text with exactly the same decimal value, still a float literal. */
export function shortFloat(v) {
  const m = /^(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(v);
  if (!m) return v;
  let digits = (m[1] + m[2]).replace(/^0+/, '');
  let exp = (m[3] ? parseInt(m[3], 10) : 0) - m[2].length;
  if (!digits) return '0.';
  const zeros = /0*$/.exec(digits)[0].length;
  digits = digits.slice(0, digits.length - zeros);
  exp += zeros;
  const len = digits.length;
  let plain;
  if (exp >= 0) plain = exp > 40 ? null : digits + '0'.repeat(exp) + '.';
  else if (len + exp > 0) plain = digits.slice(0, len + exp) + '.' + digits.slice(len + exp);
  else plain = -exp - len > 40 ? null : '.' + '0'.repeat(-exp - len) + digits;
  const sci = digits + 'e' + exp;
  if (plain === null) return sci;
  return exp !== 0 && sci.length < plain.length ? sci : plain;
}

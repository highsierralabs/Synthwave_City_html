// Name tables for the GLSL ES 3.00 shader minifier. Owner: T02 (plans/T02-glslmin.md).
//
// Written from the GLSL ES 3.00 specification as remembered [M]: sections 3.8 (keywords and
// reserved words), 4.1 (types), 7 (built-in variables) and 8 (built-in functions). A name missing
// from these lists is only dangerous if a shader *declares* it (then it is renamed) or if the name
// generator could produce it (only names of one or two letters or digits matter there).

const words = (s) => s.trim().split(/\s+/);

/** Types that can start a declaration. User struct names are added per run. */
export const TYPES = new Set(words(`
  void bool int uint float
  vec2 vec3 vec4 bvec2 bvec3 bvec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4
  mat2 mat3 mat4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4
  sampler2D sampler3D samplerCube sampler2DShadow samplerCubeShadow sampler2DArray sampler2DArrayShadow
  isampler2D isampler3D isamplerCube isampler2DArray usampler2D usampler3D usamplerCube usampler2DArray
`));

/** Keywords, qualifiers and words reserved for future use. Never declared, never generated. */
export const KEYWORDS = new Set(words(`
  const uniform layout centroid flat smooth break continue do for while switch case default
  if else in out inout true false invariant discard return lowp mediump highp precision struct
  attribute varying coherent volatile restrict readonly writeonly resource atomic_uint
  noperspective patch sample subroutine common partition active asm class union enum typedef
  template this goto inline noinline public static extern external interface long short double
  half fixed unsigned superp input output hvec2 hvec3 hvec4 dvec2 dvec3 dvec4 fvec2 fvec3 fvec4
  sampler3DRect filter image1D image2D image3D imageCube iimage1D iimage2D iimage3D iimageCube
  uimage1D uimage2D uimage3D uimageCube image1DArray image2DArray iimage1DArray iimage2DArray
  uimage1DArray uimage2DArray imageBuffer iimageBuffer uimageBuffer sampler1D sampler1DShadow
  sampler1DArray sampler1DArrayShadow isampler1D usampler1D isampler1DArray usampler1DArray
  sampler2DRect sampler2DRectShadow isampler2DRect usampler2DRect samplerBuffer isamplerBuffer
  usamplerBuffer sampler2DMS isampler2DMS usampler2DMS sampler2DMSArray isampler2DMSArray
  usampler2DMSArray sizeof cast namespace using buffer shared
  location std140 std430 packed row_major column_major binding offset
`));

/** Built-in functions, predefined macros and preprocessor words. Never renamed, never generated. */
export const BUILTINS = new Set(words(`
  radians degrees sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh
  pow exp log exp2 log2 sqrt inversesqrt abs sign floor trunc round roundEven ceil fract mod modf
  min max clamp mix step smoothstep isnan isinf floatBitsToInt floatBitsToUint intBitsToFloat
  uintBitsToFloat packSnorm2x16 unpackSnorm2x16 packUnorm2x16 unpackUnorm2x16 packHalf2x16
  unpackHalf2x16 length distance dot cross normalize faceforward reflect refract matrixCompMult
  outerProduct transpose determinant inverse lessThan lessThanEqual greaterThan greaterThanEqual
  equal notEqual any all not textureSize texture textureProj textureLod textureOffset texelFetch
  texelFetchOffset textureProjOffset textureLodOffset textureProjLod textureProjLodOffset
  textureGrad textureGradOffset textureProjGrad textureProjGradOffset dFdx dFdy fwidth
  texture2D texture2DProj texture2DLod texture2DProjLod textureCube textureCubeLod
  texture2DLodEXT texture2DProjLodEXT textureCubeLodEXT texture2DGradEXT texture2DProjGradEXT
  textureCubeGradEXT noise1 noise2 noise3 noise4 ftransform
  __LINE__ __FILE__ __VERSION__ GL_ES GL_FRAGMENT_PRECISION_HIGH defined
`));
// Directive words (define, ifdef, line, version, ...) are special only straight after "#", and the
// minifier never renames that position, so a variable called "line" may be renamed like any other.

/** Names JavaScript knows (architecture.md section 10.6). Always left alone. */
export const ALWAYS_RESERVED = ['F', 'FS', 'main', 'T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'X0', 'X1', 'X2', 'X3'];

/** True for names the language owns: keywords, types, built-ins and anything gl_ or containing __. */
export function isLanguageName(name) {
  return TYPES.has(name) || KEYWORDS.has(name) || BUILTINS.has(name) || name.startsWith('gl_') || name.includes('__');
}

const FIRST = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REST = FIRST + '0123456789';

/** Short names in order of length, then of the alphabet above: a..Z, aa..Z9, aaa... */
export function* shortNames() {
  for (const c of FIRST) yield c;
  for (let len = 2; ; len++) {
    const idx = new Array(len).fill(0);
    for (;;) {
      let s = FIRST[idx[0]];
      for (let k = 1; k < len; k++) s += REST[idx[k]];
      yield s;
      let k = len - 1;
      while (k > 0 && ++idx[k] === REST.length) idx[k--] = 0;
      if (k === 0 && ++idx[0] === FIRST.length) break;
    }
  }
}

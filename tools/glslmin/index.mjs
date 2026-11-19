// Shader minifier. Owner: T02 (plans/T02-glslmin.md).
//
// STUB: the final signature, returning its input unchanged. T02 writes the real one.

/**
 * Minifies a set of GLSL fragments together, with one rename map shared by all of them.
 *
 * @param {Record<string, string>} sources  path -> GLSL text. Fragments, not whole shaders: the
 *        "#version" header is added at run time and never passes through here.
 * @param {{ rename?: boolean, reserved?: string[] }} [options]
 *        rename (default true): false strips comments and space only.
 *        reserved: extra identifiers to leave alone. F, T0..T7, X0..X3, FS and main always are.
 * @returns {{ out: Record<string, string>, names: Record<string, string> }}
 *        out: the same paths with minified text; names: original identifier -> short name.
 */
export function minifyShaders(sources, options = {}) {
  void options;
  return { out: { ...sources }, names: {} };
}

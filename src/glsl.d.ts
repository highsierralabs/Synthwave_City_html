// Shaders import as strings (the build bundles them as text, minified in the shipped file).
declare module '*.glsl' {
  const source: string;
  export default source;
}

/** Build-time flag. `if (DEV) { ... }` is removed from the shipped file. */
declare const DEV: boolean;

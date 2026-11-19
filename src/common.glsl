// The shared GLSL (architecture.md section 10.5). Owner: T00. Frozen; everyone else reads.
//
// Every program's source is:  header + this file + the shader's own text.
// The header (src/gl.ts) is "#version 300 es", the precision lines and, in fragment shaders,
// "#define FS". Fragment-only code here sits inside #ifdef FS, vertex-only code in the #else.
//
// "Render space" means: x and z relative to the camera (wrapped to the nearest copy of the tile),
// y absolute. The camera is at (0, uCam.y, 0). uVP takes render space to clip space.
//
// Names are long on purpose; tools/glslmin renames all of them. Reserved, never renamed:
// F, T0..T7, X0..X3, FS, main.

// ---- constants, mirrored from src/contracts.ts (tests/contracts keeps them equal) -------------
const float TILE = 4096.0;
const float CELLS = 32.0;
const float CELL = 128.0;
const float AVE = 4.0;
const float ST_HALF = 10.0;
const float ST_ROAD = 7.0;
const float AV_HALF = 18.0;
const float AV_ROAD = 13.0;
const float PI = 3.14159265;
const float TAU = 6.2831853;

// ---- the uniform block (section 10.2). Every member is a vec4 or a mat4. ----------------------
layout(std140) uniform F {
  mat4 uVP;     // view-projection for this pass
  vec4 uCam;    // x,z camera in tile coordinates; y height; w pass (0 main, 1 mirror)
  vec4 uTime;   // x seconds in [0,LOOP); y x/LOOP; z beats, modulo 64; w beat pulse 1..0
  vec4 uRes;    // x,y target size in pixels; z quality 0,1,2; w density 0..1
  vec4 uFade;   // x R0; y R1; z fog density; w exposure
  vec4 uRight;  // xyz camera right; w tan(fov/2)*aspect
  vec4 uUp;     // xyz camera up; w tan(fov/2)
  vec4 uFwd;    // xyz camera forward
  vec4 uSun;    // xyz direction to the sun
  vec4 uMix;    // x kick, y bass, z lead levels 0..1; w station
  vec4 uMood;   // x mood 0..3 (0 sunset, 1 midnight, 2 miami; fractions blend)
  vec4 uX0;
  vec4 uX1;
};

// Texture units (section 10.6): T0 pass input, T1 mirrored city, T2 cells, T3 glyph atlas.
uniform sampler2D T0;
uniform sampler2D T1;
uniform sampler2D T2;
uniform sampler2D T3;

// ---- hashes: integer based, identical on every GPU --------------------------------------------
// Feed them exact values: floor()ed cell indices, integer seeds, gl_InstanceID.
uint hashU(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
// 0 <= result < 1, exactly representable.
float hashF(uint x) { return float(hashU(x) >> 8) / 16777216.0; }
// One float in, one out. n must hold an integer (negative is fine).
float hash(float n) { return hashF(uint(int(n))); }
// Two integers in, one float out.
float hash(vec2 p) { return hashF(uint(int(p.x)) * 0x9e3779b9u + hashU(uint(int(p.y)))); }
// Three independent values from one integer.
vec3 hash3(float n) {
  uint h = hashU(uint(int(n)));
  return vec3(hashF(h), hashF(h + 1u), hashF(h + 2u));
}
// Smooth value noise, about 0..1, period 256 in each axis.
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec2 j = mod(i + 1.0, 256.0);
  i = mod(i, 256.0);
  return mix(mix(hash(i), hash(vec2(j.x, i.y)), f.x),
             mix(hash(vec2(i.x, j.y)), hash(j), f.x), f.y);
}

// ---- palette (section 6.1), linear light ------------------------------------------------------
// 0 magenta, 1 cyan, 2 ultraviolet, 3 orange, 4 yellow, 5 green, 6 red, 7 ice white.
vec3 pal(float i) {
  const vec3 c[8] = vec3[8](
    vec3(1.0, 0.024, 0.672), vec3(0.01, 0.871, 1.0), vec3(0.328, 0.074, 1.0), vec3(1.0, 0.195, 0.01),
    vec3(1.0, 0.753, 0.074), vec3(0.067, 1.0, 0.195), vec3(1.0, 0.02, 0.051), vec3(0.738, 0.905, 1.0));
  return c[int(i) & 7];
}

// ---- moods (section 6.7) ----------------------------------------------------------------------
// Blend three per-mood values by uMood.x: a at 0, b at 1, c at 2, back to a at 3.
vec3 mood(vec3 a, vec3 b, vec3 c) {
  float m = mod(uMood.x, 3.0);
  return m < 1.0 ? mix(a, b, m) : m < 2.0 ? mix(b, c, m - 1.0) : mix(c, a, m - 2.0);
}

// ---- fog (section 6.3) ------------------------------------------------------------------------
// Colour of the fog in a view direction: warm towards the sun, violet away from it.
vec3 fogColor(vec3 dir) {
  float s = clamp(dot(normalize(dir.xz + 1e-5), uSun.xz) * 0.5 + 0.5, 0.0, 1.0);
  vec3 warm = mood(vec3(0.22, 0.05, 0.11), vec3(0.05, 0.06, 0.20), vec3(0.21, 0.06, 0.19));
  vec3 cool = mood(vec3(0.07, 0.03, 0.17), vec3(0.02, 0.02, 0.09), vec3(0.04, 0.09, 0.20));
  return mix(cool, warm, s * s);
}
// Fog between the camera and a render-space point, denser near the ground.
// Density falls as exp(-height / 350 m); this is its exact integral along the ray, so the fog stays
// right when the camera is high above the city. uFade.z is the density at the ground.
float fogAmount(vec3 p) {
  float a = max(p.y, 0.0) / 350.0, b = max(uCam.y, 0.0) / 350.0;
  float k = abs(b - a) < 0.01 ? exp(-a) : (exp(-a) - exp(-b)) / (b - a);
  return 1.0 - exp(-length(p - vec3(0.0, uCam.y, 0.0)) * uFade.z * k);
}
// Apply fog to a colour at a render-space point. Run every colour through this before output.
vec3 fog(vec3 col, vec3 p) {
  return mix(col, fogColor(p - vec3(0.0, uCam.y, 0.0)), fogAmount(p));
}

// ---- the street grid (section 5.4) ------------------------------------------------------------
// For one tile coordinate c (x or z): x = signed distance in metres to the nearest road centre
// line, y = 1 if that road is an avenue, 0 if it is a street.
vec2 road(float c) {
  float i = floor(c / CELL + 0.5);
  return vec2(c - i * CELL, mod(i, AVE) == 0.0 ? 1.0 : 0.0);
}
// Corridor half-width and carriageway half-width of a road, from road().y.
float roadHalf(float avenue) { return mix(ST_HALF, AV_HALF, avenue); }
float roadWidth(float avenue) { return mix(ST_ROAD, AV_ROAD, avenue); }

#ifdef FS
// ---- fragment only ----------------------------------------------------------------------------
out vec4 O;

// Coverage 0..1 of a line of half-width w centred on d = 0, filtered over the pixel footprint.
// d must vary smoothly across the surface (take it before any fract()).
float line(float d, float w) {
  float a = max(fwidth(d), 1e-5);
  return 1.0 - smoothstep(w - a, w + a, abs(d));
}
// World-space view direction of this fragment, for full-screen passes. Correct in the mirror pass.
vec3 ray() {
  vec2 u = gl_FragCoord.xy / uRes.xy * 2.0 - 1.0;
  vec3 r = normalize(uFwd.xyz + u.x * uRight.w * uRight.xyz + u.y * uUp.w * uUp.xyz);
  r.y *= 1.0 - 2.0 * uCam.w;
  return r;
}

#else
// ---- vertex only ------------------------------------------------------------------------------

// Render-space position of a point `local` metres from an anchor given in tile coordinates.
// Wraps the ANCHOR to the copy nearest the camera and sinks heights to zero across the far fade.
// Use it for everything; never write another wrap, and never wrap per vertex.
vec3 place(vec3 anchor, vec3 local) {
  vec2 d = anchor.xz - uCam.xz;
  d -= TILE * floor(d / TILE + 0.5);
  float k = 1.0 - smoothstep(uFade.x, uFade.y, length(d));
  return vec3(d.x + local.x, (anchor.y + local.y) * k, d.y + local.z);
}

// Corner of a quad from gl_VertexID, 6 vertices per quad, both coordinates in -1..1.
vec2 quad() {
  int c = int[6](0, 1, 2, 2, 1, 3)[gl_VertexID % 6];
  return vec2(c & 1, c >> 1) * 2.0 - 1.0;
}
// Unit box from gl_VertexID, 36 vertices: x and z in -1..1, y in 0..1 (it stands on its base).
// n is the outward face normal. Counter-clockwise from outside.
// Faces in order -x +x -y +y -z +z, 6 vertices each. No dynamic vector indexing (ANGLE warns on it).
vec3 cube(out vec3 n) {
  float s = float(gl_VertexID / 6 & 1) * 2.0 - 1.0;
  vec3 e = vec3(equal(ivec3(gl_VertexID / 12), ivec3(0, 1, 2)));
  vec2 q = quad();
  n = e * s;
  vec3 p = n + e.zxy * q.x * s + e.yzx * q.y;
  p.y = p.y * 0.5 + 0.5;
  return p;
}
// Full-screen triangle at the far plane, 3 vertices. Draw with depth func LEQUAL.
vec4 screen() {
  return vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 4.0 - 1.0, 1.0, 1.0);
}
// Camera-facing sprite: vertex of a quad of half-size s centred on render-space point p.
// uv comes back in -1..1.
vec3 sprite(vec3 p, float s, out vec2 uv) {
  uv = quad();
  return p + (uRight.xyz * uv.x + uUp.xyz * uv.y) * s;
}
// Camera-facing strip from a to b (render space) of half-width w, for beams and trails.
// uv comes back as x across in -1..1, y along in 0..1. Draw with culling off.
vec3 ribbon(vec3 a, vec3 b, float w, out vec2 uv) {
  uv = quad();
  uv.y = uv.y * 0.5 + 0.5;
  vec3 p = mix(a, b, uv.y);
  vec3 side = normalize(cross(b - a, p - vec3(0.0, uCam.y, 0.0)) + 1e-6);
  return p + side * w * uv.x;
}
#endif

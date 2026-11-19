// Lights over the roofs, one program over the plan's boxes (8 slots of 6 vertices per box, and a
// second draw of slots 8..20 over the first 1024 instances, read as cells):
//  - megatower spire: slot 0 a beacon pillar straight up, slots 1..7 a laser fan from the spire base;
//  - megatower segment: slots 0..1 sweeping searchlights from the corners of its top;
//  - tall shaft or crown, about one in four: slot 0 a sweeping searchlight;
//  - crown, megatower segment or small spire above 120 m: slots 4..7 red aviation lights, blinking;
//  - plaza cells, second draw: a turning wire octahedron and a column of light.
// A slot that is not used is dropped with a zero-area triangle. Ribbons are camera facing; every
// beam is kept at least about a pixel wide, with its intensity scaled down by the same factor, so
// thin beams do not shimmer at distance. Additive: colour scaled by 1 - fogAmount.
#ifdef FS
in vec2 vUv;
in float vI;
in vec3 vPos;
flat in vec4 vCol; // rgb colour; w falloff along the beam, negative for a sprite
void main() {
  float sp = step(vCol.w, 0.0);
  float q = max(1.0 - vUv.x * vUv.x - sp * vUv.y * vUv.y, 0.0);
  float shimmer = mix(0.6 + noise(vec2(vUv.y * 14.0 - uTime.x * 1.5, vCol.w * 40.0)) * 0.8, 1.0, sp);
  O = vec4(vCol.rgb * q * q * (1.0 + 3.0 * pow(q, 12.0)) * exp(-max(vCol.w, 0.0) * vUv.y) * (1.0 - vUv.y * vUv.y * min(vCol.w, 1.0)) * shimmer
    * vI * (1.0 - fogAmount(vPos)) * smoothstep(0.0, 80.0, length(vPos - vec3(0.0, uCam.y, 0.0))), 1.0);
}
#else
layout(location = 0) in vec4 aA; // centre x, base y, centre z, seed
layout(location = 1) in vec4 aB; // half-width x, height, half-width z, kind
out vec2 vUv;
out float vI;
out vec3 vPos;
flat out vec4 vCol;
void main() {
  int b = gl_VertexID / 6;
  float slot = float(b);
  vec3 r = hash3(float(gl_InstanceID * 32 + b));
  vec3 anchor = aA.xyz;
  // a corner of the box top, picked per slot
  vec3 from = vec3(aB.x * sign(r.y - 0.5) * 0.85, aB.y, aB.z * sign(r.z - 0.5) * 0.85);
  // a sweeping searchlight by default
  float sweep = r.x * TAU + uTime.x * (r.y - 0.5) * 0.9;
  float tilt = 0.15 + 0.45 * r.z + 0.12 * sin(uTime.x * 0.5 + r.x * 20.0);
  float len = 1500.0, w0 = 1.5, w1 = 36.0, fall = 2.2, on = 0.0;
  vec3 col = pal(floor(r.z * 3.0) * floor(r.z * 3.0)) * 1.1; // magenta, cyan or yellow
  if (aB.w == 4.0 && aB.y > 60.0) {
    // the spire of a megatower
    on = 1.0;
    from.xz = vec2(0.0);
    if (b == 0) {
      // beacon pillar, out of sight
      tilt = 0.0; len = 6000.0; w0 = 9.0; w1 = 9.0; fall = 0.3;
      col = pal(floor(hash(aA.w) * 3.0) * floor(hash(aA.w) * 3.0)) * 1.6;
    } else {
      // laser fan from the spire base, turning slowly
      from.y = 0.0;
      sweep = slot * 0.9 + uTime.x * 0.12 + hash(aA.w) * TAU;
      tilt = 0.55 + 0.3 * sin(uTime.x * 0.35 + slot * 1.7);
      len = 2600.0; w0 = 0.5; w1 = 2.0; fall = 1.2;
      col *= 1.4;
    }
  } else if (b < 1) {
    on = aB.w == 3.0 || aB.w > 0.0 && aA.y + aB.y > 170.0 && hash(float(gl_InstanceID)) < 0.16 ? 1.0 : 0.0;
  } else if (b > 3 && aB.w > 1.0 && aA.y + aB.y > 120.0) {
    // aviation light on a corner of a crown, megatower segment or spire top, blinking per building;
    // a spire gets one, at its tip
    on = aB.w == 4.0 && b > 4 ? 0.0 : 1.0;
    from.xz = vec2(float(b & 1), float(b >> 1 & 1)) * 2.0 - 1.0;
    from = vec3(from.x * aB.x, aB.y + 0.6, from.z * aB.z) * vec3(aB.w < 4.0, 1.0, aB.w < 4.0);
    fall = -1.0;
    col = pal(6.0) * (fract(uTime.x * 0.6 + hash(aA.w)) < 0.25 ? 8.0 : 0.25);
  }
  vec3 dir = vec3(sin(tilt) * cos(sweep), cos(tilt), sin(tilt) * sin(sweep));
  if (b > 7) {
    // second draw, instance = cell: over a plaza, a turning wire octahedron (slots 8..19, one edge
    // each) and a column of light rising from the ground (slot 20)
    ivec2 cell = ivec2(gl_InstanceID & 31, gl_InstanceID >> 5);
    on = abs(texelFetch(T2, cell, 0).r * 255.0 - 3.0) < 0.5 ? 1.0 : 0.0; // D_PLAZA
    anchor = vec3((vec2(cell) + 0.5) * CELL, 0.0).xzy;
    float k = float(b & 3) * PI * 0.5 + uTime.x * 0.4;
    from = vec3(cos(k), 0.0, sin(k)) * 28.0;
    dir = (b < 12 ? vec3(cos(k + PI * 0.5), 0.0, sin(k + PI * 0.5)) * 28.0 : vec3(0.0, b < 16 ? 28.0 : -28.0, 0.0)) - from;
    from.y += 96.0 + 5.0 * sin(uTime.x);
    len = 1.0; w0 = 0.5; w1 = 0.5; fall = 0.0;
    col = pal(hash(float(gl_InstanceID)) * 3.0) * 3.0;
    if (b > 19) {
      from = vec3(0.0); dir = vec3(0.0, 1.0, 0.0); len = 500.0; w0 = 14.0; w1 = 5.0; fall = 2.5; col *= 0.5;
    }
  }
  vec3 a = place(anchor, from), e = place(anchor, from + dir * len);
  vec3 p = ribbon(a, e, 1.0, vUv);
  vec3 c = mix(a, e, vUv.y);
  // half-width of about one and a half pixels at this distance
  float px = length(c - vec3(0.0, uCam.y, 0.0)) * uUp.w * 3.0 / uRes.y;
  float w = mix(w0, w1, vUv.y);
  float ww = max(w, px);
  vI = w / ww;
  vPos = c + (p - c) * ww;
  if (fall < 0.0) {
    ww = max(1.6, px * 1.5);
    vI = 2.56 / (ww * ww);
    vPos = sprite(a, ww, vUv);
  }
  // beams fade out across the far fade instead of lying down with their anchor
  vCol = vec4(col * (0.8 + 0.4 * uTime.w) * (1.0 - smoothstep(uFade.x, uFade.y, length(a.xz - from.xz))), fall);
  gl_Position = on > 0.0 ? uVP * vec4(vPos, 1.0) : vec4(0.0);
}
#endif

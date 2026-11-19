// Holographic billboards, one program over the plan's boxes (5 panels of 6 vertices per box):
//  - panel 0: a sign on one face of about a quarter of the tall shafts, 1.5 m out from the wall;
//  - panels 0, 2, 3, 4 on a megatower segment: a scrolling ticker band round the top of it;
//  - panel 1: instance n < 1024 is cell n; a slowly turning sign floating over the cell if it is a
//    plaza, or over the avenue junction at its corner on about half of them.
// Each sign is an invented word of 3 to 6 letters (alternating consonant and vowel, sometimes digits)
// read from the glyph atlas on T3, horizontal or stacked vertically, in a frame with a bar, scanlines,
// flicker, a glitch band that jumps on the beat and a little colour fringing. Additive.
#ifdef FS
in vec2 vUv;       // glyph units from the panel centre
in vec3 vPos;
flat in vec4 vA;   // letters, vertical 0/1, half-size in glyph units
flat in vec4 vB;   // seed, colour index, digits 0/1, first letter parity
void main() {
  vec2 p = vUv;
  float fw = fwidth(p.y);
  if (!gl_FrontFacing) p.x = -p.x;
  float n = vA.x;
  // glitch: a band of the panel slides sideways for a moment after a beat
  float band = floor(p.y * 3.0 + 9.0);
  p.x += step(0.75, hash(vec2(band + vB.x * 7.0, uTime.z))) * uTime.w * uTime.w * (hash(vec2(band, uTime.z)) - 0.5);
  // along the text (t, in letters) and inside one glyph cell (g, 0..1, y up)
  // a ticker (n huge) scrolls
  float t = vA.y > 0.5 ? n * 0.5 - p.y : (p.x + n * 0.4 + uTime.x * 2.0 * step(99.0, n)) / 0.8;
  vec2 g = vA.y > 0.5 ? vec2(p.x + 0.5, 1.0 - fract(t)) : vec2(0.5 + (fract(t) - 0.5) * 0.8, p.y + 0.5);
  float i = floor(t);
  float h = hash(vec2(vB.x, i));
  float letter = vB.z > 0.5 ? 23.0 + floor(h * 10.0) : mod(i + vB.w, 2.0) > 0.5 ? floor(h * 6.0) : 6.0 + floor(h * 17.0);
  vec2 uv = (vec2(mod(letter, 8.0), floor(letter / 8.0)) + vec2(g.x, 1.0 - g.y)) / vec2(8.0, 5.0);
  float inside = step(0.0, t) * step(t, n) * step(0.0, g.y) * step(g.y, 1.0) * step(0.0, g.x) * step(g.x, 1.0);
  vec3 txt = vec3(texture(T3, uv + vec2(0.004, 0.0)).r, texture(T3, uv).r, texture(T3, uv - vec2(0.004, 0.0)).r);
  // fade the text to its average when a glyph is under about eight pixels
  txt = mix(txt, vec3(0.3), smoothstep(0.06, 0.16, fw)) * inside;
  vec3 a = pal(vB.y), c = pal(vB.y + 3.0);
  float edge = min(vA.z - abs(p.x), vA.w - abs(p.y));
  float frame = line(edge - 0.1, 0.05);
  float bar = line(p.y + vA.w - 0.22, 0.04) * (1.0 - vA.y);
  float scan = mix(0.6 + 0.4 * cos(p.y * 50.0 - uTime.x * 4.0), 0.6, smoothstep(0.02, 0.05, fw));
  float flick = hash(vec2(floor(uTime.x * 14.0), vB.x)) < 0.04 ? 0.3 : 1.0;
  vec3 col = a * txt * 2.8 + a * frame * 2.2 + c * (bar * 1.6 + 0.16 + 0.1 * p.y / vA.w + 0.15 * step(edge, 0.25));
  O = vec4(col * scan * flick * (0.8 + 0.4 * uTime.w) * step(0.0, edge) * (1.0 - fogAmount(vPos)), 1.0);
}
#else
layout(location = 0) in vec4 aA; // centre x, base y, centre z, seed
layout(location = 1) in vec4 aB; // half-width x, height, half-width z, kind
out vec2 vUv;
out vec3 vPos;
flat out vec4 vA;
flat out vec4 vB;
void main() {
  int s = gl_VertexID / 6;
  int id = gl_InstanceID;
  vec3 r = hash3(float(id * 8 + s + 77));
  float n = 3.0 + floor(r.x * 4.0);
  float vert = step(0.72, r.y);
  // half-size in glyph units
  vec2 e = vert > 0.5 ? vec2(0.75, n * 0.5 + 0.35) : vec2(n * 0.4 + 0.35, 0.8);
  vec3 anchor = aA.xyz, nrm, right, local;
  float g, on = 0.0;
  if (s != 1) {
    // on a face of a tall shaft (panel 0), or a ticker band on all four faces of a megatower
    // segment (panels 0, 2, 3, 4)
    float ticker = aB.w == 3.0 ? 1.0 : 0.0;
    float f = ticker > 0.0 ? float(s - min(s, 1)) : floor(fract(r.z * 17.0) * 4.0);
    nrm = f < 2.0 ? vec3(f * 2.0 - 1.0, 0.0, 0.0) : vec3(0.0, 0.0, f * 2.0 - 5.0);
    right = cross(vec3(0.0, 1.0, 0.0), nrm);
    float across = f < 2.0 ? aB.z : aB.x, away = f < 2.0 ? aB.x : aB.z;
    g = min(min(5.0 + fract(r.x * 7.0) * 12.0, across * 0.85 / e.x), aB.y * 0.3 / e.y);
    local = nrm * (away + 1.5) + vec3(0.0, aB.y * (0.62 + 0.25 * fract(r.z * 5.0)) - g * e.y, 0.0);
    on = ticker > 0.0 || s == 0 && aB.w == 1.0 && aB.y > 40.0 && r.z < 0.4 ? 1.0 : 0.0;
    if (ticker > 0.0) {
      n = 29999.0; vert = 0.0; g = 8.0;
      e = vec2(across * 0.97 / g, 0.8);
      local = nrm * (away + 1.0) + vec3(0.0, aB.y - 20.0, 0.0);
    }
  } else {
    // floating over a plaza or an avenue junction, turning
    ivec2 cell = ivec2(id & 31, id >> 5);
    float plaza = abs(texelFetch(T2, cell, 0).r * 255.0 - 3.0) < 0.5 ? 1.0 : 0.0; // D_PLAZA
    anchor = vec3((vec2(cell) + 0.5 * plaza) * CELL, 0.0).xzy;
    float a = uTime.x * 0.25 + r.z * TAU;
    right = vec3(cos(a), 0.0, sin(a));
    g = min(mix(5.0, 11.0, plaza) + r.z * 4.0, 16.0 / e.x);
    local = vec3(0.0, mix(30.0, 120.0, plaza) + fract(r.y * 13.0) * 100.0, 0.0);
    on = id < 1024 && (plaza > 0.0 || (cell.x & 3) + (cell.y & 3) == 0 && r.z < 0.55) ? 1.0 : 0.0;
  }
  vUv = quad() * e;
  vPos = place(anchor, local + (right * vUv.x + vec3(0.0, vUv.y, 0.0)) * g);
  vA = vec4(n, vert, e);
  vB = vec4(floor(r.x * 4096.0), floor(fract(r.y * 9.0) * 6.0), step(0.85, fract(r.z * 23.0)), step(0.5, fract(r.x * 31.0)));
  gl_Position = on > 0.0 ? uVP * vec4(vPos, 1.0) : vec4(0.0);
}
#endif

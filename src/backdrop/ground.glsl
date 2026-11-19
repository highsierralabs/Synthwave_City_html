// Backdrop ground: one huge quad at y = 0 under the camera. Streets and avenues (section 5.4) are
// worked out per fragment from tile coordinates: asphalt, sidewalks, block interiors tinted by
// district (cell texture T2), glowing curbs, lane dashes, pedestrian crossings, pools of lamp light
// and the mirrored city (T1) on wet asphalt. Every line is filtered against its pixel footprint and
// the whole pattern fades to its average once a cell is only a few pixels across.
#ifdef FS
in vec3 vPos;

// Coverage of a line |d| < w, with a the pixel footprint of d (fwidth of a smooth coordinate).
// Scaled down once the line is thinner than the footprint, so far lines do not sum to a glare.
float lineA(float d, float w, float a) {
  a = max(a, 1e-4);
  return (1.0 - smoothstep(w - a, w + a, abs(d))) * min(1.0, 2.0 * w / a);
}
// The same, footprint taken from d itself: d must be smooth here.
float lineD(float d, float w) { return lineA(d, w, fwidth(d)); }
// 0..1 dashes, 40% on, along t in periods; fades to 0.4 when a period is under about two pixels.
float dash(float t) {
  float a = fwidth(t);
  return mix(smoothstep(0.3 - a, 0.3 + a, abs(fract(t) - 0.5)), 0.4, min(a * 2.0, 1.0));
}

// Light emitted by the markings of one road axis. ra = road() across this road, rb = road() of the
// crossing axis, t = coordinate along this road. Also returns the carriageway coverage in cw.
vec3 marks(vec2 ra, vec2 rb, float t, out float cw) {
  // road().x jumps by CELL mid block, where fwidth is meaningless: every term is masked by step(.., 40).
  float d = abs(ra.x), w = roadWidth(ra.y), wb = roadWidth(rb.y);
  cw = lineD(ra.x, w) * step(abs(ra.x), 40.0);
  // inside the crossing road's carriageway there are no lengthwise markings or curbs
  float keep = (1.0 - lineD(rb.x, wb) * step(abs(rb.x), 40.0)) * step(abs(ra.x), 40.0);
  // lane dividers: street at 3.5 m, avenue at 5.25 and 8.75 m; a centre line on both
  float lanes = (lineD(d - mix(3.5, 5.25, ra.y), 0.08) + ra.y * lineD(d - 8.75, 0.08)) * dash(t / 9.0);
  // crossings: zebra stripes across this road, just outside the crossing road's carriageway
  float zebra = lineD(abs(rb.x) - wb - 2.5, 1.5) * step(abs(rb.x), 40.0) * dash(ra.x / 1.4) * cw;
  // lamp pools: lamps every 64 m on both sides, heads 1.5 m in from the curb
  float lx = d - w + 0.5, lz = mod(t, 64.0) - 32.0;
  float pool = exp(-(lx * lx + lz * lz) * 0.05) * step(abs(ra.x), 40.0);
  return keep * (pal(7.0) * 0.7 * (lanes + lineD(ra.x, 0.1)) + pal(1.0 - ra.y) * 2.5 * lineD(d - w, 0.18))
    + pal(7.0) * 0.15 * zebra + mix(pal(3.0), pal(4.0), 0.5) * 0.25 * pool;
}

void main() {
  vec2 w = uCam.xz + vPos.xz;          // tile coordinates of this fragment (not wrapped; periodic)
  vec2 rx = road(w.x), rz = road(w.y);
  float cx, cz;
  vec3 e = marks(rx, rz, w.y, cx) + marks(rz, rx, w.x, cz);
  float car = max(cx, cz);
  // corridor (carriageway plus sidewalk)
  float walk = max(lineD(rx.x, roadHalf(rx.y)) * step(abs(rx.x), 40.0), lineD(rz.x, roadHalf(rz.y)) * step(abs(rz.x), 40.0));
  // block interior tinted by district: 0 low, 1 mid, 2 high, 3 plaza, 4 mega
  vec4 cell = texelFetch(T2, ivec2(mod(floor(w / CELL), CELLS)), 0);
  float dist = floor(cell.r * 255.0 + 0.5);
  vec3 c = pal(dist + 2.0) * 0.03 + vec3(0.012, 0.006, 0.03);
  // plaza floors: a fine cyan grid
  vec2 g = abs(fract(w / 8.0 + 0.5) - 0.5) * 8.0;
  vec2 ga = fwidth(w);
  c += pal(1.0) * 0.6 * step(2.5, dist) * step(dist, 3.5) * max(lineA(g.x, 0.1, ga.x), lineA(g.y, 0.1, ga.y));
  c = mix(c, vec3(0.04, 0.03, 0.07), walk);
  c = mix(c, vec3(0.012, 0.01, 0.025), car);

  // Fade the periodic pattern to its average once a cell is a few pixels across.
  float far = smoothstep(0.03, 0.15, max(ga.x, ga.y) / CELL);
  vec3 v = normalize(vPos - vec3(0.0, uCam.y, 0.0));
  // wet: puddles on the asphalt, damp sidewalks; stronger at grazing angles
  float wet = mix((car * 0.3 + walk * 0.1) * (0.2 + 1.0 * noise(w * 0.11)), 0.1, far)
    * (0.25 + 0.75 * pow(clamp(1.0 + v.y, 0.0, 1.0), 4.0));
  vec2 uv = gl_FragCoord.xy / uRes.xy + (vec2(noise(w * 0.5), noise(w.yx * 0.5 + 37.0)) - 0.5) * vec2(0.006, 0.03) * max(0.0, 1.0 - max(ga.x, ga.y));
  c = mix(c + e, vec3(0.035, 0.02, 0.05) + pal(0.0) * 0.02, far)
    + wet * (texture(T1, uv).rgb + step(uRes.z, 0.5) * (fogColor(v) * 0.6
      + pal(3.0) * 3.0 * pow(clamp(dot(normalize(v.xz + 1e-5), normalize(uSun.xz)), 0.0, 1.0), 400.0)));
  O = vec4(fog(c, vPos), 1.0);
  // One quad 80 km wide cannot be trusted for depth: on some rasterisers its interpolated depth is
  // off by metres at a few hundred metres and changes every frame, which cut every headlight to a
  // sliver in step. Nothing is below the ground, so it sits at a constant depth behind the whole
  // city (the depth of 50 km) and in front of the sky (1.0).
  gl_FragDepth = 0.99999;
}
#else
out vec3 vPos;
void main() {
  vec2 q = quad();
  vPos = vec3(q.x, 0.0, -q.y) * 40000.0; // -q.y keeps it counter-clockwise seen from above
  gl_Position = uVP * vec4(vPos, 1.0);
}
#endif

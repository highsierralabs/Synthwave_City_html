// Backdrop sky: the full-screen triangle at the far plane, drawn after the opaques with state(SKY),
// also in the mirror pass (ray() flips there). Below the horizon it is exactly fogColor(), so it
// meets the fogged ground without a seam; above it, a hot haze band, the mood gradient, hashed stars,
// the striped sun in direction uSun with its halo, and a ridge of wireframe mountains in front.
#ifdef FS
// Coverage of a line |d| < w, with a the pixel footprint of d (fwidth of a smooth coordinate).
float lineA(float d, float w, float a) {
  a = max(a, 1e-4);
  return (1.0 - smoothstep(w - a, w + a, abs(d))) * min(1.0, 2.0 * w / a);
}
// Lines at every integer of t, half-width w in periods; footprint from t before fract.
float grid(float t, float w) { return lineA(fract(t + 0.5) - 0.5, w, fwidth(t)); }

void main() {
  vec3 r = ray(), f = fogColor(r);
  float y = r.y, az = atan(r.x, -r.z), h = max(y, 0.0);
  // gradient: haze band at the horizon, the mood's sky colour, deep indigo overhead
  vec3 c = mix(f * 2.4 + pal(0.0) * 0.05,
    mood(vec3(0.16, 0.012, 0.14), vec3(0.02, 0.015, 0.09), vec3(0.09, 0.03, 0.2)), smoothstep(0.0, 0.2, h));
  c = mix(c, mood(vec3(0.03, 0.005, 0.07), vec3(0.004, 0.003, 0.02), vec3(0.02, 0.01, 0.08)), smoothstep(0.08, 0.6, h));

  // stars: one candidate per cell of an equal-area grid on the sky, about 1.5% of cells lit
  vec2 s = vec2(az * length(r.xz), y) * 160.0, i = floor(s);
  float n = hash(i), px = fwidth(s.y);
  float star = max(0.0, 1.0 - length(fract(s) - 0.2 - 0.6 * vec2(fract(n * 13.0), fract(n * 97.0))) / (px * 1.3));
  c += pal(7.0) * star * step(0.99, n) * (1.0 - uCam.w) * smoothstep(0.04, 0.25, y) * (1.0 - smoothstep(0.3, 0.6, px))
    * (2.0 + 1.5 * sin(uTime.x * 3.0 + n * 400.0));

  // sun: disc of angular radius 0.15, yellow to magenta, horizontal cut-outs scrolling down
  vec3 u = uSun.xyz;
  float d = length(r - u), v = (y - u.y) / 0.15;
  float k = v * 5.0 - uTime.x * 0.3;
  float cut = 1.0 - lineA(fract(k + 0.5) - 0.5, clamp(0.25 - v * 0.35, 0.0, 0.45), fwidth(k)) * step(v, 0.5);
  vec3 sc = mood(pal(4.0), pal(1.0), pal(3.0));
  c = mix(c, mix(pal(0.0), sc, smoothstep(-0.9, 0.8, v)) * 5.0, lineA(d, 0.15, fwidth(d)) * cut);
  c += mix(pal(0.0), sc, 0.4) * (exp(-d * 5.0) * 0.5 + exp(-d * 18.0) * 0.6);

  // mountains: a seamless ridge (noise on a circle), dark indigo with a magenta wire grid and a
  // cyan crest, fading into the haze at the base
  vec2 q = vec2(cos(az), sin(az));
  float m = (1.0 - abs(noise(q * 2.5 + 5.0) * 2.0 - 1.0)) * 0.7 + noise(q * 9.0 + 9.0) * 0.3;
  m = m * m * 0.1;
  float e = m - y, ea = max(fwidth(e), 1e-4);
  vec3 wire = mix(f * 0.2, pal(0.0) * 0.9, max(grid(az * 24.0, 0.03), grid(e * 60.0, 0.03)))
    + pal(1.0) * 3.0 * lineA(e, 0.0015, ea);
  c = mix(c, mix(wire, f, 1.0 - smoothstep(0.0, 0.008, y)), smoothstep(-ea, ea, e));
  c = mix(f, c, smoothstep(-0.002, 0.004, y));
  O = vec4(c, 1.0);
}
#else
void main() { gl_Position = screen(); }
#endif

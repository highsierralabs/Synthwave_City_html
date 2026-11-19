// Post (plans/T09-post.md): bloom chain and grade in one program, one file for both stages.
// X0.x picks the pass: 0 first downsample (sanitise, soft threshold, firefly weighting),
// 1 plain blur (every other downsample and every upsample), 2 the final picture.
// The scene is on T4 for every pass; the blurred level being read is on T0.
uniform vec4 X0;
uniform sampler2D T4;
#ifdef FS
in vec2 vUv;

// The scene, finite and bounded: a NaN or an infinity from any layer becomes black here, before it
// can be blurred across the frame. The test reads the exponent bits, which no compiler can fold
// away; clamp() alone is not enough, since on D3D11 clamp(NaN) returns one of the bounds.
vec3 scene(vec2 uv) {
  vec3 c = texture(T4, uv).rgb;
  return all(lessThan(floatBitsToUint(c) & 0x7f800000u, uvec3(0x7f800000u))) ? clamp(c, 0.0, 64.0) : vec3(0.0);
}

// 3 x 3 tent of bilinear taps one source texel apart: a 4 x 4 footprint going down, a smooth
// tent going up. The first pass weights each tap by 1 / (1 + brightness) so a lone hot pixel
// cannot flicker the halo, and keeps only what lies above the knee near the top of L1.
float peak(vec3 c) { return max(max(c.r, c.g), c.b); }

vec3 blur(vec2 uv) {
  vec2 s = 1.0 / vec2(X0.x < 0.5 ? textureSize(T4, 0) : textureSize(T0, 0));
  vec4 sum = vec4(0.0);
  for (int i = -1; i < 2; i++)
    for (int j = -1; j < 2; j++) {
      vec2 p = uv + vec2(i, j) * s;
      vec3 c = texture(T0, p).rgb;
      float w = float((2 - abs(i)) * (2 - abs(j)));
      if (X0.x < 0.5) {
        c = scene(p);
        float m = peak(c), k = clamp(m - 0.9, 0.0, 0.8);
        c *= max(k * k / 1.6, m - 1.3) / max(m, 1e-4);
        w /= 1.0 + peak(c);
      }
      sum += vec4(c * w, w);
    }
  return sum.rgb / sum.a;
}

void main() {
  if (X0.x < 1.5) {
    O = vec4(blur(vUv), 1.0);
    return;
  }
  // Chromatic fringe: red and blue pulled apart towards the edges, about a pixel at the corners.
  vec2 d = vUv - 0.5;
  vec3 c = vec3(scene(vUv + d * 0.0015).r, scene(vUv).g, scene(vUv - d * 0.0015).b);
  // How far towards white: decided by the scene alone (only L3 cores), not by the bloom on top.
  float w = smoothstep(4.0, 16.0, peak(c) * uFade.w);
  c = (c + blur(vUv) * 0.2) * uFade.w;
  // Tone on the brightest channel, so the ratios between channels (the hue) survive.
  float m = peak(c) + 1e-4;
  // The chroma (c / m, brightest channel 1) is raised to a power to saturate it: unlike a mix
  // away from grey it cannot go negative, so no dark rings where two hues meet in a halo.
  c = mix(pow(c / m, vec3(1.3)), vec3(1.0), w) * (1.0 - exp(-1.2 * m * m / (m + 0.1)));
  // Vignette, gamma, scanlines, grain.
  c *= 1.0 - dot(d, d) * 0.5;
  c = pow(clamp(c, 0.0, 1.0), vec3(0.4545));
  c *= 0.95 + 0.05 * sin(gl_FragCoord.y * 2.1);
  c += (hash(floor(gl_FragCoord.xy) + vec2(4096.0 * mod(floor(uTime.x * 30.0), 512.0), 0.0)) - 0.5) * 0.04;
  O = vec4(c, 1.0);
}
#else
out vec2 vUv;
void main() {
  gl_Position = screen();
  vUv = gl_Position.xy * 0.5 + 0.5;
}
#endif

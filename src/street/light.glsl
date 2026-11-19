// Head and tail lights: five additive pieces per car (instance 5c + k). k = 0..3 are camera-facing
// sprites (k bit 0 tail, bit 1 side): a small L3 core with a glow. A sprite never shrinks below
// about two pixels, and its peak falls as it grows, so a distant road reads as a stream of points
// instead of flickering out. A light is brightest seen from the way it faces and never fully dark,
// so from above a road shows white and red together. k = 4 is the pool of headlight on the road
// ahead: a flat quad, warm, L1. Tail lights brake: a car's tails are three times as bright in about
// one second in seven, picked per car per second (cosmetic, so uTime.x).
#ifdef FS
in vec2 vUv;
flat in vec3 vCol;
void main() {
  float g = max(1.0 - dot(vUv, vUv), 0.0);
  O = vec4(vCol * g * g * g, 1.0);
}
#else
out vec2 vUv;
flat out vec3 vCol;
void main() {
  vec2 fw;
  float seed;
  int k = gl_InstanceID % 5;
  vec3 a = car(gl_InstanceID / 5, fw, seed), z = carSize(seed);
  float tail = float(k & 1);
  vec3 p = carPoint(a, fw, z * vec3(float(k & 2) * 0.65 - 0.65, 0.6, tail * 4.6 - 2.3));
  vec3 e = vec3(0.0, uCam.y, 0.0) - p;
  float d = length(e) + 0.01, r = max(0.3, 4.0 * d * uUp.w / uRes.y);
  float face = clamp(dot(e / d, vec3(fw.x, 0.0, fw.y)) * (0.7 - 1.4 * tail) + 0.3, 0.0, 1.0);
  vCol = (tail > 0.0 ? pal(6.0) * (1.0 + 2.0 * step(0.85, hash(vec2(gl_InstanceID / 5, floor(uTime.x))))) : mix(pal(7.0), pal(4.0), 0.3)) * 8.0 * face * sqrt(0.3 / r)
       * (1.0 - fogAmount(p)) * (1.0 - smoothstep(uFade.x, uFade.y, length(p.xz)));
  p.y += max(r - 0.6, 0.0);
  p = sprite(p, r, vUv);
  if (k == 4) {
    vUv = quad();
    p = carPoint(a, fw, vec3(vUv.x * 1.8 * z.x, 0.1, z.z * -2.3 - 6.0 + 5.0 * vUv.y));
    vCol = mix(pal(7.0), pal(4.0), 0.5) * 0.3 * (1.0 - fogAmount(p));
  }
  gl_Position = uVP * vec4(p, 1.0);
}
#endif

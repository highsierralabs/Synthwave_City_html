// People: additive neon figures walking the sidewalks of the 5 x 5 cells around the camera.
// Instance i: cell i % 25 of that window, walker k = i / 25 of 32 (so a drawn prefix thins every
// cell evenly). A walker belongs to its absolute cell, so it stays put while the window moves; the
// window edge is over 256 m away, past the 240 m fade, so nobody pops. k & 3 is the block side;
// each walks along the sidewalk between the two crossings, fading out at the ends.
#ifdef FS
in vec2 vUv;
flat in vec3 vCol;
flat in float vStep;
void main() {
  vec2 q = vec2(vUv.x * 0.3, vUv.y * 0.9 + 0.9);
  float legs = abs(abs(q.x + vStep * (0.85 - q.y)) - 0.07) - 0.05 + max(q.y - 0.85, 0.0) * 9.0;
  float body = max(abs(q.x) - 0.17, abs(q.y - 1.15) - 0.3);
  float f = min(min(legs, body), length(q - vec2(0.0, 1.6)) - 0.11);
  O = vec4(vCol * (1.0 - smoothstep(0.0, 0.03, f)), 1.0);
}
#else
out vec2 vUv;
flat out vec3 vCol;
flat out float vStep;
void main() {
  int i = gl_InstanceID % 25, k = gl_InstanceID / 25;
  vec2 cc = mod(floor(uCam.xz / CELL) + vec2(i % 5 - 2, i / 5 - 2), CELLS);
  vec3 h = hash3((cc.y * CELLS + cc.x) * 32.0 + float(k));
  float hi = float(k >> 1 & 1), across = float(k & 1);
  float ln = mix(cc.x, cc.y, across) + hi;
  float ave = mod(ln, AVE) == 0.0 ? 1.0 : 0.0;
  float w = roadWidth(ave), perp = ln * CELL + (1.0 - 2.0 * hi) * (w + (roadHalf(ave) - w) * (0.2 + 0.6 * h.x));
  float t = fract((h.y < 0.5 ? -48.0 : 48.0) * (1.0 + floor(h.z * 2.0)) * uTime.y + h.z);
  float along = mix(cc.y, cc.x, across) * CELL + 20.0 + 88.0 * t;
  vec3 p = place(across > 0.0 ? vec3(along, 0.0, perp) : vec3(perp, 0.0, along), vec3(0.0));
  vCol = pal(h.x * 8.0) * 1.2 * (1.0 - fogAmount(p)) * smoothstep(0.0, 0.04, t) * smoothstep(0.0, 0.04, 1.0 - t)
       * (1.0 - smoothstep(150.0, 240.0, length(p.xz)));
  vStep = sin(uTime.x * 7.0 + h.z * 40.0) * 0.2;
  vUv = quad();
  gl_Position = uVP * vec4(p + normalize(vec3(uRight.x, 0.0, uRight.z) + 1e-5) * vUv.x * 0.3 + vec3(0.0, vUv.y * 0.9 + 0.9, 0.0), 1.0);
}
#endif

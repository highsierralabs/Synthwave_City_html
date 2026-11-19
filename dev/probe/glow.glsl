// Probe glows: an additive camera-facing sprite on the roof of every box taller than 100 m,
// pulsing on the beat. Same vertex array as the boxes. Idioms:
//  - drop an instance in the vertex shader with gl_Position = vec4(0.0) (a zero-area triangle);
//  - additive colour is scaled by 1 - fogAmount(p), never mixed with fog() (that would add the
//    fog colour over the whole sprite);
//  - draw with state(ADD).
#ifdef FS
in vec2 vUv;
flat in vec3 vCol;
in vec3 vPos;
void main() {
  float g = max(1.0 - dot(vUv, vUv), 0.0);
  O = vec4(vCol * g * g * (1.0 - fogAmount(vPos)), 1.0);
}
#else
layout(location = 0) in vec4 aA;
layout(location = 1) in vec4 aB;
out vec2 vUv;
flat out vec3 vCol;
out vec3 vPos;
void main() {
  vec3 p = place(aA.xyz, vec3(0.0, aB.y + 6.0, 0.0));
  vPos = sprite(p, 8.0, vUv);
  vCol = pal(hash(aA.w) * 8.0) * (3.0 + 3.0 * uTime.w);
  gl_Position = aB.y > 100.0 ? uVP * vec4(vPos, 1.0) : vec4(0.0);
}
#endif

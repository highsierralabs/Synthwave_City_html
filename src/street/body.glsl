// Car bodies: two boxes per car (instance 2c the body, 2c + 1 the cabin), dark (L0) with a neon
// side stripe, a red tail bar and a white head bar (L2), and faintly lit glass. 4.5 x 1.8 x 1.35 m for a car;
// vL is in car units, so a bus or a motorcycle (carSize) carries the same pattern stretched.
#ifdef FS
flat in vec3 vCol;
flat in vec3 vN;
in vec3 vL;
in vec3 vPos;
void main() {
  float side = abs(vN.x), cabin = step(0.86, vL.y);
  vec3 c = vec3(0.03, 0.02, 0.06) + vec3(0.05, 0.1, 0.2) * cabin * (1.0 - abs(vN.y)) * line(vL.y - 1.08, 0.18);
  c += vCol * 2.5 * side * line(vL.y - 0.5, 0.04);
  float bar = line(vL.y - 0.62, 0.07) * (1.0 - cabin) * step(abs(vL.x), 0.75);
  c += bar * (vN.z > 0.5 ? pal(6.0) * 3.0 : vN.z < -0.5 ? pal(7.0) * 2.0 : vec3(0.0));
  O = vec4(fog(c, vPos), 1.0);
}
#else
flat out vec3 vCol;
flat out vec3 vN;
out vec3 vL;
out vec3 vPos;
void main() {
  vec2 fw;
  float seed, cab = float(gl_InstanceID & 1);
  vec3 a = car(gl_InstanceID >> 1, fw, seed), n;
  vec3 l = cube(n) * (cab > 0.0 ? vec3(0.75, 0.5, 1.15) : vec3(0.9, 0.65, 2.25));
  l += vec3(0.0, 0.2 + 0.65 * cab, 0.3 * cab);
  vL = l;
  vN = n;
  vCol = pal(seed * 8.0);
  vPos = carPoint(a, fw, l * carSize(seed));
  gl_Position = uVP * vec4(vPos, 1.0);
}
#endif

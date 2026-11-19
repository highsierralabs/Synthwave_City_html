// Backdrop street lamps: no buffer. Instance pairs (post, head) from gl_InstanceID: 8192 lamps,
// every 64 m on both sides of every road of the tile, just behind the curb, their heads reaching
// 1.2 m over the carriageway. The lamp index is scrambled by an odd multiplier, so drawing a density
// prefix draws an even sample. The head is a small L3 core; bloom makes the glow, the ground shader
// draws the pool of light under it.
#ifdef FS
flat in vec3 vCol;
in vec3 vPos;
void main() { O = vec4(fog(vCol, vPos), 1.0); }
#else
flat out vec3 vCol;
out vec3 vPos;
void main() {
  int id = (gl_InstanceID >> 1) * 1597 & 8191, rl = id >> 2 & 31;
  float head = float(gl_InstanceID & 1), s = float(id & 2) - 1.0;
  float a = float(id & 1);                         // 0: road runs along z, 1: along x
  float across = float(rl) * CELL + s * (roadWidth(float((rl & 3) == 0)) + 1.0);
  float along = float(id >> 7) * 64.0 + 32.0;
  vec3 n, l = cube(n) * mix(vec3(0.12, 7.5, 0.12), vec3(1.0, 0.2, 0.3), head);
  l.y += head * 7.3;
  l.xz = mix(l.xz, vec2(l.z, -l.x), a);            // a quarter turn keeps the winding
  l.xz -= mix(vec2(s, 0.0), vec2(0.0, s), a) * 1.2 * head;
  vPos = place(a > 0.5 ? vec3(along, 0.0, across) : vec3(across, 0.0, along), l);
  vCol = mix(vec3(0.03, 0.02, 0.06), mix(pal(3.0), pal(4.0), 0.6) * 6.0, head);
  gl_Position = uVP * vec4(vPos, 1.0);
}
#endif

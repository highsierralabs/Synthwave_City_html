// Probe ground: one quad under the camera, the street grid drawn from tile coordinates, the
// mirrored city (T1) on the roads, glowing curbs. Not wrapped: the pattern is periodic, so it is
// worked out from uCam.xz + render position. Lines go through line(), filtered per pixel.
#ifdef FS
in vec3 vPos;
void main() {
  vec2 w = uCam.xz + vPos.xz;          // tile coordinates of this fragment
  vec2 rx = road(w.x), rz = road(w.y); // distance to the nearest road line in x and in z
  // road().x jumps by CELL in the middle of each block, where fwidth is meaningless: mask there.
  vec2 m = step(abs(vec2(rx.x, rz.x)), vec2(CELL * 0.25));
  float onRoad = max(line(rx.x, roadHalf(rx.y)) * m.x, line(rz.x, roadHalf(rz.y)) * m.y);
  float curb = max(line(abs(rx.x) - roadWidth(rx.y), 0.25) * m.x, line(abs(rz.x) - roadWidth(rz.y), 0.25) * m.y);
  vec3 c = mix(vec3(0.05, 0.03, 0.08), vec3(0.012, 0.01, 0.02), onRoad);
  c += texture(T1, gl_FragCoord.xy / uRes.xy).rgb * 0.6 * onRoad;
  c += pal(0.0) * 2.0 * curb;
  O = vec4(fog(c, vPos), 1.0);
}
#else
out vec3 vPos;
void main() {
  vec2 q = quad();
  vPos = vec3(q.x, 0.0, -q.y) * 8192.0; // -q.y keeps it counter-clockwise seen from above
  gl_Position = uVP * vec4(vPos, 1.0);
}
#endif

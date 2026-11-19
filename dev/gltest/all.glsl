// probe (e): every function of common.glsl called from both stages.
#ifdef FS
in vec3 vP;
void main() {
  float a = hashF(hashU(7u)) + hash(3.0) + hash(vec2(4.0, 5.0)) + noise(vP.xz);
  vec3 h = hash3(9.0) + pal(a) + mood(vec3(1.0), vec3(2.0), vec3(3.0));
  vec2 r = road(vP.x);
  a += roadHalf(r.y) + roadWidth(r.y) + fogAmount(vP) + line(r.x, 1.0);
  vec3 c = fog(h * a, vP) + fogColor(ray());
  O = vec4(c * TILE * CELLS * CELL * AVE * ST_HALF * ST_ROAD * AV_HALF * AV_ROAD * PI * TAU, 1.0);
}
#else
out vec3 vP;
void main() {
  vec3 n;
  vec2 uv;
  vec3 p = place(vec3(10.0, 0.0, 20.0), cube(n)) + sprite(vec3(0.0), 1.0, uv) + ribbon(vec3(0.0), vec3(1.0), 1.0, uv);
  p += vec3(quad(), 0.0) + hash3(1.0) + pal(2.0) + vec3(hash(2.0) + hash(vec2(1.0)) + noise(p.xz));
  p += fog(fogColor(p), p) + vec3(road(p.x), roadHalf(1.0) + roadWidth(0.0) + fogAmount(p));
  p += mood(vec3(1.0), vec3(2.0), vec3(3.0)) + vec3(hashF(hashU(3u)));
  vP = p;
  gl_Position = uVP * vec4(p, 1.0) + screen();
}
#endif

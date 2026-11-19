// Probe boxes: one instance per plan box, flat-shaded, fogged. The idioms layers copy:
//  - one file for both stages, prog(src, src), fragment code under #ifdef FS;
//  - per-instance attributes at layout(location = n), filled once from plan.boxes;
//  - geometry from cube(), placed with place(anchor, local), projected with uVP;
//  - per-instance values reach the fragment stage as flat varyings;
//  - every colour goes through fog() before it is written.
#ifdef FS
flat in vec3 vCol;
flat in vec3 vN;
in vec3 vPos;
void main() {
  // L0 to L1 (architecture.md 6.2): a dull body, the sun side a little brighter.
  float lit = 0.35 + 0.65 * max(dot(vN, normalize(vec3(0.2, 0.6, -0.8))), 0.0);
  O = vec4(fog(vCol * lit, vPos), 1.0);
}
#else
layout(location = 0) in vec4 aA; // centre x, base y, centre z, seed   (contracts.ts B_X .. B_SEED)
layout(location = 1) in vec4 aB; // half-width x, height, half-width z, kind   (B_HX .. B_KIND)
flat out vec3 vCol;
flat out vec3 vN;
out vec3 vPos;
void main() {
  vec3 n;
  vec3 p = place(aA.xyz, cube(n) * aB.xyz);
  vPos = p;
  vN = n;
  vCol = pal(hash(aA.w) * 8.0) * 0.12 + 0.03;
  gl_Position = uVP * vec4(p, 1.0);
}
#endif

// probe (f): a culled cube() seen from +z must show its +z face (winding is counter-clockwise).
#ifdef FS
flat in vec3 vN;
void main() { O = vec4(vN, 1.0); }
#else
flat out vec3 vN;
void main() {
  vec3 n;
  vec3 p = cube(n);
  gl_Position = uVP * vec4(p, 1.0);
  vN = n;
}
#endif

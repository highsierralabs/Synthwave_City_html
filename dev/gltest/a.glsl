// probe (a): per-instance attributes only (divisor 1), corners from gl_VertexID.
#ifdef FS
flat in vec4 vC;
void main() { O = vC; }
#else
layout(location = 0) in vec4 aPos;
layout(location = 1) in vec4 aCol;
flat out vec4 vC;
void main() {
  gl_Position = vec4(aPos.xy + quad() * aPos.z, 0.0, 1.0);
  vC = aCol;
}
#endif

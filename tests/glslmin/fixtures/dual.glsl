// Fixture: one file used as both the vertex and the fragment body, split by #ifdef FS / #else.
// Its minified text starts with a directive, so it also proves the join after the common chunk.
#ifdef FS
in vec2 vQuad;
flat in float vIndex;
void main() {
  float ring = line(length(vQuad) - 0.5, 0.05);
  O = vec4(pal(vIndex) * (ring * 3.0 + 0.1), 1.0);
}
#else
out vec2 vQuad;
flat out float vIndex;
void main() {
  vQuad = quad();
  vIndex = float(gl_InstanceID);
  vec2 cellOrigin = vec2(float(gl_InstanceID % 4), float(gl_InstanceID / 4)) * 0.5 - 0.75;
  gl_Position = vec4(cellOrigin + vQuad * 0.24, 0.0, 1.0);
}
#endif

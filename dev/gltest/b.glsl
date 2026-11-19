// probe (b): no attributes at all; position from gl_InstanceID.
#ifdef FS
flat in vec4 vC;
void main() { O = vC; }
#else
flat out vec4 vC;
void main() {
  vec2 c = vec2(gl_InstanceID & 1, gl_InstanceID >> 1) - 0.5;
  gl_Position = vec4(c + quad() * 0.25, 0.0, 1.0);
  vC = vec4(float(gl_InstanceID + 1));
}
#endif

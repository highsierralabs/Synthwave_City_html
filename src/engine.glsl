// The engine's own program: copies the scene to the canvas when no post is set (src/engine.ts).
// Linear in, clamped, gamma 2.2 out, alpha 1. One file for both stages: prog(blit, blit).
#ifdef FS
in vec2 vUv;
void main() {
  O = vec4(pow(clamp(texture(T0, vUv).rgb, 0.0, 1.0), vec3(0.4545)), 1.0);
}
#else
out vec2 vUv;
void main() {
  gl_Position = screen();
  vUv = gl_Position.xy * 0.5 + 0.5;
}
#endif

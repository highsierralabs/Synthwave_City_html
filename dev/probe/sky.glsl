// Probe sky: the full-screen triangle at the far plane, drawn after the opaques with state(SKY),
// fog colour at the horizon fading to deep indigo overhead. ray() is right in the mirror pass too.
#ifdef FS
void main() {
  vec3 r = ray();
  O = vec4(mix(fogColor(r), vec3(0.01, 0.0, 0.04), clamp(r.y * 3.0, 0.0, 1.0)), 1.0);
}
#else
void main() { gl_Position = screen(); }
#endif

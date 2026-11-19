// probe (c): pixel x of a 64 x 1 target shows float slot x of the block F.
#ifdef FS
float slot(int i) {
  if (i < 16) return uVP[i / 4][i % 4];
  vec4 v[12] = vec4[12](uCam, uTime, uRes, uFade, uRight, uUp, uFwd, uSun, uMix, uMood, uX0, uX1);
  return v[(i - 16) / 4][i % 4];
}
void main() { O = vec4(slot(int(gl_FragCoord.x))); }
#else
void main() { gl_Position = screen(); }
#endif

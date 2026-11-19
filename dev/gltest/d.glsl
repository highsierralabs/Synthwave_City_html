// probe (d): a full-target quad at depth X0.x writing X0.y on the left pixel and X0.z on the right.
#ifdef FS
uniform vec4 X0;
void main() { O = vec4(gl_FragCoord.x < 1.0 ? X0.y : X0.z); }
#else
uniform vec4 X0;
void main() { gl_Position = vec4(quad(), X0.x, 1.0); }
#endif

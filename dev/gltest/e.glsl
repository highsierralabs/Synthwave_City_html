// probe (d, second half): sample T0 with linear filtering at its centre.
#ifdef FS
void main() { O = texture(T0, vec2(0.5)); }
#else
void main() { gl_Position = screen(); }
#endif

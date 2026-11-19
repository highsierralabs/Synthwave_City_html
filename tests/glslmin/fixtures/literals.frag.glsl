// Fixture: literal values written straight to a float target, so a literal that changed value
// shows in the bits. Every float form the minifier rewrites, plus int, octal, hex and u forms.
const float FLOATS[24] = float[24](
  100000.0, 0.00001, 1.5e-5, 2.5E2, 3.14159265, 0.001, 123.456, 1e10, 1e-10, 0.0, 10.0, 1.0e+3,
  6.02214076e23, 0.1, 1.17549435e-38, 3.0e-7, 0.333333333, 16777217.0, 0.050, 1000.0, 100.0, 7.0e-3,
  65504.0, 2.0e-30);
const int INTS[6] = int[6](017, 0x1F, 255, -3, 0X7fffFFFF, 1 - -1);
const uint UINTS[4] = uint[4](0xFFFFFFFFu, 4294967295u, 0x9e3779b9u, 17u);

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int i = (p.x + p.y * 7) % 24;
  float f = FLOATS[i];
  int n = INTS[i % 6] + + 1;
  uint u = UINTS[i & 3] >> uint(i % 8);
  O = vec4(f, float(n), float(u), f * -1.0 - -0.5);
}

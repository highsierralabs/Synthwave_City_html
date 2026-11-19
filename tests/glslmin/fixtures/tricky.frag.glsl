// Fixture: the joins and forms a minifier gets wrong. Unary operators next to binary ones, "a---b",
// a function-like and an object-like macro whose body starts with "(", a macro whose body starts
// with "-", "return 0.5", switch and case, integer % and shifts, nested ternaries, and parameters
// named like preprocessor directives.
#define K (2.0)
#define MAD(a, b, c) ((a) * (b) + (c))
#define NEG -1.0

float half5() { return 0.5; }
float line2(float version, float error) { return version - -error; }

int bump(inout int x) { return x++ + ++x; }

void main() {
  vec2 p = gl_FragCoord.xy / uRes.xy;
  float a = p.x, b = p.y;
  float c = a - -b + +a - (-b) * K;
  int i = int(gl_FragCoord.x) & 15, j = 3;
  int k = i-- - --j;
  int q = i-- - j;
  int m = bump(j) + (i << 2) - (k >> 1) + (i % 5) + q;
  float sel;
  switch (m & 3) {
    case 0: sel = 0.25; break;
    case 1: sel = 0.5; break;
    default: sel = 1.0;
  }
  float t = a < 0.25 ? 1.0 : a < 0.5 ? 2.0 : b > 0.5 ? 3.0 : 4.0;
  float d = MAD(c, NEG, half5()) + line2(t, sel);
  O = vec4(d, float(m), float(k), 1.0);
}

// Fixture: facades. Exercises a struct (with a field named like a parameter, and two fields in one
// declaration), overloaded functions, in/inout/out parameters, a for loop with two counters,
// nested ternaries, the filtered line helper, the palette and fog.
flat in vec4 vSeed;
in vec3 vNormal;
in vec3 vLocal;
in vec3 vWorld;

struct Window {
  vec2 cell;
  float lit, seed;
  vec3 tint;
};

#define WIN_W 3.5
#define WIN_H 4.0
#define LIT_FRACTION 0.45

Window windowAt(vec2 p, float seed) {
  Window w;
  w.cell = floor(p / vec2(WIN_W, WIN_H));
  w.seed = seed;
  w.lit = step(1.0 - LIT_FRACTION, hash(w.cell + vec2(seed, 0.0)));
  w.tint = pal(hash(seed) * 8.0);
  return w;
}

float grid(float c, float size) { return line(c - size * floor(c / size + 0.5), 0.15); }
float grid(vec2 c, vec2 size) { return max(grid(c.x, size.x), grid(c.y, size.y)); }

void shade(in vec3 n, inout vec3 col, out float rim) {
  rim = pow(1.0 - clamp(abs(dot(n, uFwd.xyz)), 0.0, 1.0), 3.0);
  col *= 0.25 + 0.75 * max(dot(n, normalize(uSun.xyz)), 0.0);
}

void main() {
  vec2 facade = abs(vNormal.x) > 0.5 ? vLocal.zy : abs(vNormal.z) > 0.5 ? vLocal.xy : vLocal.xz;
  Window win = windowAt(facade, vSeed.x);
  float frame = grid(facade, vec2(WIN_W, WIN_H));
  vec3 col = mix(vec3(0.02, 0.015, 0.04), win.tint * 2.5, win.lit * (1.0 - frame));
  float glow = 0.0;
  for (int i = 0, j = 3; i < 4; i++, j--) {
    glow += hash(vec2(float(i), win.seed)) * float(j) * 0.25;
  }
  float rim;
  shade(vNormal, col, rim);
  col += pal(vSeed.y) * rim * (vSeed.w == 1.0 ? 4.0 : 1.5) + glow * 0.01;
  col = fog(col, vWorld);
  O = vec4(col, 1.0);
}

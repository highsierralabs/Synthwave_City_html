// Buildings (plans/T05-buildings.md): one instance per plan box, every box one cube from cube().
// The facade is built here in metres from the position on the face, so windows are the same size on
// every tower. Light bands (architecture.md 6.2): walls L0, windows L1, trim and signs L2, the blinking
// spire tips L3. Every periodic pattern fades to its average once a cell is under about two pixels.
#ifdef FS
flat in vec4 vA;  // centre x, base y, centre z, seed   (contracts.ts B_X .. B_SEED)
flat in vec4 vB;  // half-width x, height, half-width z, kind   (B_HX .. B_KIND)
flat in vec3 vN;  // face normal
flat in float vK; // 1, falling to 0 as the far fade sinks the building
in vec3 vPos;     // render space, for fog
in vec3 vL;       // metres from the centre of the box's base

// Coverage of lines of half-width w (in cells) on every integer of x. Filtered over the pixel
// footprint, and fading to its average 2w as a cell shrinks under about two pixels.
float grid(float x, float w) {
  float a = fwidth(x) + 1e-4;
  return mix(1.0 - smoothstep(w - a, w + a, abs(fract(x + 0.5) - 0.5)), 2.0 * w, smoothstep(0.2, 0.5, a));
}

void main() {
  // Identity of the building: every box of one building shares the seed.
  vec3 h = hash3(vA.w), g = hash3(vA.w + 4096.0);
  vec3 trim = pal(h.x * 6.0);
  vec3 cA = pal(h.x * 6.0 + 1.0 + floor(h.y * 4.0));
  vec3 cB = pal(g.x < 0.5 ? 3.0 : 1.0);
  float kind = vB.w, y = vA.y + vL.y, rel = vL.y / vB.y, side = 1.0 - abs(vN.y);
  float blink = step(0.6, fract(uTime.x * 0.7 + h.z));

  // Neon trim: the distance to the nearest edge of this face that is a roof line or a vertical
  // corner (r is the distance to each of the box's outer planes; the face's own plane is pushed away).
  // At least a pixel wide, so the skyline reads far away, and dimmed as it widens.
  vec3 r = vec3(vB.x - abs(vL.x), vB.y - vL.y, vB.z - abs(vL.z)) + abs(vN) * 1e4;
  float e = min(min(r.x, r.y), r.z), ew = max(0.3, 0.5 * fwidth(e));
  float edge = line(e, ew) * sqrt(0.3 / ew);

  // Window grid on the side faces: u runs along the face from one corner, in metres; w is half the
  // face's width; f numbers the face, so the four sides differ.
  float u = dot(vL.xz + vB.xz, abs(vN.zx)), w = dot(vB.xz, abs(vN.zx)), f = 64.0 * (vN.x + 2.0 * vN.z + 3.0) + 320.0 * vA.w;
  vec2 c = vec2(u / (2.0 + 2.0 * h.z), y / (3.2 + 0.6 * g.y));
  float win = (1.0 - grid(c.x, 0.1)) * (1.0 - grid(c.y, 0.08 + 0.2 * fract(h.y * 7.0)));
  float far = smoothstep(0.2, 0.5, max(fwidth(c.x), fwidth(c.y)));
  vec2 id = floor(c);
  // Windows are lit in runs of three; colour and brightness vary per window.
  float k = hash(vec2(floor(id.x / 3.0) + f, id.y)), j = hash(vec2(id.x + f, id.y));
  // One run in twenty switches now and then.
  k = mix(k, fract(k + floor(uTime.x * 0.1 + k * 50.0) * 0.618), step(fract(k * 97.0), 0.05));
  // Lit fraction: taller buildings are busier; floors come in lit and dark bands of five.
  float lit = clamp(0.3 + (vA.y + vB.y) / 800.0 + g.z * 0.3 + hash(vec2(vA.w, floor(id.y / 5.0))) * 0.5 - 0.25, 0.0, 0.9);
  float on = step(k, lit);
  vec3 wc = mix(cA, cB, step(0.5, j)) * (0.4 + 0.6 * fract(j * 7.0));
  // Equaliser facades, one building in ten: every column of windows is a level meter on the beat.
  if (g.y > 0.9) on = step(rel, hash(vec2(id.x + f, floor(uTime.z))) * (0.4 + 0.6 * uMix.x)), wc = mix(pal(5.0), pal(0.0), rel);
  // Dark panes keep a faint tint, so an unlit facade still shows its grid.
  vec3 col = mix(win * (on * wc + 0.03 * cB), 0.06 * lit * (cA + cB), far);

  // Neon floor lines every eight floors on a quarter of the buildings.
  col += trim * grid(c.y / 8.0, 0.015) * step(0.75, h.y) * 2.0;
  // Megatowers: bands of light every 32 m, neon pinstripes every 8 m and a band that climbs the tower.
  if (kind == 3.0) col += trim * (grid(y / 32.0, 0.05) + grid(u / 8.0, 0.03) + line(fract(uTime.x / 40.0 + h.z) * vB.y - vL.y, 1.5)) * 1.5;
  // Crowns: neon fins brightening towards the top.
  if (kind == 2.0) col = trim * grid(u / 2.0, 0.15) * (0.05 + rel * rel * rel * 1.5);
  // Spires: rings of light and a blinking red tip.
  if (kind == 4.0) col = trim * grid(y / 4.0, 0.12) * 2.0 + pal(6.0) * step(r.y, 2.5) * blink * 8.0;
  // A slatted lit band under every roof line on part of the buildings.
  col += trim * (1.0 - smoothstep(2.0, 2.6, r.y)) * (1.0 - grid(u / 0.8, 0.3)) * step(0.4, h.y);

  // Sign panels high on the main body of some buildings: moving chevrons in a neon frame.
  float q = max(abs(u - w) - 0.6 * w, abs(y - vA.y - vB.y * 0.75) - min(0.4 * w, 0.15 * vB.y));
  float s = step(0.6, h.z) * float(kind == 1.0);
  col = mix(col, cB * grid((abs(u - w) + y) / 3.0 - uTime.x * 0.5, 0.25) * 1.8, step(q, 0.0) * s)
      + trim * line(q, 0.4) * 2.0 * s;
  // Storefronts: the street floor of every podium is shop windows under a neon strip.
  s = float(kind == 0.0);
  col = mix(col, pal(hash(vec2(floor(u / 6.0) + f, 1.0)) * 8.0) * (1.0 - grid(u / 6.0, 0.05)) * (1.0 - grid(y / 3.0, 0.04)) * 0.45, step(y, 5.0) * s)
      + cA * line(y - 5.0, 0.25) * 2.0 * s;

  // Roofs: dim panels, a ring and a blinking red dot.
  float m = length(vL.xz);
  vec3 roof = trim * 0.2 * max(grid(vL.x / 4.0, 0.06), grid(vL.z / 4.0, 0.06))
            + cA * line(m - 0.55 * min(vB.x, vB.z), 0.35) * step(0.5, h.z) * 1.5 + pal(6.0) * line(m, 0.6) * blink * 6.0;

  col = mix(roof, col * side, side) + vec3(0.022, 0.012, 0.055) + trim * (0.012 + 2.5 * edge);
  // Sinking into the far fade, a building dims with its height, so no flat outline is left behind.
  O = vec4(fog(col * vK, vPos), 1.0);
}
#else
layout(location = 0) in vec4 aA;
layout(location = 1) in vec4 aB;
flat out vec4 vA;
flat out vec4 vB;
flat out vec3 vN;
flat out float vK;
out vec3 vPos;
out vec3 vL;
void main() {
  vec3 n;
  vL = cube(n) * aB.xyz;
  vN = n;
  vA = aA;
  vB = aB;
  vPos = place(aA.xyz, vL);
  vK = place(vec3(aA.x, 1.0, aA.z), vec3(0.0)).y;
  gl_Position = uVP * vec4(vPos, 1.0);
}
#endif

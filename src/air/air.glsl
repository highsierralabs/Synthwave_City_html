// Air traffic (plans/T07-air-traffic.md): one program for every craft, no vertex buffer at all.
// A craft is gl_InstanceID; everything about it comes from that number:
//   stream = id % 96: bit 0 axis (0 runs along x, 1 along z), bits 1..3 avenue (8 per axis),
//            (stream >> 4) % 3 level, stream / 48 direction;
//   k = id / 96, its place in the stream: sub-lane k & 1 and a golden-ratio phase, so any prefix
//            of instances (the density prefix) is spread evenly along every lane.
// Every craft of one sub-lane flies at the same integer speed (laps per loop = metres per second),
// and golden-ratio phases keep them at least ~100 m apart, so nothing ever overtakes or collides.
// x-lanes and z-lanes fly at heights 50 m apart, so crossing streams never meet, and the air over
// an avenue corridor is free of buildings at every height (architecture.md 5.4).
// One craft in a third of the streams is instead a large slow ship on the avenue's centre line,
// 310 m above its stream's level (400 to 650 m), with rows of lit windows. At most one per stream.
//
// Vertices 0..35 are the hull (cube(), drawn opaque); 36..53 are three quads drawn additively:
// the engine glow, the trail and the strobe. index.ts draws the two ranges separately.
#ifdef FS
flat in vec4 vCol;  // rgb colour; w: 0 hull, 1 light
flat in vec4 vN;    // hull: xyz unit-cube face normal; w: 1 for a ship
flat in vec2 vSize; // hull: half-length and height in metres
in vec3 vLoc;       // hull: unit-cube position; lights: x across, y across (sprites), z along (trail)
in vec3 vPos;       // render space
void main() {
  // Ship windows: 2 m cells along and up the flanks, faded to their average when they get small.
  vec2 m = vLoc.zy * vSize, fw = fwidth(m);
  float win = mix(step(0.6, fract(m.x * 0.5)) * step(0.5, fract(m.y * 0.5)), 0.2,
    clamp(max(fw.x, fw.y) - 0.5, 0.0, 1.0)) * vN.w;
  // Hull: a dark body, neon edges, a stripe along the flanks, an underglow, a lit tail face.
  // On a face one of |x|, |2y - 1|, |z| is 1; the middle one reaching 1 means an edge.
  vec3 e = abs(vLoc * vec3(1.0, 2.0, 1.0) - vec3(0.0, 1.0, 0.0));
  float edge = line(e.x + e.y + e.z - max(e.x, max(e.y, e.z)) - min(e.x, min(e.y, e.z)) - 1.0, 0.07);
  float stripe = line(vLoc.y - 0.6, 0.05) * (1.0 - abs(vN.y));
  vec3 hull = vec3(0.02, 0.012, 0.045) + vCol.rgb * (edge * 2.0 + stripe * 2.5 + step(vN.y, -0.5) * 1.6 + step(vN.z, -0.5) * 1.2)
    + pal(7.0) * win * abs(vN.x);
  // Lights: a soft round core (sprites) or a soft strip fading towards its end (trail).
  float g = max(1.0 - dot(vLoc.xy, vLoc.xy), 0.0) * (1.0 - vLoc.z);
  O = vec4(vCol.w < 0.5 ? fog(hull, vPos) : vCol.rgb * g * g * (1.0 - fogAmount(vPos)), 1.0);
}
#else
flat out vec4 vCol;
flat out vec4 vN;
flat out vec2 vSize;
out vec3 vLoc;
out vec3 vPos;
void main() {
  int id = gl_InstanceID, stream = id % 96, k = id / 96, part = gl_VertexID / 6;
  float axis = float(stream & 1), dir = float(stream / 48) * 2.0 - 1.0, sub = float(k & 1);
  vec3 r = hash3(float(id)), q = hash3(float(id + 65536));
  // One ship in a third of the streams, early in the stream so every density keeps it.
  float ship = float(k == 3 + stream % 8 && stream % 3 == 0);
  // Speed of the sub-lane: 30 to 90 m/s, an integer number of laps per loop (architecture.md 5.3);
  // ships 8 to 15 m/s.
  float laps = mix(floor(30.0 + 61.0 * hash(float(stream * 2 + k % 2 + 9000))), float(8 + (stream & 7)), ship);
  // Heading, and the side vector that makes (side, up, heading) a right-handed frame.
  vec3 h = axis > 0.5 ? vec3(0.0, 0.0, dir) : vec3(dir, 0.0, 0.0);
  vec3 side = vec3(h.z, 0.0, -h.x);
  float ave = float(stream >> 1 & 7) * AVE * CELL;
  // Keep right (right = -side): sub-lanes 5 and 10.5 m from the avenue's centre line.
  vec3 anchor = vec3(ave, 90.0 + 50.0 * axis + 100.0 * float(stream / 16 % 3) + 310.0 * ship + r.y * 6.0, ave)
    + h * fract(laps * uTime.y + fract(float(k) * 0.618034) + r.z * 0.006) * TILE
    - side * (5.0 + 5.5 * sub + r.x) * (1.0 - ship);
  // Bob a little; cosmetic, so uTime.x is fine.
  anchor.y += sin(uTime.x * (0.5 + r.x) + r.y * TAU);
  float len = mix(3.0 + 2.0 * q.x, 26.0 + 8.0 * q.x, ship), wid = len * mix(0.4, 0.3, ship), tall = len * 0.3;
  vCol = vec4(pal(hash(float(stream * 2 + k % 2 + 7000)) * 6.0), 1.0);
  vN.w = ship;
  vSize = vec2(len, tall);

  // One pixel in metres at this craft's distance; lights never get thinner than about two pixels,
  // and get dimmer as they widen, so far streams stay steady lines instead of crawling dots.
  vec3 a = place(anchor, vec3(0.0));
  float px = length(a - vec3(0.0, uCam.y, 0.0)) * 2.0 * uUp.w / uRes.y;
  vec3 tail = -h * len + vec3(0.0, tall * 0.5, 0.0), p;
  vec2 uv;
  vLoc = vec3(0.0);
  if (part < 6) {
    // Hull: a box, narrower and lower towards the nose.
    vec3 c = cube(vN.xyz);
    vLoc = c;
    c.xy *= 1.0 - 0.4 * max(c.z, 0.0);
    p = place(anchor, side * c.x * wid + h * c.z * len + vec3(0.0, c.y * tall, 0.0));
    vCol.w = 0.0;
  } else if (part == 7) {
    // Trail: from the tail back, 1.5 s of flight long (plus two hull lengths); L2 at its head.
    float w = max(wid * 0.35, 2.0 * px);
    p = ribbon(place(anchor, tail), place(anchor, tail - h * (laps * 0.5 + len * 2.0)), w, uv);
    vLoc = vec3(uv.x, 0.0, uv.y);
    vCol.rgb *= 3.5 * sqrt(wid * 0.35 / w);
  } else {
    // Engine glow (part 6) at the tail, L3; strobe (part 8) on the roof of a third of the craft,
    // red or white, a short flash every second or so.
    float strobe = float(part == 8), s = max(mix(wid * 0.9, 0.5, strobe), 2.5 * px);
    p = sprite(place(anchor, mix(tail, vec3(0.0, tall * 1.3, 0.0), strobe)), s, uv);
    vLoc.xy = uv;
    vCol.rgb = mix(mix(vCol.rgb, vec3(1.0), 0.4) * 6.0,
      pal(6.0 + step(0.5, r.y)) * 8.0 * step(0.94, fract(uTime.x * (0.8 + 0.4 * r.z) + r.x)) * step(q.z, 0.35),
      strobe) * min(mix(wid * 0.9, 0.5, strobe) / s, 1.0);
  }
  // place() flattens everything past the far fade; switch the light off over the same range, or
  // the outer craft would lie glowing on the ground.
  vCol.rgb *= 1.0 - smoothstep(uFade.x, uFade.y, length(a.xz));
  vPos = p;
  gl_Position = uVP * vec4(p, 1.0);
}
#endif

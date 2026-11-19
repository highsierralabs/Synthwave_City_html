// Street traffic: where car number c is. Shared by body.glsl and light.glsl (prepended to both in
// index.ts); vertex stage only.
//
// Car c sits in lane slot c % 384 at place (c / 384) * 39 mod 64 of 64 along it. Every car of a
// lane has the same integer speed in laps per loop and its own phase, so cars in a lane never run
// into each other. The stride of 39 (about 64 / golden ratio) spreads any prefix of slots evenly
// along the lane, so a drawn prefix (c < count * density) thins every lane evenly instead of
// leaving a contiguous stretch of it (architecture.md 11.1).
//
// Lane slot l: bit 0 the direction along the axis, bit 1 the axis (0: the road runs along z, at a
// fixed x), l >> 2 = r in 0..95. r < 48 is an avenue lane: 8 avenues x 3 lanes, twice over (the
// second set sits half a slot behind the first), so avenues carry twice the cars of a street lane.
// r >= 48 is a street lane: 24 streets x 2 lanes. Traffic keeps right (section 5.4).
#ifndef FS
const float CARS_PER_LANE = 64.0;

// Returns the car's anchor in tile coordinates on the road surface; fw is its heading in xz (a unit
// axis vector), seed a hash in 0..1 for its looks.
vec3 car(int c, out vec2 fw, out float seed) {
  int l = c % 384, r = l >> 2, n = r % 24;
  float s = float(l & 1) * 2.0 - 1.0;
  bool ave = r < 48;
  float ln = ave ? float(n & 7) * AVE : float(n + n / 3 + 1);
  float off = ave ? 3.5 * float(n / 8 + 1) : 2.0 + 3.0 * float(r / 24 - 2);
  float laps = ave ? 14.0 + floor(hash(float(l)) * 12.0) : 8.0 + floor(hash(float(l)) * 8.0);
  seed = hash(float(c + 7919));
  float slot = float(c / 384 * 39 & 63) + (ave && r >= 24 ? 0.5 : 0.0) + 0.3 * hash(float(c));
  float along = s * fract(laps * uTime.y + slot / CARS_PER_LANE) * TILE;
  fw = (l & 2) == 0 ? vec2(0.0, s) : vec2(s, 0.0);
  vec2 xz = ln * CELL * abs(fw.yx) + along * abs(fw) + vec2(-fw.y, fw.x) * off;
  return vec3(xz.x, 0.0, xz.y);
}

// Scale of a vehicle's frame from its seed: 6% buses (wider, taller, 2.4 times as long; the 0.3
// slot jitter above keeps 12 m between neighbours, so a bus never overlaps), 6% motorcycles (narrow,
// so their two lights merge into one), the rest cars of 4.5 x 1.8 x 1.35 m.
vec3 carSize(float seed) {
  return seed < 0.06 ? vec3(1.2, 1.9, 2.4) : seed > 0.94 ? vec3(0.3, 0.9, 0.5) : vec3(1.0);
}

// A point given in the car's frame (x right, y up, -z forward) as a render-space position.
vec3 carPoint(vec3 anchor, vec2 fw, vec3 l) {
  return place(anchor, vec3(-fw.y * l.x - fw.x * l.z, l.y, fw.x * l.x - fw.y * l.z));
}
#endif

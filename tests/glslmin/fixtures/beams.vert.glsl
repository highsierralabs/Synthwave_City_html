// Fixture: additive beams and sprites. Exercises gl_InstanceID hashing with hex, decimal-u and
// u-suffixed literals, a const array, an array constructor, ribbon(), sprite(), uint bit operations,
// a flat int varying and a branch on it.
layout(location = 0) in vec4 aAnchor;
layout(location = 1) in vec4 aSize;

out vec2 vUv;
flat out vec3 vColour;
flat out int vKind;

const float HEIGHTS[4] = float[4](40.0, 120.0, 260.0, 600.0);

uint mixBits(uint v) {
  v ^= v >> 13u;
  v *= 0x5bd1e995u;
  return v ^ (v >> 15u) ^ (uint(gl_InstanceID) & 0xFFu);
}

void main() {
  uint h = mixBits(uint(gl_InstanceID) * 2654435761u + 0x9e3779b9u);
  vKind = int(h % 3u);
  vec3 base = place(aAnchor.xyz, vec3(0.0));
  float height = HEIGHTS[int(h >> 8) & 3];
  vec3 palette[3] = vec3[3](pal(0.0), pal(1.0), pal(float(h & 7u)));
  vColour = palette[vKind];
  vec3 p;
  if (vKind == 2) {
    p = sprite(base + vec3(0.0, height, 0.0), aSize.x, vUv);
  } else {
    p = ribbon(base, base + vec3(0.0, height, 0.0), aSize.z * 0.5 + 1.0, vUv);
  }
  gl_Position = uVP * vec4(p, 1.0);
}

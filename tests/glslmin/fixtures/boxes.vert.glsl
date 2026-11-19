// Fixture: instanced boxes, like the towers. Exercises layout(location = n) attributes, flat
// varyings, gl_InstanceID, cube(), place(), a function-like macro and an out parameter.
layout(location = 0) in vec4 aAnchor;   // xyz: tile position; w: random 0..1
layout(location = 1) in vec4 aSize;     // xyz: half size in metres; w: integer seed

flat out vec4 vSeed;   // x: seed, y: palette index, z: height, w: kind
out vec3 vNormal;
out vec3 vLocal;
out vec3 vWorld;

#define SCALE(value, factor) ((value) * (factor))

void main() {
  vec3 normal;
  vec3 unit = cube(normal);
  vec3 local = SCALE(unit, vec3(aSize.x, aSize.y * 2.0, aSize.z));
  vec3 world = place(aAnchor.xyz, local);
  float seed = aSize.w + float(gl_InstanceID);
  vSeed = vec4(seed, floor(hash(seed) * 8.0), aSize.y, mod(seed, 3.0));
  vNormal = normal;
  vLocal = local;
  vWorld = world;
  gl_Position = uVP * vec4(world, 1.0);
}

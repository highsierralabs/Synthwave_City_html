// Fixture: the beam and sprite fragment side. A local named "a" next to renamed names.
in vec2 vUv;
flat in vec3 vColour;
flat in int vKind;

void main() {
  float core = vKind == 2 ? max(1.0 - length(vUv), 0.0) : 1.0 - abs(vUv.x);
  float a = core * core;
  O = vec4(vColour * a * (vKind == 2 ? 6.0 : 2.5), a);
}

// Fixture: a full-screen sky. Exercises ray(), noise(), fogColor(), mood(), hash3(), road(),
// samplers T0 and T2, a per-program uniform X0, and #if / #else on a macro.
uniform vec4 X0;

#define STRIPES 7
#if defined(STRIPES) && STRIPES > 4
#define STRIPE_GAP 0.035
#else
#define STRIPE_GAP 0.0
#endif

vec3 sun(vec3 dir) {
  float d = distance(dir, normalize(uSun.xyz));
  float disc = 1.0 - smoothstep(0.17, 0.18, d);
  float band = fract((dir.y - uSun.y) * float(STRIPES) / 0.18);
  return mix(vec3(4.0, 1.2, 0.3), vec3(3.0, 0.2, 1.4), clamp(dir.y * 3.0, 0.0, 1.0)) * disc
    * step(STRIPE_GAP * 10.0, band);
}

void main() {
  vec3 dir = ray();
  vec3 col = fogColor(dir) + sun(dir);
  float cloud = noise(dir.xz / max(dir.y, 0.05) * 3.0 + X0.xy);
  col += mood(vec3(0.3, 0.05, 0.2), vec3(0.02, 0.02, 0.1), vec3(0.2, 0.1, 0.3)) * cloud;
  vec3 stars = hash3(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) * 4096.0);
  col += stars.x > 0.995 ? vec3(stars.y * 2.0) : vec3(0.0);
  vec2 rx = road(dir.x * 1000.0 + uCam.x);
  col += texture(T0, gl_FragCoord.xy / uRes.xy).rgb * 0.1
    + texelFetch(T2, ivec2(gl_FragCoord.xy) & 63, 0).rgb * 0.05 * rx.y;
  O = vec4(col * uFade.w, 1.0);
}

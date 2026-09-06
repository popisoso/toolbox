#version 300 es
precision highp float;
// Default input when no camera/file is attached: a slowly moving field with a
// bright travelling blob, so time-based tools have visible motion to work on.
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;

#include "noise.glsl"

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * aspect;
  float n = fbm(vec3(p * 2.0, uTime * 0.35));
  float hue = fbm(vec3(p * 1.3 + 7.0, uTime * 0.05));
  vec3 base = mix(vec3(0.10, 0.12, 0.16), vec3(0.85, 0.82, 0.78), n);
  base = mix(base, vec3(0.55, 0.65, 0.80), smoothstep(0.55, 0.9, hue) * 0.5);
  vec2 blob = vec2(sin(uTime * 1.6) * 0.38, cos(uTime * 1.1) * 0.32);
  float d = length(p - blob);
  base += vec3(1.0, 0.95, 0.85) * smoothstep(0.16, 0.02, d);
  outColor = vec4(clamp(base, 0.0, 1.0), 1.0);
}

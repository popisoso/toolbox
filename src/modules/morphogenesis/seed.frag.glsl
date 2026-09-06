#version 300 es
precision highp float;
// Random spots of V on a blank U field.
in vec2 vUv;
out vec4 outColor;
uniform float uSeed;
uniform float uDensity;
uniform vec2 uSize;

#include "hash.glsl"

void main() {
  vec2 aspect = vec2(uSize.x / uSize.y, 1.0);
  vec2 cellUv = vUv * aspect * 9.0;
  vec2 cell = floor(cellUv);
  vec2 jitter = hash22(cell + uSeed) * 0.6 + 0.2;
  float r = 0.12 + 0.1 * hash12(cell * 3.3 + uSeed);
  float on = step(hash12(cell + uSeed * 1.7), uDensity);
  float d = length(cellUv - cell - jitter);
  float v = on * smoothstep(r, r * 0.6, d);
  outColor = vec4(1.0, v, 0.0, 1.0);
}

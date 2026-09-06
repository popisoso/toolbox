#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uSourceSize;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uEdge;
uniform float uTint;

#include "fit.glsl"

void main() {
  float v = texture(uState, vUv).g;
  float m = smoothstep(uEdge - 0.08, uEdge + 0.08, v);
  vec3 src = texture(uSource, coverUv(vUv, uResolution, uSourceSize)).rgb;
  vec3 a = mix(uColorA, src, uTint);
  outColor = vec4(mix(a, uColorB, m), 1.0);
}

#version 300 es
precision highp float;
precision highp sampler2DArray;
// Every pixel is sampled from a different moment: the ring buffer of past
// frames is indexed by position (slit-scan), radius, noise or the frame's own
// brightness. Time as a spatial material.
in vec2 vUv;
out vec4 outColor;

uniform sampler2DArray uFrames;
uniform int uHead;        // most recently written layer
uniform int uLayers;
uniform int uMode;        // 0 vertical, 1 horizontal, 2 radial, 3 noise, 4 luma
uniform float uDepth;     // 0..1 of the buffer length
uniform float uInvert;
uniform float uSmooth;
uniform float uTime;
uniform vec2 uResolution;

#include "noise.glsl"

vec3 frameAt(float back) {
  float n = float(uLayers);
  float layer = mod(float(uHead) - back + n * 4.0, n);
  if (uSmooth < 0.5) return texture(uFrames, vec3(vUv, floor(layer + 0.5))).rgb;
  float a = floor(layer), b = mod(a + 1.0, n);
  return mix(texture(uFrames, vec3(vUv, a)).rgb, texture(uFrames, vec3(vUv, b)).rgb, fract(layer));
}

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  float t;
  if (uMode == 0) t = vUv.x;
  else if (uMode == 1) t = vUv.y;
  else if (uMode == 2) t = clamp(length((vUv - 0.5) * aspect) / 0.75, 0.0, 1.0);
  else if (uMode == 3) t = fbm(vec3((vUv - 0.5) * aspect * 2.5, uTime * 0.1));
  else t = dot(texture(uFrames, vec3(vUv, float(uHead))).rgb, vec3(0.2126, 0.7152, 0.0722));
  t = mix(t, 1.0 - t, uInvert);
  float back = t * uDepth * float(uLayers - 1);
  outColor = vec4(frameAt(back), 1.0);
}

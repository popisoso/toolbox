#version 300 es
precision highp float;
// One feedback step: transform the previous frame, decay it, rotate its hue,
// then inject the source. The output becomes next frame's "previous".
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPrev;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uSourceSize;
uniform float uZoom;      // per-frame scale about the centre
uniform float uRotate;    // radians per frame
uniform vec2 uDrift;      // uv per frame
uniform float uDecay;     // 0..1 multiplier per frame
uniform float uHue;       // radians per frame
uniform float uInject;
uniform int uInjectMode;  // 0 add, 1 mix, 2 max, 3 difference
uniform float uThreshold; // source luma gate

#include "fit.glsl"

vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float cs = cos(a), sn = sin(a);
  return c * cs + cross(k, c) * sn + k * dot(k, c) * (1.0 - cs);
}

void main() {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * aspect;
  float cs = cos(-uRotate), sn = sin(-uRotate);
  p = mat2(cs, -sn, sn, cs) * p / uZoom;
  vec2 tuv = p / aspect + 0.5 - uDrift;
  float inside = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  vec3 prev = texture(uPrev, tuv).rgb * uDecay * inside;
  // 8-bit buffers round 0.5/255 back up to 1/255 forever; bias so decay reaches black.
  prev = max(prev - (1.0 - step(0.9995, uDecay)) * (0.6 / 255.0), 0.0);
  prev = hueRotate(prev, uHue);

  vec3 src = texture(uSource, coverUv(vUv, uResolution, uSourceSize)).rgb;
  float luma = dot(src, vec3(0.2126, 0.7152, 0.0722));
  src *= smoothstep(uThreshold - 0.05, uThreshold + 0.05, luma);

  vec3 col;
  if (uInjectMode == 0) col = prev + src * uInject;
  else if (uInjectMode == 1) col = mix(prev, src, uInject);
  else if (uInjectMode == 2) col = max(prev, src * uInject);
  else col = abs(prev - src * uInject);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}

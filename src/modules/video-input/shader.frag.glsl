#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform sampler2D uSource;
uniform vec2 uSourceSize;
uniform int uHasSource;
uniform float uMirror;
uniform float uExposure;   // stops
uniform float uContrast;
uniform float uSaturation;
uniform float uGrid;       // same 0→1 control as noise-grid, on live video
uniform float uDotSize;
uniform float uMaxCells;

#include "grid.glsl"

// "cover" fit: fill the viewport, crop the overflow.
vec2 coverUv(vec2 uv) {
  float viewAspect = uResolution.x / uResolution.y;
  float srcAspect = uSourceSize.x / max(1.0, uSourceSize.y);
  vec2 s = viewAspect > srcAspect ? vec2(1.0, srcAspect / viewAspect) : vec2(viewAspect / srcAspect, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float pitch = gridPitch(uGrid, uResolution, uMaxCells);
  GridSample g = gridResample(frag, pitch);

  vec2 uv = g.center / uResolution;
  uv.x = mix(uv.x, 1.0 - uv.x, uMirror);
  uv = coverUv(uv);

  vec3 c = uHasSource == 1 ? texture(uSource, uv).rgb : vec3(0.08);
  c *= exp2(uExposure);
  c = (c - 0.5) * uContrast + 0.5;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, uSaturation);
  c = clamp(c, 0.0, 1.0);

  float pointness = smoothstep(0.5, 1.0, uGrid);
  float radius = 0.5 * uDotSize * (0.2 + 0.8 * clamp(luma, 0.0, 1.0));
  float mask = gridDotMask(g, radius, pointness);
  outColor = vec4(c * mask, 1.0);
}

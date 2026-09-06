#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uGrid;        // THE control: 0 continuous field → 1 point grid
uniform float uScale;
uniform float uSpeed;
uniform float uContrast;
uniform float uDotSize;
uniform float uMaxCells;
uniform vec3 uColorA;
uniform vec3 uColorB;

// ── Source seam ─────────────────────────────────────────────────────────
// uSourceMode 0 samples procedural noise; 1 samples `uSource` (a video frame
// uploaded by a VideoSource). The video-input module exercises the same
// grid chunk with a live texture — this module ships in mode 0 only.
uniform int uSourceMode;
uniform sampler2D uSource;

#include "noise.glsl"
#include "grid.glsl"

float field(vec2 uv) {
  if (uSourceMode == 1) {
    vec3 c = texture(uSource, uv).rgb;
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect * uScale;
  return fbm(vec3(p, uTime * uSpeed));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float pitch = gridPitch(uGrid, uResolution, uMaxCells);
  GridSample g = gridResample(frag, pitch);

  float v = field(g.center / uResolution);
  v = clamp((v - 0.5) * uContrast + 0.5, 0.0, 1.0);

  // First half of the range coarsens the field into a mosaic (pitch grows);
  // second half discretises it: cells shrink into points sized by their value.
  float pointness = smoothstep(0.5, 1.0, uGrid);
  float radius = 0.5 * uDotSize * (0.2 + 0.8 * v);
  float mask = gridDotMask(g, radius, pointness);

  vec3 col = mix(uColorA, uColorB, v);
  col = mix(uColorA, col, mask);
  outColor = vec4(col, 1.0);
}

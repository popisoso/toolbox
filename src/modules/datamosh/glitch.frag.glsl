#version 300 es
precision highp float;
// Compression-artefact aesthetics on any source: block displacement, frozen
// blocks that keep last frame's pixels, scanline tearing, channel split,
// posterisation. Deterministic in (time, seed) so a paused frame is stable.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSource;
uniform sampler2D uPrev;     // last output, for frozen blocks
uniform vec2 uResolution;
uniform vec2 uSourceSize;
uniform float uTime;
uniform float uSeed;
uniform float uRate;         // glitch clock, Hz
uniform float uIntensity;    // master 0..1
uniform float uBlock;        // block size, px
uniform float uDisplace;
uniform float uFreeze;
uniform float uScan;
uniform float uSplit;
uniform float uPosterize;    // 0 = off, 1 = 3 levels

#include "hash.glsl"
#include "fit.glsl"

vec3 src(vec2 uv) { return texture(uSource, coverUv(clamp(uv, 0.0, 1.0), uResolution, uSourceSize)).rgb; }

void main() {
  float tick = floor(uTime * uRate) + uSeed * 97.0;
  vec2 uv = vUv;
  vec2 cell = floor(vUv * uResolution / uBlock);

  // block displacement: some blocks copy pixels from elsewhere
  float h = hash12(cell + tick);
  if (h < uDisplace * uIntensity * 0.6) {
    vec2 jump = (hash22(cell * 1.7 + tick) - 0.5) * uIntensity * 0.35;
    uv += jump;
  }
  // scanline tearing
  float row = floor(vUv.y * uResolution.y / 3.0);
  float r = hash12(vec2(row, tick * 0.5));
  if (r < uScan * uIntensity * 0.5) uv.x += (hash12(vec2(row, tick)) - 0.5) * 0.25 * uIntensity;

  // channel split
  vec2 off = vec2(uSplit * uIntensity * 0.03, 0.0);
  vec3 c = vec3(src(uv + off).r, src(uv).g, src(uv - off).b);

  // posterise
  if (uPosterize > 0.0) {
    float levels = mix(48.0, 3.0, uPosterize);
    c = floor(c * levels + 0.5) / levels;
  }

  // frozen blocks: hold the previous output (datamosh "stuck" macroblocks)
  float f = hash12(cell * 3.1 + floor(tick * 0.5) + 11.0);
  if (f < uFreeze * uIntensity * 0.5) c = texture(uPrev, vUv).rgb;

  outColor = vec4(c, 1.0);
}

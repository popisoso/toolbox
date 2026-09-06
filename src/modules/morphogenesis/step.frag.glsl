#version 300 es
precision highp float;
// Gray-Scott reaction-diffusion. State: r = U, g = V.
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform sampler2D uSource;
uniform vec2 uSize;        // simulation size in texels
uniform vec2 uSourceSize;
uniform float uFeed;
uniform float uKill;
uniform float uDiffusion;  // Dv / Du ratio, Du fixed at 1
uniform float uInfluence;  // how much source luma modulates feed
uniform vec2 uBrush;       // uv, y up
uniform float uBrushRadius;// uv units, 0 = off

#include "fit.glsl"

void main() {
  vec2 px = 1.0 / uSize;
  vec4 c = texture(uState, vUv);
  // 9-point Laplacian
  vec2 lap = -c.rg;
  lap += 0.2 * (texture(uState, vUv + vec2(px.x, 0.0)).rg + texture(uState, vUv - vec2(px.x, 0.0)).rg
              + texture(uState, vUv + vec2(0.0, px.y)).rg + texture(uState, vUv - vec2(0.0, px.y)).rg);
  lap += 0.05 * (texture(uState, vUv + px).rg + texture(uState, vUv - px).rg
               + texture(uState, vUv + vec2(px.x, -px.y)).rg + texture(uState, vUv + vec2(-px.x, px.y)).rg);

  float luma = dot(texture(uSource, coverUv(vUv, uSize, uSourceSize)).rgb, vec3(0.2126, 0.7152, 0.0722));
  float feed = uFeed + (luma - 0.5) * uInfluence * 0.04;

  float u = c.r, v = c.g;
  float uvv = u * v * v;
  float du = 1.0 * lap.x - uvv + feed * (1.0 - u);
  float dv = uDiffusion * lap.y + uvv - (uKill + feed) * v;
  u = clamp(u + du, 0.0, 1.0);
  v = clamp(v + dv, 0.0, 1.0);

  if (uBrushRadius > 0.0) {
    vec2 aspect = vec2(uSize.x / uSize.y, 1.0);
    float d = length((vUv - uBrush) * aspect);
    v = max(v, smoothstep(uBrushRadius, uBrushRadius * 0.4, d) * 0.9);
  }
  outColor = vec4(u, v, 0.0, 1.0);
}

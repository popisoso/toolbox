// Variable-resolution grid resampling shared by shader + video modules.
//
// A single control t ∈ [0,1] drives the transition:
//   t = 0   → pitch of 1 px: the field is sampled per pixel (continuous)
//   t = 0.5 → coarse mosaic: each cell holds one flat sample
//   t → 1   → discrete point grid: cells shrink to dots sized by their sample
struct GridSample {
  vec2 center;   // cell centre, pixels
  vec2 local;    // position inside cell, -0.5..0.5
  float pitch;   // cell size, pixels
};

float gridPitch(float t, vec2 resolution, float maxCells) {
  float maxPitch = min(resolution.x, resolution.y) / maxCells;
  // Quadratic ease keeps the fine end fine for longer; floor keeps cells
  // stable (no shimmer) while the control is animated.
  return max(1.0, floor(mix(1.0, maxPitch, t * t)));
}

GridSample gridResample(vec2 fragCoord, float pitch) {
  vec2 cell = floor(fragCoord / pitch);
  vec2 center = (cell + 0.5) * pitch;
  return GridSample(center, (fragCoord - center) / pitch, pitch);
}

// Mask that is 1 (solid cell) at pointness 0 and an anti-aliased disc of
// `radius` (in cell units, 0.5 = touching) at pointness 1.
float gridDotMask(GridSample g, float radius, float pointness) {
  float r = length(g.local);
  float aa = 0.75 / g.pitch;
  float disc = 1.0 - smoothstep(radius - aa, radius + aa, r);
  return mix(1.0, disc, pointness);
}

// "cover" fit: fill the viewport with the source, cropping the overflow.
vec2 coverUv(vec2 uv, vec2 resolution, vec2 sourceSize) {
  float viewAspect = resolution.x / resolution.y;
  float srcAspect = sourceSize.x / max(1.0, sourceSize.y);
  vec2 s = viewAspect > srcAspect ? vec2(1.0, srcAspect / viewAspect) : vec2(viewAspect / srcAspect, 1.0);
  return (uv - 0.5) * s + 0.5;
}

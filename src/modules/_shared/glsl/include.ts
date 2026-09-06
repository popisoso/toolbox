import noise from './noise.glsl?raw';
import grid from './grid.glsl?raw';

const CHUNKS: Record<string, string> = { 'noise.glsl': noise, 'grid.glsl': grid };

/** Resolve `#include "chunk.glsl"` lines against the shared chunk library. */
export function resolveIncludes(source: string): string {
  return source.replace(/^\s*#include\s+"([^"]+)"\s*$/gm, (_, name: string) => {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`Unknown GLSL include "${name}"`);
    return `// ── begin ${name}\n${chunk}\n// ── end ${name}`;
  });
}

/** WebGL2 context creation and drawing-buffer sizing. */

export interface GLContextOptions {
  /** Cap device-pixel-ratio to keep fill-rate sane on 3x phones. */
  maxDpr?: number;
  alpha?: boolean;
}

export function createGL(canvas: HTMLCanvasElement, opts: GLContextOptions = {}): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: opts.alpha ?? false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    // Off: we capture stills via RenderLoop.onceAfterFrame instead, which is
    // cheaper on mobile GPUs than preserving the buffer every frame.
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is not available on this device.');
  return gl;
}

/** Resize drawing buffer to match CSS size × DPR. Returns true if it changed. */
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 2): { width: number; height: number; dpr: number; changed: boolean } {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  const changed = canvas.width !== width || canvas.height !== height;
  if (changed) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr, changed };
}

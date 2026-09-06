/**
 * WebGPU seam.
 *
 * Decision: the rendering baseline is WebGL2 because it runs everywhere the
 * toolkit targets (iOS Safari included) with one code path. WebGPU is
 * exposed here as an *optional accelerator* for modules whose work is
 * genuinely compute-shaped (particle systems, optical flow, large
 * convolutions). Such a module declares `requires: ['webgpu']` or checks
 * `ctx.gpu.available` and falls back to WebGL2. Nothing in the shell depends
 * on WebGPU, so a device without it loses nothing but those accelerations.
 */
export interface GpuInfo {
  available: boolean;
  /** Lazily requests an adapter + device. Cached after first success. */
  device(): Promise<GPUDevice | null>;
}

let devicePromise: Promise<GPUDevice | null> | null = null;

export function createGpuInfo(): GpuInfo {
  const available = typeof navigator !== 'undefined' && 'gpu' in navigator;
  return {
    available,
    device() {
      if (!available) return Promise.resolve(null);
      if (!devicePromise) {
        devicePromise = (async () => {
          try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) return null;
            return await adapter.requestDevice();
          } catch {
            return null;
          }
        })();
      }
      return devicePromise;
    },
  };
}

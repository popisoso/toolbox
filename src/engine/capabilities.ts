/** Runtime feature detection. Modules declare what they `require`; the shell
 *  greys out tools the current device cannot run instead of crashing. */

export type Capability = 'webgl2' | 'webgpu' | 'camera' | 'mediarecorder' | 'ai';

export interface CapabilityReport {
  webgl2: boolean;
  webgpu: boolean;
  camera: boolean;
  mediarecorder: boolean;
  ai: boolean;
  standalone: boolean;
  touch: boolean;
}

let cached: CapabilityReport | null = null;

export function detectCapabilities(): CapabilityReport {
  if (cached) return cached;
  let webgl2 = false;
  try {
    const c = document.createElement('canvas');
    webgl2 = !!c.getContext('webgl2');
  } catch { /* no DOM */ }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  cached = {
    webgl2,
    webgpu: !!(nav && 'gpu' in nav),
    camera: !!nav?.mediaDevices?.getUserMedia,
    mediarecorder: typeof MediaRecorder !== 'undefined',
    ai: typeof fetch !== 'undefined',
    standalone:
      (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
      (nav as unknown as { standalone?: boolean } | undefined)?.standalone === true,
    touch: typeof window !== 'undefined' && ('ontouchstart' in window || (nav?.maxTouchPoints ?? 0) > 0),
  };
  return cached;
}

export function missingCapabilities(required: readonly Capability[]): Capability[] {
  const report = detectCapabilities();
  return required.filter((r) => !report[r]);
}

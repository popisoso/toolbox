/**
 * EXPORT SEAM
 * -----------
 * Two paths that work today in Safari and Chromium:
 *  - `snapshot()`  → PNG still of the canvas.
 *  - `startRecording()/stopRecording()` → video via canvas.captureStream +
 *    MediaRecorder (MP4/H.264 on Safari, WebM/VP9 on Chromium).
 * A frame-accurate offline renderer (WebCodecs, fixed time-step) plugs in
 * behind the same interface later; both consume `RenderLoop` + canvas.
 */
import type { RenderLoop } from '../loop';

export interface RecordingOptions {
  fps?: number;
  /** Bits per second for video. */
  bitrate?: number;
}

export interface Exporter {
  readonly recording: boolean;
  snapshot(): Promise<Blob>;
  startRecording(opts?: RecordingOptions): void;
  stopRecording(): Promise<Blob>;
  /** Preferred container the current browser can record. */
  recordingMimeType(): string | null;
}

// H.264 MP4 first (Safari; plays everywhere Apple), then WebM (Chromium).
// Plain 'video/mp4' last: Chromium answers it with VP9-in-MP4, which
// QuickTime cannot open, so WebM is the better Chromium default.
const CANDIDATE_TYPES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

export function createExporter(canvas: HTMLCanvasElement, loop: RenderLoop): Exporter {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stopped: Promise<Blob> | null = null;

  return {
    get recording() { return recorder !== null; },

    snapshot() {
      return new Promise<Blob>((resolve, reject) => {
        loop.onceAfterFrame(() => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
        });
      });
    },

    recordingMimeType() {
      if (typeof MediaRecorder === 'undefined') return null;
      return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
    },

    startRecording(opts = {}) {
      if (recorder) return;
      const mimeType = this.recordingMimeType();
      if (!mimeType) throw new Error('Video recording is not supported in this browser.');
      const stream = canvas.captureStream(opts.fps ?? 60);
      chunks = [];
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: opts.bitrate ?? 12_000_000 });
      const rec = recorder;
      stopped = new Promise<Blob>((resolve) => {
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });
      rec.start(250);
    },

    async stopRecording() {
      if (!recorder || !stopped) throw new Error('Not recording');
      const rec = recorder;
      recorder = null;
      rec.stop();
      const blob = await stopped;
      stopped = null;
      return blob;
    },
  };
}

/** Hand a blob to the user: share sheet on iOS where possible, else download. */
export async function deliverBlob(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch { /* user cancelled or unsupported; fall through */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function extensionFor(mimeType: string): string {
  if (mimeType.startsWith('video/mp4')) return 'mp4';
  if (mimeType.startsWith('video/webm')) return 'webm';
  if (mimeType === 'image/png') return 'png';
  return 'bin';
}

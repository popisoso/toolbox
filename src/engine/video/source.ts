/**
 * REAL-TIME VIDEO I/O SEAM
 * ------------------------
 * A `VideoSource` is anything that can hand the engine a fresh frame each
 * tick: the camera, a local file, later a screen capture, a network stream,
 * or another module's output. Modules consume the interface only, so the
 * same shader works on any of them (see `uSource` in noise-grid's shader).
 */
import { createTexture, uploadVideoFrame } from '../gl/texture';

export type VideoSourceKind = 'camera' | 'file';

export interface VideoSource {
  readonly kind: VideoSourceKind;
  readonly element: HTMLVideoElement;
  /** Native frame size once known (0×0 before). */
  readonly width: number;
  readonly height: number;
  readonly ready: boolean;
  /** Ensure `texture` holds the newest frame. Returns true if a frame was uploaded. */
  update(gl: WebGL2RenderingContext): boolean;
  /** The GL texture holding the latest frame (allocated on first `update`). */
  texture(gl: WebGL2RenderingContext): WebGLTexture;
  /** For cameras: swap front/back. No-op otherwise. */
  flip?(): Promise<void>;
  dispose(): void;
}

export interface CameraOptions {
  facing?: 'user' | 'environment';
  /** Ideal capture size; browsers pick the closest supported mode. */
  width?: number;
  height?: number;
}

export interface VideoSourceFactory {
  camera(opts?: CameraOptions): Promise<VideoSource>;
  file(file: File | Blob): Promise<VideoSource>;
}

class ElementSource implements VideoSource {
  readonly element: HTMLVideoElement;
  private tex: WebGLTexture | null = null;
  private lastTime = -1;
  private stream: MediaStream | null = null;
  private objectUrl: string | null = null;

  constructor(readonly kind: VideoSourceKind) {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.autoplay = true;
    v.loop = kind === 'file';
    this.element = v;
  }

  get width(): number { return this.element.videoWidth; }
  get height(): number { return this.element.videoHeight; }
  get ready(): boolean { return this.element.readyState >= 2 && this.element.videoWidth > 0; }

  async attachStream(stream: MediaStream): Promise<void> {
    this.stream = stream;
    this.element.srcObject = stream;
    await this.play();
  }

  async attachBlob(blob: Blob): Promise<void> {
    this.objectUrl = URL.createObjectURL(blob);
    this.element.src = this.objectUrl;
    await this.play();
  }

  private async play(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); reject(new Error('Video failed to load')); };
      const cleanup = () => {
        this.element.removeEventListener('loadedmetadata', onReady);
        this.element.removeEventListener('error', onErr);
      };
      if (this.element.readyState >= 1) return onReady();
      this.element.addEventListener('loadedmetadata', onReady);
      this.element.addEventListener('error', onErr);
    });
    try { await this.element.play(); } catch (e) { /* autoplay may need a gesture; caller retries */ }
  }

  texture(gl: WebGL2RenderingContext): WebGLTexture {
    if (!this.tex) {
      this.tex = createTexture(gl, true);
      // 1×1 placeholder so sampling before the first frame is defined.
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    return this.tex;
  }

  update(gl: WebGL2RenderingContext): boolean {
    if (!this.ready) return false;
    // Live streams keep currentTime moving; files may be paused — upload anyway when time changed.
    const t = this.element.currentTime;
    if (this.kind === 'file' && t === this.lastTime) return false;
    this.lastTime = t;
    return uploadVideoFrame(gl, this.texture(gl), this.element);
  }

  dispose(): void {
    this.element.pause();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.element.srcObject = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.element.removeAttribute('src');
    this.element.load();
  }

  /** GL texture must be freed by whoever owns the context. */
  glTexture(): WebGLTexture | null { return this.tex; }
}

class CameraSource extends ElementSource {
  private facing: 'user' | 'environment';
  constructor(private readonly opts: CameraOptions) {
    super('camera');
    this.facing = opts.facing ?? 'user';
  }
  async open(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: this.facing,
        width: { ideal: this.opts.width ?? 1280 },
        height: { ideal: this.opts.height ?? 720 },
      },
    });
    await this.attachStream(stream);
  }
  async flip(): Promise<void> {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    this.dispose();
    await this.open();
  }
}

export function createSourceFactory(gl: WebGL2RenderingContext): VideoSourceFactory & { disposeAll(): void } {
  const open = new Set<ElementSource>();
  const track = <T extends ElementSource>(s: T): T => {
    open.add(s);
    const orig = s.dispose.bind(s);
    s.dispose = () => {
      orig();
      const tex = s.glTexture();
      if (tex) gl.deleteTexture(tex);
      open.delete(s);
    };
    return s;
  };
  return {
    async camera(opts = {}) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available in this browser.');
      const s = new CameraSource(opts);
      await s.open();
      return track(s);
    },
    async file(file) {
      const s = new ElementSource('file');
      await s.attachBlob(file);
      return track(s);
    },
    disposeAll() {
      for (const s of [...open]) s.dispose();
    },
  };
}

import { allocTexture, createTexture } from './texture';

/**
 * Where a module draws. The screen target has `framebuffer === null`; the
 * compositor hands modules offscreen targets so their output becomes a
 * texture for the next stage. Modules call `target.bind(gl)` first thing in
 * `render` and otherwise never touch framebuffer state.
 */
export interface RenderTarget {
  readonly framebuffer: WebGLFramebuffer | null;
  readonly texture: WebGLTexture | null;
  readonly width: number;
  readonly height: number;
  bind(gl: WebGL2RenderingContext): void;
}

export class ScreenTarget implements RenderTarget {
  readonly framebuffer = null;
  readonly texture = null;
  constructor(public width: number, public height: number) {}
  bind(gl: WebGL2RenderingContext): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
  }
}

export interface OffscreenOptions {
  /** Request a half-float colour buffer (for simulations). Falls back to RGBA8
   *  when the device lacks EXT_color_buffer_float / half_float. */
  float?: boolean;
  /** NEAREST filtering (simulation state, pixel-exact copies). Default LINEAR. */
  nearest?: boolean;
}

/** True if the context can render into RGBA16F. Cached per context. */
const floatSupport = new WeakMap<WebGL2RenderingContext, boolean>();
export function supportsFloatTargets(gl: WebGL2RenderingContext): boolean {
  let s = floatSupport.get(gl);
  if (s === undefined) {
    s = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    floatSupport.set(gl, s);
  }
  return s;
}

export class OffscreenTarget implements RenderTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  /** Whether this target actually got a float buffer. */
  readonly isFloat: boolean;
  width = 0;
  height = 0;

  constructor(private readonly gl: WebGL2RenderingContext, width: number, height: number, opts: OffscreenOptions = {}) {
    const fb = gl.createFramebuffer();
    if (!fb) throw new Error('createFramebuffer failed');
    this.framebuffer = fb;
    this.isFloat = !!opts.float && supportsFloatTargets(gl);
    this.texture = createTexture(gl, !opts.nearest);
    this.resize(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const gl = this.gl;
    if (this.isFloat) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } else {
      allocTexture(gl, this.texture, width, height);
    }
  }

  bind(gl: WebGL2RenderingContext): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }

  clear(r = 0, g = 0, b = 0, a = 1): void {
    const gl = this.gl;
    this.bind(gl);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);
  }
}

/** Two offscreen targets you alternate between (simulations, feedback). */
export class PingPong {
  private a: OffscreenTarget;
  private b: OffscreenTarget;
  constructor(gl: WebGL2RenderingContext, width: number, height: number, opts: OffscreenOptions = {}) {
    this.a = new OffscreenTarget(gl, width, height, opts);
    this.b = new OffscreenTarget(gl, width, height, opts);
  }
  /** The target holding the current state (read from this). */
  get read(): OffscreenTarget { return this.a; }
  /** The target to draw the next state into. */
  get write(): OffscreenTarget { return this.b; }
  swap(): void { const t = this.a; this.a = this.b; this.b = t; }
  resize(width: number, height: number): void { this.a.resize(width, height); this.b.resize(width, height); }
  clear(): void { this.a.clear(); this.b.clear(); }
  dispose(): void { this.a.dispose(); this.b.dispose(); }
}

/**
 * A stack of `layers` same-sized frames in one TEXTURE_2D_ARRAY, each layer
 * individually renderable. Backs time buffers (slit-scan, echo, onion skin).
 */
export class TextureArrayTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  width = 0;
  height = 0;

  constructor(private readonly gl: WebGL2RenderingContext, width: number, height: number, readonly layers: number) {
    const fb = gl.createFramebuffer();
    const tex = gl.createTexture();
    if (!fb || !tex) throw new Error('TextureArrayTarget allocation failed');
    this.framebuffer = fb;
    this.texture = tex;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, width, height, this.layers, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }

  /** Bind one layer as the draw target. */
  bindLayer(gl: WebGL2RenderingContext, layer: number): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.texture, 0, layer);
    gl.viewport(0, 0, this.width, this.height);
  }

  /** Bind the whole array to a sampler2DArray unit. */
  bindSampler(gl: WebGL2RenderingContext, unit: number): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);
  }
}

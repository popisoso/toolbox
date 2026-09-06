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

export class OffscreenTarget implements RenderTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  width = 0;
  height = 0;

  constructor(private readonly gl: WebGL2RenderingContext, width: number, height: number) {
    const fb = gl.createFramebuffer();
    if (!fb) throw new Error('createFramebuffer failed');
    this.framebuffer = fb;
    this.texture = createTexture(gl, true);
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
    allocTexture(this.gl, this.texture, width, height);
  }

  bind(gl: WebGL2RenderingContext): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);
  }
}

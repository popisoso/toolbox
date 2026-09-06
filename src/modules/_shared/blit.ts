import { FULLSCREEN_VS, FullscreenQuad, Program, type RenderTarget } from '@engine/index';
import blitFrag from './glsl/blit.frag.glsl?raw';

/** Copies a texture into a target. Shared by every module that post-processes. */
export class Blit {
  private program: Program;
  constructor(private readonly gl: WebGL2RenderingContext, private readonly quad: FullscreenQuad) {
    this.program = new Program(gl, FULLSCREEN_VS, blitFrag);
  }
  draw(texture: WebGLTexture, target: RenderTarget): void {
    target.bind(this.gl);
    this.program.use();
    this.program.tex('uTex', 0, texture);
    this.quad.draw();
  }
  dispose(): void { this.program.dispose(); }
}

/**
 * SourceInput: one texture a module can always sample.
 *  - With no live source attached it renders the shared procedural field.
 *  - When the user starts the camera or opens a file (via the engine's
 *    source picker, mounted from the module's `ui()`), frames from that
 *    VideoSource take over. Modules never branch on where pixels came from.
 */
import {
  FULLSCREEN_VS, FullscreenQuad, OffscreenTarget, Program, mountSourcePicker,
  type Clock, type ModuleContext, type VideoSource,
} from '@engine/index';
import { resolveIncludes } from './glsl/include';
import proceduralFrag from './glsl/procedural.frag.glsl?raw';

export class SourceInput {
  private live: VideoSource | null = null;
  private procedural: OffscreenTarget;
  private program: Program;
  private lastTime = -1;

  constructor(private readonly ctx: ModuleContext, private readonly quad: FullscreenQuad, private readonly maxSize = 768) {
    const { gl } = ctx;
    this.program = new Program(gl, FULLSCREEN_VS, resolveIncludes(proceduralFrag));
    this.procedural = new OffscreenTarget(gl, 16, 16);
  }

  get kind(): 'procedural' | 'camera' | 'file' { return this.live?.kind ?? 'procedural'; }

  /** Mount the camera/file picker into a module's custom UI area. */
  ui(host: HTMLElement): () => void {
    return mountSourcePicker(host, {
      factory: this.ctx.sources,
      onSource: (s) => { this.live = s; },
      onError: (e) => this.ctx.log.warn(e.message),
    });
  }

  /** Refresh the texture for this frame. `width/height` = output size. */
  update(clock: Clock, width: number, height: number): void {
    const { gl } = this.ctx;
    if (this.live) {
      this.live.update(gl);
      return;
    }
    const scale = Math.min(1, this.maxSize / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const resized = w !== this.procedural.width || h !== this.procedural.height;
    this.procedural.resize(w, h);
    if (!resized && clock.time === this.lastTime) return; // paused clock → keep frame
    this.lastTime = clock.time;
    this.procedural.bind(gl);
    this.program.use();
    this.program.v2('uResolution', w, h);
    this.program.f('uTime', clock.time);
    this.quad.draw();
  }

  texture(): WebGLTexture {
    return this.live?.ready ? this.live.texture(this.ctx.gl) : this.procedural.texture;
  }

  /** Native pixel size of whatever is being sampled. */
  size(): [number, number] {
    if (this.live?.ready) return [this.live.width, this.live.height];
    return [this.procedural.width, this.procedural.height];
  }

  dispose(): void {
    this.program.dispose();
    this.procedural.dispose();
    // live sources belong to the host's factory and are disposed with it
  }
}

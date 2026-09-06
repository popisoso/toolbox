/**
 * VIDEO INPUT — second module; proves the real-time video I/O seam.
 *
 * Camera or file frames are uploaded to a texture by the engine's
 * VideoSource and pushed through the same grid-resample chunk the shader
 * module uses, with basic grading on top. The shell never learns anything
 * about cameras: the module mounts the engine's source picker in `ui()`.
 */
import {
  defineModule, FullscreenQuad, FULLSCREEN_VS, Program, mountSourcePicker,
  type Clock, type ModuleContext, type ModuleInstance, type RenderTarget, type VideoSource,
} from '@engine/index';
import { resolveIncludes } from '../_shared/glsl/include';
import fragSource from './shader.frag.glsl?raw';

export default defineModule({
  id: 'video-input',
  name: 'Video Input',
  description: 'Live camera or video file with grading and the grid resampler.',
  category: 'video',
  version: '1.0.0',
  requires: ['webgl2'],
  outputs: [{ key: 'out', label: 'Output', type: 'texture' }],
  params: [
    { kind: 'toggle', key: 'mirror', label: 'Mirror', default: true, group: 'Source' },
    { kind: 'range', key: 'exposure', label: 'Exposure', min: -3, max: 3, step: 0.01, default: 0, unit: 'EV', group: 'Grade' },
    { kind: 'range', key: 'contrast', label: 'Contrast', min: 0.5, max: 2, step: 0.01, default: 1, group: 'Grade' },
    { kind: 'range', key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01, default: 1, group: 'Grade' },
    { kind: 'range', key: 'grid', label: 'Grid', min: 0, max: 1, step: 0.001, default: 0, group: 'Grid',
      description: '0 = full-resolution video, 1 = coarse point grid' },
    { kind: 'range', key: 'maxCells', label: 'Coarsest cells', min: 4, max: 96, step: 1, default: 24, group: 'Grid' },
    { kind: 'range', key: 'dotSize', label: 'Dot size', min: 0.2, max: 1, step: 0.01, default: 0.9, group: 'Grid' },
  ],
  create: (ctx) => new VideoInput(ctx),
});

class VideoInput implements ModuleInstance {
  private program!: Program;
  private quad!: FullscreenQuad;
  private source: VideoSource | null = null;

  constructor(private readonly ctx: ModuleContext) {}

  init(): void {
    const { gl } = this.ctx;
    this.program = new Program(gl, FULLSCREEN_VS, resolveIncludes(fragSource));
    this.quad = new FullscreenQuad(gl);
  }

  ui(host: HTMLElement): () => void {
    return mountSourcePicker(host, {
      factory: this.ctx.sources,
      onSource: (s) => { this.source = s; },
      onError: (e) => this.ctx.log.warn(e.message),
    });
  }

  render(clock: Clock, target: RenderTarget): void {
    const { gl, params: p } = this.ctx;
    void clock;
    const src = this.source;
    if (src) src.update(gl);
    target.bind(gl);
    this.program.use();
    this.program.v2('uResolution', target.width, target.height);
    this.program.i('uHasSource', src?.ready ? 1 : 0);
    this.program.v2('uSourceSize', src?.width || 1, src?.height || 1);
    this.program.tex('uSource', 0, src ? src.texture(gl) : null);
    this.program.f('uMirror', p.bool('mirror') ? 1 : 0);
    this.program.f('uExposure', p.number('exposure'));
    this.program.f('uContrast', p.number('contrast'));
    this.program.f('uSaturation', p.number('saturation'));
    this.program.f('uGrid', p.number('grid'));
    this.program.f('uDotSize', p.number('dotSize'));
    this.program.f('uMaxCells', p.number('maxCells'));
    this.quad.draw();
  }

  dispose(): void {
    // Sources are owned by the host's factory and disposed with it.
    this.program?.dispose();
    this.quad?.dispose();
  }
}

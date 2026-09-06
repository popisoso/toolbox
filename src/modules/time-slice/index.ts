/**
 * TIME SLICE — slit-scan / temporal displacement over a ring buffer of the
 * last N frames. Position, radius, noise or brightness decide how far back
 * in time each pixel looks.
 */
import {
  defineModule, FullscreenQuad, FULLSCREEN_VS, Program, TextureArrayTarget,
  type Clock, type ModuleContext, type ModuleInstance, type RenderTarget,
} from '@engine/index';
import { resolveIncludes } from '../_shared/glsl/include';
import { Blit } from '../_shared/blit';
import { SourceInput } from '../_shared/source-input';
import frag from './slice.frag.glsl?raw';

const MODES = ['vertical', 'horizontal', 'radial', 'noise', 'luma'];
/** Frames kept. 48 layers at ≤540px long edge ≈ 40 MB of GPU memory. */
const LAYERS = 48;
const BUFFER_MAX = 540;

export default defineModule({
  id: 'time-slice',
  name: 'Time Slice',
  description: 'Slit-scan and temporal displacement: each pixel is drawn from a different moment of the last two seconds.',
  category: 'video',
  version: '1.0.0',
  requires: ['webgl2'],
  outputs: [{ key: 'out', label: 'Output', type: 'texture' }],
  params: [
    { kind: 'select', key: 'mode', label: 'Map', options: MODES.map((m) => ({ value: m, label: m })), default: 'vertical', group: 'Time' },
    { kind: 'range', key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.001, default: 1, group: 'Time',
      description: '0 = live frame everywhere, 1 = full buffer span' },
    { kind: 'toggle', key: 'invert', label: 'Invert map', default: false, group: 'Time' },
    { kind: 'toggle', key: 'smooth', label: 'Blend between frames', default: true, group: 'Time' },
  ],
  create: (ctx) => new TimeSlice(ctx),
});

class TimeSlice implements ModuleInstance {
  private quad!: FullscreenQuad;
  private program!: Program;
  private blit!: Blit;
  private frames!: TextureArrayTarget;
  private source!: SourceInput;
  private head = 0;
  private filled = 0;

  constructor(private readonly ctx: ModuleContext) {}

  init(): void {
    const { gl } = this.ctx;
    this.quad = new FullscreenQuad(gl);
    this.program = new Program(gl, FULLSCREEN_VS, resolveIncludes(frag));
    this.blit = new Blit(gl, this.quad);
    this.frames = new TextureArrayTarget(gl, 16, 16, LAYERS);
    this.source = new SourceInput(this.ctx, this.quad, BUFFER_MAX);
  }

  ui(host: HTMLElement): () => void { return this.source.ui(host); }

  render(clock: Clock, target: RenderTarget): void {
    const { gl, params: p } = this.ctx;
    const scale = Math.min(1, BUFFER_MAX / Math.max(target.width, target.height));
    const bw = Math.max(8, Math.round(target.width * scale)), bh = Math.max(8, Math.round(target.height * scale));
    if (bw !== this.frames.width || bh !== this.frames.height) { this.frames.resize(bw, bh); this.filled = 0; }
    this.source.update(clock, bw, bh);

    // Push the current source frame into the ring. This runs while paused too:
    // a static source then converges to identical layers and a stable output.
    this.head = (this.head + 1) % LAYERS;
    this.filled = Math.min(LAYERS, this.filled + 1);
    const layerTarget = {
      framebuffer: this.frames.framebuffer, texture: null, width: bw, height: bh,
      bind: (g: WebGL2RenderingContext) => this.frames.bindLayer(g, this.head),
    };
    this.blit.draw(this.source.texture(), layerTarget);
    // Until the ring is full, mirror the newest frame into the not-yet-written layers.
    if (this.filled < LAYERS) {
      for (let i = this.filled; i < LAYERS; i++) {
        const l = (this.head - i + LAYERS * 2) % LAYERS;
        this.blit.draw(this.source.texture(), { ...layerTarget, bind: (g) => this.frames.bindLayer(g, l) });
      }
    }

    target.bind(gl);
    this.program.use();
    this.frames.bindSampler(gl, 0);
    this.program.i('uFrames', 0);
    this.program.i('uHead', this.head);
    this.program.i('uLayers', LAYERS);
    this.program.i('uMode', Math.max(0, MODES.indexOf(p.string('mode'))));
    this.program.f('uDepth', p.number('depth'));
    this.program.f('uInvert', p.bool('invert') ? 1 : 0);
    this.program.f('uSmooth', p.bool('smooth') ? 1 : 0);
    this.program.f('uTime', clock.time);
    this.program.v2('uResolution', target.width, target.height);
    this.quad.draw();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }

  dispose(): void {
    this.source?.dispose();
    this.frames?.dispose();
    this.blit?.dispose();
    this.program?.dispose();
    this.quad?.dispose();
  }
}

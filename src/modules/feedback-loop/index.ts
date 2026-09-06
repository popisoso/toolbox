/**
 * FEEDBACK LOOP — an autopoietic image: each frame is made from the last one,
 * transformed and decayed, with the source injected. The machine watching
 * its own output; camera in the loop turns it into a mirror that drifts.
 */
import {
  defineModule, FullscreenQuad, FULLSCREEN_VS, PingPong, Program,
  type Clock, type ModuleContext, type ModuleInstance, type RenderTarget,
} from '@engine/index';
import { resolveIncludes } from '../_shared/glsl/include';
import { Blit } from '../_shared/blit';
import { SourceInput } from '../_shared/source-input';
import frag from './feedback.frag.glsl?raw';

const MODES = ['add', 'mix', 'max', 'difference'];

export default defineModule({
  id: 'feedback-loop',
  name: 'Feedback Loop',
  description: 'Recursive video feedback: zoom, rotate, decay and hue-drift the previous frame while injecting the source.',
  category: 'shader',
  version: '1.0.0',
  requires: ['webgl2'],
  outputs: [{ key: 'out', label: 'Output', type: 'texture' }],
  params: [
    { kind: 'range', key: 'zoom', label: 'Zoom / frame', min: 0.9, max: 1.1, step: 0.001, default: 1.012, group: 'Transform' },
    { kind: 'range', key: 'rotate', label: 'Rotate / frame', min: -4, max: 4, step: 0.01, default: 0.35, unit: '°', group: 'Transform' },
    { kind: 'range', key: 'driftX', label: 'Drift X', min: -0.01, max: 0.01, step: 0.0001, default: 0, group: 'Transform' },
    { kind: 'range', key: 'driftY', label: 'Drift Y', min: -0.01, max: 0.01, step: 0.0001, default: 0.0006, group: 'Transform' },
    { kind: 'range', key: 'decay', label: 'Decay', min: 0.8, max: 1, step: 0.001, default: 0.985, group: 'Memory' },
    { kind: 'range', key: 'hue', label: 'Hue drift / frame', min: -6, max: 6, step: 0.01, default: 0.8, unit: '°', group: 'Memory' },
    { kind: 'select', key: 'mode', label: 'Inject mode', options: MODES.map((m) => ({ value: m, label: m })), default: 'mix', group: 'Source' },
    { kind: 'range', key: 'inject', label: 'Inject', min: 0, max: 1, step: 0.001, default: 0.1, group: 'Source' },
    { kind: 'range', key: 'threshold', label: 'Luma gate', min: 0, max: 1, step: 0.01, default: 0, group: 'Source',
      description: 'Only source pixels brighter than this enter the loop' },
    { kind: 'action', key: 'clear', label: 'Clear', group: 'Memory' },
  ],
  create: (ctx) => new FeedbackLoop(ctx),
});

class FeedbackLoop implements ModuleInstance {
  private quad!: FullscreenQuad;
  private program!: Program;
  private blit!: Blit;
  private buffers!: PingPong;
  private source!: SourceInput;
  private clearRequested = true;

  constructor(private readonly ctx: ModuleContext) {}

  init(): void {
    const { gl } = this.ctx;
    this.quad = new FullscreenQuad(gl);
    this.program = new Program(gl, FULLSCREEN_VS, resolveIncludes(frag));
    this.blit = new Blit(gl, this.quad);
    this.buffers = new PingPong(gl, 16, 16);
    this.source = new SourceInput(this.ctx, this.quad);
  }

  ui(host: HTMLElement): () => void { return this.source.ui(host); }

  onAction(key: string): void {
    if (key === 'clear') this.clearRequested = true;
  }

  render(clock: Clock, target: RenderTarget): void {
    const { gl, params: p } = this.ctx;
    const w = target.width, h = target.height;
    const resized = w !== this.buffers.read.width || h !== this.buffers.read.height;
    this.buffers.resize(w, h);
    if (resized || this.clearRequested) { this.buffers.clear(); this.clearRequested = false; }
    this.source.update(clock, w, h);

    // A paused clock (dt = 0) holds the loop so exports are frame-stable.
    if (clock.dt > 0) {
      this.buffers.write.bind(gl);
      this.program.use();
      this.program.tex('uPrev', 0, this.buffers.read.texture);
      this.program.tex('uSource', 1, this.source.texture());
      this.program.v2('uResolution', w, h);
      const [sw, sh] = this.source.size();
      this.program.v2('uSourceSize', sw, sh);
      this.program.f('uZoom', p.number('zoom'));
      this.program.f('uRotate', (p.number('rotate') * Math.PI) / 180);
      this.program.v2('uDrift', p.number('driftX'), p.number('driftY'));
      this.program.f('uDecay', p.number('decay'));
      this.program.f('uHue', (p.number('hue') * Math.PI) / 180);
      this.program.f('uInject', p.number('inject'));
      this.program.i('uInjectMode', Math.max(0, MODES.indexOf(p.string('mode'))));
      this.program.f('uThreshold', p.number('threshold'));
      this.quad.draw();
      this.buffers.swap();
    }
    this.blit.draw(this.buffers.read.texture, target);
  }

  dispose(): void {
    this.source?.dispose();
    this.buffers?.dispose();
    this.blit?.dispose();
    this.program?.dispose();
    this.quad?.dispose();
  }
}

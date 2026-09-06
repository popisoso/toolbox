/**
 * DATAMOSH — machine artefacts as material. Runs on the procedural field,
 * the camera or a file; frozen blocks read from this module's own previous
 * output so errors accumulate like a corrupted stream.
 */
import {
  defineModule, FullscreenQuad, FULLSCREEN_VS, PingPong, Program,
  type Clock, type ModuleContext, type ModuleInstance, type RenderTarget,
} from '@engine/index';
import { resolveIncludes } from '../_shared/glsl/include';
import { Blit } from '../_shared/blit';
import { SourceInput } from '../_shared/source-input';
import frag from './glitch.frag.glsl?raw';

export default defineModule({
  id: 'datamosh',
  name: 'Datamosh',
  description: 'Block displacement, stuck macroblocks, tearing, channel split and posterisation on live or generated video.',
  category: 'post',
  version: '1.0.0',
  requires: ['webgl2'],
  outputs: [{ key: 'out', label: 'Output', type: 'texture' }],
  params: [
    { kind: 'range', key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.001, default: 0.6, group: 'Corruption',
      description: '0 passes the source through untouched' },
    { kind: 'range', key: 'rate', label: 'Rate', min: 0.5, max: 30, step: 0.1, default: 8, unit: 'Hz', group: 'Corruption' },
    { kind: 'range', key: 'seed', label: 'Seed', min: 0, max: 100, step: 1, default: 1, group: 'Corruption' },
    { kind: 'range', key: 'block', label: 'Block size', min: 4, max: 128, step: 1, default: 24, unit: 'px', group: 'Blocks' },
    { kind: 'range', key: 'displace', label: 'Displace', min: 0, max: 1, step: 0.01, default: 0.7, group: 'Blocks' },
    { kind: 'range', key: 'freeze', label: 'Freeze', min: 0, max: 1, step: 0.01, default: 0.6, group: 'Blocks' },
    { kind: 'range', key: 'scan', label: 'Tearing', min: 0, max: 1, step: 0.01, default: 0.5, group: 'Signal' },
    { kind: 'range', key: 'split', label: 'Channel split', min: 0, max: 1, step: 0.01, default: 0.5, group: 'Signal' },
    { kind: 'range', key: 'posterize', label: 'Posterise', min: 0, max: 1, step: 0.01, default: 0, group: 'Signal' },
  ],
  create: (ctx) => new Datamosh(ctx),
});

class Datamosh implements ModuleInstance {
  private quad!: FullscreenQuad;
  private program!: Program;
  private blit!: Blit;
  private out!: PingPong;
  private source!: SourceInput;

  constructor(private readonly ctx: ModuleContext) {}

  init(): void {
    const { gl } = this.ctx;
    this.quad = new FullscreenQuad(gl);
    this.program = new Program(gl, FULLSCREEN_VS, resolveIncludes(frag));
    this.blit = new Blit(gl, this.quad);
    this.out = new PingPong(gl, 16, 16);
    this.source = new SourceInput(this.ctx, this.quad);
  }

  ui(host: HTMLElement): () => void { return this.source.ui(host); }

  render(clock: Clock, target: RenderTarget): void {
    const { gl, params: p } = this.ctx;
    const w = target.width, h = target.height;
    if (w !== this.out.read.width || h !== this.out.read.height) { this.out.resize(w, h); this.out.clear(); }
    this.source.update(clock, w, h);
    const [sw, sh] = this.source.size();

    this.out.write.bind(gl);
    this.program.use();
    this.program.tex('uSource', 0, this.source.texture());
    this.program.tex('uPrev', 1, this.out.read.texture);
    this.program.v2('uResolution', w, h);
    this.program.v2('uSourceSize', sw, sh);
    this.program.f('uTime', clock.time);
    this.program.f('uSeed', p.number('seed'));
    this.program.f('uRate', p.number('rate'));
    this.program.f('uIntensity', p.number('intensity'));
    this.program.f('uBlock', p.number('block') * this.ctx.viewport.dpr);
    this.program.f('uDisplace', p.number('displace'));
    // While paused, frozen blocks would re-freeze on themselves every frame;
    // hold the frame instead so exports are stable.
    this.program.f('uFreeze', clock.dt > 0 ? p.number('freeze') : 0);
    this.program.f('uScan', p.number('scan'));
    this.program.f('uSplit', p.number('split'));
    this.program.f('uPosterize', p.number('posterize'));
    this.quad.draw();
    this.blit.draw(this.out.write.texture, target);
    if (clock.dt > 0) this.out.swap();
  }

  dispose(): void {
    this.source?.dispose();
    this.out?.dispose();
    this.blit?.dispose();
    this.program?.dispose();
    this.quad?.dispose();
  }
}

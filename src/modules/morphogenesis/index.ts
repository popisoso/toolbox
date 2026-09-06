/**
 * MORPHOGENESIS — Gray-Scott reaction-diffusion. Pattern grows by its own
 * chemistry; the camera/file can bias the feed rate so an image "infects"
 * the field, and the pointer paints catalyst. Non-human form-making.
 */
import {
  defineModule, FullscreenQuad, FULLSCREEN_VS, PingPong, Program, hexToRgb, supportsFloatTargets,
  type Clock, type ModuleContext, type ModuleInstance, type ParamValue, type RenderTarget,
} from '@engine/index';
import { resolveIncludes } from '../_shared/glsl/include';
import { SourceInput } from '../_shared/source-input';
import stepFrag from './step.frag.glsl?raw';
import seedFrag from './seed.frag.glsl?raw';
import displayFrag from './display.frag.glsl?raw';

const PRESETS: Record<string, { feed: number; kill: number }> = {
  spots: { feed: 0.035, kill: 0.065 },
  mitosis: { feed: 0.0367, kill: 0.0649 },
  worms: { feed: 0.058, kill: 0.065 },
  coral: { feed: 0.0545, kill: 0.062 },
  maze: { feed: 0.029, kill: 0.057 },
};

export default defineModule({
  id: 'morphogenesis',
  name: 'Morphogenesis',
  description: 'Reaction-diffusion chemistry that grows spots, worms and coral; paint with the pointer, seed from video.',
  category: 'shader',
  version: '1.0.0',
  requires: ['webgl2'],
  outputs: [{ key: 'out', label: 'Output', type: 'texture' }],
  params: [
    { kind: 'select', key: 'preset', label: 'Preset', default: 'coral', group: 'Chemistry',
      options: [...Object.keys(PRESETS), 'custom'].map((k) => ({ value: k, label: k })) },
    { kind: 'range', key: 'feed', label: 'Feed', min: 0.01, max: 0.09, step: 0.0001, default: 0.0545, group: 'Chemistry' },
    { kind: 'range', key: 'kill', label: 'Kill', min: 0.04, max: 0.075, step: 0.0001, default: 0.062, group: 'Chemistry' },
    { kind: 'range', key: 'diffusion', label: 'Diffusion ratio', min: 0.3, max: 0.7, step: 0.001, default: 0.5, group: 'Chemistry' },
    { kind: 'range', key: 'steps', label: 'Steps / frame', min: 1, max: 24, step: 1, default: 10, group: 'Chemistry' },
    { kind: 'range', key: 'influence', label: 'Source influence', min: 0, max: 1, step: 0.01, default: 0.35, group: 'Source',
      description: 'Bright source pixels feed the reaction, dark starve it' },
    { kind: 'range', key: 'tint', label: 'Source tint', min: 0, max: 1, step: 0.01, default: 0, group: 'Look' },
    { kind: 'range', key: 'brush', label: 'Brush size', min: 0.01, max: 0.2, step: 0.001, default: 0.05, group: 'Brush' },
    { kind: 'range', key: 'edge', label: 'Edge', min: 0.05, max: 0.5, step: 0.001, default: 0.22, group: 'Look' },
    { kind: 'color', key: 'colorA', label: 'Field', default: '#0e0e10', group: 'Look' },
    { kind: 'color', key: 'colorB', label: 'Growth', default: '#e8e4dc', group: 'Look' },
    { kind: 'action', key: 'reseed', label: 'Reseed', group: 'Chemistry' },
    { kind: 'action', key: 'clear', label: 'Clear', group: 'Chemistry' },
  ],
  create: (ctx) => new Morphogenesis(ctx),
});

/** Simulation texels across the long edge; keeps 10 steps/frame fluid on phones. */
const SIM_MAX = 512;

class Morphogenesis implements ModuleInstance {
  private quad!: FullscreenQuad;
  private step!: Program;
  private seed!: Program;
  private display!: Program;
  private state!: PingPong;
  private source!: SourceInput;
  private pending: 'seed' | 'clear' | null = 'seed';
  private seedCounter = 0;
  private applyingPreset = false;

  constructor(private readonly ctx: ModuleContext) {}

  init(): void {
    const { gl, log } = this.ctx;
    this.quad = new FullscreenQuad(gl);
    this.step = new Program(gl, FULLSCREEN_VS, resolveIncludes(stepFrag));
    this.seed = new Program(gl, FULLSCREEN_VS, resolveIncludes(seedFrag));
    this.display = new Program(gl, FULLSCREEN_VS, resolveIncludes(displayFrag));
    this.state = new PingPong(gl, 16, 16, { float: true });
    if (!supportsFloatTargets(gl)) log.warn('[morphogenesis] no float render targets; running in 8-bit (coarser patterns)');
    this.source = new SourceInput(this.ctx, this.quad, 512);
  }

  ui(host: HTMLElement): () => void { return this.source.ui(host); }

  onAction(key: string): void {
    if (key === 'reseed') { this.seedCounter++; this.pending = 'seed'; }
    if (key === 'clear') this.pending = 'clear';
  }

  onParam(key: string, value: ParamValue): void {
    const p = this.ctx.params;
    if (key === 'preset' && value !== 'custom') {
      const preset = PRESETS[String(value)];
      if (!preset) return;
      this.applyingPreset = true;
      p.set('feed', preset.feed);
      p.set('kill', preset.kill);
      this.applyingPreset = false;
    } else if ((key === 'feed' || key === 'kill') && !this.applyingPreset && p.string('preset') !== 'custom') {
      p.set('preset', 'custom');
    }
  }

  private simSize(target: RenderTarget): [number, number] {
    const scale = Math.min(1, SIM_MAX / Math.max(target.width, target.height));
    return [Math.max(8, Math.round(target.width * scale)), Math.max(8, Math.round(target.height * scale))];
  }

  render(clock: Clock, target: RenderTarget): void {
    const { gl, params: p, pointer } = this.ctx;
    const [sw, sh] = this.simSize(target);
    const resized = sw !== this.state.read.width || sh !== this.state.read.height;
    this.state.resize(sw, sh);
    if (resized && !this.pending) this.pending = 'seed';
    this.source.update(clock, sw, sh);
    const [srcW, srcH] = this.source.size();

    if (this.pending === 'clear') {
      this.state.read.clear(1, 0, 0, 1);
      this.state.write.clear(1, 0, 0, 1);
      this.pending = null;
    } else if (this.pending === 'seed') {
      this.state.write.bind(gl);
      this.seed.use();
      this.seed.f('uSeed', this.seedCounter * 13.7 + 1);
      this.seed.f('uDensity', 0.35);
      this.seed.v2('uSize', sw, sh);
      this.quad.draw();
      this.state.swap();
      this.pending = null;
    }

    const brushOn = pointer.down && pointer.inside;
    if (clock.dt > 0 || brushOn) {
      const steps = Math.round(p.number('steps'));
      this.step.use();
      this.step.v2('uSize', sw, sh);
      this.step.v2('uSourceSize', srcW, srcH);
      this.step.f('uFeed', p.number('feed'));
      this.step.f('uKill', p.number('kill'));
      this.step.f('uDiffusion', p.number('diffusion'));
      this.step.f('uInfluence', p.number('influence'));
      this.step.v2('uBrush', pointer.x, pointer.y);
      this.step.f('uBrushRadius', brushOn ? p.number('brush') : 0);
      this.step.tex('uSource', 1, this.source.texture());
      for (let i = 0; i < steps; i++) {
        this.state.write.bind(gl);
        this.step.tex('uState', 0, this.state.read.texture);
        this.quad.draw();
        this.state.swap();
      }
    }

    target.bind(gl);
    this.display.use();
    this.display.tex('uState', 0, this.state.read.texture);
    this.display.tex('uSource', 1, this.source.texture());
    this.display.v2('uResolution', target.width, target.height);
    this.display.v2('uSourceSize', srcW, srcH);
    const a = hexToRgb(p.string('colorA')), b = hexToRgb(p.string('colorB'));
    this.display.v3('uColorA', a[0], a[1], a[2]);
    this.display.v3('uColorB', b[0], b[1], b[2]);
    this.display.f('uEdge', p.number('edge'));
    this.display.f('uTint', p.number('tint'));
    this.quad.draw();
  }

  dispose(): void {
    this.source?.dispose();
    this.state?.dispose();
    this.step?.dispose();
    this.seed?.dispose();
    this.display?.dispose();
    this.quad?.dispose();
  }
}

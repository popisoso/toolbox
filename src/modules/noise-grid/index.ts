/**
 * NOISE GRID — reference implementation of the module contract.
 *
 * An organic procedural noise field resampled at variable grid resolution.
 * One control (`grid`) takes it from a fine, near-continuous field to a
 * coarse discrete point grid. Runs on noise alone: no permissions needed.
 */
import {
  defineModule, FullscreenQuad, FULLSCREEN_VS, Program, hexToRgb,
  type Clock, type ModuleContext, type ModuleInstance, type RenderTarget,
} from '@engine/index';
import { resolveIncludes } from '../_shared/glsl/include';
import fragSource from './shader.frag.glsl?raw';

export default defineModule({
  id: 'noise-grid',
  name: 'Noise Grid',
  description: 'Organic noise field that resolves from a continuous surface into a discrete point grid.',
  category: 'shader',
  version: '1.0.0',
  requires: ['webgl2'],
  outputs: [{ key: 'out', label: 'Output', type: 'texture' }],
  params: [
    { kind: 'range', key: 'grid', label: 'Grid', min: 0, max: 1, step: 0.001, default: 0, group: 'Field',
      description: '0 = continuous field, 1 = coarse point grid' },
    { kind: 'range', key: 'scale', label: 'Scale', min: 0.5, max: 8, step: 0.01, default: 2.2, group: 'Field' },
    { kind: 'range', key: 'speed', label: 'Speed', min: 0, max: 1, step: 0.001, default: 0.12, group: 'Field' },
    { kind: 'range', key: 'contrast', label: 'Contrast', min: 0.5, max: 3, step: 0.01, default: 1.4, group: 'Field' },
    { kind: 'range', key: 'maxCells', label: 'Coarsest cells', min: 4, max: 64, step: 1, default: 14, group: 'Grid',
      description: 'Cells across the short edge when Grid = 1' },
    { kind: 'range', key: 'dotSize', label: 'Dot size', min: 0.2, max: 1, step: 0.01, default: 0.9, group: 'Grid' },
    { kind: 'color', key: 'colorA', label: 'Low', default: '#101010', group: 'Colour' },
    { kind: 'color', key: 'colorB', label: 'High', default: '#e6e6e6', group: 'Colour' },
    { kind: 'action', key: 'reseed', label: 'Reseed', group: 'Field' },
  ],
  create: (ctx) => new NoiseGrid(ctx),
});

class NoiseGrid implements ModuleInstance {
  private program!: Program;
  private quad!: FullscreenQuad;
  private timeOffset = 0;

  constructor(private readonly ctx: ModuleContext) {}

  init(): void {
    const { gl } = this.ctx;
    this.program = new Program(gl, FULLSCREEN_VS, resolveIncludes(fragSource));
    this.quad = new FullscreenQuad(gl);
  }

  render(clock: Clock, target: RenderTarget): void {
    const { gl, params: p } = this.ctx;
    target.bind(gl);
    this.program.use();
    this.program.v2('uResolution', target.width, target.height);
    this.program.f('uTime', clock.time + this.timeOffset);
    this.program.f('uGrid', p.number('grid'));
    this.program.f('uScale', p.number('scale'));
    this.program.f('uSpeed', p.number('speed'));
    this.program.f('uContrast', p.number('contrast'));
    this.program.f('uDotSize', p.number('dotSize'));
    this.program.f('uMaxCells', p.number('maxCells'));
    const a = hexToRgb(p.string('colorA'));
    const b = hexToRgb(p.string('colorB'));
    this.program.v3('uColorA', a[0], a[1], a[2]);
    this.program.v3('uColorB', b[0], b[1], b[2]);
    // Source seam stays in procedural mode here; see the video-input module
    // for the same grid driven by a live texture.
    this.program.i('uSourceMode', 0);
    this.quad.draw();
  }

  onAction(key: string): void {
    if (key === 'reseed') this.timeOffset += 97.31;
  }

  dispose(): void {
    this.program?.dispose();
    this.quad?.dispose();
  }
}

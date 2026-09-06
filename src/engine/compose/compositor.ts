/**
 * COMPOSITING / SEQUENCING SEAM
 * -----------------------------
 * The single-tool view renders one module straight to the screen. The
 * compositor generalises that: each layer's module renders into an offscreen
 * target, and a blend pass stacks the resulting textures. Because modules
 * only ever see a `RenderTarget`, the same instance code runs in both modes.
 *
 * Sequencing is data (see `timeline.ts`): a `Timeline` says which layers are
 * active at time t and with what params; the compositor just draws them.
 */
import { FullscreenQuad } from '../gl/quad';
import { FULLSCREEN_VS, Program } from '../gl/program';
import { OffscreenTarget, type RenderTarget } from '../gl/target';
import type { Clock, ModuleInstance } from '../module';

export type BlendMode = 'normal' | 'add' | 'multiply' | 'screen';

export interface Layer {
  id: string;
  instance: ModuleInstance;
  opacity: number;
  blend: BlendMode;
  visible: boolean;
}

const BLEND_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBase;
uniform sampler2D uLayer;
uniform float uOpacity;
uniform int uMode;
void main() {
  vec3 a = texture(uBase, vUv).rgb;
  vec3 b = texture(uLayer, vUv).rgb;
  vec3 r = b;
  if (uMode == 1) r = a + b;
  else if (uMode == 2) r = a * b;
  else if (uMode == 3) r = 1.0 - (1.0 - a) * (1.0 - b);
  outColor = vec4(mix(a, r, uOpacity), 1.0);
}`;

const MODES: Record<BlendMode, number> = { normal: 0, add: 1, multiply: 2, screen: 3 };

export class Compositor {
  readonly layers: Layer[] = [];
  private targets = new Map<string, OffscreenTarget>();
  private ping: OffscreenTarget;
  private pong: OffscreenTarget;
  private program: Program;
  private quad: FullscreenQuad;

  constructor(private readonly gl: WebGL2RenderingContext, private width: number, private height: number) {
    this.program = new Program(gl, FULLSCREEN_VS, BLEND_FS);
    this.quad = new FullscreenQuad(gl);
    this.ping = new OffscreenTarget(gl, width, height);
    this.pong = new OffscreenTarget(gl, width, height);
  }

  addLayer(layer: Layer): void {
    this.layers.push(layer);
    this.targets.set(layer.id, new OffscreenTarget(this.gl, this.width, this.height));
  }

  removeLayer(id: string): void {
    const i = this.layers.findIndex((l) => l.id === id);
    if (i >= 0) this.layers.splice(i, 1);
    this.targets.get(id)?.dispose();
    this.targets.delete(id);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.ping.resize(width, height);
    this.pong.resize(width, height);
    for (const t of this.targets.values()) t.resize(width, height);
  }

  /** Output texture of a single layer (for wiring into another module's inputs). */
  layerTexture(id: string): WebGLTexture | null {
    return this.targets.get(id)?.texture ?? null;
  }

  /** Render every visible layer, then blend them bottom-up into `out`. */
  render(clock: Clock, out: RenderTarget): void {
    const gl = this.gl;
    let base: OffscreenTarget | null = null;
    let scratch = this.ping;
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      const target = this.targets.get(layer.id);
      if (!target) continue;
      layer.instance.render(clock, target);
      if (!base) {
        base = target;
        continue;
      }
      scratch.bind(gl);
      this.blend(base.texture, target.texture, layer);
      base = scratch;
      scratch = scratch === this.ping ? this.pong : this.ping;
    }
    out.bind(gl);
    if (base) this.blit(base.texture);
    else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  private blend(baseTex: WebGLTexture, layerTex: WebGLTexture, layer: Layer): void {
    this.program.use();
    this.program.tex('uBase', 0, baseTex);
    this.program.tex('uLayer', 1, layerTex);
    this.program.f('uOpacity', layer.opacity);
    this.program.i('uMode', MODES[layer.blend]);
    this.quad.draw();
  }

  private blit(tex: WebGLTexture): void {
    this.program.use();
    this.program.tex('uBase', 0, tex);
    this.program.tex('uLayer', 1, tex);
    this.program.f('uOpacity', 0);
    this.program.i('uMode', 0);
    this.quad.draw();
  }

  dispose(): void {
    for (const t of this.targets.values()) t.dispose();
    this.targets.clear();
    this.ping.dispose();
    this.pong.dispose();
    this.program.dispose();
    this.quad.dispose();
  }
}

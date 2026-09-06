/**
 * ModuleHost: mounts one module on a canvas and owns its lifecycle —
 * context, loop, params, resize, sources, export. The shell's tool view is a
 * thin wrapper around this; tests can drive it headlessly.
 */
import { createGL, fitCanvas } from './gl/context';
import { ScreenTarget } from './gl/target';
import { RenderLoop } from './loop';
import { ParamStore, type ParamValue } from './params';
import { createSourceFactory } from './video/source';
import { createExporter, type Exporter } from './export/exporter';
import { createAnthropicHook } from './ai/assistant';
import { createGpuInfo } from './gpu/webgpu';
import type { Logger, ModuleContext, ModuleInstance, ModuleManifest, Viewport } from './module';

export interface HostOptions {
  initialParams?: Record<string, ParamValue>;
  maxDpr?: number;
  log?: Logger;
}

export class ModuleHost {
  readonly manifest: ModuleManifest;
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly params: ParamStore;
  readonly loop: RenderLoop;
  readonly exporter: Exporter;
  readonly viewport: Viewport = { width: 1, height: 1, dpr: 1 };
  instance: ModuleInstance | null = null;
  /** Last error thrown by the module; the shell surfaces it. */
  error: Error | null = null;
  onError: ((e: Error) => void) | null = null;

  private target: ScreenTarget;
  private sources: ReturnType<typeof createSourceFactory>;
  private unsubscribe: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly maxDpr: number;
  private disposed = false;

  constructor(manifest: ModuleManifest, canvas: HTMLCanvasElement, opts: HostOptions = {}) {
    this.manifest = manifest;
    this.canvas = canvas;
    this.maxDpr = opts.maxDpr ?? 2;
    this.gl = createGL(canvas);
    this.params = new ParamStore(manifest.params, opts.initialParams);
    this.sources = createSourceFactory(this.gl);
    this.loop = new RenderLoop((clock) => this.frame(clock));
    this.exporter = createExporter(canvas, this.loop);
    this.target = new ScreenTarget(1, 1);
    const log = opts.log ?? console;

    const ctx: ModuleContext = {
      gl: this.gl,
      canvas,
      params: this.params,
      clock: this.loop.clock,
      viewport: this.viewport,
      sources: this.sources,
      ai: createAnthropicHook(),
      gpu: createGpuInfo(),
      log,
      inputs: new Map(),
    };
    this.instance = manifest.create(ctx);
  }

  async mount(): Promise<void> {
    if (!this.instance) throw new Error('Host already disposed');
    this.fit();
    await this.instance.init();
    if (this.disposed) return;
    this.unsubscribe = this.params.subscribe((k, v) => this.instance?.onParam?.(k, v));
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this.canvas);
    this.loop.start();
  }

  async action(key: string): Promise<void> {
    try {
      await this.instance?.onAction?.(key);
    } catch (e) {
      this.fail(e);
    }
  }

  private fit(): void {
    const r = fitCanvas(this.canvas, this.maxDpr);
    this.viewport.width = r.width;
    this.viewport.height = r.height;
    this.viewport.dpr = r.dpr;
    this.target.width = r.width;
    this.target.height = r.height;
    if (r.changed) this.instance?.resize?.(this.viewport);
  }

  private frame(clock: ModuleContext['clock']): void {
    if (!this.instance || this.error) return;
    try {
      this.instance.render(clock, this.target);
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    this.error = e instanceof Error ? e : new Error(String(e));
    this.loop.stop();
    this.onError?.(this.error);
  }

  dispose(): void {
    this.disposed = true;
    this.loop.stop();
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    try { this.instance?.dispose(); } catch { /* best effort */ }
    this.instance = null;
    this.sources.disposeAll();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

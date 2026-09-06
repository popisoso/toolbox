/**
 * THE MODULE CONTRACT
 * ===================
 * Every tool in the toolbox (shader, video, post, sequencing, export, …) is a
 * self-contained module that exports a `ModuleManifest`. The shell discovers
 * manifests through `src/modules/index.ts`, renders their params, and drives
 * their instances through the render loop. Adding a tool is "write a module
 * folder"; nothing in `src/engine` or `src/shell` changes.
 *
 * See ARCHITECTURE.md for the reasoning; `src/modules/noise-grid` is the
 * reference implementation.
 */
import type { Capability } from './capabilities';
import type { ParamSpec, ParamStore, ParamValue } from './params';
import type { RenderTarget } from './gl/target';
import type { VideoSourceFactory } from './video/source';
import type { AIHook } from './ai/assistant';
import type { GpuInfo } from './gpu/webgpu';

export type ModuleCategory = 'shader' | 'video' | 'post' | 'sequence' | 'export' | 'utility';

export interface PortSpec {
  key: string;
  label: string;
  /** Only textures cross module boundaries; audio/data ports can be added later. */
  type: 'texture';
}

export interface ModuleManifest {
  /** Stable, URL-safe id. Used in routes and saved presets. */
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  version: string;
  /** Capabilities the device must have. The shell disables the tool otherwise. */
  requires: readonly Capability[];
  params: readonly ParamSpec[];
  /** Compositing seam: textures this module can consume / produce. */
  inputs?: readonly PortSpec[];
  outputs?: readonly PortSpec[];
  /** Factory. Called once per mounted tool; the engine owns the lifecycle. */
  create(ctx: ModuleContext): ModuleInstance;
}

export interface Clock {
  /** Seconds since the instance was mounted (pausable). */
  time: number;
  /** Seconds since last frame. */
  dt: number;
  frame: number;
}

export interface Viewport {
  /** Drawing-buffer size in device pixels. */
  width: number;
  height: number;
  dpr: number;
}

/** Pointer/touch state over the canvas, normalised to 0..1 with y up (GL convention). */
export interface PointerState {
  x: number;
  y: number;
  /** A button/finger is down. */
  down: boolean;
  /** Pointer is over the canvas. */
  inside: boolean;
}

export interface Logger {
  info(...a: unknown[]): void;
  warn(...a: unknown[]): void;
  error(...a: unknown[]): void;
}

/** Everything a module may touch. Modules never reach for globals. */
export interface ModuleContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  params: ParamStore;
  clock: Clock;
  viewport: Viewport;
  /** Real-time video I/O seam (camera, file, and later network / other modules). */
  sources: VideoSourceFactory;
  /** Anthropic API seam. `ai.available` is false until the user adds a key. */
  ai: AIHook;
  /** WebGPU availability, for modules whose compute genuinely benefits. */
  gpu: GpuInfo;
  log: Logger;
  /** Textures wired in by the compositor (keys from `manifest.inputs`). */
  inputs: ReadonlyMap<string, WebGLTexture>;
  /** Live pointer over the canvas (interaction seam). */
  pointer: PointerState;
}

export interface ModuleInstance {
  /** Compile programs, allocate buffers. May be async (e.g. waiting on a camera). */
  init(): void | Promise<void>;
  /**
   * Draw one frame into `target`. `target.framebuffer` is `null` for the
   * screen or an FBO when the compositor is capturing this module's output.
   * Implementations must bind the target themselves via `target.bind(gl)`.
   * `clock.dt === 0` means the clock is paused: stateful modules must not
   * advance their simulation, so a held frame exports byte-stable.
   */
  render(clock: Clock, target: RenderTarget): void;
  /** Drawing-buffer size changed. */
  resize?(viewport: Viewport): void;
  /** A stored param changed (also fired on preset load). */
  onParam?(key: string, value: ParamValue): void;
  /** An `action` param was pressed. */
  onAction?(key: string): void | Promise<void>;
  /**
   * Optional custom UI beyond the auto-generated controls. Called after
   * `init()` resolves. Return a cleanup. Use tokens (var(--…)) only; never
   * hard-code visual style here.
   */
  ui?(host: HTMLElement): void | (() => void);
  dispose(): void;
}

/** Helper for authors: gives type inference on the manifest literal. */
export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest;
}

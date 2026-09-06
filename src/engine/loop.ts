import type { Clock } from './module';

/**
 * requestAnimationFrame loop with a pausable clock. Pauses automatically when
 * the tab is hidden so a backgrounded PWA does not burn battery.
 */
export class RenderLoop {
  readonly clock: Clock = { time: 0, dt: 0, frame: 0 };
  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private afterFrame: Array<() => void> = [];

  constructor(private readonly tick: (clock: Clock) => void) {
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.step);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Freeze time (e.g. to export a still) without tearing down. */
  setPaused(p: boolean): void {
    this.paused = p;
    this.last = performance.now();
  }
  get isPaused(): boolean { return this.paused; }

  /** Run `fn` right after the next frame is drawn, before the buffer is cleared
   *  (needed for `canvas.toBlob` without `preserveDrawingBuffer`). */
  onceAfterFrame(fn: () => void): void {
    this.afterFrame.push(fn);
  }

  private step = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.clock.time += dt;
    this.clock.dt = this.paused ? 0 : dt;
    this.clock.frame++;
    this.tick(this.clock);
    if (this.afterFrame.length) {
      const fns = this.afterFrame;
      this.afterFrame = [];
      for (const f of fns) f();
    }
    this.raf = requestAnimationFrame(this.step);
  };

  private onVisibility = (): void => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else if (this.running) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.step);
    }
  };
}

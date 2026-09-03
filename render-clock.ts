/**
 * render-clock.ts — lifecycle-owned coalescing render clock (v0.4 spec §4.4)
 *
 * While an assistant turn is active the chrome must refresh elapsed time at a
 * bounded cadence (at most one render per RENDER_INTERVAL_MS) instead of once
 * per streamed token. Only index.ts instantiates this clock — renderers and
 * state objects never create timers (spec §5.3).
 *
 * Timer functions are injectable so tests can drive ticks deterministically.
 */

/** Minimum spacing between clock-driven renders while a turn is active. */
export const RENDER_INTERVAL_MS = 250;

export interface RenderTimerHandle {
  /** Supported on Node timers; a clock timer must never keep the process alive. */
  unref?: () => void;
}

export interface RenderClockOptions {
  /** The bounded-cadence render request (typically footer.requestRender). */
  requestRender: () => void;
  /** Tick interval; defaults to the spec's 250ms budget. */
  intervalMs?: number;
  /** Injectable timer creation (defaults to setTimeout). */
  setTimer?: (callback: () => void, ms: number) => RenderTimerHandle;
  /** Injectable timer cancellation (defaults to clearTimeout). */
  clearTimer?: (timer: RenderTimerHandle) => void;
}

export class RenderClock {
  private running = false;
  private timer: RenderTimerHandle | null = null;
  private readonly intervalMs: number;
  private readonly requestRenderFn: () => void;
  private readonly setTimerFn: (callback: () => void, ms: number) => RenderTimerHandle;
  private readonly clearTimerFn: (timer: RenderTimerHandle) => void;

  constructor(options: RenderClockOptions) {
    this.requestRenderFn = options.requestRender;
    this.intervalMs = options.intervalMs ?? RENDER_INTERVAL_MS;
    this.setTimerFn = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms) as unknown as RenderTimerHandle);
    this.clearTimerFn = options.clearTimer ?? ((timer) => clearTimeout(timer as NodeJS.Timeout));
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Start the clock exactly once; repeated calls are no-ops so overlapping
   * turn-start events can never stack timers.
   */
  public start(): void {
    if (this.running) return;
    this.running = true;
    this.arm();
  }

  /**
   * Stop the clock; idempotent. No trailing render is requested here — the
   * lifecycle decides whether a final render is wanted.
   */
  public stop(): void {
    this.running = false;
    if (this.timer) {
      try {
        this.clearTimerFn(this.timer);
      } catch {
        // Timer already gone.
      }
      this.timer = null;
    }
  }

  /**
   * Record that chrome is dirty. While the clock runs, the tick loop coalesces
   * this into the next bounded render; outside an active turn it falls back to
   * a single immediate render so isolated updates are not lost.
   */
  public markDirty(): void {
    if (!this.running) {
      this.requestRenderFn();
    }
  }

  private arm(): void {
    if (!this.running) return;
    const timer = this.setTimerFn(() => {
      this.timer = null;
      if (!this.running) return;
      try {
        this.requestRenderFn();
      } finally {
        this.arm();
      }
    }, this.intervalMs);
    this.timer = timer;
    // A render clock must never keep Node alive across idle sessions.
    try {
      timer.unref?.();
    } catch {
      // Hosts without unref support simply keep default timer semantics.
    }
  }
}

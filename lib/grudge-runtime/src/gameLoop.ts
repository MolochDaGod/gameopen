/**
 * Fleet game loop — patterns from benvanik/games-framework (gf.Game),
 * without Closure. Fixed timestep updates + variable render alpha + tab focus.
 *
 * SSOT: @workspace/grudge-runtime
 * Use from Open, Mine-Loader, VoxGrudge (via JS mirror), GRUDOX hosts.
 */

export type UpdateFrame = {
  /** Monotonic update frame index. */
  frame: number;
  /** Game time in seconds (accumulates fixed steps). */
  time: number;
  /** Step duration in seconds (fixed when fixedTimestep). */
  dt: number;
  /** Document has focus / not hidden. */
  hasFocus: boolean;
};

export type RenderFrame = {
  frame: number;
  /** Wall / render time in seconds. */
  time: number;
  /** Wall delta since last render (capped). */
  dt: number;
  /** Interpolation factor into next fixed step [0,1]. */
  alpha: number;
  hasFocus: boolean;
};

export type GameLoopOptions = {
  /** Fixed physics/sim step in seconds. Default ~1/60. */
  fixedDt?: number;
  /** Cap wall-frame delta (seconds). Default 0.25 (GF MAX_FRAME_TIME). */
  maxFrameDt?: number;
  /** When true (default), sim uses fixed steps; render gets alpha. */
  fixedTimestep?: boolean;
  /**
   * When true (default), skip update while document.hidden.
   * Render callback still runs if renderWhileHidden is true.
   */
  pauseWhenHidden?: boolean;
  /** Still call onRender when hidden (draw last frame). Default true. */
  renderWhileHidden?: boolean;
  /** Optional clock source (seconds). Default performance.now()/1000. */
  now?: () => number;
  onUpdate?: (frame: UpdateFrame) => void;
  onRender?: (frame: RenderFrame) => void;
  /**
   * Optional: when false, skip update but may still render.
   * Hosts use this for pause menus / soft pause.
   */
  shouldUpdate?: () => boolean;
};

const DEFAULT_FIXED = 16.777 / 1000;
const DEFAULT_MAX = 0.25;

/**
 * rAF-driven loop with GF-style fixed timestep accumulator and visibility.
 */
export class FleetGameLoop {
  readonly fixedDt: number;
  readonly maxFrameDt: number;
  readonly fixedTimestep: boolean;
  readonly pauseWhenHidden: boolean;
  readonly renderWhileHidden: boolean;

  private nowFn: () => number;
  private onUpdate?: (frame: UpdateFrame) => void;
  private onRender?: (frame: RenderFrame) => void;
  private shouldUpdateFn?: () => boolean;

  private running = false;
  private raf = 0;
  private lastWall = 0;
  private accumulator = 0;
  private gameTime = 0;
  private updateFrame = 0;
  private renderFrame = 0;
  private focused = true;
  private unsubVis: (() => void) | null = null;

  constructor(opts: GameLoopOptions = {}) {
    this.fixedDt = opts.fixedDt ?? DEFAULT_FIXED;
    this.maxFrameDt = opts.maxFrameDt ?? DEFAULT_MAX;
    this.fixedTimestep = opts.fixedTimestep !== false;
    this.pauseWhenHidden = opts.pauseWhenHidden !== false;
    this.renderWhileHidden = opts.renderWhileHidden !== false;
    this.nowFn = opts.now ?? (() => performance.now() / 1000);
    this.onUpdate = opts.onUpdate;
    this.onRender = opts.onRender;
    this.shouldUpdateFn = opts.shouldUpdate;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get hasFocus(): boolean {
    return this.focused;
  }

  get time(): number {
    return this.gameTime;
  }

  setHandlers(h: {
    onUpdate?: (frame: UpdateFrame) => void;
    onRender?: (frame: RenderFrame) => void;
    shouldUpdate?: () => boolean;
  }): void {
    if (h.onUpdate) this.onUpdate = h.onUpdate;
    if (h.onRender) this.onRender = h.onRender;
    if (h.shouldUpdate) this.shouldUpdateFn = h.shouldUpdate;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastWall = this.nowFn();
    this.accumulator = 0;
    this.bindVisibility();
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unbindVisibility();
  }

  /** Soft reset clocks without stopping rAF. */
  resetTime(): void {
    this.lastWall = this.nowFn();
    this.accumulator = 0;
    this.gameTime = 0;
    this.updateFrame = 0;
    this.renderFrame = 0;
  }

  private bindVisibility(): void {
    if (typeof document === "undefined") return;
    this.focused = !document.hidden;
    const onVis = () => {
      this.focused = !document.hidden;
      // Drop accumulator on hide so resume does not explode sim
      if (document.hidden) {
        this.accumulator = 0;
        this.lastWall = this.nowFn();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    this.unsubVis = () => document.removeEventListener("visibilitychange", onVis);
  }

  private unbindVisibility(): void {
    this.unsubVis?.();
    this.unsubVis = null;
  }

  private tick = (_ts?: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const wall = this.nowFn();
    let wallDt = wall - this.lastWall;
    this.lastWall = wall;
    if (wallDt > this.maxFrameDt) wallDt = this.maxFrameDt;
    if (wallDt < 0) wallDt = 0;

    const hostAllows = this.shouldUpdateFn ? this.shouldUpdateFn() : true;
    const tabOk = !this.pauseWhenHidden || this.focused;
    const doUpdate = hostAllows && tabOk;

    let alpha = 1;

    if (doUpdate) {
      if (this.fixedTimestep) {
        this.accumulator += wallDt;
        const step = this.fixedDt;
        // Cap spiral of death
        let guard = 0;
        while (this.accumulator >= step && guard < 8) {
          this.gameTime += step;
          this.updateFrame++;
          this.onUpdate?.({
            frame: this.updateFrame,
            time: this.gameTime,
            dt: step,
            hasFocus: this.focused,
          });
          this.accumulator -= step;
          guard++;
        }
        alpha = step > 0 ? this.accumulator / step : 0;
      } else {
        this.gameTime += wallDt;
        this.updateFrame++;
        this.onUpdate?.({
          frame: this.updateFrame,
          time: this.gameTime,
          dt: wallDt,
          hasFocus: this.focused,
        });
        alpha = 1;
      }
    }

    const doRender = this.focused || this.renderWhileHidden;
    if (doRender && this.onRender) {
      this.renderFrame++;
      this.onRender({
        frame: this.renderFrame,
        time: wall,
        dt: wallDt,
        alpha,
        hasFocus: this.focused,
      });
    }
  };
}

/** Convenience factory. */
export function createGameLoop(opts?: GameLoopOptions): FleetGameLoop {
  return new FleetGameLoop(opts);
}

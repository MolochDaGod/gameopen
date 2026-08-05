import { describe, expect, it, vi } from "vitest";
import { FleetGameLoop } from "./gameLoop";

describe("FleetGameLoop", () => {
  it("runs fixed steps from wall delta", () => {
    let t = 0;
    const updates: number[] = [];
    const loop = new FleetGameLoop({
      fixedDt: 0.05,
      maxFrameDt: 1,
      now: () => t,
      onUpdate: (f) => updates.push(f.dt),
      onRender: () => {},
    });

    // Manually drive tick internals via start + fake rAF
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    loop.start();
    expect(rafQueue.length).toBe(1);

    // Advance wall 0.12s → two fixed 0.05 steps, remainder 0.02
    t = 0.12;
    rafQueue.shift()?.(0);
    expect(updates.length).toBe(2);
    expect(updates[0]).toBeCloseTo(0.05);
    expect(loop.time).toBeCloseTo(0.1);

    loop.stop();
    vi.unstubAllGlobals();
  });

  it("skips update when shouldUpdate is false but can still render", () => {
    let t = 0;
    let updates = 0;
    let renders = 0;
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const loop = new FleetGameLoop({
      fixedDt: 0.05,
      now: () => t,
      shouldUpdate: () => false,
      onUpdate: () => {
        updates++;
      },
      onRender: () => {
        renders++;
      },
    });
    loop.start();
    t = 0.1;
    rafQueue.shift()?.(0);
    expect(updates).toBe(0);
    expect(renders).toBe(1);
    loop.stop();
    vi.unstubAllGlobals();
  });
});

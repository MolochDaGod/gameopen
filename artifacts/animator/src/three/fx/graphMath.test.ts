import { describe, expect, it } from "vitest";
import {
  catmullRom,
  circleGraphNodes,
  cubicBezier,
  easeInOutCubic,
  lerp,
  pulse,
  sampleCatmullRomPath,
  smoothstep,
  v3,
} from "./graphMath";

describe("graphMath", () => {
  it("lerp / smoothstep bounds", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("cubicBezier endpoints", () => {
    const a = v3(0, 0, 0);
    const b = v3(1, 1, 0);
    const c = v3(2, 1, 0);
    const d = v3(3, 0, 0);
    expect(cubicBezier(a, b, c, d, 0)).toEqual(a);
    expect(cubicBezier(a, b, c, d, 1).x).toBeCloseTo(3, 5);
  });

  it("catmullRom path samples stay continuous", () => {
    const pts = [v3(0, 0, 0), v3(1, 1, 0), v3(2, 0, 0), v3(3, 1, 0)];
    const mid = sampleCatmullRomPath(pts, 0.5, false);
    expect(Number.isFinite(mid.x)).toBe(true);
    const cr = catmullRom(pts[0]!, pts[1]!, pts[2]!, pts[3]!, 0.5);
    expect(cr.x).toBeGreaterThan(1);
  });

  it("circleGraphNodes places N on a ring", () => {
    const nodes = circleGraphNodes(8, 2);
    expect(nodes).toHaveLength(8);
    const r = Math.hypot(nodes[0]!.x, nodes[0]!.z);
    expect(r).toBeCloseTo(2, 5);
  });

  it("pulse is 0..1", () => {
    for (let t = 0; t < 3; t += 0.1) {
      const p = pulse(t, 1);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

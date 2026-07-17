import { describe, expect, it } from "vitest";
import { probeWallAnalytic, probeLedge, resolveCirclePush } from "./probes";

describe("probeWallAnalytic", () => {
  it("finds room bound wall", () => {
    const hit = probeWallAnalytic({ x: 14.8, y: 0, z: 0 }, { bound: 15, reach: 0.5 });
    expect(hit).not.toBeNull();
    expect(hit!.normal.x).toBe(-1);
  });

  it("finds circle obstacle", () => {
    const hit = probeWallAnalytic(
      { x: 1.1, y: 0, z: 0 },
      { obstacles: [{ x: 0, z: 0, r: 1 }], reach: 0.5 },
    );
    expect(hit).not.toBeNull();
    expect(hit!.normal.x).toBeGreaterThan(0);
  });
});

describe("probeLedge", () => {
  it("detects climbable lip ahead", () => {
    const sample = (x: number, _z: number) => (x > 0.3 ? 1.0 : 0);
    const hit = probeLedge({ x: 0, y: 0, z: 0 }, Math.PI / 2, sample);
    expect(hit).not.toBeNull();
    expect(hit!.height).toBeCloseTo(1.0, 2);
  });

  it("rejects flat ground", () => {
    const sample = () => 0;
    expect(probeLedge({ x: 0, y: 0, z: 0 }, 0, sample)).toBeNull();
  });
});

describe("resolveCirclePush", () => {
  it("pushes out of overlap", () => {
    const p = resolveCirclePush({ x: 0.1, z: 0 }, [{ x: 0, z: 0, r: 1 }], 0.35);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1.35 - 1e-6);
  });
});

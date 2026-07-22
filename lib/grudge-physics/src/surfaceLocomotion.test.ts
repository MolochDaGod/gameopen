import { describe, it, expect } from "vitest";
import {
  resolveSurfaceLocomotion,
  modeToLocoCam,
  allowsGroundNav,
  gravityScaleForMode,
} from "./surfaceLocomotion";

describe("resolveSurfaceLocomotion", () => {
  const flat = (_x: number, _z: number) => 0;

  it("defaults to ground", () => {
    const s = resolveSurfaceLocomotion({
      feetY: 0,
      x: 0,
      z: 0,
      sampleHeight: flat,
    });
    expect(s.mode).toBe("ground");
    expect(modeToLocoCam(s.mode)).toBe("walk");
    expect(allowsGroundNav(s.mode)).toBe(true);
  });

  it("swims when deep water", () => {
    const s = resolveSurfaceLocomotion({
      feetY: 0,
      x: 0,
      z: 0,
      sampleHeight: flat,
      sampleWaterY: () => 2,
      wadeDepthM: 0.9,
    });
    expect(s.mode).toBe("swim");
    expect(s.waterDepthM).toBeGreaterThan(0.9);
  });

  it("vehicle boat wins over ground", () => {
    const s = resolveSurfaceLocomotion({
      feetY: 0,
      x: 0,
      z: 0,
      sampleHeight: flat,
      vehicle: "ship",
      vehicleId: "boat-1",
    });
    expect(s.mode).toBe("boat");
    expect(s.vehicleId).toBe("boat-1");
  });

  it("dragon → fly", () => {
    const s = resolveSurfaceLocomotion({
      feetY: 10,
      x: 0,
      z: 0,
      sampleHeight: flat,
      vehicle: "dragon",
    });
    expect(s.mode).toBe("fly");
    expect(gravityScaleForMode(s.mode)).toBeLessThan(0.1);
  });

  it("wallRun when airborne + wall + sprint", () => {
    const s = resolveSurfaceLocomotion({
      feetY: 2,
      x: 0,
      z: 0,
      sampleHeight: flat,
      airborne: true,
      wantWallRun: true,
      wallHit: { dist: 0.3 },
    });
    expect(s.mode).toBe("wallRun");
    expect(s.onWall).toBe(true);
  });
});

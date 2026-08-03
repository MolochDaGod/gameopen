import { describe, expect, it } from "vitest";
import { SLOT_COUNT, slotPosition } from "./GrudgeMenuScene";

describe("GrudgeMenuScene slot layout", () => {
  it("provides a distinct standing spot for every roster slot", () => {
    const seen = new Set<string>();
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const { x, z } = slotPosition(slot);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
      seen.add(`${x}:${z}`);
    }
    expect(seen.size).toBe(SLOT_COUNT);
  });

  it("arcs the band symmetrically around the fire (x mirrors, z behind it)", () => {
    expect(slotPosition(0).x).toBe(-slotPosition(3).x);
    expect(slotPosition(1).x).toBe(-slotPosition(2).x);
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      // Fire sits at z=1.6 — every hero stands behind it, in camera view.
      expect(slotPosition(slot).z).toBeLessThan(1.6);
    }
  });

  it("clamps out-of-range slots to the origin", () => {
    expect(slotPosition(99)).toEqual({ x: 0, z: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { capsulesOverlap, closestSegmentSegment, sweptCapsuleHit } from "./sweptCapsule";

describe("closestSegmentSegment", () => {
  it("distance between parallel unit segments", () => {
    const { d2 } = closestSegmentSegment(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 1 },
    );
    expect(d2).toBeCloseTo(1, 5);
  });
});

describe("capsulesOverlap", () => {
  it("detects overlapping capsules", () => {
    expect(
      capsulesOverlap(
        { a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 1, z: 0 }, radius: 0.3 },
        { a: { x: 0.4, y: 0, z: 0 }, b: { x: 0.4, y: 1, z: 0 }, radius: 0.3 },
      ),
    ).toBe(true);
  });
});

describe("sweptCapsuleHit", () => {
  it("hits during sweep into target", () => {
    const hit = sweptCapsuleHit(
      { x: -2, y: 0, z: 0 },
      { x: -2, y: 1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      0.2,
      { a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 1, z: 0 }, radius: 0.3 },
      8,
    );
    expect(hit).not.toBeNull();
  });
});

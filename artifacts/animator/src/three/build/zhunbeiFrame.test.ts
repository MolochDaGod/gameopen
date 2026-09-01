import { describe, expect, it } from "vitest";
import {
  innerMFromFootprint,
  ZHUNBEI_NATIVE_INNER_M,
  zhunbeiScaleForInner,
} from "./zhunbeiFrame";

describe("zhunbei placement frame", () => {
  it("scales the inner plate to a 1 m snap cell", () => {
    const s = zhunbeiScaleForInner(1);
    expect(s).toBeCloseTo(1 / ZHUNBEI_NATIVE_INNER_M, 5);
  });

  it("wraps a placeable half-extent footprint (claim flag 0.6 → 1.2 m inner)", () => {
    expect(innerMFromFootprint({ x: 0.6, z: 0.6 })).toBeCloseTo(1.2, 5);
    const s = zhunbeiScaleForInner(innerMFromFootprint({ x: 0.6, z: 0.6 }));
    expect(s * ZHUNBEI_NATIVE_INNER_M).toBeCloseTo(1.2, 5);
  });

  it("uses the larger axis so a rectangle still fits inside the square frame", () => {
    expect(innerMFromFootprint({ x: 1, z: 0.5 })).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { applyIntensity, rangedPrimaryTune } from "@workspace/grudge-physics";

describe("ranged SSOT (package)", () => {
  it("is reachable from animator host", () => {
    const bow = applyIntensity(rangedPrimaryTune("bow"), 50);
    expect(bow.kind).toBe("arrow");
    expect(bow.releaseLead).toBeGreaterThan(0);
  });
});

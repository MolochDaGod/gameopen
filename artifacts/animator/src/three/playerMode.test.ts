import { describe, expect, it } from "vitest";
import { radialPickFromMouseDy, RADIAL_AIM_DEADZONE } from "./playerMode";

describe("radialPickFromMouseDy", () => {
  it("picks combat on mouse up (negative dy)", () => {
    expect(radialPickFromMouseDy(-RADIAL_AIM_DEADZONE - 1)).toBe("combat");
    expect(radialPickFromMouseDy(-80)).toBe("combat");
  });

  it("picks harvest on mouse down (positive dy)", () => {
    expect(radialPickFromMouseDy(RADIAL_AIM_DEADZONE + 1)).toBe("harvest");
    expect(radialPickFromMouseDy(80)).toBe("harvest");
  });

  it("returns null inside the deadzone (cancel / keep mode)", () => {
    expect(radialPickFromMouseDy(0)).toBeNull();
    expect(radialPickFromMouseDy(RADIAL_AIM_DEADZONE - 1)).toBeNull();
    expect(radialPickFromMouseDy(-(RADIAL_AIM_DEADZONE - 1))).toBeNull();
  });
});

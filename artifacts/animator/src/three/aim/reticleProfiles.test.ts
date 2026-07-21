/** Re-export package tests surface — fleet SSOT lives in grudge-physics. */
import { describe, expect, it } from "vitest";
import { reticleProfileForWeapon } from "@workspace/grudge-physics";

describe("reticle SSOT (package)", () => {
  it("is reachable from animator host", () => {
    expect(reticleProfileForWeapon("sword").shape).toBe("dot");
    expect(reticleProfileForWeapon("bow").shape).toBe("x");
    expect(reticleProfileForWeapon("pistol").shape).toBe("cross");
    expect(reticleProfileForWeapon("staff").shape).toBe("ring");
  });
});

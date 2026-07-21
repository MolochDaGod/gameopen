import { describe, expect, it } from "vitest";
import { aoeReticleScale, reticleProfileForWeapon } from "./reticleProfiles";

describe("reticleProfileForWeapon", () => {
  it("swords and melee use a centre dot", () => {
    expect(reticleProfileForWeapon("sword").shape).toBe("dot");
    expect(reticleProfileForWeapon("greatsword").shape).toBe("dot");
    expect(reticleProfileForWeapon("axe").shape).toBe("dot");
    expect(reticleProfileForWeapon("none").shape).toBe("dot");
  });

  it("bows use an X mark", () => {
    expect(reticleProfileForWeapon("bow").shape).toBe("x");
  });

  it("guns use a classic cross", () => {
    expect(reticleProfileForWeapon("pistol").shape).toBe("cross");
    expect(reticleProfileForWeapon("rifle").shape).toBe("cross");
    expect(reticleProfileForWeapon("hunter-rifle").shape).toBe("cross");
    expect(reticleProfileForWeapon("shotgun").shape).toBe("cross");
  });

  it("staffs use a pulsing ring that can expand for AoE", () => {
    const p = reticleProfileForWeapon("staff");
    expect(p.shape).toBe("ring");
    expect(p.aoeExpand).toBe(true);
    expect(p.pulseHz).toBeGreaterThan(0);
    expect(reticleProfileForWeapon("staffFire").shape).toBe("ring");
    expect(reticleProfileForWeapon("wand").shape).toBe("ring");
  });

  it("honours optional group hint for unknown ids", () => {
    expect(reticleProfileForWeapon("custom-mage", "magic").shape).toBe("ring");
    expect(reticleProfileForWeapon("custom-blade", "melee-1h").shape).toBe("dot");
  });
});

describe("aoeReticleScale", () => {
  it("grows with radius but stays clamped", () => {
    expect(aoeReticleScale(0)).toBe(1);
    expect(aoeReticleScale(2)).toBeGreaterThan(1);
    expect(aoeReticleScale(20)).toBeLessThanOrEqual(4.2);
  });
});

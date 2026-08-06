import { describe, expect, it } from "vitest";
import { skillPackForWeaponId, skillPackForFamily } from "./weaponSkillPacks";

describe("skillPackForWeaponId — Casting element staff trees", () => {
  it("staffFire → fire labels + cast/impact effect ids", () => {
    const pack = skillPackForWeaponId("staffFire");
    expect(pack).toHaveLength(4);
    expect(pack[0]!.label).toMatch(/fire/i);
    expect(pack[0]!.castEffectId).toBe("fire_hand");
    expect(pack[0]!.impactEffectId).toBe("inferno");
    expect(pack[0]!.reach).toBeGreaterThan(4);
    expect(pack[0]!.damage).toBeGreaterThan(0);
  });

  it("staffIce → water/frost tree", () => {
    const pack = skillPackForWeaponId("staffIce");
    expect(pack[0]!.label).toMatch(/water|frost|ice/i);
    expect(pack[0]!.castEffectId).toBeTruthy();
    expect(pack[0]!.impactEffectId).toBe("frost_wave");
  });

  it("staffNature → earth tree", () => {
    const pack = skillPackForWeaponId("staffNature");
    expect(pack.some((s) => /earth|quake|stone|tectonic/i.test(s.label))).toBe(true);
    expect(pack[0]!.castEffectId).toBe("earth_surge");
  });

  it("staffStorm → wind tree", () => {
    const pack = skillPackForWeaponId("staffStorm");
    expect(pack.some((s) => /wind|gale|storm|tempest/i.test(s.label))).toBe(true);
  });

  it("staff / wand → arcane tree", () => {
    const staff = skillPackForWeaponId("staff");
    const wand = skillPackForWeaponId("wand");
    expect(staff[0]!.label).toMatch(/arcane/i);
    expect(wand[0]!.label).toMatch(/arcane/i);
    expect(staff[0]!.castEffectId).toBe("arcane_swirl");
  });

  it("magic family defaults to arcane (same as staff)", () => {
    const family = skillPackForFamily("magic");
    const staff = skillPackForWeaponId("staff");
    expect(family[0]!.label).toBe(staff[0]!.label);
  });

  it("non-staff weapons still resolve family packs", () => {
    const sword = skillPackForWeaponId("sword");
    expect(sword.length).toBeGreaterThanOrEqual(1);
    expect(sword[0]!.slot).toBe(1);
  });
});

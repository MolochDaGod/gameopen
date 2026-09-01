import { describe, expect, it } from "vitest";
import { WEAPONS } from "./index";
import { getWeaponSkills, WEAPON_SKILL_KITS } from "./weaponSkills";

describe("weapon skill kits", () => {
  it("covers every equippable weapon with exactly 4 skills", () => {
    for (const w of WEAPONS) {
      const kit = getWeaponSkills(w.id);
      expect(kit.length, w.id).toBe(4);
      for (const s of kit) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.clip.length).toBeGreaterThan(0);
        expect(s.behavior).toBeTruthy();
      }
    }
  });

  it("never uses a generic Power Throw label on slot 3 (index 2)", () => {
    for (const [id, kit] of Object.entries(WEAPON_SKILL_KITS)) {
      const slot3 = kit?.[2];
      expect(slot3?.label.toLowerCase()).not.toMatch(/power throw|grenade/);
      // Slot 3 is not a pure throw pose for non-javelin weapons
      if (id !== "javelin" && id !== "mace") {
        expect(slot3?.behavior).not.toBe("javelinThrow");
        expect(slot3?.behavior).not.toBe("maceThrow");
      }
    }
  });

  it("gives javelin a real projectile skill and mace a chain throw", () => {
    const jav = getWeaponSkills("javelin");
    expect(jav.some((s) => s.behavior === "javelinThrow")).toBe(true);
    const mace = getWeaponSkills("mace");
    expect(mace[3]?.behavior).toBe("maceThrow");
  });
});

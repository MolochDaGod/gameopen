import { describe, expect, it } from "vitest";
import {
  applyBackTemplateToMeshIds,
  collectKitSlotMeshes,
  cycleKitSlot,
  currentKitSlotMesh,
  getPreset,
} from "./gearPresets";
import {
  reconcileKitLimbs,
  reconcileKitLoadout,
  UMMORPG_PLAYER_SLOTS,
  UMMORPG_SLOT_TO_KIT,
} from "./toonKitCoverage";

describe("Toon main-panel kit slots", () => {
  it("maps the Unity Player.prefab 10 slots onto kit panel slots", () => {
    expect([...UMMORPG_PLAYER_SLOTS]).toEqual([
      "MainHand",
      "OffHand",
      "Head",
      "Shoulders",
      "Body",
      "Back",
      "Hands",
      "Ring",
      "Boots",
      "Relic",
    ]);
    expect(UMMORPG_SLOT_TO_KIT.Relic).toBe("relic");
    expect(UMMORPG_SLOT_TO_KIT.Hands).toBe("arms");
    expect(UMMORPG_SLOT_TO_KIT.Boots).toBe("legs");
  });

  it("lists the full customizable WK wardrobe for weapons", () => {
    const weapons = collectKitSlotMeshes("western-kingdoms", "weapon");
    expect(weapons.length).toBeGreaterThan(6);
    expect(weapons.some((w) => /pick|hammer|spear/i.test(w))).toBe(true);
  });

  it("cycles exclusive head without dropping body", () => {
    const base = getPreset("western-kingdoms", "warrior").visibleMeshes.slice();
    const next = cycleKitSlot("western-kingdoms", base, "head");
    expect(currentKitSlotMesh(next, "head")).not.toBe(currentKitSlotMesh(base, "head"));
    expect(currentKitSlotMesh(next, "body")).toBe(currentKitSlotMesh(base, "body"));
    expect(next.filter((m) => /head/i.test(m))).toHaveLength(1);
  });

  it("WK mage robe is onesie — no extra arms/legs", () => {
    const mage = getPreset("western-kingdoms", "mage").visibleMeshes;
    expect(mage.some((m) => /Body_A/i.test(m))).toBe(true);
    expect(mage.some((m) => /Arms/i.test(m))).toBe(false);
    expect(mage.some((m) => /Legs/i.test(m))).toBe(false);
  });

  it("cycling onto WK Body_A drops arms and legs", () => {
    const split = getPreset("western-kingdoms", "warrior").visibleMeshes.slice();
    const ontoRobe = reconcileKitLimbs("western-kingdoms", [
      ...split.filter((m) => !/body/i.test(m)),
      "WK_Units_Body_A",
    ]);
    expect(ontoRobe.some((m) => /Arms/i.test(m))).toBe(false);
    expect(ontoRobe.some((m) => /Legs/i.test(m))).toBe(false);
  });

  it("UD / ORC robe presets do not stack limbs", () => {
    for (const race of ["undead", "orcs", "dwarves"] as const) {
      const mage = getPreset(race, "mage").visibleMeshes;
      expect(mage.some((m) => /arm/i.test(m))).toBe(false);
    }
  });

  it("switching WK robe → split body adds required arms and legs", () => {
    const robe = getPreset("western-kingdoms", "mage").visibleMeshes.slice();
    const next = reconcileKitLoadout("western-kingdoms", [
      ...robe.filter((m) => !/body/i.test(m)),
      "WK_Units_Body_C",
    ]);
    expect(next.some((m) => /Arms/i.test(m))).toBe(true);
    expect(next.some((m) => /Legs/i.test(m))).toBe(true);
  });

  it("bow requires quiver and drops shield", () => {
    const withShield = [
      "WK_Units_head_D",
      "WK_Units_Body_C",
      "WK_Units_Arms_B",
      "WK_Units_Legs_B",
      "WK_weapon_Bow",
      "WK_Shield_B",
    ];
    const next = reconcileKitLoadout("western-kingdoms", withShield);
    expect(next.some((m) => /Shield/i.test(m))).toBe(false);
    expect(next.some((m) => /quiver/i.test(m))).toBe(true);
  });

  it("staff / spear drop shield and do not keep quiver", () => {
    const next = reconcileKitLoadout("western-kingdoms", [
      "WK_Units_Body_C",
      "WK_weapon_staff_C",
      "WK_Shield_B",
      "WK_Xtra_quiver",
    ]);
    expect(next.some((m) => /Shield/i.test(m))).toBe(false);
    expect(next.some((m) => /quiver/i.test(m))).toBe(false);
  });

  it("cycles Relic and Ring Unity families", () => {
    const base = getPreset("western-kingdoms", "warrior").visibleMeshes.slice();
    const relic = cycleKitSlot("western-kingdoms", base, "relic");
    expect(currentKitSlotMesh(relic, "relic")).toBe("equip:relic:nature");
    const ring = cycleKitSlot("western-kingdoms", relic, "ring");
    expect(currentKitSlotMesh(ring, "ring")).toBe("equip:ring:silver");
    expect(currentKitSlotMesh(ring, "relic")).toBe("equip:relic:nature");
  });

  it("shoulders can unequip to empty", () => {
    const base = getPreset("western-kingdoms", "warrior").visibleMeshes.slice();
    expect(currentKitSlotMesh(base, "shoulders")).toBeTruthy();
    let ids = base;
    for (let i = 0; i < 8; i++) ids = cycleKitSlot("western-kingdoms", ids, "shoulders");
    expect(currentKitSlotMesh(ids, "shoulders")).toBeNull();
  });

  it("Hands on WK robe is a no-op", () => {
    const mage = getPreset("western-kingdoms", "mage").visibleMeshes.slice();
    const next = cycleKitSlot("western-kingdoms", mage, "arms");
    expect(next).toEqual(mage);
  });

  it("warrior / ranger / mage presets stamp the Class item slot", () => {
    expect(getPreset("western-kingdoms", "warrior").visibleMeshes).toContain("equip:class:warrior");
    expect(getPreset("western-kingdoms", "ranger").visibleMeshes).toContain("equip:class:ranger");
    expect(getPreset("western-kingdoms", "mage").visibleMeshes).toContain("equip:class:mage");
    expect(getPreset("western-kingdoms", "unarmed").visibleMeshes.some((m) => /^equip:class:/.test(m))).toBe(
      false,
    );
  });

  it("bow keeps mobility back and does not force quiver", () => {
    const next = reconcileKitLoadout("western-kingdoms", [
      "WK_Units_head_D",
      "WK_Units_Body_C",
      "WK_Units_Arms_B",
      "WK_Units_Legs_B",
      "WK_weapon_Bow",
      "equip:back:wind_surf",
    ]);
    expect(next).toContain("equip:back:wind_surf");
    expect(next.some((m) => /quiver/i.test(m))).toBe(false);
  });

  it("bow can cycle Back onto windsurf instead of only quiver", () => {
    const withBow = [
      "WK_Units_head_D",
      "WK_Units_Body_C",
      "WK_Units_Arms_B",
      "WK_Units_Legs_B",
      "WK_weapon_Bow",
      "WK_Xtra_quiver",
    ];
    let ids = withBow;
    let sawWind = false;
    for (let i = 0; i < 16; i++) {
      ids = cycleKitSlot("western-kingdoms", ids, "back");
      if (currentKitSlotMesh(ids, "back") === "equip:back:wind_surf") {
        sawWind = true;
        break;
      }
    }
    expect(sawWind).toBe(true);
  });

  it("applyBackTemplateToMeshIds stamps one equip:back tag and drops quiver", () => {
    const withBow = [
      "WK_Units_head_D",
      "WK_Units_Body_C",
      "WK_Units_Arms_B",
      "WK_Units_Legs_B",
      "WK_weapon_Bow",
      "WK_Xtra_quiver",
    ];
    const next = applyBackTemplateToMeshIds(
      "western-kingdoms",
      withBow,
      "itm_back_holy_wings",
    );
    expect(next).toContain("equip:back:holy_wings");
    expect(next.some((m) => /quiver/i.test(m))).toBe(false);
    expect(next).toContain("WK_weapon_Bow");
  });
});

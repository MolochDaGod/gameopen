import { describe, expect, it } from "vitest";
import { collectKitSlotMeshes } from "./gearPresets";
import {
  effectForEquipId,
  resolveSlotEffects,
  classIdFromMeshIds,
  classTreeIdFromMeshIds,
  RELIC_SLOT_EFFECTS,
  CLASS_ITEM_EFFECTS,
  BACK_SLOT_EFFECTS,
} from "./slotEffects";

describe("Relic / Back slot effects", () => {
  it("every cycled Relic has a passive or proc spec", () => {
    const relics = collectKitSlotMeshes("western-kingdoms", "relic");
    expect(relics).toHaveLength(4);
    expect(relics.every((id) => /nature|frost|fury|void/.test(id))).toBe(true);
    for (const id of relics) {
      const spec = effectForEquipId(id);
      expect(spec, id).toBeTruthy();
      expect(spec!.slot).toBe("relic");
      expect(spec!.kinds.length).toBeGreaterThan(0);
    }
  });

  it("elemental relics proc existing StatusFx on hit", () => {
    const fury = RELIC_SLOT_EFFECTS["equip:relic:fury"]!;
    expect(fury.aura).toBe("rage");
    expect(fury.onHit?.status).toBe("burning");
    expect(fury.onHit?.chance).toBeGreaterThan(0);
  });

  it("class items are their own slot, not Relic", () => {
    const items = collectKitSlotMeshes("western-kingdoms", "classItem");
    expect(items).toEqual([
      "equip:class:warrior",
      "equip:class:ranger",
      "equip:class:mage",
      "equip:class:worge",
    ]);
    expect(CLASS_ITEM_EFFECTS["equip:class:warrior"]?.classRelicId).toBe("WARRIOR_BATTLE_FORMS");
    expect(CLASS_ITEM_EFFECTS["equip:class:ranger"]?.classRelicId).toBe("RANGER_LOG");
    expect(CLASS_ITEM_EFFECTS["equip:class:mage"]?.classRelicId).toBe("MAGE_WAND");
    expect(CLASS_ITEM_EFFECTS["equip:class:worge"]?.classRelicId).toBe("WORGE_NATURE_GRIMOIRE");
    expect(effectForEquipId("equip:relic:warrior")?.id).toBe("equip:class:warrior");
  });

  it("paperdoll Back includes windsurf, shark fin, wings, and cape variants", async () => {
    const { collectKitSlotMeshes } = await import("./gearPresets");
    const backs = collectKitSlotMeshes("western-kingdoms", "back");
    expect(backs.some((b) => /wind_surf/.test(b))).toBe(true);
    expect(backs.some((b) => /shark_fin/.test(b))).toBe(true);
    expect(backs.some((b) => /holy_wings/.test(b))).toBe(true);
    expect(backs).toContain("equip:back:traveler_wings");
    expect(backs).toContain("equip:back:traveler_wings_t2");
    expect(backs).toContain("equip:back:traveler_wings_t3");
    expect(backs.some((b) => /cape_long/.test(b))).toBe(true);
    expect(backs.some((b) => /cape_wide/.test(b))).toBe(true);
  });

  it("class item mesh_ids resolve the class tree id", () => {
    expect(classIdFromMeshIds(["equip:class:ranger", "WK_weapon_Bow"])).toBe("ranger");
    expect(classTreeIdFromMeshIds(["equip:relic:warrior"])).toBe("class-warrior");
    expect(classIdFromMeshIds(["equip:relic:nature"])).toBeNull();
  });

  it("Toon back quiver/bag/wood resolve as back passives", () => {
    const fx = resolveSlotEffects(["WK_Xtra_quiver", "WK_Xtra_bag"]);
    expect(fx.map((e) => e.id).sort()).toEqual(["back:bag", "back:quiver"].sort());
    expect(BACK_SLOT_EFFECTS["back:wood"]?.bonuses.harvest).toBeGreaterThan(0);
  });

  it("empty loadout has no slot effects", () => {
    expect(resolveSlotEffects(["WK_Units_Body_C", "WK_weapon_sword_B"])).toEqual([]);
  });
});

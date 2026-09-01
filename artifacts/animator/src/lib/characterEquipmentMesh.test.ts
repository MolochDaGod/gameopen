import { describe, expect, it } from "vitest";
import { resolveCharacterEquipmentVisualSync } from "./characterEquipmentMesh";
import type { GrudgeCharacter } from "./grudgeAuth";

function wkWarrior(extra: Partial<GrudgeCharacter> = {}): GrudgeCharacter {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Test",
    raceId: "western-kingdoms",
    classId: "warrior",
    ...extra,
  } as GrudgeCharacter;
}

describe("equipment.back hydrate", () => {
  it("merges itm_back_* onto class mesh_ids as equip:back:*", () => {
    const vis = resolveCharacterEquipmentVisualSync(
      wkWarrior({
        saveData: {
          open: {
            equipment: {
              back: { templateId: "itm_back_holy_wings", instanceId: "prov_test" },
            },
          },
        },
      }),
    );
    expect(vis.meshIds).toContain("equip:back:holy_wings");
  });

  it("replaces quiver when model3d.equipmentSlots.back is set", () => {
    const vis = resolveCharacterEquipmentVisualSync(
      wkWarrior({
        model3d: {
          meshIds: [
            "WK_Units_head_D",
            "WK_Units_Body_C",
            "WK_Units_Arms_B",
            "WK_Units_Legs_B",
            "WK_weapon_Bow",
            "WK_Xtra_quiver",
          ],
          equipmentSlots: {
            back: { templateId: "itm_back_wind_surf", instanceId: "x" },
          },
        },
      }),
    );
    expect(vis.meshIds).toContain("equip:back:wind_surf");
    expect(vis.meshIds.some((m) => /quiver/i.test(m))).toBe(false);
  });

  it("does not strip a wooden weapon when applying back", () => {
    const vis = resolveCharacterEquipmentVisualSync(
      wkWarrior({
        model3d: {
          meshIds: [
            "WK_Units_head_D",
            "WK_Units_Body_C",
            "WK_weapon_sword_B",
            "WK_Shield_B",
          ],
          equipmentSlots: {
            back: { templateId: "itm_back_cape", instanceId: "x" },
          },
        },
      }),
    );
    expect(vis.meshIds).toContain("equip:back:cape");
    expect(vis.meshIds).toContain("WK_weapon_sword_B");
    expect(vis.meshIds).toContain("WK_Shield_B");
  });
});

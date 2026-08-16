import { describe, expect, it } from "vitest";
import {
  equipmentBackFromItem,
  equipmentFromKept,
} from "./characterAppearance";
import { newCharacterBag, newItemInstance } from "./types";

describe("appearance equipment refs", () => {
  it("kept loadout does not include Back; back is a separate body ref", () => {
    const bag = newCharacterBag("char");
    bag.kept.mainHand = newItemInstance("wpn_sword_01", 1, {
      grudgeUuid: "weap-t0-0001-012501012026-000001",
    });
    const kept = equipmentFromKept(bag);
    expect(kept.mainHand?.templateId).toBe("wpn_sword_01");
    expect(kept.back).toBeUndefined();

    const back = equipmentBackFromItem(
      newItemInstance("itm_back_holy_wings", 1, {
        grudgeUuid: "back-t0-0001-012501012026-000002",
      }),
    );
    expect(back?.templateId).toBe("itm_back_holy_wings");
    expect(back?.grudgeUuid).toBe("back-t0-0001-012501012026-000002");
  });
});

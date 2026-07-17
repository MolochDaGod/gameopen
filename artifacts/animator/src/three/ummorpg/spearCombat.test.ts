import { describe, expect, it } from "vitest";
import {
  isSpearWeapon,
  SPEAR_COMBO_CLIPS,
  spearChargePlan,
  spearClipForSkillId,
  spearHotbarSkills,
  spearSkillById,
  spearSignatureRows,
} from "./spearCombat";

describe("uMMORPG spear combat", () => {
  it("detects spear family weapons", () => {
    expect(isSpearWeapon("spear")).toBe(true);
    expect(isSpearWeapon("javelin")).toBe(true);
    expect(isSpearWeapon("sword")).toBe(false);
  });

  it("maps master skill ids to Madarame polearm clips", () => {
    expect(spearClipForSkillId("spear_thrust")).toBe("attack"); // attack1_1
    expect(spearClipForSkillId("spear_lunge")).toBe("attack5"); // attack1_5
    expect(spearClipForSkillId("spear_cyclone")).toBe("skill2"); // skill2_1
    expect(spearClipForSkillId("spear_dragontail")).toBe("special");
  });

  it("hotbar is thrust · lunge · rush · dragontail", () => {
    const bar = spearHotbarSkills();
    expect(bar.map((s) => s.id)).toEqual([
      "spear_thrust",
      "spear_lunge",
      "spear_cyclone",
      "spear_dragontail",
    ]);
  });

  it("lunge (1_5) and rush (skill2_1) are gap-close charges", () => {
    const lunge = spearSkillById("spear_lunge")!;
    const rush = spearSkillById("spear_cyclone")!;
    const lp = spearChargePlan(lunge);
    const rp = spearChargePlan(rush);
    expect(lp.isGapClose).toBe(true);
    expect(lp.distance).toBeGreaterThanOrEqual(2.5);
    expect(rp.isGapClose).toBe(true);
    expect(lunge.clip).toBe("attack5");
    expect(rush.clip).toBe("skill2");
    expect(lunge.mode).toBe("dash");
    expect(rush.mode).toBe("dash");
  });

  it("signature rows carry Madarame clips for Studio", () => {
    const rows = spearSignatureRows();
    expect(rows).toHaveLength(4);
    expect(rows[0]!.clip).toBe("attack");
    expect(rows[1]!.clip).toBe("attack5");
    expect(rows[2]!.clip).toBe("skill2");
    expect(rows[1]!.mode).toBe("dash");
  });

  it("LMB combo order is 1_1 → 1_2 → 1_4 → 1_3", () => {
    expect(SPEAR_COMBO_CLIPS[0]![0]).toBe("attack");
    expect(SPEAR_COMBO_CLIPS[1]![0]).toBe("attack2");
    expect(SPEAR_COMBO_CLIPS[2]![0]).toBe("attack4");
    expect(SPEAR_COMBO_CLIPS[3]![0]).toBe("attack3");
  });
});

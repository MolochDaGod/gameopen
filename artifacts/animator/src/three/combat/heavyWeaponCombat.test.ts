import { describe, expect, it } from "vitest";
import {
  heavyProfile,
  heavySignatureRows,
  isHeavy2hWeapon,
  scaledDashM,
  scaledMm,
} from "./heavyWeaponCombat";

describe("heavy 2H combat profiles", () => {
  it("classifies greataxe hammer2h greatsword", () => {
    expect(isHeavy2hWeapon("greataxe")).toBe(true);
    expect(isHeavy2hWeapon("hammer2h")).toBe(true);
    expect(isHeavy2hWeapon("greatsword")).toBe(true);
    expect(isHeavy2hWeapon("spear")).toBe(false);
  });

  it("varies MM / intensity / timeScale per weapon", () => {
    const axe = heavyProfile("greataxe")!;
    const mace = heavyProfile("hammer2h")!;
    const gs = heavyProfile("greatsword")!;
    expect(mace.timeScale).toBeLessThan(axe.timeScale);
    expect(mace.intensity).toBeGreaterThan(gs.intensity);
    expect(gs.mmScale).toBeGreaterThan(axe.mmScale);
    expect(gs.slashProjectiles).toBe(true);
    expect(axe.slashProjectiles).toBe(false);
  });

  it("scales dash and mm", () => {
    const gs = heavyProfile("greatsword")!;
    expect(scaledMm(100, gs)).toBeGreaterThan(100);
    expect(scaledDashM(3, gs)).toBeGreaterThan(3);
  });

  it("greatsword sig rows include jump + slide + aoe", () => {
    const rows = heavySignatureRows("greatsword");
    expect(rows).toHaveLength(4);
    expect(rows[1]!.label).toMatch(/jump/i);
    expect(rows[2]!.label).toMatch(/slide/i);
    expect(rows[2]!.blasters).toBe(true);
    expect(rows[3]!.kind).toBe("nova");
  });

  it("axe/mace use Madarame combo clip stages", () => {
    const axe = heavyProfile("greataxe")!;
    expect(axe.comboClips[0][0]).toBe("attack");
    expect(axe.comboClips[2][0]).toBe("attack4");
    expect(axe.comboClips[3][0]).toBe("attack3");
  });
});

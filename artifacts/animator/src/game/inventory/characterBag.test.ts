import { describe, expect, it } from "vitest";
import {
  addToBag,
  newCharacterBag,
  assignConsumableHotkey,
  listDepositable,
  clearDepositable,
  dropCarryOnDeath,
  equipBagToKept,
  canEquipInKeptSlot,
} from "./characterBag";
import { resolveDepositContext } from "./depositZones";
import { MATERIAL_STACK_MAX } from "./types";

describe("character bag 3x3 + 2x2 kept loadout", () => {
  it("starts with 9 carry slots, starter claim flag, empty kept loadout", () => {
    const b = newCharacterBag("hero1");
    expect(b.slots).toHaveLength(9);
    expect(b.slots[0]?.item?.templateId).toBe("itm_claim_flag");
    expect(b.kept.mainHand).toBeNull();
    expect(b.kept.sideArm).toBeNull();
    expect(b.kept.mount).toBeNull();
    expect(b.kept.boat).toBeNull();
    expect(b.consumableHotkeys).toHaveLength(3);
  });

  it("stacks materials to 100 per slot", () => {
    let b = newCharacterBag("h");
    const r = addToBag(b, "wood", 150);
    expect(r.ok).toBe(true);
    expect(r.leftover).toBe(0);
    const woodSlots = r.bag.slots.filter((s) => s.item?.templateId === "wood");
    expect(woodSlots).toHaveLength(2);
    expect(woodSlots[0]!.item!.qty).toBe(MATERIAL_STACK_MAX);
    expect(woodSlots[1]!.item!.qty).toBe(50);
  });

  it("fills multiple stacks (remaining free slots × 100)", () => {
    let b = newCharacterBag("h");
    // Slot 0 is starter claim flag → 8 free stacks → 800 stone max
    const r = addToBag(b, "stone", 950);
    expect(r.leftover).toBe(150);
    const qty = r.bag.slots
      .filter((s) => s.item?.templateId === "stone")
      .reduce((n, s) => n + (s.item?.qty ?? 0), 0);
    expect(qty).toBe(800);
  });

  it("assigns J/H/V utility hotkey (consumable or deployable)", () => {
    let b = newCharacterBag("h");
    b = addToBag(b, "itm_ration_01", 5).bag;
    const rationIdx = b.slots.findIndex((s) => s.item?.templateId === "itm_ration_01");
    expect(rationIdx).toBeGreaterThanOrEqual(0);
    b = assignConsumableHotkey(b, rationIdx, 0);
    expect(b.consumableHotkeys[0]?.templateId).toBe("itm_ration_01");
    // Claim flag (slot 0) can bind to H
    b = assignConsumableHotkey(b, 0, 1);
    expect(b.consumableHotkeys[1]?.templateId).toBe("itm_claim_flag");
  });

  it("lists and clears depositable materials", () => {
    let b = newCharacterBag("h");
    b = addToBag(b, "wood", 10).bag;
    b = addToBag(b, "itm_ration_01", 2).bag;
    const dep = listDepositable(b);
    expect(dep.length).toBeGreaterThan(0);
    b = clearDepositable(b);
    expect(listDepositable(b)).toHaveLength(0);
  });
});

describe("deposit zones", () => {
  it("illuminates on claim", () => {
    const c = resolveDepositContext({
      x: 0,
      y: 0,
      z: 0,
      insideClaim: true,
    });
    expect(c.canDeposit).toBe(true);
    expect(c.zone).toBe("claim");
  });
});

describe("death drop + loadout", () => {
  it("empties 3×3 on death but keeps loadout", () => {
    let b = newCharacterBag("h");
    b = addToBag(b, "wood", 40).bag;
    b = addToBag(b, "wpn_sword_01", 1).bag;
    const swordIdx = b.slots.findIndex((s) => s.item?.templateId === "wpn_sword_01");
    expect(swordIdx).toBeGreaterThanOrEqual(0);
    const eq = equipBagToKept(b, swordIdx, "mainHand");
    expect(eq.ok).toBe(true);
    b = eq.bag;
    expect(b.kept.mainHand?.templateId).toBe("wpn_sword_01");
    expect(countWood(b)).toBe(40);

    const { bag: after, dropped } = dropCarryOnDeath(b);
    expect(after.slots.every((s) => s.item === null)).toBe(true);
    expect(after.kept.mainHand?.templateId).toBe("wpn_sword_01");
    expect(dropped.some((d) => d.templateId === "wood")).toBe(true);
  });

  it("accepts side arm weapons and shields", () => {
    expect(canEquipInKeptSlot("sideArm", "wpn_bow_01")).toBe(true);
    expect(canEquipInKeptSlot("sideArm", "arm_shield_01")).toBe(true);
    expect(canEquipInKeptSlot("mainHand", "wpn_sword_01")).toBe(true);
    expect(canEquipInKeptSlot("mount", "itm_mount_horse_01")).toBe(true);
    expect(canEquipInKeptSlot("boat", "itm_boat_skiff_01")).toBe(true);
    expect(canEquipInKeptSlot("mainHand", "wood")).toBe(false);
  });
});

function countWood(b: ReturnType<typeof newCharacterBag>): number {
  return b.slots
    .filter((s) => s.item?.templateId === "wood")
    .reduce((n, s) => n + (s.item?.qty ?? 0), 0);
}

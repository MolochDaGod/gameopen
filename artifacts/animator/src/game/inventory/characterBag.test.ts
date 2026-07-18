import { describe, expect, it } from "vitest";
import {
  addToBag,
  newCharacterBag,
  removeFromSlot,
  assignConsumableHotkey,
  listDepositable,
  clearDepositable,
} from "./characterBag";
import { resolveDepositContext } from "./depositZones";
import { MATERIAL_STACK_MAX } from "./types";

describe("character bag 3x3", () => {
  it("starts with 9 empty slots", () => {
    const b = newCharacterBag("hero1");
    expect(b.slots).toHaveLength(9);
    expect(b.slots.every((s) => s.item === null)).toBe(true);
  });

  it("stacks materials to 100 per slot", () => {
    let b = newCharacterBag("h");
    const r = addToBag(b, "wood", 150);
    expect(r.ok).toBe(true);
    expect(r.leftover).toBe(0);
    const filled = r.bag.slots.filter((s) => s.item);
    expect(filled).toHaveLength(2);
    expect(filled[0]!.item!.qty).toBe(MATERIAL_STACK_MAX);
    expect(filled[1]!.item!.qty).toBe(50);
  });

  it("fills multiple stacks (9 slots × 100)", () => {
    let b = newCharacterBag("h");
    // 250 fits in 3 stacks of 100 (leftover 0); 950 fills 9 slots leftover 50
    const r = addToBag(b, "stone", 950);
    expect(r.leftover).toBe(50);
    const qty = r.bag.slots
      .filter((s) => s.item?.templateId === "stone")
      .reduce((n, s) => n + (s.item?.qty ?? 0), 0);
    expect(qty).toBe(900);
  });

  it("assigns consumable hotkey", () => {
    let b = newCharacterBag("h");
    b = addToBag(b, "itm_ration_01", 5).bag;
    b = assignConsumableHotkey(b, 0, 0);
    expect(b.consumableHotkeys[0]?.templateId).toBe("itm_ration_01");
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

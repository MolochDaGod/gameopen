import { describe, expect, it } from "vitest";
import {
  numericItemId,
  slotLabelForTemplate,
  tierForTemplate,
} from "./ledgerClient";
import {
  isLedgerUniqueTemplate,
  isStackableTemplate,
  newItemInstance,
} from "./types";

describe("ledger unique vs stack", () => {
  it("weapons/armor are ledger-unique; wood is stackable", () => {
    expect(isLedgerUniqueTemplate("wpn_sword_01")).toBe(true);
    expect(isLedgerUniqueTemplate("arm_shield_01")).toBe(true);
    expect(isStackableTemplate("wood")).toBe(true);
    expect(isLedgerUniqueTemplate("wood")).toBe(false);
  });

  it("newItemInstance does not use ent_ entity ids for production shape", () => {
    const stack = newItemInstance("wood", 5);
    expect(stack.instanceId).toBe("stack_wood");
    expect(stack.provisional).toBe(false);
    expect(stack.grudgeUuid).toBeUndefined();

    const sword = newItemInstance("wpn_sword_01", 1);
    expect(sword.provisional).toBe(true);
    expect(sword.instanceId.startsWith("prov_")).toBe(true);
    expect(sword.grudgeUuid).toBeUndefined();
  });

  it("ledgered extra.grudgeUuid clears provisional", () => {
    const sword = newItemInstance("wpn_sword_01", 1, {
      grudgeUuid: "weap-t0-0001-012501012026-000001",
    });
    expect(sword.provisional).toBe(false);
    expect(sword.grudgeUuid).toBe("weap-t0-0001-012501012026-000001");
    expect(sword.instanceId).toBe("weap-t0-0001-012501012026-000001");
  });
});

describe("ledgerClient helpers", () => {
  it("maps weapon templates to slot labels", () => {
    expect(slotLabelForTemplate("wpn_sword_01")).toBe("Weapon");
    expect(slotLabelForTemplate("arm_shield_01")).toBe("Shield");
  });

  it("stable numeric item ids", () => {
    expect(numericItemId("wpn_sword_01")).toBe(numericItemId("wpn_sword_01"));
    expect(numericItemId("wpn_sword_01")).toBeGreaterThan(0);
    expect(numericItemId("wpn_sword_01")).toBeLessThanOrEqual(9999);
  });

  it("reads weapon tier", () => {
    expect(tierForTemplate("wpn_flintlock_t0")).toBe(0);
  });
});

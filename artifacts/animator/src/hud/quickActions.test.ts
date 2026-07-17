import { describe, expect, it } from "vitest";
import {
  COMBAT_KEY_LEGEND,
  QUICK_ACTIONS,
  QUICK_SLOT_COUNT,
  clampQuickSlots,
  defaultQuickSlots,
  leftWingSlots,
  rightWingSlots,
} from "./quickActions";

describe("quickActions SSOT", () => {
  it("ships exactly 12 wing slots (6+6)", () => {
    const slots = defaultQuickSlots();
    expect(slots).toHaveLength(QUICK_SLOT_COUNT);
    expect(leftWingSlots(slots)).toHaveLength(6);
    expect(rightWingSlots(slots)).toHaveLength(6);
  });

  it("keeps mode on Q and parry on C (not swapped)", () => {
    expect(QUICK_ACTIONS.mode.key).toBe("Q");
    expect(QUICK_ACTIONS.parry.key).toBe("C");
    expect(QUICK_ACTIONS.dodge.key).toBe("X");
    expect(QUICK_ACTIONS.block.key).toBe("RMB");
  });

  it("legend mentions mode + parry + dodge", () => {
    expect(COMBAT_KEY_LEGEND).toMatch(/Q mode/i);
    expect(COMBAT_KEY_LEGEND).toMatch(/C parry/i);
    expect(COMBAT_KEY_LEGEND).toMatch(/X dodge/i);
  });

  it("clampQuickSlots pads and sanitizes", () => {
    expect(clampQuickSlots(["primary", "nope"])).toEqual([
      "primary",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

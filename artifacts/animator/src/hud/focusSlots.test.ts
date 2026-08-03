import { describe, expect, it } from "vitest";
import {
  clampFocusSlots,
  defaultFocusSlots,
  defaultQuickSlots,
  focusOverrideMap,
  QUICK_SLOT_COUNT,
} from "./quickActions";

describe("defaultFocusSlots", () => {
  it("is all-empty (layer off by default)", () => {
    const s = defaultFocusSlots();
    expect(s).toHaveLength(QUICK_SLOT_COUNT);
    expect(s.every((v) => v === null)).toBe(true);
  });
});

describe("clampFocusSlots", () => {
  it("falls back to all-empty (not the default loadout) when missing", () => {
    expect(clampFocusSlots(undefined).every((v) => v === null)).toBe(true);
    expect(clampFocusSlots("junk").every((v) => v === null)).toBe(true);
  });

  it("nulls unknown ids and pads/truncates to the slot count", () => {
    const out = clampFocusSlots(["fskill", "nope", null]);
    expect(out).toHaveLength(QUICK_SLOT_COUNT);
    expect(out[0]).toBe("fskill");
    expect(out[1]).toBeNull();
    expect(out[2]).toBeNull();
  });
});

describe("focusOverrideMap", () => {
  it("is empty when no focus bindings exist", () => {
    expect(focusOverrideMap(defaultQuickSlots(), defaultFocusSlots())).toEqual({});
  });

  it("maps base → focus only for slots with both bound", () => {
    const quick = defaultQuickSlots(); // slot 1 = fskill, slot 6 = heavy
    const focus = defaultFocusSlots();
    focus[1] = "heal";
    focus[6] = "sig4";
    focus[3] = null; // untouched
    expect(focusOverrideMap(quick, focus)).toEqual({ fskill: "heal", heavy: "sig4" });
  });

  it("skips identity bindings and empty base slots", () => {
    const quick = defaultQuickSlots();
    const focus = defaultFocusSlots();
    focus[1] = "fskill"; // same as base — pointless
    quick[2] = null;
    focus[2] = "bomb"; // no base action to override
    expect(focusOverrideMap(quick, focus)).toEqual({});
  });

  it("first slot wins when the same base action appears twice", () => {
    const quick = defaultQuickSlots();
    quick[0] = "fskill";
    quick[1] = "fskill";
    const focus = defaultFocusSlots();
    focus[0] = "heal";
    focus[1] = "bomb";
    expect(focusOverrideMap(quick, focus)).toEqual({ fskill: "heal" });
  });
});

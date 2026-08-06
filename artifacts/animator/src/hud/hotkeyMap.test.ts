import { describe, expect, it } from "vitest";
import { COMBAT_KEY_LEGEND_V2, HOTKEY_GROUPS, HUD_KEY_CHIPS } from "./hotkeyMap";
import { COMBAT_KEY_LEGEND } from "./quickActions";

describe("hotkeyMap SSOT", () => {
  it("includes F1 help chip", () => {
    expect(HUD_KEY_CHIPS.some((c) => c.key === "F1")).toBe(true);
  });

  it("has combat and vfx groups", () => {
    const ids = HOTKEY_GROUPS.map((g) => g.id);
    expect(ids).toContain("combat");
    expect(ids).toContain("vfx");
    expect(ids).toContain("camera");
  });

  it("legend variants mention F1", () => {
    expect(COMBAT_KEY_LEGEND_V2).toMatch(/F1/i);
    expect(COMBAT_KEY_LEGEND).toMatch(/F1/i);
  });

  it("documents Alt+VFX so combat keys stay free", () => {
    const vfx = HOTKEY_GROUPS.find((g) => g.id === "vfx");
    expect(vfx?.entries.some((e) => e.keys.startsWith("Alt+"))).toBe(true);
  });
});

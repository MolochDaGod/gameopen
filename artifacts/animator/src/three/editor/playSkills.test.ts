import { describe, expect, it } from "vitest";
import { skillsForGroup } from "./playSkills";

describe("playSkills", () => {
  it("has no emoji glyphs and leaves Whirlwind named Whirlwind", () => {
    const all = (["unarmed", "melee-1h", "melee-2h", "off-hand", "ranged", "magic"] as const)
      .flatMap((g) => skillsForGroup(g));
    expect(all.some((s) => s.label === "Whirlwind")).toBe(true);
    for (const s of all) {
      expect(s.iconUrl == null || s.iconUrl === "").toBe(true);
      expect(JSON.stringify(s)).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });
});

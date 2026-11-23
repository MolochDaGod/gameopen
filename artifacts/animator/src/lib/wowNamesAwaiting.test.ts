import { describe, expect, it } from "vitest";
import { WOW_NAMES_AWAITING } from "./wowNamesAwaiting";
import { skillsForGroup } from "../three/editor/playSkills";

describe("WoW names awaiting Jonathan", () => {
  it("lists Whirlwind, Hellfire and Smite and does not rename them", () => {
    const names = WOW_NAMES_AWAITING.map((e) => e.name);
    expect(names).toEqual(["Whirlwind", "Hellfire", "Smite"]);
    expect(skillsForGroup("melee-1h").some((s) => s.label === "Whirlwind")).toBe(true);
  });
});

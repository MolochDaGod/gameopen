import { describe, expect, it } from "vitest";
import {
  DRC_DEFAULT_AVATAR_ID,
  DRC_SURFACE_MATRIX,
  drcSpecForMode,
  isBip001CombatMode,
} from "./drcSurfaceContract";

describe("drcSurfaceContract", () => {
  it("lists core combat modes as bip001 + studio controller", () => {
    for (const mode of ["danger", "play", "brawl", "survival", "mimic"] as const) {
      expect(isBip001CombatMode(mode), mode).toBe(true);
      const s = drcSpecForMode(mode);
      expect(s?.character).toBe("grudge6-runtime");
      expect(s?.usesStudioController).toBe(true);
    }
  });

  it("default avatar is grudge6 not explorer", () => {
    expect(DRC_DEFAULT_AVATAR_ID.startsWith("grudge:")).toBe(true);
    expect(DRC_DEFAULT_AVATAR_ID).not.toContain("explorer");
  });

  it("matrix has unique modes", () => {
    const modes = DRC_SURFACE_MATRIX.map((s) => s.mode);
    expect(new Set(modes).size).toBe(modes.length);
  });

  it("library has no combat controller", () => {
    expect(drcSpecForMode("doors")?.usesStudioController).toBe(false);
  });
});

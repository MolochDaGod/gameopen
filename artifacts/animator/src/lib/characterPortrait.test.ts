import { describe, expect, it } from "vitest";
import {
  fleetRaceToPaper,
  isVoxelCharacter,
  resolveCharacterPortrait,
} from "./characterPortrait";
import type { GrudgeCharacter } from "./grudgeAuth";

describe("characterPortrait", () => {
  it("maps fleet races to paper stems", () => {
    expect(fleetRaceToPaper("human")).toBe("human");
    expect(fleetRaceToPaper("western-kingdoms")).toBe("human");
    expect(fleetRaceToPaper("orc")).toBe("orc");
    expect(fleetRaceToPaper("high-elves")).toBe("elf");
  });

  it("detects voxel / cube-head characters", () => {
    expect(
      isVoxelCharacter({
        id: "1",
        name: "Vox",
        model3d: { renderPipeline: "sprite2d" },
      }),
    ).toBe(true);
    expect(
      isVoxelCharacter({
        id: "2",
        name: "Cube",
        config: { avatarId: "avatar-head-01" },
      }),
    ).toBe(true);
    expect(
      isVoxelCharacter({
        id: "3",
        name: "Knight",
        raceId: "human",
        classId: "knight",
      }),
    ).toBe(false);
  });

  it("prefers DB avatarUrl over race PNG", () => {
    const ch: GrudgeCharacter = {
      id: "c1",
      name: "Hero",
      raceId: "orc",
      classId: "warrior",
      avatarUrl: "https://cdn.example.com/heroes/c1.png",
    };
    const p = resolveCharacterPortrait(ch);
    expect(p.url).toBe("https://cdn.example.com/heroes/c1.png");
    expect(p.kind).toBe("db-avatar");
    expect(p.paperRace).toBe("orc");
  });

  it("uses race-class candidates for warlords-style heroes", () => {
    const p = resolveCharacterPortrait({
      id: "c2",
      name: "WK",
      raceId: "western-kingdoms",
      classId: "knight",
    });
    expect(p.isVoxel).toBe(false);
    expect(p.candidates.some((u) => u.includes("human_knight") || u.includes("human"))).toBe(
      true,
    );
    expect(p.url.length).toBeGreaterThan(0);
  });

  it("routes voxel characters to voxel-head paths", () => {
    const p = resolveCharacterPortrait({
      id: "c3",
      name: "Blocky",
      raceId: "human",
      saveData: { open: { kind: "voxel" } },
    });
    expect(p.isVoxel).toBe(true);
    expect(
      p.url.includes("voxel") || p.candidates.some((u) => u.includes("voxel")),
    ).toBe(true);
  });
});

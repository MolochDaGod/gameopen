import { describe, expect, it } from "vitest";
import {
  buildVoxelCampfireHeroes,
  isVoxelExplorerHero,
} from "./grudoxRoster";
import type { GrudgeCharacter } from "./grudgeAuth";

describe("voxel campfire roster", () => {
  it("accepts era=voxel and explorer pipeline", () => {
    expect(
      isVoxelExplorerHero({
        id: "a",
        name: "A",
        gameEra: "voxel",
      }),
    ).toBe(true);
    expect(
      isVoxelExplorerHero({
        id: "b",
        name: "B",
        config: { baseId: "explorer", renderPipeline: "voxel" },
      }),
    ).toBe(true);
    expect(
      isVoxelExplorerHero({
        id: "c",
        name: "Warlord",
        gameEra: "warlords",
        raceId: "human",
      }),
    ).toBe(false);
  });

  it("fills seats from voxel fleet only", () => {
    const fleet: GrudgeCharacter[] = [
      { id: "w1", name: "Knight", gameEra: "warlords" },
      { id: "v1", name: "Scout", gameEra: "voxel", slotIndex: 1, config: { baseId: "explorer" } },
      { id: "v0", name: "Ash", gameEra: "voxel", slotIndex: 0, config: { baseId: "explorer" } },
    ];
    const seats = buildVoxelCampfireHeroes(fleet);
    expect(seats.map((s) => s.id)).toEqual(["v0", "v1"]);
    expect(seats.every((s) => s.baseId === "explorer")).toBe(true);
  });
});

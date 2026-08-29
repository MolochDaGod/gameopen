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
  it("keeps account UUIDs in their slot (holes stay empty)", () => {
    const fleet: GrudgeCharacter[] = [
      { id: "w1", name: "Knight", gameEra: "warlords" },
      { id: "v1", name: "Scout", gameEra: "voxel", slotIndex: 1, config: { baseId: "explorer" } },
      { id: "v0", name: "Ash", gameEra: "voxel", slotIndex: 0, config: { baseId: "explorer" } },
    ];
    const seats = buildVoxelCampfireHeroes(fleet);
    expect(seats.map((s) => s.id)).toEqual(["v0", "v1"]);
    expect(seats.every((s) => s.baseId === "explorer")).toBe(true);
    expect(seats).toHaveLength(4);
    expect(seats[0]?.id).toBe("v0");
    expect(seats[1]?.id).toBe("v1");
    expect(seats[2]).toBeNull();
    expect(seats[3]).toBeNull();
    expect(seats.filter(Boolean).every((s) => s!.baseId === "explorer")).toBe(true);
  });

  it("keeps each UUID voxelLook on its own seat", () => {
    const fleet: GrudgeCharacter[] = [
      {
        id: "uuid-a",
        name: "Ash",
        gameEra: "voxel",
        slotIndex: 2,
        saveData: { open: { voxelLook: { skin: "#111111", shirt: "#222222" } } },
      },
      {
        id: "uuid-b",
        name: "Bram",
        gameEra: "voxel",
        slotIndex: 0,
        saveData: { open: { voxelLook: { skin: "#abcdef", shirt: "#fedcba" } } },
      },
    ];
    const seats = buildVoxelCampfireHeroes(fleet);
    expect(seats[0]?.id).toBe("uuid-b");
    expect(seats[0]?.voxelLook?.skin).toBe("#abcdef");
    expect(seats[2]?.id).toBe("uuid-a");
    expect(seats[2]?.voxelLook?.skin).toBe("#111111");
    expect(seats[0]?.voxelLook).not.toEqual(seats[2]?.voxelLook);
  });
});

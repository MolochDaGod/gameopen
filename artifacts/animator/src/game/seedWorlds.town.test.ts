import { describe, expect, it } from "vitest";
import {
  buildSeedDeployment,
  DEFAULT_EXPLORER_STARTING_TOWN,
  deploymentToScene,
  EXPLORER_STARTING_TOWN_CHUNK,
  listPremadeVoxelMaps,
} from "@workspace/voxel-canonical";
import { catalogEntryToDeployment, customSeedDeployment } from "./seedWorlds";

describe("explorer starting town + seed", () => {
  it("reviews premade voxel maps including the lobby spawn hub", () => {
    const maps = listPremadeVoxelMaps();
    expect(maps.some((m) => m.id === "amidaFarmCamp" && m.role === "starting_town")).toBe(true);
    const lobby = maps.find((m) => m.id === EXPLORER_STARTING_TOWN_CHUNK);
    expect(lobby?.role).toBe("lobby");
    expect(lobby?.source).toBe("map_chunk");
  });

  it("stamps Animal Company lobby as starting town on the explorer deployment", () => {
    const dep = catalogEntryToDeployment({
      id: "mapchunk-animal-company-lobby",
      name: "Animal Company Lobby",
      blurb: "town",
      seed: "explorer-town",
      chunkIdx: 5,
      biome: "plains",
      deploy: "both",
      mapChunkId: EXPLORER_STARTING_TOWN_CHUNK,
    });
    expect(dep.world.startingTown?.mapChunkId).toBe(EXPLORER_STARTING_TOWN_CHUNK);
    expect(dep.world.startingTown?.templateId).toBe(DEFAULT_EXPLORER_STARTING_TOWN.templateId);
    const scene = deploymentToScene(dep);
    expect((scene.map as { startingTown?: { mapChunkId: string } }).startingTown?.mapChunkId).toBe(
      EXPLORER_STARTING_TOWN_CHUNK,
    );
    expect(scene.triggers.some((t) => t.kind === "portal")).toBe(true);
  });

  it("typed Minecraft-style seeds still start in the town", () => {
    const a = customSeedDeployment("alpha-42");
    const b = customSeedDeployment("alpha-42");
    const c = customSeedDeployment("beta-99");
    expect(a.world.startingTown?.mapChunkId).toBe(EXPLORER_STARTING_TOWN_CHUNK);
    expect(a.portals.map((p) => p.position)).toEqual(b.portals.map((p) => p.position));
    expect(a.portals[0]!.position).not.toEqual(c.portals[0]!.position);
    expect(buildSeedDeployment({ id: "x", name: "x", seed: "alpha-42" }).world.seedNumber).toBe(
      a.world.seedNumber,
    );
  });
});

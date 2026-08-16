import { describe, expect, it } from "vitest";
import {
  buildSeedDeployment,
  DEFAULT_EXPLORER_STARTING_TOWN,
  deploymentToScene,
  evaluateAssetRole,
  EXPLORER_STARTING_TOWN_CHUNK,
  listPremadeVoxelMaps,
  resolveSeedPrefabMapChunk,
  SEED_FALLBACK_PREFAB_CHUNK,
} from "@workspace/voxel-canonical";
import { catalogEntryToDeployment, customSeedDeployment } from "./seedWorlds";
import { assembleSeedOverworldMap, explorerTownDeployment } from "../three/voxel/seedOverworldPlay";
import { assemblePortalDungeonMap } from "../three/voxel/portalDungeonPlay";
import { dungeonTemplateForTheme, SHADER_LAB_CAVE_TEMPLATE } from "@workspace/voxel-canonical";

describe("explorer starting town + seed", () => {
  it("reviews premade voxel maps including the lobby spawn hub", () => {
    const maps = listPremadeVoxelMaps();
    expect(maps.some((m) => m.id === "explorerStartingTown" && m.role === "starting_town")).toBe(true);
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
    expect(a.world.mapChunkId).toBe(SEED_FALLBACK_PREFAB_CHUNK);
    expect(resolveSeedPrefabMapChunk({})).toBe(SEED_FALLBACK_PREFAB_CHUNK);
    expect(
      resolveSeedPrefabMapChunk({
        mapChunkId: EXPLORER_STARTING_TOWN_CHUNK,
        usedMapChunkIds: [EXPLORER_STARTING_TOWN_CHUNK],
      }),
    ).toBe(SEED_FALLBACK_PREFAB_CHUNK);
    const street = evaluateAssetRole({
      name: "wolf_street.glb",
      fileBytes: 92_270_532,
      bounds: { x: 80, y: 20, z: 40 },
    });
    expect(street.role).toBe("map_chunk");
    expect(street.forbidPropHeightFit).toBe(true);
    expect(a.portals.map((p) => p.position)).toEqual(b.portals.map((p) => p.position));
    expect(a.portals[0]!.position).not.toEqual(c.portals[0]!.position);
    expect(buildSeedDeployment({ id: "x", name: "x", seed: "alpha-42" }).world.seedNumber).toBe(
      a.world.seedNumber,
    );
  });

  it("assembles a voxel-playable map with the real lobby chunk and chunked heights", () => {
    const map = assembleSeedOverworldMap(explorerTownDeployment("explorer-town"));
    expect(map.play?.kind).toBe("seed-overworld");
    expect(map.play?.mapChunkId).toBe(EXPLORER_STARTING_TOWN_CHUNK);
    expect(map.play?.hubRadius).toBeGreaterThan(0);
    expect(map.play?.heights.length).toBe(map.play!.width * map.play!.depth);
    expect(map.play!.heights.length).toBeGreaterThan(32 * 32);
    expect(map.deployables.some((d) => d.kind === "start")).toBe(true);
    expect(map.blocks.some((b) => b.type === "diamond")).toBe(true);
    const hubIdx =
      (0 - map.play!.minZ) * map.play!.width + (0 - map.play!.minX);
    expect(map.play!.heights[hubIdx]).toBe(0);
  });

  it("routes mine/cave portals into the Shader.lab voxel cave with an end room", () => {
    expect(dungeonTemplateForTheme("mine")).toBe(SHADER_LAB_CAVE_TEMPLATE);
    const dep = explorerTownDeployment("explorer-town");
    const mine = dep.portals.find((p) => p.dungeon.theme === "mine");
    expect(mine?.dungeon.templateId).toBe(SHADER_LAB_CAVE_TEMPLATE);
    const cave = assemblePortalDungeonMap({
      seed: mine?.dungeon.seed ?? 1,
      templateId: SHADER_LAB_CAVE_TEMPLATE,
      theme: "mine",
    });
    expect(cave.dungeon).toBe(true);
    expect(cave.blocks.length).toBeGreaterThan(200);
    expect(cave.deployables.some((d) => d.kind === "start")).toBe(true);
    expect(cave.deployables.some((d) => d.kind === "npc" && d.difficulty === "elite")).toBe(true);
    const maxZ = Math.max(...cave.blocks.map((b) => b.z));
    expect(maxZ).toBeGreaterThan(30);
  });
});

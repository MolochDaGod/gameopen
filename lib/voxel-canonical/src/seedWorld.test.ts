import { describe, expect, it } from "vitest";
import {
  buildSeedDeployment,
  clampChunkIdx,
  chunkBlocks,
  CHUNK_IDX_MAX,
  DEFAULT_CHUNK_IDX,
  DEFAULT_EXPLORER_STARTING_TOWN,
  resolveSeedPrefabMapChunk,
  SEED_FALLBACK_PREFAB_CHUNK,
  deploymentToScene,
  EXPLORER_STARTING_TOWN_CHUNK,
  hashSeed,
  listPremadeVoxelMaps,
  placePortalsFromSeed,
  portalsToTriggers,
} from "./seedWorld";

describe("seedWorld", () => {
  it("clamps chunkIdx to Mine-Loader CHUNK_SIZES (0..7)", () => {
    expect(clampChunkIdx(8)).toBe(CHUNK_IDX_MAX);
    expect(clampChunkIdx(9)).toBe(CHUNK_IDX_MAX);
    expect(clampChunkIdx(-1)).toBe(0);
    expect(clampChunkIdx(undefined)).toBe(DEFAULT_CHUNK_IDX);
    expect(chunkBlocks(5)).toBe(256);
    expect(chunkBlocks(7)).toBe(1024);
    expect(chunkBlocks(99)).toBe(1024);
  });

  it("hashes string seeds stably", () => {
    expect(hashSeed("grudge-plains")).toBe(hashSeed("grudge-plains"));
    expect(hashSeed("grudge-plains")).not.toBe(hashSeed("grudge-desert"));
  });

  it("places the same portals for the same seed", () => {
    const a = placePortalsFromSeed(0x5ed1ec75, { portalCount: 4 }, "t");
    const b = placePortalsFromSeed(0x5ed1ec75, { portalCount: 4 }, "t");
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
    expect(a[0]!.dungeon.kind).toBe("dungeon");
    expect(a[0]!.dungeon.returnToPortal).toBe(true);
  });

  it("places different portals for different seeds", () => {
    const a = placePortalsFromSeed(1, { portalCount: 3 }, "t");
    const b = placePortalsFromSeed(2, { portalCount: 3 }, "t");
    expect(a[0]!.position).not.toEqual(b[0]!.position);
  });

  it("builds deployment scene with portal triggers", () => {
    const dep = buildSeedDeployment({
      id: "test-plains",
      name: "Test Plains",
      seed: "alpha-plains",
      chunkIdx: 99,
      portalPlan: { portalCount: 3 },
    });
    expect(dep.format).toBe("grudge.seed-world.v1");
    expect(dep.world.chunkIdx).toBe(CHUNK_IDX_MAX);
    expect(dep.portals).toHaveLength(3);

    const scene = deploymentToScene(dep);
    expect(scene.spawn).toEqual({ x: 0, y: 2, z: 0 });
    const portals = scene.triggers.filter((t) => t.kind === "portal");
    expect(portals).toHaveLength(3);
    expect((portals[0] as { target?: { type?: string } }).target?.type).toBe("dungeon");

    const markers = portalsToTriggers(dep.portals);
    expect(markers[0]!.kind).toBe("portal");
  });

  it("reviews premade maps and marks Animal Company lobby as spawn hub", () => {
    const maps = listPremadeVoxelMaps();
    expect(maps.some((m) => m.id === "explorerStartingTown" && m.source === "template")).toBe(true);
    expect(maps.some((m) => m.id === "amidaFarmCamp" && m.source === "template")).toBe(true);
    const lobby = maps.find((m) => m.id === EXPLORER_STARTING_TOWN_CHUNK);
    expect(lobby?.source).toBe("map_chunk");
    expect(lobby?.role).toBe("lobby");
  });

  it("uses Wolf Street when a seed has no map or would duplicate another", () => {
    expect(resolveSeedPrefabMapChunk({})).toBe(SEED_FALLBACK_PREFAB_CHUNK);
    expect(
      resolveSeedPrefabMapChunk({ mapChunkId: EXPLORER_STARTING_TOWN_CHUNK }),
    ).toBe(EXPLORER_STARTING_TOWN_CHUNK);
    expect(
      resolveSeedPrefabMapChunk({
        mapChunkId: EXPLORER_STARTING_TOWN_CHUNK,
        usedMapChunkIds: [EXPLORER_STARTING_TOWN_CHUNK],
      }),
    ).toBe(SEED_FALLBACK_PREFAB_CHUNK);
    const empty = buildSeedDeployment({ id: "seed-empty", name: "Empty", seed: "no-map" });
    expect(empty.world.mapChunkId).toBe(SEED_FALLBACK_PREFAB_CHUNK);
  });

  it("stamps explorer starting town on the lobby map chunk + seed scene", () => {
    const dep = buildSeedDeployment({
      id: "mapchunk-animal-company-lobby",
      name: "Animal Company Lobby",
      seed: "explorer-town",
      mapChunkId: EXPLORER_STARTING_TOWN_CHUNK,
    });
    expect(dep.world.startingTown?.mapChunkId).toBe(EXPLORER_STARTING_TOWN_CHUNK);
    expect(dep.world.startingTown?.templateId).toBe(
      DEFAULT_EXPLORER_STARTING_TOWN.templateId,
    );
    const scene = deploymentToScene(dep);
    expect((scene.map as { startingTown?: { mapChunkId: string } }).startingTown?.mapChunkId).toBe(
      EXPLORER_STARTING_TOWN_CHUNK,
    );
    expect(scene.spawn).toEqual({ x: 0, y: 2, z: 0 });
  });
});

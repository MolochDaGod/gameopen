/**
 * Assemble a playable VoxelMap: real starting-town map chunk + chunked seed terrain.
 *
 * Extends seedWorld / MAP_CHUNKS — does not invent a second engine.
 * 1 block = 1 m. Town mesh via loadMapChunk (never prop height-fit).
 */
import {
  buildSeedDeployment,
  colorForBlockType,
  deploymentToScene,
  EXPLORER_ENCAMPMENT_CHUNK,
  EXPLORER_ENCAMPMENT_DEPLOYMENT,
  EXPLORER_STARTING_TOWN_CHUNK,
  EXPLORER_STARTING_TOWN_DEPLOYMENT,
  EXPLORER_STARTING_TOWN_TEMPLATE,
  generateSeedTerrain,
  resolveSeedPrefabMapChunk,
  heightAtCell,
  type SeedTerrainField,
  type SeedWorldDeployment,
  type TerrainBlockId,
} from "@workspace/voxel-canonical";
import { buildAmidaFarmBlocks } from "./amidaFields";
import type { BlockData, SeedOverworldPlay, VoxelMap } from "./types";
import { VOXEL_MAP_VERSION } from "./types";

export function explorerEncampmentDeployment(
  seed: string | number = "encampment-start",
): SeedWorldDeployment {
  return buildSeedDeployment({
    id: EXPLORER_ENCAMPMENT_DEPLOYMENT,
    name: "Grudges Encament",
    blurb: "Encament village + chunked seed wilderness — campfire explorer play start.",
    seed,
    chunkIdx: 5,
    biome: "plains",
    featured: true,
    deploy: "both",
    mapChunkId: EXPLORER_ENCAMPMENT_CHUNK,
    startingTown: {
      mapChunkId: EXPLORER_ENCAMPMENT_CHUNK,
      templateId: EXPLORER_STARTING_TOWN_TEMPLATE,
      spawn: { x: 0, y: 2, z: 0 },
    },
  });
}

export function assembleEncampmentPlayMap(): VoxelMap {
  return assembleSeedOverworldMap(explorerEncampmentDeployment());
}

export function assembleStartingLobbyPlayMap(): VoxelMap {
  return assembleSeedOverworldMap(explorerTownDeployment());
}

export function explorerTownDeployment(seed: string | number = "explorer-town"): SeedWorldDeployment {
  return buildSeedDeployment({
    id: EXPLORER_STARTING_TOWN_DEPLOYMENT,
    name: "Explorer Starting Town",
    blurb: "Animal Company lobby + chunked seed wilderness + dungeon portals.",
    seed,
    chunkIdx: 5,
    biome: "plains",
    featured: true,
    deploy: "both",
    mapChunkId: EXPLORER_STARTING_TOWN_CHUNK,
  });
}

function fieldToPlay(field: SeedTerrainField, mapChunkId?: string, templateId?: string): SeedOverworldPlay {
  return {
    kind: "seed-overworld",
    seed: field.seed,
    biome: field.biome,
    mapChunkId,
    templateId,
    hubRadius: field.hubRadius,
    minX: field.minX,
    maxX: field.maxX,
    minZ: field.minZ,
    maxZ: field.maxZ,
    width: field.width,
    depth: field.depth,
    heights: Array.from(field.heights),
    types: field.types.slice(),
  };
}

function overlayBlock(x: number, y: number, z: number, type: TerrainBlockId): BlockData {
  return {
    x,
    y,
    z,
    shape: "block",
    color: colorForBlockType(type),
    rotation: 0,
    type,
  };
}

/** Portal beacons + spawn pad from the seed scene, Y snapped to generated surface. */
function overlayFromDeployment(
  dep: SeedWorldDeployment,
  field: SeedTerrainField,
): BlockData[] {
  const scene = deploymentToScene(dep);
  const blocks: BlockData[] = [];
  const seen = new Set<string>();
  const push = (x: number, y: number, z: number, type: TerrainBlockId) => {
    const k = `${x},${y},${z}`;
    if (seen.has(k)) return;
    seen.add(k);
    blocks.push(overlayBlock(x, y, z, type));
  };

  for (const p of dep.portals) {
    const surface = Math.max(1, Math.round(heightAtCell(field, p.position.x, p.position.z)));
    const y = surface;
    push(p.position.x, y, p.position.z, "diamond");
    push(p.position.x, y + 1, p.position.z, "exclamation");
    push(p.position.x + 1, y, p.position.z, "stone");
    push(p.position.x - 1, y, p.position.z, "stone");
    push(p.position.x, y, p.position.z + 1, "stone");
    push(p.position.x, y, p.position.z - 1, "stone");
  }

  for (const e of scene.blockEdits ?? []) {
    if (!e.type) continue;
    if (Math.abs(e.x) <= 2 && Math.abs(e.z) <= 2) {
      push(e.x, e.y, e.z, e.type as TerrainBlockId);
    }
  }
  return blocks;
}

/**
 * Playable explorer map: town GLB id + chunked heights + portal overlay + start.
 */
export function assembleSeedOverworldMap(dep: SeedWorldDeployment): VoxelMap {
  const town = dep.world.startingTown;
  const mapChunkId = resolveSeedPrefabMapChunk({
    mapChunkId: dep.world.mapChunkId,
    startingTownMapChunkId: town?.mapChunkId,
  });
  const templateId = town?.templateId ?? EXPLORER_STARTING_TOWN_TEMPLATE;
  const scene = deploymentToScene(dep);
  const gen = (scene.map as { gen?: { hubRadius?: number } } | null)?.gen;
  const field = generateSeedTerrain({
    seed: dep.world.seedNumber,
    biome: dep.world.biome,
    hubRadius: gen?.hubRadius ?? 36,
    extraCenters: dep.portals.map((p: { position: { x: number; z: number } }) => p.position),
    chunkIdx: dep.world.chunkIdx,
  });

  const spawn = scene.spawn ?? town?.spawn ?? { x: 0, y: 2, z: 0 };
  return {
    version: VOXEL_MAP_VERSION,
    dungeon: false,
    blocks: overlayFromDeployment(dep, field),
    deployables: [
      {
        id: "start",
        kind: "start",
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        rotation: 0,
      },
    ],
    play: fieldToPlay(field, mapChunkId, templateId),
  };
}

/** Voxel-editor template: default explorer town + explorer-town seed. */
export function buildExplorerStartingTownMap(): VoxelMap {
  return assembleSeedOverworldMap(explorerTownDeployment());
}

/** Amida farm overlay used when the lobby GLB cannot load. */
export function townFallbackBlocks(): BlockData[] {
  return buildAmidaFarmBlocks({ half: 18 });
}

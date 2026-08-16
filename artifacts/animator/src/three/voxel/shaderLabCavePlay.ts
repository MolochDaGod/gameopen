/**
 * Playable Shader.lab `#voxel` cave dungeon for VoxelArena.
 * Generator lives in @workspace/voxel-canonical — this only stamps a VoxelMap.
 */
import {
  colorForBlockType,
  generateShaderLabCave,
  SHADER_LAB_CAVE_TEMPLATE,
  type TerrainBlockId,
} from "@workspace/voxel-canonical";
import type { BlockData, VoxelMap } from "./types";
import { VOXEL_MAP_VERSION } from "./types";
import type { Difficulty, WeaponId } from "../types";

export function assembleShaderLabCaveMap(seed: number): VoxelMap {
  const field = generateShaderLabCave({ seed });
  const blocks: BlockData[] = field.blocks.map((b) => ({
    x: b.x,
    y: b.y,
    z: b.z,
    shape: "block" as const,
    color: colorForBlockType(b.type),
    rotation: 0,
    type: b.type as TerrainBlockId,
  }));

  const room = field.roomCenter;
  const midZ = Math.round(field.length * 0.45);
  const mid = field.blocks.find((b) => b.z === midZ && b.y === 0 && b.type === "brickRed");

  return {
    version: VOXEL_MAP_VERSION,
    dungeon: true,
    blocks,
    deployables: [
      {
        id: "start",
        kind: "start",
        x: field.start.x,
        y: field.start.y,
        z: field.start.z,
        rotation: 0,
      },
      {
        id: "cave-ambush",
        kind: "npc",
        x: mid?.x ?? field.start.x,
        y: 0,
        z: midZ,
        rotation: 0,
        weapon: "axe" as WeaponId,
        difficulty: "normal" as Difficulty,
      },
      {
        id: "cave-room-elite",
        kind: "npc",
        x: room.x,
        y: 0,
        z: room.z,
        rotation: 0,
        weapon: "greataxe" as WeaponId,
        difficulty: "elite" as Difficulty,
      },
      {
        id: "cave-room-guard",
        kind: "npc",
        x: room.x + 3,
        y: 0,
        z: room.z - 1,
        rotation: 0,
        weapon: "spear" as WeaponId,
        difficulty: "hard" as Difficulty,
      },
    ],
  };
}

export function buildShaderLabCaveTemplate(): VoxelMap {
  return assembleShaderLabCaveMap(0x51ab);
}

export { SHADER_LAB_CAVE_TEMPLATE };

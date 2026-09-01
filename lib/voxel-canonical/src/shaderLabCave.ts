/**
 * Shader.lab `#voxel` cave → playable 1 m blocks + open dungeon room at the end.
 *
 * Source: https://lo-th.github.io/Shader.lab/#voxel
 *         glsl/voxel.glsl (Shane / Shadertoy MdVSDh)
 *
 * We reuse the winding `path()` + solid `map()` — not the Shadertoy fly-cam.
 * VoxelArena walks the resulting blocks. Same seed ⇒ same tunnel + room.
 *
 * Convention (matches voxel.glsl): map < 0 is solid. Lab floor is y = -3;
 * we shift +3 so play floor is y = 0 (SI metres).
 */

import type { TerrainBlockId } from "./types";
import { mixSeed } from "./seedWorld";

export const SHADER_LAB_CAVE_TEMPLATE = "shaderLabCave";
export const SHADER_LAB_VOXEL_URL = "https://lo-th.github.io/Shader.lab/#voxel";

/** Tunnel length along +Z before the open room (blocks / metres). */
export const SHADER_LAB_CAVE_LENGTH = 44;
export const SHADER_LAB_CAVE_ROOM_RADIUS = 8;
export const SHADER_LAB_Y_SHIFT = 3;

export type ShaderLabCaveBlock = {
  x: number;
  y: number;
  z: number;
  type: TerrainBlockId;
};

export type ShaderLabCaveField = {
  seed: number;
  phase: number;
  length: number;
  roomRadius: number;
  blocks: ShaderLabCaveBlock[];
  start: { x: number; y: number; z: number };
  roomCenter: { x: number; y: number; z: number };
  /** World cells that are air inside the end room (for spawn / NPCs). */
  roomFloor: { x: number; z: number }[];
};

export type GenerateShaderLabCaveOpts = {
  seed: number;
  length?: number;
  roomRadius?: number;
};

/** voxel.glsl `path(z)` with a seed phase so worlds differ. */
export function shaderLabPath(z: number, phase = 0): { x: number; y: number } {
  const a = Math.sin(z * 0.11 + phase);
  const b = Math.cos(z * 0.14 + phase * 0.7);
  return { x: a * 4 - b * 1.5, y: b * 1.7 + a * 1.5 };
}

/**
 * voxel.glsl `map(p)` plus an open chamber at z ≈ length.
 * Coordinates are Shader.lab space (floor plane y = -3).
 */
export function shaderLabMap(
  x: number,
  y: number,
  z: number,
  opts: { phase?: number; length?: number; roomRadius?: number } = {},
): number {
  const phase = opts.phase ?? 0;
  const length = opts.length ?? SHADER_LAB_CAVE_LENGTH;
  const roomR = opts.roomRadius ?? SHADER_LAB_CAVE_ROOM_RADIUS;
  const path = shaderLabPath(z, phase);
  const lx = x - path.x;
  const ly = y - path.y;
  let air = 5 - Math.hypot(lx, ly * 0.8);

  if (z >= length - 3) {
    const end = shaderLabPath(length, phase);
    const rx = x - end.x;
    const ry = y - end.y;
    const rz = z - length;
    const roomAir = roomR - Math.hypot(rx, ry * 0.85, rz * 1.05);
    air = Math.max(air, roomAir);
  }

  return Math.min(y + 3, air);
}

export function shaderLabPhase(seed: number): number {
  return (mixSeed(seed >>> 0, 0x51ade) / 4294967296) * Math.PI * 2;
}

function isSolid(
  x: number,
  y: number,
  z: number,
  phase: number,
  length: number,
  roomRadius: number,
): boolean {
  return shaderLabMap(x, y, z, { phase, length, roomRadius }) <= 0;
}

function blockType(
  x: number,
  yLab: number,
  z: number,
  length: number,
  roomRadius: number,
  phase: number,
): TerrainBlockId {
  const y = yLab + SHADER_LAB_Y_SHIFT;
  if (y <= 0) return z >= length - 2 ? "brickYellow" : "brickRed";
  const end = shaderLabPath(length, phase);
  const inRoom = z >= length - 3 && Math.hypot(x - end.x, z - length) < roomRadius + 1;
  if (inRoom) return y >= 5 ? "stone" : "brickDark";
  return y >= 4 ? "stone" : "brickRed";
}

/**
 * Surface voxels of the winding tunnel + open end room.
 * Floor cells inside the room are listed for deployables.
 */
export function generateShaderLabCave(opts: GenerateShaderLabCaveOpts): ShaderLabCaveField {
  const seed = opts.seed >>> 0;
  const phase = shaderLabPhase(seed);
  const length = Math.max(28, Math.min(64, opts.length ?? SHADER_LAB_CAVE_LENGTH));
  const roomRadius = Math.max(6, Math.min(12, opts.roomRadius ?? SHADER_LAB_CAVE_ROOM_RADIUS));

  const z0 = 0;
  const z1 = length + roomRadius + 2;
  const blocks: ShaderLabCaveBlock[] = [];
  const seen = new Set<string>();
  const roomFloor: { x: number; z: number }[] = [];

  const NEIGH = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;

  for (let z = z0; z <= z1; z++) {
    const path = shaderLabPath(z, phase);
    const span = z >= length - 3 ? roomRadius + 3 : 8;
    const x0 = Math.floor(path.x - span);
    const x1 = Math.ceil(path.x + span);
    const yLab0 = -3;
    const yLab1 = z >= length - 3 ? 8 : 6;

    for (let x = x0; x <= x1; x++) {
      for (let yLab = yLab0; yLab <= yLab1; yLab++) {
        if (!isSolid(x, yLab, z, phase, length, roomRadius)) {
          if (
            yLab === -2 &&
            z >= length - 2 &&
            isSolid(x, -3, z, phase, length, roomRadius)
          ) {
            const end = shaderLabPath(length, phase);
            if (Math.hypot(x - end.x, z - length) < roomRadius - 1.5) {
              roomFloor.push({ x, z });
            }
          }
          continue;
        }
        let surface = false;
        for (const [dx, dy, dz] of NEIGH) {
          if (!isSolid(x + dx, yLab + dy, z + dz, phase, length, roomRadius)) {
            surface = true;
            break;
          }
        }
        if (!surface) continue;
        const y = yLab + SHADER_LAB_Y_SHIFT;
        const k = `${x},${y},${z}`;
        if (seen.has(k)) continue;
        seen.add(k);
        blocks.push({
          x,
          y,
          z,
          type: blockType(x, yLab, z, length, roomRadius, phase),
        });
      }
    }
  }

  const startPath = shaderLabPath(2, phase);
  const endPath = shaderLabPath(length, phase);
  return {
    seed,
    phase,
    length,
    roomRadius,
    blocks,
    start: { x: Math.round(startPath.x), y: 0, z: 2 },
    roomCenter: { x: Math.round(endPath.x), y: 0, z: length },
    roomFloor,
  };
}

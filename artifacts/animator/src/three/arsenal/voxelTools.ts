/**
 * Desktop `toolsvoxel.glb` — harvest hand meshes for the existing 8-tool kit.
 *
 * Isolate by node name (do not load the whole ForgeScene as one prop).
 * Parent on uMMORPG sockets (`R_hand_container` / `L_hand_container`).
 * Race body / armor stays Toon kit mesh_ids from Unity Player prefabs —
 * `FRESH GRUDGE/Assets/uMMORPG/Prefabs/Entities/Players/{Race}.prefab`.
 *
 * Not a second tool system. Skills stay in harvestTools.ts.
 * Pack has no hatchet / hoe — those keep Toon kit / jade fallbacks.
 */
import { normalizeHarvestTool } from "../harvest/pinataHarvest";
import type { HarvestToolId } from "./harvestTools";

export const VOXEL_TOOLS_PACK = "models/tools/voxel/toolsvoxel.glb";

export type VoxelToolSocket = "R" | "L";

export type VoxelToolMesh = {
  isolate: string;
  /** Longest AABB axis after isolate — SI metres. */
  lengthM: number;
  socket: VoxelToolSocket;
};

/** Isolate roots inside toolsvoxel.glb (ForgeScene children). */
export const VOXEL_TOOL_MESH: Record<string, VoxelToolMesh> = {
  pick: { isolate: "Pickaxe", lengthM: 0.85, socket: "R" },
  knife: { isolate: "Knife", lengthM: 0.28, socket: "R" },
  bucket: { isolate: "Bucket", lengthM: 0.32, socket: "L" },
  shovel: { isolate: "Shovel", lengthM: 1.05, socket: "R" },
  fish: { isolate: "FishingRod_Lvl2", lengthM: 1.35, socket: "R" },
  buildhammer: { isolate: "Hammer_Circle027", lengthM: 0.7, socket: "R" },
};

const ACTIVITY_TO_VOXEL: Record<string, keyof typeof VOXEL_TOOL_MESH> = {
  pick: "pick",
  pickaxe: "pick",
  toolpickaxe: "pick",
  mine: "pick",
  ore: "pick",
  knife: "knife",
  toolskinningknife: "knife",
  skin: "knife",
  skinning: "knife",
  bucket: "bucket",
  water: "bucket",
  shovel: "shovel",
  dig: "shovel",
  fish: "fish",
  rod: "fish",
  fishing: "fish",
  fishingpole: "fish",
  toolfishingrod: "fish",
  buildhammer: "buildhammer",
  hammer: "buildhammer",
};

export function voxelMeshForActivity(toolId: string): VoxelToolMesh | null {
  const raw = String(toolId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const direct = ACTIVITY_TO_VOXEL[raw];
  if (direct) return VOXEL_TOOL_MESH[direct] ?? null;
  const norm = String(normalizeHarvestTool(toolId) || "").toLowerCase();
  const viaNorm = ACTIVITY_TO_VOXEL[norm];
  if (viaNorm) return VOXEL_TOOL_MESH[viaNorm] ?? null;
  return null;
}

/** HarvestToolId rows that have a voxel mesh (hoe / hatchet do not). */
export function voxelMeshForHarvestId(id: HarvestToolId): VoxelToolMesh | null {
  return voxelMeshForActivity(id);
}

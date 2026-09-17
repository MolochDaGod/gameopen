/**
 * ObjectStore ↔ Mine-Loader Codex wiring.
 * Prefabs, items, materials, buildings, and buildables resolve through this
 * module + objectstore /api/v1/voxel-codex-bridge.json.
 */

import type { BlockTypeId } from "./types";
import { MINE_LOADER_API_ORIGIN } from "./catalog";

export const OBJECTSTORE_API_ORIGIN = "https://objectstore.grudge-studio.com/api/v1";

export const CODEX_BRIDGE_URL = `${OBJECTSTORE_API_ORIGIN}/voxel-codex-bridge.json`;
export const CODEX_SSOT_URL = `${MINE_LOADER_API_ORIGIN}/api/ssot`;

export const WARLORDS_CLASS_KITS_FORBIDDEN = [
  "WAND",
  "GRIMOIRE",
  "RANGER_LOG",
  "BATTLE_DUAL",
] as const;

export const VOXEL_ALLOWED_WEAPON_TYPES = [
  "SWORD",
  "AXE",
  "MACE",
  "SPEAR",
  "DAGGER",
  "BOW",
  "STAFF",
  "TOOL",
] as const;

export type VoxelWeaponType = (typeof VOXEL_ALLOWED_WEAPON_TYPES)[number];

export interface CodexBridge {
  version: string;
  terrainPlacePalette?: string[];
  terrainAliases?: Record<string, string>;
  materialToCell?: Record<
    string,
    { placeType: string; dropItem?: string; toolTier?: string; family?: string }
  >;
  itemIdSpace?: Record<
    string,
    { family: string; model?: string | null; placeType?: string | null; harvestFamily?: string }
  >;
  buildingsToStations?: Array<{
    name: string;
    uuid?: string;
    voxelProp: string;
    modelKey: string;
    aliases?: string[];
    occupy?: string;
    bench?: boolean;
    codexRole?: string;
  }>;
  buildablePrefabSockets?: {
    gridM?: number;
    characterHeightM?: number;
    kindToCodexRole?: Record<string, string>;
  };
}

let bridgeCache: CodexBridge | null = null;

export async function fetchCodexBridge(
  opts: { force?: boolean; url?: string; signal?: AbortSignal } = {},
): Promise<CodexBridge> {
  if (!opts.force && bridgeCache) return bridgeCache;
  const url = opts.url ?? CODEX_BRIDGE_URL;
  const res = await fetch(url, {
    signal: opts.signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = (await res.json()) as CodexBridge;
  if (!data || typeof data !== "object") throw new Error(`Invalid Codex bridge from ${url}`);
  bridgeCache = data;
  return data;
}

export function getCachedCodexBridge(): CodexBridge | null {
  return bridgeCache;
}

export function clearCodexBridgeCache(): void {
  bridgeCache = null;
}

/** Resolve any authoring id (MC alias, material, cat slug) to a cell type. */
export function resolvePlaceType(
  id: string,
  bridge?: CodexBridge | null,
): BlockTypeId {
  if (!id) return "stone";
  if (id.startsWith("cat:")) return id as BlockTypeId;
  const fromItem = bridge?.itemIdSpace?.[id]?.placeType;
  if (fromItem) return fromItem as BlockTypeId;
  const fromMat = bridge?.materialToCell?.[id]?.placeType;
  if (fromMat) return fromMat as BlockTypeId;
  const alias = bridge?.terrainAliases?.[id];
  if (alias) return alias as BlockTypeId;
  return id as BlockTypeId;
}

export function isPlaceableId(id: string, bridge?: CodexBridge | null): boolean {
  if (id.startsWith("cat:")) return true;
  if (bridge?.terrainPlacePalette?.includes(id)) return true;
  const place = bridge?.itemIdSpace?.[id]?.placeType ?? bridge?.materialToCell?.[id]?.placeType;
  return Boolean(place);
}

export function isForbiddenVoxelWeaponType(weaponType: string): boolean {
  return (WARLORDS_CLASS_KITS_FORBIDDEN as readonly string[]).includes(weaponType);
}

export function isAllowedVoxelWeaponType(weaponType: string): boolean {
  return (VOXEL_ALLOWED_WEAPON_TYPES as readonly string[]).includes(weaponType);
}

export function resolveBuildingProp(
  nameOrUuid: string,
  bridge?: CodexBridge | null,
): { voxelProp: string; modelKey: string; bench: boolean } | null {
  const rows = bridge?.buildingsToStations ?? [];
  const key = nameOrUuid.toLowerCase();
  const hit = rows.find(
    (r) =>
      r.name.toLowerCase() === key ||
      r.uuid === nameOrUuid ||
      r.modelKey.toLowerCase() === key ||
      r.aliases?.some((a) => a.toLowerCase() === key),
  );
  if (!hit) return null;
  return { voxelProp: hit.voxelProp, modelKey: hit.modelKey, bench: Boolean(hit.bench) };
}

/** Scene prop stub for an ObjectStore buildable prefab (not a voxel cell). */
export function buildableToSceneProp(
  prefab: {
    id: string;
    kind?: string;
    occupy?: string;
    wx?: number;
    wz?: number;
    heightM?: number;
  },
  position: { x: number; y: number; z: number },
  rotation = 0,
) {
  return {
    id: prefab.id,
    kind: prefab.kind ?? "buildable",
    model: prefab.id,
    occupy: prefab.occupy ?? "ground",
    footprint: { wx: prefab.wx ?? 1, wz: prefab.wz ?? 1, heightM: prefab.heightM ?? 1 },
    x: position.x,
    y: position.y,
    z: position.z,
    rotation,
  };
}

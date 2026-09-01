/**
 * PURGED — 30characters.glb is NOT a production grudge6 path.
 *
 * Historical "static multi-hero GLB" caused wrong kits, no skeleton anims, and
 * debris looks. Fleet hard ban: never load 30characters for playable heroes.
 *
 * SSOT only:
 *   loadGrudge6CombatRig(raceId, presetId, { meshIds?, animPack? })
 *   or GrudgeAvatar → same function
 *
 * This module remains only so old imports fail loudly instead of silently
 * loading garbage.
 */
import type * as THREE from "three";
import type { PresetId } from "./gearPresets";
import { RACE_IDS, type RaceId } from "./raceAssets";
import { PRESET_IDS } from "./gearPresets";

const PURGE_MSG =
  "[grudge6 PURGED] 30characters.glb / bakedRoster is forbidden. " +
  "Use loadGrudge6CombatRig(raceId, presetId) or GrudgeAvatar only " +
  "(equip mesh_ids → SI fit → race atlas → baked Bip001 anims).";

/** @deprecated Layout table kept for index math only — do not load meshes from this. */
export const BAKED_ORDER: ReadonlyArray<readonly [RaceId, PresetId]> = RACE_IDS.flatMap(
  (race) => PRESET_IDS.map((preset) => [race, preset] as const),
);

export function bakedIndexFor(raceId: RaceId, presetId: PresetId): number {
  const i = BAKED_ORDER.findIndex(([r, p]) => r === raceId && p === presetId);
  return i >= 0 ? i : 0;
}

/**
 * @deprecated Always throws. Call {@link loadGrudge6CombatRig} instead.
 */
export async function getBakedCharacter(_index?: number): Promise<THREE.Group> {
  throw new Error(PURGE_MSG);
}

/**
 * @deprecated Always throws. Call {@link loadGrudge6CombatRig} instead.
 */
export async function loadBakedGrudgeCharacter(
  _raceId?: RaceId,
  _presetId?: PresetId,
): Promise<THREE.Group> {
  throw new Error(PURGE_MSG);
}

export function assertNotThirtyCharactersPath(url: string): void {
  if (/30characters/i.test(String(url || ""))) {
    throw new Error(PURGE_MSG + ` refused url=${url}`);
  }
}

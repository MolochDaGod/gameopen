/**
 * Gameplay layer bits — terrain / climb / swim / harvest / claim / etc.
 * Stored on object.userData.layers for controller + bake queries.
 */
import * as THREE from "three";

export type GameLayerTag =
  | "terrain"
  | "climb"
  | "swim"
  | "burn"
  | "harvest"
  | "claim"
  | "enemy_zone"
  | "reward"
  | "vehicle"
  | "prop"
  | "ocean_floor"
  | "ignore";

/** Bit flags (also exposed as GamePlayLayer for map code). */
export const GamePlayLayer = {
  TERRAIN: 1 << 0,
  CLIMB: 1 << 1,
  SWIM: 1 << 2,
  BURN: 1 << 3,
  HARVESTABLE: 1 << 4,
  CLAIM: 1 << 5,
  ENEMY_ZONE: 1 << 6,
  REWARD: 1 << 7,
  VEHICLE: 1 << 8,
  PROP: 1 << 9,
  OCEAN_FLOOR: 1 << 10,
  IGNORE: 1 << 11,
} as const;

const TAG_TO_BIT: Record<GameLayerTag, number> = {
  terrain: GamePlayLayer.TERRAIN,
  climb: GamePlayLayer.CLIMB,
  swim: GamePlayLayer.SWIM,
  burn: GamePlayLayer.BURN,
  harvest: GamePlayLayer.HARVESTABLE,
  claim: GamePlayLayer.CLAIM,
  enemy_zone: GamePlayLayer.ENEMY_ZONE,
  reward: GamePlayLayer.REWARD,
  vehicle: GamePlayLayer.VEHICLE,
  prop: GamePlayLayer.PROP,
  ocean_floor: GamePlayLayer.OCEAN_FLOOR,
  ignore: GamePlayLayer.IGNORE,
};

export function tagToBit(tag: GameLayerTag): number {
  return TAG_TO_BIT[tag] ?? 0;
}

export function applyGameLayer(
  obj: THREE.Object3D,
  tag: GameLayerTag,
  opts?: { extraBits?: number },
): void {
  const bit = tagToBit(tag) | (opts?.extraBits ?? 0);
  const prev = Number(obj.userData.layers) || 0;
  obj.userData.layers = prev | bit;
  obj.userData.gameLayer = tag;
  obj.layers?.enable?.(Math.min(31, Math.max(0, Math.floor(Math.log2(bit || 1)))));
}

export function hasGameLayer(obj: THREE.Object3D, tag: GameLayerTag): boolean {
  const bits = Number(obj.userData.layers) || 0;
  return (bits & tagToBit(tag)) !== 0;
}

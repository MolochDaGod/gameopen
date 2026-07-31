/**
 * Harvest-specific layer bits (OR into object.userData.layers).
 */
export const HarvestLayer = {
  HARVESTABLE: 1 << 4,
  DEPLETED: 1 << 12,
  RESPAWNING: 1 << 13,
  CHUNK: 1 << 14,
} as const;

export type HarvestLayerKey = keyof typeof HarvestLayer;

/**
 * Claim-gated placeables + quick-craft exclusions.
 *
 * Ghost placement uses footprint + optional meshUrl (production GLB).
 * Claim flag is converted Decor_PirateFlag_00 → models/camp/claim-flag.glb.
 */

export type PlaceableCategory =
  | "territory"
  | "production"
  | "defensive"
  | "farming"
  | "taming"
  | "station"
  | "storage"
  | "utility"
  | "quick_craft";

export type PlaceableDef = {
  id: string;
  name: string;
  category: PlaceableCategory;
  /** Requires planted claim flag build rights. */
  claimGated: boolean;
  /** Footprint half-extents (m) for ghost box / snap. */
  footprint: { x: number; z: number; y: number };
  /** Preferred production mesh (GLB). */
  meshUrl?: string;
  /** Fallback procedural color when mesh missing. */
  ghostColor: number;
  /** Grid snap size (m). */
  snap: number;
  /** Optional master-buildings uuid. */
  buildingUuid?: string;
  /** RTS production role when training units. */
  producesTypes?: string[];
  /** Asset line notes (uMMORPG / Ultimate Fantasy RTS). */
  assetNote?: string;
  iconUrl?: string;
};

const BASE = typeof import.meta !== "undefined" ? import.meta.env.BASE_URL || "/" : "/";

/** Converted + migrated claim flag (grudge-convert from Decor_PirateFlag_00.fbx). */
export const CLAIM_FLAG_PLACEABLE: PlaceableDef = {
  id: "claim_flag",
  name: "Camp Claim Flag",
  category: "territory",
  claimGated: false, // planting the flag itself is not gated
  footprint: { x: 0.6, z: 0.6, y: 2.4 },
  meshUrl: `${BASE}models/camp/claim-flag.glb`,
  ghostColor: 0xe8c547,
  snap: 1,
  buildingUuid: "BLDG-20260604172217-000005-1CD0B077",
  assetNote: "Migrated Decor_PirateFlag_00.fbx → claim-flag.glb (grudge-convert fbx2glb)",
  // Flag_01 404s on assets CDN — Naturecircle is live pack art (claim territory glyph)
  iconUrl: "https://assets.grudge-studio.com/icons/pack/misc/Naturecircle.png",
};

/** Quick-craft — never claim-gated. */
export const QUICK_CRAFT_PLACEABLES: PlaceableDef[] = [
  {
    id: "campfire",
    name: "Campfire",
    category: "quick_craft",
    claimGated: false,
    footprint: { x: 0.8, z: 0.8, y: 0.6 },
    ghostColor: 0xff6a2a,
    snap: 0.5,
    buildingUuid: "BLDG-20260604172217-000008-707A9F5B",
  },
  {
    id: "sleeping_bag",
    name: "Sleeping Bag",
    category: "quick_craft",
    claimGated: false,
    footprint: { x: 1.0, z: 0.5, y: 0.25 },
    ghostColor: 0x6a8ab0,
    snap: 0.5,
  },
  {
    id: "torch",
    name: "Torch",
    category: "quick_craft",
    claimGated: false,
    footprint: { x: 0.2, z: 0.2, y: 1.2 },
    ghostColor: 0xffcc66,
    snap: 0.5,
  },
];

/** Claim-gated structures for ghost place from Camp UI / Build mode. */
export const CLAIM_PLACEABLES: PlaceableDef[] = [
  CLAIM_FLAG_PLACEABLE,
  {
    id: "barracks",
    name: "Barracks",
    category: "production",
    claimGated: true,
    footprint: { x: 3.5, z: 3.5, y: 3.2 },
    ghostColor: 0x8899bb,
    snap: 1,
    producesTypes: ["melee", "heavy"],
    assetNote: "Ultimate Fantasy RTS Barracks_FirstAge_Level*",
  },
  {
    id: "archery",
    name: "Archery Range",
    category: "production",
    claimGated: true,
    footprint: { x: 3.2, z: 3.2, y: 2.8 },
    ghostColor: 0x6a9a70,
    snap: 1,
    producesTypes: ["ranged"],
    assetNote: "Ultimate Fantasy RTS Archery_FirstAge_Level*",
  },
  {
    id: "temple",
    name: "Temple",
    category: "production",
    claimGated: true,
    footprint: { x: 3.0, z: 3.0, y: 3.5 },
    ghostColor: 0x9a80d0,
    snap: 1,
    producesTypes: ["magic", "support"],
    assetNote: "Ultimate Fantasy RTS Temple_*",
  },
  {
    id: "stable",
    name: "Stable",
    category: "production",
    claimGated: true,
    footprint: { x: 3.5, z: 4.0, y: 2.6 },
    ghostColor: 0xb09060,
    snap: 1,
    producesTypes: ["cavalry"],
    assetNote: "Toon RTS Cavalry + uMMORPG mount pens",
  },
  {
    id: "wall",
    name: "Wall",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.0, z: 0.4, y: 2.2 },
    ghostColor: 0x707888,
    snap: 1,
    assetNote: "Wall_FirstAge / SecondAge",
  },
  {
    id: "watchtower",
    name: "Watch Tower",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.0, z: 2.0, y: 4.5 },
    ghostColor: 0x606878,
    snap: 1,
    assetNote: "WatchTower_*_Level*",
  },
  {
    id: "gate",
    name: "Gate",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.5, z: 0.6, y: 2.8 },
    ghostColor: 0x808898,
    snap: 1,
  },
  {
    id: "farm_plot",
    name: "Farm Plot",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.5, z: 2.5, y: 0.4 },
    ghostColor: 0x6a8a40,
    snap: 1,
    assetNote: "Farm_FirstAge_Level*",
  },
  {
    id: "windmill",
    name: "Windmill",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.2, z: 2.2, y: 4.0 },
    ghostColor: 0xc8b090,
    snap: 1,
  },
  {
    id: "pen_basic",
    name: "Creature Pen",
    category: "taming",
    claimGated: true,
    footprint: { x: 3.0, z: 3.0, y: 1.5 },
    ghostColor: 0x8a7050,
    snap: 1,
  },
  {
    id: "miner_forge",
    name: "Miner's Forge",
    category: "station",
    claimGated: true,
    footprint: { x: 2.0, z: 2.0, y: 2.0 },
    ghostColor: 0xb07040,
    snap: 1,
    buildingUuid: "BLDG-20260604172217-000000-17733B6C",
  },
  {
    id: "storage_chest",
    name: "Storage Chest",
    category: "storage",
    claimGated: true,
    footprint: { x: 0.9, z: 0.6, y: 0.7 },
    ghostColor: 0x8a6030,
    snap: 0.5,
    buildingUuid: "BLDG-20260604172217-000006-DA8899F1",
  },
  {
    id: "market",
    name: "Market",
    category: "farming",
    claimGated: true,
    footprint: { x: 3.0, z: 3.0, y: 2.4 },
    ghostColor: 0xc4a060,
    snap: 1,
    assetNote: "Market_*_Level* — box ghost until GLB bake",
  },
  {
    id: "town_center",
    name: "Town Center",
    category: "production",
    claimGated: true,
    footprint: { x: 4.0, z: 4.0, y: 3.5 },
    ghostColor: 0xd4a400,
    snap: 1,
    assetNote: "TownCenter_FirstAge_Level* — box ghost until GLB bake",
  },
  {
    id: "wall_tower",
    name: "Wall Tower",
    category: "defensive",
    claimGated: true,
    footprint: { x: 1.8, z: 1.8, y: 3.5 },
    ghostColor: 0x606878,
    snap: 1,
  },
  {
    id: "tower_house",
    name: "Tower House",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.2, z: 2.2, y: 4.0 },
    ghostColor: 0x707888,
    snap: 1,
  },
  {
    id: "wonder_wall",
    name: "Wonder Wall",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.5, z: 0.5, y: 2.8 },
    ghostColor: 0x9098a8,
    snap: 1,
  },
  {
    id: "farm_wheat",
    name: "Wheat Field",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.5, z: 2.5, y: 0.5 },
    ghostColor: 0xc8b040,
    snap: 1,
  },
  {
    id: "farm_dirt",
    name: "Tilled Dirt",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.5, z: 2.5, y: 0.3 },
    ghostColor: 0x6a5030,
    snap: 1,
  },
  {
    id: "stable_bond",
    name: "Bond Stable",
    category: "taming",
    claimGated: true,
    footprint: { x: 3.5, z: 4.0, y: 2.4 },
    ghostColor: 0x9a8060,
    snap: 1,
  },
  {
    id: "beast_yard",
    name: "Beast Yard",
    category: "taming",
    claimGated: true,
    footprint: { x: 4.0, z: 4.0, y: 2.0 },
    ghostColor: 0x7a6040,
    snap: 1,
  },
  ...QUICK_CRAFT_PLACEABLES,
];

const byId = new Map(CLAIM_PLACEABLES.map((p) => [p.id, p]));

export function getPlaceable(id: string): PlaceableDef | undefined {
  return byId.get(id);
}

export function listClaimGatedPlaceables(): PlaceableDef[] {
  return CLAIM_PLACEABLES.filter((p) => p.claimGated);
}

export function listPlaceablesByCategory(cat: PlaceableCategory): PlaceableDef[] {
  return CLAIM_PLACEABLES.filter((p) => p.category === cat);
}

export type PlacedStructure = {
  instanceId: string;
  placeableId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  placedAt: number;
};

export function snapToGrid(v: number, snap: number): number {
  if (snap <= 0) return v;
  return Math.round(v / snap) * snap;
}

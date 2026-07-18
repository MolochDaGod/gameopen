/**
 * Claim-gated placeables + quick-craft exclusions.
 *
 * Every buildable has:
 *  - iconUrl (catalog / pack / local)
 *  - meshUrl when a production GLB exists (ghost = blue tint of same mesh)
 *  - behavior for runtime (door/gate/tower/trap/building/npc/static)
 *
 * Ghost placement uses footprint + mesh; solid deploy uses full textures +
 * optional AnimationMixer (doors/gates) and interact hooks.
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
  | "trap"
  | "furniture"
  | "quick_craft";

/** Runtime behaviour once the solid is deployed. */
export type PlaceableBehavior =
  | "static"
  | "door"
  | "gate"
  | "tower"
  | "trap"
  | "building"
  | "npc_spawn"
  | "harvest_node"
  | "workbench";

export type PlaceableDef = {
  id: string;
  name: string;
  category: PlaceableCategory;
  /** Requires planted claim flag build rights. */
  claimGated: boolean;
  /** Footprint half-extents (m) for ghost box / snap. */
  footprint: { x: number; z: number; y: number };
  /** Preferred production mesh (GLB). Ghost is blue-tinted clone of this. */
  meshUrl?: string;
  /** Uniform scale applied to mesh (ghost + solid). */
  meshScale?: number;
  /** Fallback procedural color when mesh missing (solid only). Ghost is always blue when valid. */
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
  /** Deployed interact / animation behaviour. */
  behavior?: PlaceableBehavior;
  /** For npc_spawn / building: unit type hint. */
  npcHint?: string;
};

/**
 * Relative mesh keys (resolved by campAssetCatalog + loadGltfFirst).
 * Prefer keys over absolute URLs so fleet CDN / same-origin both work.
 */
const MESH = {
  claimFlag: "models/camp/claim-flag.glb",
  fortress: "models/props/modular-fortress.glb",
  bearTrap: "models/props/bear-trap.glb",
  torch: "models/props/torch-burning.glb",
  campfire: "models/props/dying-torch.glb",
  chest: "models/props/alchemists-chest.glb",
  altar: "models/props/altar.glb",
  brew: "models/props/brewing-stand.glb",
  bag: "models/props/punching-bag.glb",
  door: "models/haunting-door.glb",
  turret: "models/vfx/turret-game-ready.glb",
  cannon: "models/creatures/cannon.glb",
  barrel: "models/destructibles/barrel-01.glb",
  island: "models/worlds/small_island.glb",
  // Human props pack (artikora / CC-BY) — split from Documents GLB
  fishingPole: "models/props/human-props/fishing-pole.glb",
  fishingPoleCast: "models/props/human-props/fishing-pole-cast.glb",
  bucket: "models/props/human-props/bucket.glb",
  bridgeLong: "models/props/human-props/bridge-long.glb",
  bridgeShort: "models/props/human-props/bridge-short.glb",
  bridgePontoon: "models/props/human-props/bridge-pontoon.glb",
  professionTable: "models/props/human-props/profession-table.glb",
  humanBarrel: "models/props/human-props/barrel.glb",
  humanCrate: "models/props/human-props/crate.glb",
  humanFence: "models/props/human-props/fence-1.glb",
  humanLamp: "models/props/human-props/lamp-1.glb",
} as const;

/** Relative icon keys (master-buildings + pack; fleet resolve). */
const ICON = {
  flag: "icons/pack/misc/Naturecircle.png",
  wall: "icons/pack/misc/Effect.png",
  tower: "icons/pack/misc/Chaos_2.png",
  gate: "icons/pack/misc/Flow.png",
  door: "icons/pack/misc/Flow.png",
  barracks: "icons/pack/weapons/Sword_01.png",
  archery: "icons/pack/weapons/Bow_01.png",
  temple: "icons/professions/altar.png",
  stable: "icons/pack/misc/Naturecircle.png",
  farm: "icons/pack/misc/Slash_07.png",
  windmill: "icons/pack/misc/Flow.png",
  forge: "icons/professions/forge.png",
  chest: "icons/pack/misc/Naturecircle.png",
  trap: "icons/pack/misc/Chaos_2.png",
  bench: "icons/professions/workbench.png",
  torch: "icons/pack/misc/Slash_07.png",
  campfire: "icons/pack/misc/Slash_07.png",
  market: "icons/pack/misc/Naturecircle.png",
  town: "icons/pack/misc/Naturecircle.png",
  bag: "icons/pack/misc/Effect.png",
  fortify: "icons/camp/camp_fortify.png",
  husbandry: "icons/camp/camp_husbandry.png",
  drill: "icons/camp/camp_drill.png",
} as const;

/** Converted + migrated claim flag (grudge-convert from Decor_PirateFlag_00.fbx). */
export const CLAIM_FLAG_PLACEABLE: PlaceableDef = {
  id: "claim_flag",
  name: "Camp Claim Flag",
  category: "territory",
  claimGated: false,
  footprint: { x: 0.6, z: 0.6, y: 2.4 },
  meshUrl: MESH.claimFlag,
  meshScale: 1,
  ghostColor: 0xe8c547,
  snap: 1,
  buildingUuid: "BLDG-20260604172217-000005-1CD0B077",
  assetNote: "Migrated Decor_PirateFlag_00.fbx → claim-flag.glb",
  iconUrl: ICON.flag,
  behavior: "static",
};

/** Quick-craft — never claim-gated. */
export const QUICK_CRAFT_PLACEABLES: PlaceableDef[] = [
  {
    id: "campfire",
    name: "Campfire",
    category: "quick_craft",
    claimGated: false,
    footprint: { x: 0.8, z: 0.8, y: 0.6 },
    meshUrl: MESH.campfire,
    meshScale: 0.45,
    ghostColor: 0xff6a2a,
    snap: 0.5,
    buildingUuid: "BLDG-20260604172217-000008-707A9F5B",
    iconUrl: ICON.campfire,
    behavior: "static",
  },
  {
    id: "sleeping_bag",
    name: "Sleeping Bag",
    category: "quick_craft",
    claimGated: false,
    footprint: { x: 1.0, z: 0.5, y: 0.25 },
    ghostColor: 0x6a8ab0,
    snap: 0.5,
    iconUrl: ICON.bag,
    behavior: "static",
  },
  {
    id: "torch",
    name: "Torch",
    category: "quick_craft",
    claimGated: false,
    footprint: { x: 0.2, z: 0.2, y: 1.2 },
    meshUrl: MESH.torch,
    meshScale: 0.55,
    ghostColor: 0xffcc66,
    snap: 0.5,
    iconUrl: ICON.torch,
    behavior: "static",
  },
];

/** Claim-gated structures for ghost place from Camp UI / Build mode. */
export const CLAIM_PLACEABLES: PlaceableDef[] = [
  CLAIM_FLAG_PLACEABLE,
  // ── Production ────────────────────────────────────────────────
  {
    id: "barracks",
    name: "Barracks",
    category: "production",
    claimGated: true,
    footprint: { x: 3.5, z: 3.5, y: 3.2 },
    meshUrl: MESH.fortress,
    meshScale: 0.55,
    ghostColor: 0x8899bb,
    snap: 1,
    producesTypes: ["melee", "heavy"],
    assetNote: "modular-fortress stand-in · trains melee NPCs",
    iconUrl: ICON.barracks,
    behavior: "npc_spawn",
    npcHint: "melee",
  },
  {
    id: "archery",
    name: "Archery Range",
    category: "production",
    claimGated: true,
    footprint: { x: 3.2, z: 3.2, y: 2.8 },
    meshUrl: MESH.fortress,
    meshScale: 0.48,
    ghostColor: 0x6a9a70,
    snap: 1,
    producesTypes: ["ranged"],
    assetNote: "modular-fortress stand-in · trains ranged NPCs",
    iconUrl: ICON.archery,
    behavior: "npc_spawn",
    npcHint: "ranged",
  },
  {
    id: "temple",
    name: "Temple",
    category: "production",
    claimGated: true,
    footprint: { x: 3.0, z: 3.0, y: 3.5 },
    meshUrl: MESH.altar,
    meshScale: 0.9,
    ghostColor: 0x9a80d0,
    snap: 1,
    producesTypes: ["magic", "support"],
    assetNote: "altar.glb · magic / support building",
    iconUrl: ICON.temple,
    behavior: "building",
  },
  {
    id: "stable",
    name: "Stable",
    category: "production",
    claimGated: true,
    footprint: { x: 3.5, z: 4.0, y: 2.6 },
    meshUrl: MESH.fortress,
    meshScale: 0.5,
    ghostColor: 0xb09060,
    snap: 1,
    producesTypes: ["cavalry"],
    iconUrl: ICON.stable,
    behavior: "npc_spawn",
    npcHint: "cavalry",
  },
  {
    id: "town_center",
    name: "Town Center",
    category: "production",
    claimGated: true,
    footprint: { x: 4.0, z: 4.0, y: 3.5 },
    meshUrl: MESH.fortress,
    meshScale: 0.7,
    ghostColor: 0xd4a400,
    snap: 1,
    assetNote: "Town center · modular fortress large",
    iconUrl: ICON.town,
    behavior: "building",
  },
  // ── Defensives ────────────────────────────────────────────────
  {
    id: "wall",
    name: "Wall",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.0, z: 0.4, y: 2.2 },
    meshUrl: MESH.fortress,
    meshScale: 0.22,
    ghostColor: 0x707888,
    snap: 1,
    assetNote: "Wall segment (fortress kit)",
    iconUrl: ICON.wall,
    behavior: "static",
  },
  {
    id: "wonder_wall",
    name: "Wonder Wall",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.5, z: 0.5, y: 2.8 },
    meshUrl: MESH.fortress,
    meshScale: 0.28,
    ghostColor: 0x9098a8,
    snap: 1,
    iconUrl: ICON.fortify,
    behavior: "static",
  },
  {
    id: "watchtower",
    name: "Watch Tower",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.0, z: 2.0, y: 4.5 },
    meshUrl: MESH.turret,
    meshScale: 1.4,
    ghostColor: 0x606878,
    snap: 1,
    assetNote: "Working tower · auto-aims hostiles in range",
    iconUrl: ICON.tower,
    behavior: "tower",
  },
  {
    id: "wall_tower",
    name: "Wall Tower",
    category: "defensive",
    claimGated: true,
    footprint: { x: 1.8, z: 1.8, y: 3.5 },
    meshUrl: MESH.turret,
    meshScale: 1.1,
    ghostColor: 0x606878,
    snap: 1,
    iconUrl: ICON.tower,
    behavior: "tower",
  },
  {
    id: "tower_house",
    name: "Tower House",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.2, z: 2.2, y: 4.0 },
    meshUrl: MESH.fortress,
    meshScale: 0.4,
    ghostColor: 0x707888,
    snap: 1,
    iconUrl: ICON.tower,
    behavior: "tower",
  },
  {
    id: "gate",
    name: "Gate",
    category: "defensive",
    claimGated: true,
    footprint: { x: 2.5, z: 0.6, y: 2.8 },
    meshUrl: MESH.door,
    meshScale: 0.85,
    ghostColor: 0x808898,
    snap: 1,
    assetNote: "Animated gate · E to open/close when near",
    iconUrl: ICON.gate,
    behavior: "gate",
  },
  {
    id: "door",
    name: "Door",
    category: "defensive",
    claimGated: true,
    footprint: { x: 1.2, z: 0.35, y: 2.4 },
    meshUrl: MESH.door,
    meshScale: 0.55,
    ghostColor: 0x708090,
    snap: 0.5,
    assetNote: "Animated door · E to open/close",
    iconUrl: ICON.door,
    behavior: "door",
  },
  {
    id: "cannon_tower",
    name: "Cannon Emplacement",
    category: "defensive",
    claimGated: true,
    footprint: { x: 1.4, z: 1.4, y: 1.6 },
    meshUrl: MESH.cannon,
    meshScale: 1,
    ghostColor: 0x556070,
    snap: 1,
    iconUrl: ICON.tower,
    behavior: "tower",
  },
  // ── Traps ─────────────────────────────────────────────────────
  {
    id: "bear_trap",
    name: "Bear Trap",
    category: "trap",
    claimGated: true,
    footprint: { x: 0.6, z: 0.6, y: 0.3 },
    meshUrl: MESH.bearTrap,
    meshScale: 1,
    ghostColor: 0xaa4444,
    snap: 0.5,
    assetNote: "Working trap · damages hostiles in radius",
    iconUrl: ICON.trap,
    behavior: "trap",
  },
  {
    id: "spike_barrel",
    name: "Spike Barrel",
    category: "trap",
    claimGated: true,
    footprint: { x: 0.5, z: 0.5, y: 0.9 },
    meshUrl: MESH.barrel,
    meshScale: 1,
    ghostColor: 0x884422,
    snap: 0.5,
    iconUrl: ICON.trap,
    behavior: "trap",
  },
  // ── Furniture / benches ───────────────────────────────────────
  {
    id: "work_bench",
    name: "Work Bench",
    category: "furniture",
    claimGated: true,
    footprint: { x: 1.2, z: 0.6, y: 1.0 },
    meshUrl: MESH.brew,
    meshScale: 0.7,
    ghostColor: 0x8a7050,
    snap: 0.5,
    iconUrl: ICON.bench,
    behavior: "workbench",
  },
  {
    id: "craft_bench",
    name: "Craft Bench",
    category: "furniture",
    claimGated: true,
    footprint: { x: 1.4, z: 0.7, y: 1.1 },
    meshUrl: MESH.brew,
    meshScale: 0.85,
    ghostColor: 0x9a8060,
    snap: 0.5,
    iconUrl: ICON.bench,
    behavior: "workbench",
  },
  {
    id: "training_dummy_post",
    name: "Training Post",
    category: "furniture",
    claimGated: true,
    footprint: { x: 0.5, z: 0.5, y: 1.8 },
    meshUrl: MESH.bag,
    meshScale: 0.8,
    ghostColor: 0x708090,
    snap: 0.5,
    iconUrl: ICON.drill,
    behavior: "static",
  },
  // ── Farming / taming ──────────────────────────────────────────
  {
    id: "farm_plot",
    name: "Farm Plot",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.5, z: 2.5, y: 0.4 },
    ghostColor: 0x6a8a40,
    snap: 1,
    assetNote: "Harvest node when deployed",
    iconUrl: ICON.farm,
    behavior: "harvest_node",
  },
  {
    id: "farm_wheat",
    name: "Wheat Field",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.5, z: 2.5, y: 0.5 },
    ghostColor: 0xc8b040,
    snap: 1,
    iconUrl: ICON.husbandry,
    behavior: "harvest_node",
  },
  {
    id: "farm_dirt",
    name: "Tilled Dirt",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.5, z: 2.5, y: 0.3 },
    ghostColor: 0x6a5030,
    snap: 1,
    iconUrl: ICON.farm,
    behavior: "harvest_node",
  },
  {
    id: "windmill",
    name: "Windmill",
    category: "farming",
    claimGated: true,
    footprint: { x: 2.2, z: 2.2, y: 4.0 },
    meshUrl: MESH.fortress,
    meshScale: 0.45,
    ghostColor: 0xc8b090,
    snap: 1,
    iconUrl: ICON.windmill,
    behavior: "building",
  },
  {
    id: "market",
    name: "Market",
    category: "farming",
    claimGated: true,
    footprint: { x: 3.0, z: 3.0, y: 2.4 },
    meshUrl: MESH.chest,
    meshScale: 1.2,
    ghostColor: 0xc4a060,
    snap: 1,
    iconUrl: ICON.market,
    behavior: "building",
  },
  {
    id: "pen_basic",
    name: "Creature Pen",
    category: "taming",
    claimGated: true,
    footprint: { x: 3.0, z: 3.0, y: 1.5 },
    meshUrl: MESH.fortress,
    meshScale: 0.35,
    ghostColor: 0x8a7050,
    snap: 1,
    iconUrl: ICON.husbandry,
    behavior: "building",
  },
  {
    id: "stable_bond",
    name: "Bond Stable",
    category: "taming",
    claimGated: true,
    footprint: { x: 3.5, z: 4.0, y: 2.4 },
    meshUrl: MESH.fortress,
    meshScale: 0.48,
    ghostColor: 0x9a8060,
    snap: 1,
    iconUrl: ICON.stable,
    behavior: "npc_spawn",
    npcHint: "cavalry",
  },
  {
    id: "beast_yard",
    name: "Beast Yard",
    category: "taming",
    claimGated: true,
    footprint: { x: 4.0, z: 4.0, y: 2.0 },
    meshUrl: MESH.fortress,
    meshScale: 0.55,
    ghostColor: 0x7a6040,
    snap: 1,
    iconUrl: ICON.husbandry,
    behavior: "building",
  },
  // ── Stations / storage ────────────────────────────────────────
  {
    id: "miner_forge",
    name: "Miner's Forge",
    category: "station",
    claimGated: true,
    footprint: { x: 2.0, z: 2.0, y: 2.0 },
    meshUrl: MESH.brew,
    meshScale: 1,
    ghostColor: 0xb07040,
    snap: 1,
    buildingUuid: "BLDG-20260604172217-000000-17733B6C",
    iconUrl: ICON.forge,
    behavior: "workbench",
  },
  {
    id: "storage_chest",
    name: "Storage Chest",
    category: "storage",
    claimGated: true,
    footprint: { x: 0.9, z: 0.6, y: 0.7 },
    meshUrl: MESH.chest,
    meshScale: 0.55,
    ghostColor: 0x8a6030,
    snap: 0.5,
    buildingUuid: "BLDG-20260604172217-000006-DA8899F1",
    iconUrl: ICON.chest,
    behavior: "static",
  },
  // ── Fishing / cooking profession + bridges (human-props pack) ─
  {
    id: "profession_table",
    name: "Cook & Fish Table",
    category: "station",
    claimGated: true,
    footprint: { x: 1.4, z: 1.4, y: 1.0 },
    meshUrl: MESH.professionTable,
    meshScale: 1,
    ghostColor: 0xf0f0f0,
    snap: 0.5,
    assetNote:
      "Sundial / white table from human-props → cooking + fishing profession station",
    iconUrl: ICON.bench,
    behavior: "workbench",
  },
  {
    id: "fishing_rack",
    name: "Fishing Rack",
    category: "utility",
    claimGated: true,
    footprint: { x: 0.6, z: 0.4, y: 1.8 },
    meshUrl: MESH.fishingPole,
    meshScale: 1,
    ghostColor: 0x8a6a40,
    snap: 0.5,
    assetNote: "Rod_2 idle fishing pole (human-props)",
    iconUrl: ICON.bag,
    behavior: "static",
  },
  {
    id: "fishing_cast_display",
    name: "Cast Pole Display",
    category: "utility",
    claimGated: true,
    footprint: { x: 1.0, z: 0.4, y: 1.9 },
    meshUrl: MESH.fishingPoleCast,
    meshScale: 1,
    ghostColor: 0x7a5a30,
    snap: 0.5,
    assetNote: "Rod_1 fishing pole with line cast (human-props)",
    iconUrl: ICON.bag,
    behavior: "static",
  },
  {
    id: "fish_bucket",
    name: "Fish Bucket",
    category: "storage",
    claimGated: true,
    footprint: { x: 0.55, z: 0.55, y: 0.55 },
    meshUrl: MESH.bucket,
    meshScale: 1,
    ghostColor: 0x6a7a8a,
    snap: 0.5,
    assetNote: "Bucket for catch storage / water (human-props)",
    iconUrl: ICON.chest,
    behavior: "static",
  },
  {
    id: "bridge_long",
    name: "Long Bridge",
    category: "utility",
    claimGated: true,
    footprint: { x: 0.9, z: 3.0, y: 1.2 },
    meshUrl: MESH.bridgeLong,
    meshScale: 1,
    ghostColor: 0x8a7a60,
    snap: 1,
    assetNote: "Buildable long bridge (human-props Long_bridge)",
    iconUrl: ICON.wall,
    behavior: "static",
  },
  {
    id: "bridge_short",
    name: "Short Bridge",
    category: "utility",
    claimGated: true,
    footprint: { x: 0.9, z: 2.2, y: 1.1 },
    meshUrl: MESH.bridgeShort,
    meshScale: 1,
    ghostColor: 0x8a7a60,
    snap: 1,
    assetNote: "Buildable short bridge (human-props Short_bridge)",
    iconUrl: ICON.wall,
    behavior: "static",
  },
  {
    id: "bridge_pontoon",
    name: "Pontoon Bridge",
    category: "utility",
    claimGated: true,
    footprint: { x: 0.95, z: 2.4, y: 0.9 },
    meshUrl: MESH.bridgePontoon,
    meshScale: 1,
    ghostColor: 0x7a8a9a,
    snap: 1,
    assetNote: "Buildable pontoon / dock bridge (human-props Pontoon)",
    iconUrl: ICON.wall,
    behavior: "static",
  },
  {
    id: "dock_lamp",
    name: "Dock Lamp",
    category: "furniture",
    claimGated: true,
    footprint: { x: 0.35, z: 0.25, y: 1.4 },
    meshUrl: MESH.humanLamp,
    meshScale: 1,
    ghostColor: 0xffcc88,
    snap: 0.5,
    iconUrl: ICON.torch,
    behavior: "static",
  },
  {
    id: "dock_fence",
    name: "Dock Fence",
    category: "defensive",
    claimGated: true,
    footprint: { x: 1.4, z: 0.25, y: 1.1 },
    meshUrl: MESH.humanFence,
    meshScale: 1,
    ghostColor: 0x7a7058,
    snap: 0.5,
    iconUrl: ICON.wall,
    behavior: "static",
  },
  {
    id: "supply_crate",
    name: "Supply Crate",
    category: "storage",
    claimGated: true,
    footprint: { x: 0.55, z: 0.55, y: 0.55 },
    meshUrl: MESH.humanCrate,
    meshScale: 1,
    ghostColor: 0x8a7040,
    snap: 0.5,
    iconUrl: ICON.chest,
    behavior: "static",
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

export function listAllPlaceables(): PlaceableDef[] {
  return CLAIM_PLACEABLES.slice();
}

export type PlacedStructure = {
  instanceId: string;
  placeableId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  placedAt: number;
  /** Runtime open state for doors/gates. */
  open?: boolean;
  /** Trap armed. */
  armed?: boolean;
};

export function snapToGrid(v: number, snap: number): number {
  if (snap <= 0) return v;
  return Math.round(v / snap) * snap;
}

/** Blue ghost tint (valid placement). Invalid stays red. */
export const GHOST_BLUE = 0x3a9bff;
export const GHOST_RED = 0xff3333;

/** Small island camp / voxel production test world (relative key → fleet resolve). */
export const SMALL_ISLAND_URL = MESH.island;
export const SMALL_ISLAND_META = {
  id: "small_island",
  label: "Small Island Camp",
  meshUrl: MESH.island,
  meshKeys: [
    "models/worlds/small_island.glb",
    "models/worlds/breeze-island.glb",
    "models/nature/stylized/concept/example_home_island.glb",
  ],
  assetType: "world" as const,
  importer: "gltf" as const,
  blurb: "Voxel camp starting point — buildings, harvest, production deploy test.",
  spawn: { x: 0, y: 0.5, z: 0 },
} as const;

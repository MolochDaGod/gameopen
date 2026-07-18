/**
 * Canonical camp / placeable asset catalog.
 *
 * SSOT for asset **type**, **importer**, **path candidates**, **icon**, and
 * **scale** so ghosts and deployed solids load the same production binaries
 * through the fleet resolver (same-origin → open → R2).
 *
 * Sources:
 *  - Binaries: assets.grudge-studio.com + open.grudge-studio.com public/
 *  - Icons: master-buildings.json + icons/pack / icons/professions
 *  - Importer: sharedGltfLoader (Draco + Meshopt + KTX2) via loadGltfFirst
 *  - Texture prep: prepObjectMaterials (sRGB + mips)
 *
 * Never invent Meshy paths. Prefer verified GLB keys (probed 2026-07).
 */

import type { PlaceableBehavior, PlaceableCategory } from "./placeables";

/** Fleet asset types for camp builds (maps to D1/registry categories). */
export type CampAssetType =
  | "building"
  | "prop"
  | "door"
  | "trap"
  | "siege"
  | "world"
  | "icon"
  | "station"
  | "furniture"
  | "npc_kit";

/** Loader / importer the runtime must use. */
export type CampImporter =
  | "gltf" // GLB/GLTF via sharedGltfLoader + loadGltfFirst
  | "fbx" // grudge6 / Toon race kits only
  | "texture" // icon / atlas
  | "procedural"; // footprint box when mesh missing

export type CampAssetBinding = {
  placeableId: string;
  /** Registry-style type for filters / analytics. */
  assetType: CampAssetType;
  importer: CampImporter;
  /**
   * Relative mesh keys (no leading slash). Tried in order via loadGltfFirst /
   * assetCandidates (same-origin, open, R2).
   */
  meshKeys: string[];
  /** Optional icon path keys (icons/…). */
  iconKeys: string[];
  /**
   * Target world height in metres for auto-scale (bbox Y fit).
   * When set, overrides flat meshScale after load.
   */
  targetHeightM?: number;
  /**
   * Uniform scale applied first (optional). Prefer targetHeightM for correctness.
   */
  meshScale?: number;
  /** master-buildings uuid when this placeable is a catalog station. */
  buildingUuid?: string;
  /** Placeable category / behavior hints (docs). */
  category?: PlaceableCategory;
  behavior?: PlaceableBehavior;
  notes?: string;
};

const P = {
  fortress: "models/props/modular-fortress.glb",
  bearTrap: "models/props/bear-trap.glb",
  altar: "models/props/altar.glb",
  brew: "models/props/brewing-stand.glb",
  chest: "models/props/alchemists-chest.glb",
  torch: "models/props/torch-burning.glb",
  dyingTorch: "models/props/dying-torch.glb",
  bag: "models/props/punching-bag.glb",
  claimFlag: "models/camp/claim-flag.glb",
  door: "models/haunting-door.glb",
  turret: "models/vfx/turret-game-ready.glb",
  turretAlt: "models/vfx/turret.glb",
  cannon: "models/creatures/cannon.glb",
  barrel: "models/destructibles/barrel-01.glb",
  smallIsland: "models/worlds/small_island.glb",
  breezeIsland: "models/worlds/breeze-island.glb",
  homeIsland: "models/nature/stylized/concept/example_home_island.glb",
  // Human props (artikora CC-BY) — fishing / bridges / profession table
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
  // RTS siege keys listed in rtsModels.json — not yet on open/R2 public root
  // (probed 2026-07 MISS). Prefer open-hosted turret/cannon until fleet mirrors them.
} as const;

/**
 * Canonical bindings for every placeable id used by CampBuildSystem.
 * Keep placeableId in sync with placeables.ts CLAIM_PLACEABLES.
 */
export const CAMP_ASSET_BINDINGS: Record<string, CampAssetBinding> = {
  claim_flag: {
    placeableId: "claim_flag",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.claimFlag],
    iconKeys: [
      "icons/pack/misc/Naturecircle.png",
      "icons/pack/misc/Flag_01.png",
    ],
    targetHeightM: 2.4,
    buildingUuid: "BLDG-20260604172217-000005-1CD0B077",
    category: "territory",
    behavior: "static",
  },
  campfire: {
    placeableId: "campfire",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.dyingTorch, P.torch],
    // Fire_01 not on CDN; use verified pack + local camp badge
    iconKeys: ["icons/pack/misc/Slash_07.png", "icons/camp/camp_logistics.png"],
    targetHeightM: 0.7,
    buildingUuid: "BLDG-20260604172217-000008-707A9F5B",
    category: "quick_craft",
    behavior: "static",
  },
  torch: {
    placeableId: "torch",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.torch, P.dyingTorch],
    iconKeys: ["icons/pack/misc/Slash_07.png"],
    targetHeightM: 1.2,
    category: "quick_craft",
    behavior: "static",
  },
  sleeping_bag: {
    placeableId: "sleeping_bag",
    assetType: "prop",
    importer: "procedural",
    meshKeys: [],
    iconKeys: ["icons/pack/misc/Effect.png"],
    category: "quick_craft",
    behavior: "static",
  },
  barracks: {
    placeableId: "barracks",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/weapons/Sword_01.png"],
    targetHeightM: 3.2,
    category: "production",
    behavior: "npc_spawn",
    notes: "modular-fortress stand-in until dedicated Barracks GLB on R2",
  },
  archery: {
    placeableId: "archery",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/weapons/Bow_01.png"],
    targetHeightM: 2.8,
    category: "production",
    behavior: "npc_spawn",
  },
  temple: {
    placeableId: "temple",
    assetType: "station",
    importer: "gltf",
    meshKeys: [P.altar],
    iconKeys: ["icons/professions/altar.png", "icons/pack/misc/Chaos_2.png"],
    targetHeightM: 2.4,
    category: "production",
    behavior: "building",
  },
  stable: {
    placeableId: "stable",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/misc/Naturecircle.png"],
    targetHeightM: 2.6,
    category: "production",
    behavior: "npc_spawn",
  },
  town_center: {
    placeableId: "town_center",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/misc/Naturecircle.png"],
    targetHeightM: 3.8,
    category: "production",
    behavior: "building",
  },
  wall: {
    placeableId: "wall",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/misc/Effect.png"],
    targetHeightM: 2.2,
    category: "defensive",
    behavior: "static",
  },
  wonder_wall: {
    placeableId: "wonder_wall",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/camp/camp_fortify.png", "icons/pack/misc/Effect.png"],
    targetHeightM: 2.8,
    category: "defensive",
    behavior: "static",
  },
  watchtower: {
    placeableId: "watchtower",
    assetType: "siege",
    importer: "gltf",
    meshKeys: [P.turret, P.turretAlt, P.cannon],
    iconKeys: ["icons/pack/misc/Chaos_2.png"],
    targetHeightM: 3.6,
    category: "defensive",
    behavior: "tower",
  },
  wall_tower: {
    placeableId: "wall_tower",
    assetType: "siege",
    importer: "gltf",
    meshKeys: [P.turret, P.turretAlt],
    iconKeys: ["icons/pack/misc/Chaos_2.png"],
    targetHeightM: 3.2,
    category: "defensive",
    behavior: "tower",
  },
  tower_house: {
    placeableId: "tower_house",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress, P.turret],
    iconKeys: ["icons/pack/misc/Chaos_2.png"],
    targetHeightM: 4.0,
    category: "defensive",
    behavior: "tower",
  },
  gate: {
    placeableId: "gate",
    assetType: "door",
    importer: "gltf",
    meshKeys: [P.door],
    iconKeys: ["icons/pack/misc/Flow.png"],
    targetHeightM: 2.8,
    category: "defensive",
    behavior: "gate",
  },
  door: {
    placeableId: "door",
    assetType: "door",
    importer: "gltf",
    meshKeys: [P.door],
    iconKeys: ["icons/pack/misc/Flow.png"],
    targetHeightM: 2.3,
    category: "defensive",
    behavior: "door",
  },
  cannon_tower: {
    placeableId: "cannon_tower",
    assetType: "siege",
    importer: "gltf",
    meshKeys: [P.cannon, P.turret],
    iconKeys: ["icons/pack/misc/Chaos_2.png"],
    targetHeightM: 1.6,
    category: "defensive",
    behavior: "tower",
  },
  bear_trap: {
    placeableId: "bear_trap",
    assetType: "trap",
    importer: "gltf",
    meshKeys: [P.bearTrap],
    iconKeys: ["icons/pack/misc/Chaos_2.png"],
    targetHeightM: 0.35,
    category: "trap",
    behavior: "trap",
  },
  spike_barrel: {
    placeableId: "spike_barrel",
    assetType: "trap",
    importer: "gltf",
    meshKeys: [P.barrel],
    iconKeys: ["icons/pack/misc/Chaos_2.png"],
    targetHeightM: 0.9,
    category: "trap",
    behavior: "trap",
  },
  work_bench: {
    placeableId: "work_bench",
    assetType: "furniture",
    importer: "gltf",
    meshKeys: [P.brew],
    iconKeys: [
      "icons/professions/workbench.png",
      "icons/pack/weapons/Hammer_01.png",
    ],
    targetHeightM: 1.0,
    category: "furniture",
    behavior: "workbench",
  },
  craft_bench: {
    placeableId: "craft_bench",
    assetType: "furniture",
    importer: "gltf",
    meshKeys: [P.brew],
    iconKeys: [
      "icons/professions/workshop.png",
      "icons/pack/weapons/Hammer_01.png",
    ],
    targetHeightM: 1.1,
    category: "furniture",
    behavior: "workbench",
  },
  training_dummy_post: {
    placeableId: "training_dummy_post",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.bag],
    iconKeys: ["icons/camp/camp_drill.png"],
    targetHeightM: 1.8,
    category: "furniture",
    behavior: "static",
  },
  farm_plot: {
    placeableId: "farm_plot",
    assetType: "prop",
    importer: "procedural",
    meshKeys: [],
    iconKeys: ["icons/pack/misc/Slash_07.png", "icons/camp/camp_husbandry.png"],
    category: "farming",
    behavior: "harvest_node",
  },
  farm_wheat: {
    placeableId: "farm_wheat",
    assetType: "prop",
    importer: "procedural",
    meshKeys: [],
    iconKeys: ["icons/camp/camp_husbandry.png"],
    category: "farming",
    behavior: "harvest_node",
  },
  farm_dirt: {
    placeableId: "farm_dirt",
    assetType: "prop",
    importer: "procedural",
    meshKeys: [],
    iconKeys: ["icons/pack/misc/Slash_07.png"],
    category: "farming",
    behavior: "harvest_node",
  },
  windmill: {
    placeableId: "windmill",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/misc/Flow.png"],
    targetHeightM: 4.0,
    category: "farming",
    behavior: "building",
  },
  market: {
    placeableId: "market",
    assetType: "station",
    importer: "gltf",
    meshKeys: [P.chest],
    iconKeys: ["icons/pack/misc/Naturecircle.png", "icons/pack/misc/Flow.png"],
    targetHeightM: 1.4,
    category: "farming",
    behavior: "building",
  },
  pen_basic: {
    placeableId: "pen_basic",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/camp/camp_husbandry.png"],
    targetHeightM: 1.8,
    category: "taming",
    behavior: "building",
  },
  stable_bond: {
    placeableId: "stable_bond",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/pack/misc/Naturecircle.png"],
    targetHeightM: 2.4,
    category: "taming",
    behavior: "npc_spawn",
  },
  beast_yard: {
    placeableId: "beast_yard",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.fortress],
    iconKeys: ["icons/camp/camp_husbandry.png"],
    targetHeightM: 2.0,
    category: "taming",
    behavior: "building",
  },
  miner_forge: {
    placeableId: "miner_forge",
    assetType: "station",
    importer: "gltf",
    meshKeys: [P.brew, P.altar],
    iconKeys: ["icons/professions/forge.png", "icons/pack/weapons/Hammer_01.png"],
    targetHeightM: 1.6,
    buildingUuid: "BLDG-20260604172217-000000-17733B6C",
    category: "station",
    behavior: "workbench",
  },
  profession_table: {
    placeableId: "profession_table",
    assetType: "station",
    importer: "gltf",
    meshKeys: [P.professionTable],
    iconKeys: [
      "icons/professions/workbench.png",
      "icons/professions/workshop.png",
    ],
    targetHeightM: 0.95,
    category: "station",
    behavior: "workbench",
    notes:
      "White table / sundial from human-props → cooking + fishing profession station",
  },
  fishing_rack: {
    placeableId: "fishing_rack",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.fishingPole],
    iconKeys: ["icons/pack/weapons/Bow_01.png", "icons/pack/misc/Naturecircle.png"],
    targetHeightM: 1.75,
    category: "utility",
    behavior: "static",
    notes: "Idle fishing pole (Rod_2)",
  },
  fishing_cast_display: {
    placeableId: "fishing_cast_display",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.fishingPoleCast],
    iconKeys: ["icons/pack/weapons/Bow_01.png"],
    targetHeightM: 1.85,
    category: "utility",
    behavior: "static",
    notes: "Fishing pole with line cast (Rod_1)",
  },
  fish_bucket: {
    placeableId: "fish_bucket",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.bucket],
    iconKeys: ["icons/pack/misc/Naturecircle.png"],
    targetHeightM: 0.55,
    category: "storage",
    behavior: "static",
  },
  bridge_long: {
    placeableId: "bridge_long",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.bridgeLong],
    iconKeys: ["icons/pack/misc/Effect.png", "icons/camp/camp_fortify.png"],
    targetHeightM: 1.2,
    category: "utility",
    behavior: "static",
    notes: "Buildable long bridge",
  },
  bridge_short: {
    placeableId: "bridge_short",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.bridgeShort],
    iconKeys: ["icons/pack/misc/Effect.png"],
    targetHeightM: 1.1,
    category: "utility",
    behavior: "static",
  },
  bridge_pontoon: {
    placeableId: "bridge_pontoon",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.bridgePontoon],
    iconKeys: ["icons/pack/misc/Flow.png"],
    targetHeightM: 0.85,
    category: "utility",
    behavior: "static",
    notes: "Pontoon / dock bridge",
  },
  dock_lamp: {
    placeableId: "dock_lamp",
    assetType: "furniture",
    importer: "gltf",
    meshKeys: [P.humanLamp],
    iconKeys: ["icons/pack/misc/Slash_07.png"],
    targetHeightM: 1.4,
    category: "furniture",
    behavior: "static",
  },
  dock_fence: {
    placeableId: "dock_fence",
    assetType: "building",
    importer: "gltf",
    meshKeys: [P.humanFence],
    iconKeys: ["icons/pack/misc/Effect.png"],
    targetHeightM: 1.1,
    category: "defensive",
    behavior: "static",
  },
  supply_crate: {
    placeableId: "supply_crate",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.humanCrate, P.chest],
    iconKeys: ["icons/pack/misc/Naturecircle.png"],
    targetHeightM: 0.55,
    category: "storage",
    behavior: "static",
  },
  storage_chest: {
    placeableId: "storage_chest",
    assetType: "prop",
    importer: "gltf",
    meshKeys: [P.chest],
    iconKeys: ["icons/pack/misc/Naturecircle.png", "icons/pack/misc/Effect.png"],
    targetHeightM: 0.75,
    buildingUuid: "BLDG-20260604172217-000006-DA8899F1",
    category: "storage",
    behavior: "static",
  },
  /** World terrain — camp / voxel production test. */
  small_island: {
    placeableId: "small_island",
    assetType: "world",
    importer: "gltf",
    meshKeys: [P.smallIsland, P.breezeIsland, P.homeIsland],
    iconKeys: ["icons/pack/misc/Naturecircle.png"],
    notes: "Documents small_island.glb staged to public/models/worlds/",
  },
};

/** master-buildings uuid → placeable id for catalog merge. */
export const BUILDING_UUID_TO_PLACEABLE: Record<string, string> = {
  "BLDG-20260604172217-000000-17733B6C": "miner_forge",
  "BLDG-20260604172217-000001-4D142E23": "work_bench",
  "BLDG-20260604172217-000002-B9533D52": "temple",
  "BLDG-20260604172217-000005-1CD0B077": "claim_flag",
  "BLDG-20260604172217-000006-DA8899F1": "storage_chest",
  "BLDG-20260604172217-000008-707A9F5B": "campfire",
  "BLDG-20260604172217-000009-4F5C4D20": "miner_forge",
  "BLDG-20260604172217-000003-B7E9F265": "craft_bench",
  "BLDG-20260604172217-000004-C926C0F5": "craft_bench",
};

export function getCampAssetBinding(placeableId: string): CampAssetBinding | undefined {
  return CAMP_ASSET_BINDINGS[placeableId];
}

/** Mesh path list for loadGltfFirst (relative keys). */
export function resolvePlaceableMeshKeys(
  placeableId: string,
  fallbackMeshUrl?: string,
): string[] {
  const b = CAMP_ASSET_BINDINGS[placeableId];
  const keys = b?.meshKeys?.slice() ?? [];
  if (fallbackMeshUrl) {
    // Strip origin / leading slash for fleet candidates
    const rel = fallbackMeshUrl
      .replace(/^https?:\/\/[^/]+\//i, "")
      .replace(/^\//, "");
    if (rel && !keys.includes(rel)) keys.push(rel);
  }
  return keys;
}

/** Icon path list; first entry is preferred UI icon. */
export function resolvePlaceableIconKeys(
  placeableId: string,
  fallbackIcon?: string,
): string[] {
  const b = CAMP_ASSET_BINDINGS[placeableId];
  const keys = b?.iconKeys?.slice() ?? [];
  if (fallbackIcon) {
    const rel = fallbackIcon
      .replace(/^https?:\/\/[^/]+\//i, "")
      .replace(/^\//, "");
    if (rel && !keys.includes(rel)) keys.unshift(rel);
  }
  return keys;
}

/**
 * Apply canonical scale: optional uniform meshScale, then fit bbox height to
 * targetHeightM so fortress kit pieces match placeable footprints.
 */
export function applyCanonicalScale(
  root: import("three").Object3D,
  placeableId: string,
  opts?: { meshScale?: number; targetHeightM?: number; fitHeight?: boolean },
  THREE?: typeof import("three"),
): void {
  // Caller should pass THREE; fallback dynamic import pattern avoided for sync scale.
  const T = THREE;
  if (!T) {
    // Minimal no-THREE path: only uniform scale if provided
    const b = CAMP_ASSET_BINDINGS[placeableId];
    const uniform = opts?.meshScale ?? b?.meshScale;
    if (uniform && uniform !== 1) root.scale.multiplyScalar(uniform);
    return;
  }
  const b = CAMP_ASSET_BINDINGS[placeableId];
  const uniform = opts?.meshScale ?? b?.meshScale;
  if (uniform && uniform !== 1) {
    root.scale.multiplyScalar(uniform);
  }
  // Worlds / author-scale meshes: fitHeight: false skips bbox height fit
  if (opts?.fitHeight === false) return;
  const targetH = opts?.targetHeightM ?? b?.targetHeightM;
  if (!targetH || targetH <= 0) return;
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root);
  const h = box.max.y - box.min.y;
  if (h < 1e-4) return;
  const s = targetH / h;
  root.scale.multiplyScalar(s);
  // Re-seat so local min Y sits on y=0 (ghost/solid origin at ground)
  root.updateMatrixWorld(true);
  const box2 = new T.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

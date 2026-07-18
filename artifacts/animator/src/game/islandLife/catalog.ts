/**
 * Island Life — survival RPG / Minecraft-like island SSOT.
 *
 * Map: D:/Games/Models/island_life.glb (Mineways Minecraft island ~451 MB)
 * Production: R2 `models/worlds/island_life.glb` (large — optional until uploaded).
 *
 * Enemies:
 *  - Orc_Free + Bandits_Free → polyart GLBs (tribe / outlaw)
 *  - Golem_Free + Elf_Free → models/events/* (events, NPC, neutral nodes)
 * Assist (anims / voxel temps):
 *  - Free Essential Animation CC0 → anim/assist/essential-cc0
 *  - voxVoxel RPG Characters And Weapons → models/assist/voxel-rpg
 * Blocks: minecrafts_trailer_style_ores.glb
 * Wildlife: Blockbench / voxel only — never COTW photoreal animals.
 *
 * Runtime: prefer CDN when ready; otherwise fall back to smaller outdoor islands
 * so Studio never hard-depends on a 451 MB 404.
 */

export const ISLAND_LIFE_SOURCE = "D:/Games/Models/island_life.glb";
export const ORES_SOURCE = "D:/Games/Models/minecrafts_trailer_style_ores.glb";
export const ORC_ZIP = "D:/Games/Models/Orc_Free.zip";
export const BANDIT_ZIP = "D:/Games/Models/Bandits_Free.zip";
export const GOLEM_ZIP = "D:/Games/Models/Golem_Free.zip";
export const ELF_ZIP = "D:/Games/Models/Elf_Free.zip";
export const ESSENTIAL_ANIM_ZIP = "D:/Games/Models/Free Essential Animation CC0 (1).zip";
export const VOXEL_RPG_ZIP = "D:/Games/Models/voxVoxel RPG Characters And Weapons.zip";

/** Primary map key (R2). */
export const ISLAND_LIFE_R2_KEY = "models/worlds/island_life.glb";

/**
 * Public / CDN keys once staged.
 * Fallbacks keep harvest/sail playable if island_life is not on CDN yet.
 */
export const ISLAND_LIFE_MESH_KEYS = [
  "models/worlds/island_life.glb",
  "models/worlds/sailtest.glb",
  "models/worlds/small_island.glb",
  "models/worlds/breeze-island.glb",
] as const;

/** True when we should attempt the heavy map first (always; loadGltfFirst chains). */
export const ISLAND_LIFE_CDN =
  "https://assets.grudge-studio.com/models/worlds/island_life.glb";

export const ORE_PACK_KEYS = [
  "models/blocks/minecrafts_trailer_style_ores.glb",
] as const;

/** Red mushroom world-space anchors from island_life material batches (Sketchfab-normalized → scaled in loader). */
export const RED_MUSHROOM_ANCHORS = [
  {
    id: "red-mushroom-cap-a",
    material: "Red_Mushroom",
    /** Normalized local center after root Y-up matrix */
    local: { x: 0.369, y: 0.369, z: -0.85 },
    tribe: "orc_tribe" as const,
  },
  {
    id: "red-mushroom-block-b",
    material: "Red_Mushroom_Block",
    local: { x: -0.066, y: 0.595, z: 0.609 },
    tribe: "outlaw_camp" as const,
  },
] as const;

/**
 * Neutral golem nodes + elf raid / iron elite events (Golem_Free + Elf_Free).
 * Offsets are in island local space (same frame as mushroom anchors).
 */
export const ISLAND_EVENT_NODE_ANCHORS = [
  {
    id: "golem-node-ridge",
    campId: "island_golem_node" as const,
    local: { x: 0.12, y: 0.42, z: -0.35 },
  },
  {
    id: "elf-raid-grove",
    campId: "island_elf_raid" as const,
    local: { x: -0.28, y: 0.5, z: 0.22 },
  },
  {
    id: "iron-golem-event",
    campId: "island_iron_elite" as const,
    local: { x: 0.45, y: 0.55, z: 0.1 },
  },
] as const;

/** Island materials we treat as editable / harvest blocks. */
export const ISLAND_EDITABLE_BLOCKS = [
  { mc: "Dirt", terrain: "dirt", cat: null },
  { mc: "Grass_Block", terrain: "grass", cat: null },
  { mc: "Cobblestone", terrain: "stone", cat: null },
  { mc: "Coal_Ore", terrain: "coal", cat: null },
  { mc: "Iron_Ore", terrain: "iron", cat: null },
  { mc: "Gold_Ore", terrain: "gold", cat: null },
  { mc: "Diamond_Ore", terrain: "diamond", cat: null },
  { mc: "Emerald_Ore", terrain: "emerald", cat: null },
  { mc: "Lapis_Lazuli_Ore", terrain: "lapis", cat: null },
  { mc: "Redstone_Ore", terrain: "redstone", cat: null },
  { mc: "Block_of_Gold", terrain: "gold", cat: null },
  { mc: "Oak_Log", terrain: "log", cat: null },
  { mc: "Oak_Planks", terrain: "woodPlanks", cat: null },
  { mc: "Crafting_Table", terrain: "blockSquare", cat: "cat:nano-furnace-block" },
  { mc: "Chest", terrain: "blockSquare", cat: "cat:quantum-vault-block" },
  { mc: "Furnace", terrain: "brickGrey", cat: "cat:thermal-reactor-block" },
  { mc: "Barrel", terrain: "woodPlanks", cat: null },
  { mc: "Bedrock", terrain: "deep", cat: null },
] as const;

/** Trailer-style ore pack — placeable palette for build / mine. */
export const TRAILER_ORE_PALETTE = [
  { id: "ore-coal", label: "Coal Ore", terrain: "coal", source: "trailer-ores" },
  { id: "ore-iron", label: "Iron Ore", terrain: "iron", source: "trailer-ores" },
  { id: "ore-gold", label: "Gold Ore", terrain: "gold", source: "trailer-ores" },
  { id: "ore-diamond", label: "Diamond Ore", terrain: "diamond", source: "trailer-ores" },
  { id: "ore-emerald", label: "Emerald Ore", terrain: "emerald", source: "trailer-ores" },
  { id: "ore-lapis", label: "Lapis Ore", terrain: "lapis", source: "trailer-ores" },
  { id: "ore-redstone", label: "Redstone Ore", terrain: "redstone", source: "trailer-ores" },
] as const;

/** Converted polyart enemies (from Orc_Free / Bandits_Free FBX). */
export const ISLAND_ENEMY_UNITS = {
  orc_ash_walker: {
    id: "orc_ash_walker",
    name: "Ash Walker",
    role: "tribe",
    meshKeys: ["models/enemies/polyart/orcs/ash-walker.glb"],
    heightM: 1.9,
    hp: 110,
    damage: 16,
    speed: 2.3,
    atkReach: 1.8,
    xp: 55,
  },
  orc_bone_whittler: {
    id: "orc_bone_whittler",
    name: "Bone Whittler",
    role: "tribe_elite",
    meshKeys: ["models/enemies/polyart/orcs/bone-whittler.glb"],
    heightM: 1.95,
    hp: 140,
    damage: 20,
    speed: 2.1,
    atkReach: 1.9,
    xp: 80,
  },
  orc_ironbound: {
    id: "orc_ironbound",
    name: "Ironbound Marauder",
    role: "tribe_elite",
    meshKeys: ["models/enemies/polyart/orcs/ironbound-marauder.glb"],
    heightM: 2.0,
    hp: 160,
    damage: 22,
    speed: 2.0,
    atkReach: 2.0,
    xp: 95,
  },
  bandit_poacher: {
    id: "bandit_poacher",
    name: "Poacher",
    role: "raider",
    meshKeys: ["models/enemies/polyart/bandits/poacher.glb"],
    heightM: 1.8,
    hp: 75,
    damage: 12,
    speed: 2.8,
    atkReach: 1.6,
    xp: 35,
  },
  bandit_scavenger: {
    id: "bandit_scavenger",
    name: "Scavenger",
    role: "raider",
    meshKeys: ["models/enemies/polyart/bandits/scavenger.glb"],
    heightM: 1.8,
    hp: 70,
    damage: 11,
    speed: 2.9,
    atkReach: 1.55,
    xp: 32,
  },
  bandit_thug: {
    id: "bandit_thug",
    name: "Thug",
    role: "raider",
    meshKeys: ["models/enemies/polyart/bandits/thug.glb"],
    heightM: 1.85,
    hp: 95,
    damage: 15,
    speed: 2.5,
    atkReach: 1.7,
    xp: 45,
  },
} as const;

/** Voxel/Blockbench wildlife only (no COTW). */
export const ISLAND_VOXEL_WILDLIFE = [
  {
    id: "voxel-wolf",
    label: "Wolf",
    meshKeys: ["models/battle/animals/wolf.glb", "models/battle/animals/minecraft-animals.glb"],
  },
  {
    id: "voxel-bear",
    label: "Bear",
    meshKeys: ["models/battle/animals/bear.glb"],
  },
  {
    id: "voxel-deer",
    label: "Deer",
    meshKeys: ["models/battle/animals/deer.glb"],
  },
  {
    id: "voxel-buffalo",
    label: "Buffalo",
    meshKeys: ["models/battle/animals/buffalo.glb"],
  },
] as const;

export type RaidConfig = {
  /** Seconds between raid attempts */
  intervalSec: number;
  /** First raid delay after map load */
  firstDelaySec: number;
  minRaiders: number;
  maxRaiders: number;
  boatMeshKey: string | null;
  approachDistance: number;
};

export const DEFAULT_RAID: RaidConfig = {
  intervalSec: 180,
  firstDelaySec: 90,
  minRaiders: 3,
  maxRaiders: 5,
  boatMeshKey: null, // procedural voxel boat if null
  approachDistance: 28,
};

/**
 * Map Sketchfab-normalized mushroom local coords → play space.
 * Island loader scales AABB to ~islandRadius world units.
 */
export function mushroomWorldPos(
  local: { x: number; y: number; z: number },
  islandRadius = 64,
  scaleFromNormalized = 48,
): { x: number; y: number; z: number } {
  return {
    x: local.x * scaleFromNormalized,
    y: Math.max(0, local.y * scaleFromNormalized * 0.35),
    z: local.z * scaleFromNormalized,
  };
}

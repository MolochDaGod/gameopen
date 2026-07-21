/**
 * Island / event NPC + neutral enemy nodes SSOT.
 *
 * Sources (local packs → public/models):
 *  - Golem_Free → models/events/golem/* (earth / iron / rock)
 *  - Elf_Free   → models/events/elf/* (base / fire / ice + weapons)
 *
 * Assist packs (not primary enemy SSOT — use when rigs/anims/weapons need help):
 *  - Free Essential Animation CC0 → public/anim/assist/essential-cc0/{Idle,Run,Attack,Hit,Death}.fbx
 *  - voxVoxel RPG Characters And Weapons → public/models/assist/voxel-rpg/TPose_Character*.fbx
 *
 * Used by: island neutral nodes, event spawns, camp/jungle extras, NPC hostiles.
 */

export type IslandNodeRole =
  | "neutral_node"
  | "event_hostile"
  | "event_elite"
  | "npc_hostile"
  | "npc_neutral";

export type IslandEnemyUnit = {
  id: string;
  name: string;
  role: IslandNodeRole;
  /** Prefer GLB (web). FBX kept as source alongside for re-bake. */
  meshKeys: string[];
  heightM: number;
  hp: number;
  damage: number;
  speed: number;
  atkReach: number;
  xp: number;
  /** Optional weapon mesh for elves */
  weaponKeys?: string[];
  tags: string[];
  /** Event / island placement hints */
  nodeHints?: string[];
};

export type IslandEnemyCatalog = {
  version: string;
  label: string;
  units: IslandEnemyUnit[];
  /** Assist pack paths (docs / tooling) */
  assist: {
    essentialAnims: string[];
    voxelCharacters: string[];
  };
};

/** Golem free pack → island neutral / event brutes */
export const GOLEM_UNITS: IslandEnemyUnit[] = [
  {
    id: "golem_earth",
    name: "Earth Golem",
    role: "neutral_node",
    meshKeys: [
      "models/events/golem/Earth_Golem.glb",
      "models/events/golem/Earth_Golem.fbx",
    ],
    heightM: 2.2,
    hp: 160,
    damage: 20,
    speed: 1.6,
    atkReach: 2.0,
    xp: 90,
    tags: ["island", "event", "golem", "neutral_node", "earth"],
    nodeHints: ["stone_outcrop", "mine_rim", "ruined_altar"],
  },
  {
    id: "golem_iron",
    name: "Iron Golem",
    role: "event_elite",
    meshKeys: [
      "models/events/golem/Iron_Golem.glb",
      "models/events/golem/Iron_Golem.fbx",
    ],
    heightM: 2.35,
    hp: 220,
    damage: 26,
    speed: 1.45,
    atkReach: 2.1,
    xp: 140,
    tags: ["island", "event", "golem", "elite", "iron"],
    nodeHints: ["forge_event", "siege_camp", "world_boss_satellite"],
  },
  {
    id: "golem_rock",
    name: "Rock Golem",
    role: "npc_hostile",
    meshKeys: [
      "models/events/golem/Rock_Golem.glb",
      "models/events/golem/Rock_Golem.fbx",
    ],
    heightM: 2.25,
    hp: 180,
    damage: 22,
    speed: 1.55,
    atkReach: 2.05,
    xp: 110,
    tags: ["island", "event", "golem", "hostile", "rock"],
    nodeHints: ["cliff_patrol", "quarry_node", "pass_guard"],
  },
];

/** Elf free pack → island event elves / elemental hostiles */
export const ELF_UNITS: IslandEnemyUnit[] = [
  {
    id: "elf_forest",
    name: "Forest Elf",
    role: "npc_neutral",
    meshKeys: ["models/events/elf/Elf.glb", "models/events/elf/Elf.fbx"],
    weaponKeys: [
      "models/events/elf/Sword_Elf.glb",
      "models/events/elf/Sword_Elf.fbx",
      "models/events/elf/Crystal_Spear_Elf.glb",
    ],
    heightM: 1.75,
    hp: 75,
    damage: 14,
    speed: 3.0,
    atkReach: 1.7,
    xp: 45,
    tags: ["island", "event", "elf", "npc", "neutral"],
    nodeHints: ["grove_npc", "quest_giver_hostile_opt", "patrol_path"],
  },
  {
    id: "elf_fire",
    name: "Fire Elf",
    role: "event_hostile",
    meshKeys: [
      "models/events/elf/Fire_Elf.glb",
      "models/events/elf/Fire_Elf.fbx",
    ],
    weaponKeys: [
      "models/events/elf/Magma_Staff_Elf.glb",
      "models/events/elf/Magma_Staff_Elf.fbx",
    ],
    heightM: 1.8,
    hp: 95,
    damage: 18,
    speed: 2.9,
    atkReach: 1.85,
    xp: 70,
    tags: ["island", "event", "elf", "fire", "hostile"],
    nodeHints: ["ember_event", "ritual_fire", "night_raid"],
  },
  {
    id: "elf_ice",
    name: "Ice Elf",
    role: "event_hostile",
    meshKeys: [
      "models/events/elf/Ice_Elf.glb",
      "models/events/elf/Ice_Elf.fbx",
    ],
    weaponKeys: [
      "models/events/elf/Crystal_Spear_Elf.glb",
      "models/events/elf/Crystal_Spear_Elf.fbx",
    ],
    heightM: 1.8,
    hp: 100,
    damage: 17,
    speed: 2.7,
    atkReach: 2.0,
    xp: 75,
    tags: ["island", "event", "elf", "ice", "hostile"],
    nodeHints: ["frost_node", "shore_event", "winter_patrol"],
  },
];

/** Volcano / Hellmaw / boss-event world boss + ranged minions */
export const VOLCANO_BOSS_UNITS: IslandEnemyUnit[] = [
  {
    id: "shadow_flame_mantis",
    name: "Shadow Flame Mantis",
    role: "event_elite",
    meshKeys: [
      "models/bosses/shadow-flame-mantis.prod.glb",
      "models/bosses/shadow-flame-mantis.glb",
    ],
    heightM: 3.2,
    hp: 4200,
    damage: 48,
    speed: 3.4,
    atkReach: 3.2,
    xp: 1200,
    tags: [
      "island",
      "event",
      "world_boss",
      "boss_event",
      "volcano",
      "hellmaw",
      "volcanic",
      "mantis",
    ],
    nodeHints: [
      "world_boss",
      "volcano_caldera",
      "hellmaw_depths",
      "boss_event_island",
      "sector_s",
    ],
  },
  {
    id: "volcano_ghast",
    name: "Ash Ghast",
    role: "event_hostile",
    meshKeys: [
      "models/enemies/volcano/minecraft-ghast.prod.glb",
      "models/enemies/volcano/minecraft-ghast.glb",
    ],
    heightM: 2.4,
    hp: 180,
    damage: 22,
    speed: 2.8,
    atkReach: 28,
    xp: 95,
    tags: [
      "island",
      "event",
      "volcano",
      "hellmaw",
      "volcanic",
      "ranged",
      "flying",
      "ghast",
      "summon",
    ],
    nodeHints: [
      "volcano_patrol",
      "caldera_air",
      "shadow_call_summon",
      "boss_event_island",
    ],
  },
];

export const ISLAND_EVENT_ENEMY_CATALOG: IslandEnemyCatalog = {
  version: "1.1.0",
  label: "Island events · NPC · neutral · volcano world boss",
  units: [...GOLEM_UNITS, ...ELF_UNITS, ...VOLCANO_BOSS_UNITS],
  assist: {
    essentialAnims: [
      "anim/assist/essential-cc0/Idle.fbx",
      "anim/assist/essential-cc0/Run.fbx",
      "anim/assist/essential-cc0/Attack.fbx",
      "anim/assist/essential-cc0/Hit.fbx",
      "anim/assist/essential-cc0/Death.fbx",
    ],
    voxelCharacters: [
      "models/assist/voxel-rpg/TPose_Character.fbx",
      "models/assist/voxel-rpg/TPose_Character01.fbx",
      "models/assist/voxel-rpg/TPose_Character02.fbx",
      "models/assist/voxel-rpg/TPose_Character03.fbx",
      "models/assist/voxel-rpg/TPose_Character04.fbx",
      "models/assist/voxel-rpg/TPose_Character05.fbx",
      "models/assist/voxel-rpg/TPose_Character06.fbx",
      "models/assist/voxel-rpg/TPose_Character07.fbx",
      "models/assist/voxel-rpg/TPose_Character08.fbx",
      "models/assist/voxel-rpg/TPose_Character09.fbx",
      "models/assist/voxel-rpg/TPose_Character10.fbx",
      "models/assist/voxel-rpg/TPose_Character11.fbx",
    ],
  },
};

export function listNeutralNodeUnits(): IslandEnemyUnit[] {
  return ISLAND_EVENT_ENEMY_CATALOG.units.filter(
    (u) => u.role === "neutral_node" || u.tags.includes("neutral_node"),
  );
}

export function listEventHostileUnits(): IslandEnemyUnit[] {
  return ISLAND_EVENT_ENEMY_CATALOG.units.filter(
    (u) =>
      u.role === "event_hostile" ||
      u.role === "event_elite" ||
      u.role === "npc_hostile",
  );
}

export function getIslandEnemy(id: string): IslandEnemyUnit | undefined {
  return ISLAND_EVENT_ENEMY_CATALOG.units.find((u) => u.id === id);
}

/** Map island unit → forest-creep-shaped row for CampEnemySystem / jungle. */
export function islandUnitAsForestCreep(u: IslandEnemyUnit) {
  return {
    id: u.id,
    name: u.name,
    role:
      u.role === "event_elite"
        ? "jungle_boss"
        : u.role === "neutral_node"
          ? "camp_elite"
          : "camp_melee",
    meshKeys: u.meshKeys,
    heightM: u.heightM,
    hp: u.hp,
    damage: u.damage,
    speed: u.speed,
    atkReach: u.atkReach,
    xp: u.xp,
    buffOnKill: u.role === "event_elite" ? "purple_might" : null,
    tags: u.tags,
  };
}

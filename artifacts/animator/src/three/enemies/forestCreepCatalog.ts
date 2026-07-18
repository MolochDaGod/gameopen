/**
 * Forest / camp / jungle creep SSOT.
 * Used by:
 *  - Voxel + sailtest/forest camp enemies (Studio / ForestWorld)
 *  - Warlords Genesis MOBA jungle camps (buff + XP)
 *  - Island events / neutral nodes (Golem_Free + Elf_Free packs)
 *
 * Assist (not primary enemy meshes):
 *  - anim/assist/essential-cc0 — CC0 Idle/Run/Attack/Hit/Death
 *  - models/assist/voxel-rpg — voxel T-pose character kit
 */

import { fetchCatalogJson } from "../../lib/fleetSsot";

export type ForestCreepRole =
  | "camp_elite"
  | "camp_melee"
  | "camp_swarm"
  | "jungle_camp"
  | "jungle_boss";

export type ForestCreepUnit = {
  id: string;
  name: string;
  role: ForestCreepRole | string;
  meshKeys: string[];
  heightM: number;
  hp: number;
  damage: number;
  speed: number;
  atkReach: number;
  xp: number;
  buffOnKill: string | null;
  tags: string[];
};

export type JungleBuffDef = {
  id: string;
  name: string;
  durationSec: number;
  effects: Record<string, number>;
  color: string;
};

export type CampSpawnLine = { unitId: string; count: number; radius: number };

export type CreepCampDef = {
  id: string;
  label: string;
  use: string[];
  buffOnClear?: string;
  xpBonus?: number;
  spawns: CampSpawnLine[];
};

export type ForestCreepCatalog = {
  version: string;
  units: ForestCreepUnit[];
  buffs: Record<string, JungleBuffDef>;
  camps: Record<string, Omit<CreepCampDef, "id">>;
};

const LOCAL = `${import.meta.env.BASE_URL}content/enemies/forest-creeps.json`;

/** Built-in fallback if JSON fetch fails. */
export const FALLBACK_FOREST_CREEPS: ForestCreepCatalog = {
  version: "1.0.0-fallback",
  units: [
    {
      id: "forest_bear",
      name: "Forest Bear",
      role: "camp_elite",
      meshKeys: ["models/battle/animals/bear.glb", "models/battle/animals/minecraft-animals.glb"],
      heightM: 1.6,
      hp: 120,
      damage: 18,
      speed: 2.4,
      atkReach: 1.9,
      xp: 85,
      buffOnKill: "red_rage",
      tags: ["camp", "jungle", "elite", "voxel"],
    },
    {
      id: "forest_skeleton",
      name: "Forest Skeleton",
      role: "camp_melee",
      meshKeys: ["models/creatures/skeleton-warrior.glb"],
      heightM: 1.85,
      hp: 70,
      damage: 14,
      speed: 2.8,
      atkReach: 1.7,
      xp: 40,
      buffOnKill: "blue_haste",
      tags: ["camp", "jungle"],
    },
    {
      id: "forest_zombie",
      name: "Moss Zombie",
      role: "camp_swarm",
      meshKeys: ["models/enemies/voxel-zombies/voxel-zombie-1.glb"],
      heightM: 1.7,
      hp: 45,
      damage: 10,
      speed: 2.1,
      atkReach: 1.5,
      xp: 22,
      buffOnKill: null,
      tags: ["camp", "jungle", "voxel"],
    },
    {
      id: "forest_zombie_brute",
      name: "Brute Zombie",
      role: "camp_melee",
      meshKeys: ["models/enemies/voxel-zombies/voxel-zombie-3.glb"],
      heightM: 1.85,
      hp: 90,
      damage: 16,
      speed: 2.0,
      atkReach: 1.7,
      xp: 50,
      buffOnKill: "green_regen",
      tags: ["camp", "jungle", "voxel"],
    },
    {
      id: "jungle_orc",
      name: "Jungle Orc",
      role: "jungle_camp",
      meshKeys: ["models/orc.glb"],
      heightM: 1.95,
      hp: 100,
      damage: 17,
      speed: 2.5,
      atkReach: 1.8,
      xp: 65,
      buffOnKill: "red_rage",
      tags: ["jungle", "moba"],
    },
    {
      id: "orc_ash_walker",
      name: "Ash Walker",
      role: "camp_melee",
      meshKeys: ["models/enemies/polyart/orcs/ash-walker.glb"],
      heightM: 1.9,
      hp: 110,
      damage: 16,
      speed: 2.3,
      atkReach: 1.8,
      xp: 55,
      buffOnKill: "red_rage",
      tags: ["island-life", "tribe", "orc"],
    },
    {
      id: "orc_bone_whittler",
      name: "Bone Whittler",
      role: "camp_elite",
      meshKeys: ["models/enemies/polyart/orcs/bone-whittler.glb"],
      heightM: 1.95,
      hp: 140,
      damage: 20,
      speed: 2.1,
      atkReach: 1.9,
      xp: 80,
      buffOnKill: "red_rage",
      tags: ["island-life", "tribe", "orc", "elite"],
    },
    {
      id: "orc_ironbound",
      name: "Ironbound Marauder",
      role: "camp_elite",
      meshKeys: ["models/enemies/polyart/orcs/ironbound-marauder.glb"],
      heightM: 2.0,
      hp: 160,
      damage: 22,
      speed: 2.0,
      atkReach: 2.0,
      xp: 95,
      buffOnKill: "purple_might",
      tags: ["island-life", "tribe", "orc", "elite"],
    },
    {
      id: "golem_earth",
      name: "Earth Golem",
      role: "camp_elite",
      meshKeys: ["models/events/golem/Earth_Golem.glb"],
      heightM: 2.2,
      hp: 160,
      damage: 20,
      speed: 1.6,
      atkReach: 2.0,
      xp: 90,
      buffOnKill: null,
      tags: ["island", "event", "golem", "neutral_node"],
    },
    {
      id: "golem_iron",
      name: "Iron Golem",
      role: "jungle_boss",
      meshKeys: ["models/events/golem/Iron_Golem.glb"],
      heightM: 2.35,
      hp: 220,
      damage: 26,
      speed: 1.45,
      atkReach: 2.1,
      xp: 140,
      buffOnKill: "purple_might",
      tags: ["island", "event", "golem", "elite"],
    },
    {
      id: "golem_rock",
      name: "Rock Golem",
      role: "camp_elite",
      meshKeys: ["models/events/golem/Rock_Golem.glb"],
      heightM: 2.25,
      hp: 180,
      damage: 22,
      speed: 1.55,
      atkReach: 2.05,
      xp: 110,
      buffOnKill: null,
      tags: ["island", "event", "golem"],
    },
    {
      id: "elf_fire",
      name: "Fire Elf",
      role: "camp_melee",
      meshKeys: ["models/events/elf/Fire_Elf.glb"],
      heightM: 1.8,
      hp: 95,
      damage: 18,
      speed: 2.9,
      atkReach: 1.85,
      xp: 70,
      buffOnKill: "red_rage",
      tags: ["island", "event", "elf"],
    },
    {
      id: "elf_ice",
      name: "Ice Elf",
      role: "camp_melee",
      meshKeys: ["models/events/elf/Ice_Elf.glb"],
      heightM: 1.8,
      hp: 100,
      damage: 17,
      speed: 2.7,
      atkReach: 2.0,
      xp: 75,
      buffOnKill: "blue_haste",
      tags: ["island", "event", "elf"],
    },
    {
      id: "bandit_poacher",
      name: "Poacher",
      role: "camp_swarm",
      meshKeys: ["models/enemies/polyart/bandits/poacher.glb"],
      heightM: 1.8,
      hp: 75,
      damage: 12,
      speed: 2.8,
      atkReach: 1.6,
      xp: 35,
      buffOnKill: null,
      tags: ["island-life", "raider", "bandit"],
    },
    {
      id: "bandit_scavenger",
      name: "Scavenger",
      role: "camp_swarm",
      meshKeys: ["models/enemies/polyart/bandits/scavenger.glb"],
      heightM: 1.8,
      hp: 70,
      damage: 11,
      speed: 2.9,
      atkReach: 1.55,
      xp: 32,
      buffOnKill: null,
      tags: ["island-life", "raider", "bandit"],
    },
    {
      id: "bandit_thug",
      name: "Thug",
      role: "camp_melee",
      meshKeys: ["models/enemies/polyart/bandits/thug.glb"],
      heightM: 1.85,
      hp: 95,
      damage: 15,
      speed: 2.5,
      atkReach: 1.7,
      xp: 45,
      buffOnKill: "blue_haste",
      tags: ["island-life", "raider", "bandit", "outlaw"],
    },
    {
      id: "jungle_ogre",
      name: "Jungle Ogre",
      role: "jungle_boss",
      meshKeys: ["models/ogre.glb"],
      heightM: 2.4,
      hp: 220,
      damage: 28,
      speed: 1.9,
      atkReach: 2.2,
      xp: 180,
      buffOnKill: "purple_might",
      tags: ["jungle", "moba", "elite"],
    },
  ],
  buffs: {
    blue_haste: {
      id: "blue_haste",
      name: "Blue Haste",
      durationSec: 45,
      effects: { moveSpeedMul: 1.12, atkSpeedMul: 1.08 },
      color: "#4fc3ff",
    },
    red_rage: {
      id: "red_rage",
      name: "Red Rage",
      durationSec: 40,
      effects: { damageMul: 1.15 },
      color: "#ff5a4a",
    },
    green_regen: {
      id: "green_regen",
      name: "Green Regen",
      durationSec: 50,
      effects: { hpRegenPerSec: 2.5 },
      color: "#6ee7a0",
    },
    purple_might: {
      id: "purple_might",
      name: "Purple Might",
      durationSec: 60,
      effects: { damageMul: 1.2, maxHpMul: 1.1 },
      color: "#b48cff",
    },
  },
  camps: {
    voxel_camp: {
      label: "Voxel camp hostiles",
      use: ["sailtest", "forest-map", "voxel"],
      spawns: [
        { unitId: "forest_zombie", count: 4, radius: 10 },
        { unitId: "forest_skeleton", count: 2, radius: 12 },
        { unitId: "forest_bear", count: 1, radius: 8 },
      ],
    },
    island_orc_tribe: {
      label: "Island orc tribe (red mushroom)",
      use: ["island-life"],
      buffOnClear: "red_rage",
      xpBonus: 60,
      spawns: [
        { unitId: "orc_ash_walker", count: 2, radius: 4 },
        { unitId: "orc_bone_whittler", count: 1, radius: 3 },
        { unitId: "orc_ironbound", count: 1, radius: 2.5 },
      ],
    },
    island_outlaw_camp: {
      label: "Island outlaws (red mushroom block)",
      use: ["island-life"],
      buffOnClear: "blue_haste",
      xpBonus: 40,
      spawns: [
        { unitId: "bandit_thug", count: 2, radius: 3.5 },
        { unitId: "bandit_poacher", count: 2, radius: 4 },
        { unitId: "bandit_scavenger", count: 1, radius: 3 },
      ],
    },
    jungle_blue: {
      label: "Blue jungle camp",
      use: ["warlord-genesis-moba"],
      buffOnClear: "blue_haste",
      xpBonus: 40,
      spawns: [
        { unitId: "forest_skeleton", count: 2, radius: 3 },
        { unitId: "forest_zombie", count: 2, radius: 3.5 },
      ],
    },
    jungle_red: {
      label: "Red jungle camp",
      use: ["warlord-genesis-moba"],
      buffOnClear: "red_rage",
      xpBonus: 55,
      spawns: [
        { unitId: "jungle_orc", count: 2, radius: 3 },
        { unitId: "forest_zombie_brute", count: 1, radius: 2.5 },
      ],
    },
    jungle_green: {
      label: "Green jungle camp",
      use: ["warlord-genesis-moba"],
      buffOnClear: "green_regen",
      xpBonus: 45,
      spawns: [
        { unitId: "forest_zombie", count: 3, radius: 3.2 },
        { unitId: "forest_skeleton", count: 1, radius: 2.8 },
      ],
    },
    jungle_epic: {
      label: "Epic jungle (ogre)",
      use: ["warlord-genesis-moba"],
      buffOnClear: "purple_might",
      xpBonus: 120,
      spawns: [
        { unitId: "jungle_ogre", count: 1, radius: 0 },
        { unitId: "forest_zombie", count: 2, radius: 4 },
      ],
    },
  },
};

let cache: ForestCreepCatalog | null = null;

export async function loadForestCreepCatalog(): Promise<ForestCreepCatalog> {
  if (cache) return cache;
  try {
    const r = await fetch(LOCAL, { mode: "cors" });
    if (r.ok) {
      const j = (await r.json()) as ForestCreepCatalog;
      if (j?.units?.length) {
        cache = j;
        return j;
      }
    }
  } catch {
    /* fall through */
  }
  const fleet = await fetchCatalogJson<ForestCreepCatalog>("enemies/forest-creeps.json");
  if (fleet?.units?.length) {
    cache = fleet;
    return fleet;
  }
  cache = FALLBACK_FOREST_CREEPS;
  return cache;
}

export function getCreepUnit(
  cat: ForestCreepCatalog,
  id: string,
): ForestCreepUnit | undefined {
  return cat.units.find((u) => u.id === id);
}

export function listCampsForUse(
  cat: ForestCreepCatalog,
  useTag: string,
): CreepCampDef[] {
  return Object.entries(cat.camps)
    .filter(([, c]) => c.use.includes(useTag))
    .map(([id, c]) => ({ id, ...c }));
}

/** Expand camp spawn lines into unit instances with local offsets. */
export function expandCampSpawns(
  cat: ForestCreepCatalog,
  campId: string,
  center: { x: number; z: number },
): Array<{ unit: ForestCreepUnit; x: number; z: number }> {
  const camp = cat.camps[campId];
  if (!camp) return [];
  const out: Array<{ unit: ForestCreepUnit; x: number; z: number }> = [];
  for (const line of camp.spawns) {
    const unit = getCreepUnit(cat, line.unitId);
    if (!unit) continue;
    for (let i = 0; i < line.count; i++) {
      const a = (i / Math.max(1, line.count)) * Math.PI * 2 + Math.random() * 0.4;
      const r = line.radius * (0.4 + Math.random() * 0.6);
      out.push({
        unit,
        x: center.x + Math.cos(a) * r,
        z: center.z + Math.sin(a) * r,
      });
    }
  }
  return out;
}

/**
 * Dungeon bosses & elites as **player-like grudge6 characters**.
 *
 * No karate-boss / capsule heroes: full race kit + cool armour preset,
 * weapon tier, skill tree slots, attributes, and AI behaviour tags.
 *
 * Stats scale like a high-level player so the same gear/skill systems apply.
 */

import type { WeaponId } from "../types";
import type { RaceId } from "../grudge/raceAssets";
import type { PresetId } from "../grudge/gearPresets";
import { getPreset } from "../grudge/gearPresets";
import type { EntityPrefab, CombatStyle } from "../ummorpg/prefabProfile";
import { WEAPON_COMBAT } from "../ummorpg/prefabProfile";

/** Player-like attributes (diminishing returns applied in damage later). */
export interface BossAttributes {
  strength: number;
  agility: number;
  intellect: number;
  vitality: number;
  spirit: number;
  luck: number;
  endurance: number;
  willpower: number;
}

export type BossAiBehavior =
  | "melee_pressure"
  | "ranged_kite"
  | "caster_burst"
  | "hybrid_elite";

export interface DungeonBossProfile {
  id: string;
  /** Display name on boss bar / select. */
  name: string;
  raceId: RaceId;
  /** Cool armour class (knight/warrior = heavy plate looks). */
  presetId: PresetId;
  /** Explicit mesh visibility override (armour + weapon from gear preset if omitted). */
  meshIds?: string[];
  weaponId: WeaponId;
  offHand: WeaponId | null;
  /** Character level for skill tree gates (1–20+). */
  level: number;
  /** Weapon mastery tier 0–5 (wpn_tree branch). */
  weaponTier: number;
  /** Skill tree node ids (class path) the AI may fire. */
  skillTreeNodes: string[];
  /** Hotbar skill labels for telegraphs. */
  skillLabels: [string, string, string, string];
  attributes: BossAttributes;
  maxHp: number;
  maxStamina: number;
  maxPoise: number;
  moveSpeed: number;
  /** Aggro radius (m). */
  aggroRange: number;
  /** Preferred fight range (m). */
  fightRange: number;
  attackDamage: number;
  attackInterval: number;
  windup: number;
  style: CombatStyle;
  animPack: string;
  ai: BossAiBehavior;
  /** World scale (1 = player height). */
  scale: number;
  /** Role catalog id for logs / UI. */
  roleId: string;
}

function attrs(
  str: number,
  agi: number,
  intel: number,
  vit: number,
  spi = 40,
  lck = 30,
  end = 50,
  wil = 45,
): BossAttributes {
  return {
    strength: str,
    agility: agi,
    intellect: intel,
    vitality: vit,
    spirit: spi,
    luck: lck,
    endurance: end,
    willpower: wil,
  };
}

function combat(weaponId: WeaponId) {
  return WEAPON_COMBAT[weaponId] || WEAPON_COMBAT.sword!;
}

/**
 * Canonical dungeon climax bosses — heavy armour, high tier weapons,
 * full skill labels from our trees.
 */
export const DUNGEON_BOSS_PROFILES: Record<string, DungeonBossProfile> = {
  /** Default Forge Depths pit boss (replaces capsule Moloch). */
  "forge-moloch": {
    id: "forge-moloch",
    name: "Moloch the Warchief",
    raceId: "orcs",
    presetId: "knight", // full plate + axe/shield look
    weaponId: "greataxe",
    offHand: null,
    level: 20,
    weaponTier: 5,
    skillTreeNodes: ["w_combo", "w_special", "w_ranged", "w_power"],
    skillLabels: ["Cleave", "War Cry", "Throw Axe", "Ragnarok"],
    attributes: attrs(95, 45, 30, 90, 40, 25, 85, 70),
    maxHp: 1600,
    maxStamina: 140,
    maxPoise: 180,
    moveSpeed: 2.35,
    aggroRange: 22,
    fightRange: 3.2,
    attackDamage: 52,
    attackInterval: 2.1,
    windup: 0.85,
    style: "melee",
    animPack: combat("greataxe").pack,
    ai: "melee_pressure",
    scale: 1.15,
    roleId: "hostile-orc-warchief",
  },
  /** Crypt halls undead commander. */
  "crypt-death-knight": {
    id: "crypt-death-knight",
    name: "Death Knight of the Crypt",
    raceId: "undead",
    presetId: "knight",
    weaponId: "sword",
    offHand: "shield",
    level: 18,
    weaponTier: 4,
    skillTreeNodes: ["w_combo", "w_special", "w_ranged", "w_power"],
    skillLabels: ["Risen Slash", "Bone Guard", "Soul Bolt", "Oblivion"],
    attributes: attrs(80, 50, 55, 85, 70, 20, 75, 90),
    maxHp: 1200,
    maxStamina: 120,
    maxPoise: 160,
    moveSpeed: 2.5,
    aggroRange: 20,
    fightRange: 2.6,
    attackDamage: 48,
    attackInterval: 1.9,
    windup: 0.75,
    style: "hybrid",
    animPack: combat("sword").pack,
    ai: "hybrid_elite",
    scale: 1.08,
    roleId: "hostile-ud-dk",
  },
  /** Temple guardian. */
  "temple-bladewarden": {
    id: "temple-bladewarden",
    name: "Temple Bladewarden",
    raceId: "high-elves",
    presetId: "knight",
    weaponId: "sword",
    offHand: "shield",
    level: 16,
    weaponTier: 4,
    skillTreeNodes: ["w_combo", "w_special", "w_ranged", "w_power"],
    skillLabels: ["Sanctum Cut", "Aegis", "Javelin Light", "Judgement"],
    attributes: attrs(70, 75, 50, 70, 55, 40, 65, 60),
    maxHp: 1000,
    maxStamina: 130,
    maxPoise: 140,
    moveSpeed: 2.7,
    aggroRange: 18,
    fightRange: 2.5,
    attackDamage: 44,
    attackInterval: 1.7,
    windup: 0.65,
    style: "melee",
    animPack: combat("sword").pack,
    ai: "melee_pressure",
    scale: 1.05,
    roleId: "hostile-elf-knight",
  },
  /** Mage boss for caster AI. */
  "lich-archmage": {
    id: "lich-archmage",
    name: "Arch-Lich",
    raceId: "undead",
    presetId: "mage",
    weaponId: "staffFire",
    offHand: null,
    level: 19,
    weaponTier: 5,
    skillTreeNodes: ["w_combo", "w_special", "w_ranged", "w_power"],
    skillLabels: ["Fire Bolt", "Flame Wave", "Inferno Shield", "Hellstorm"],
    attributes: attrs(30, 45, 95, 55, 90, 35, 40, 85),
    maxHp: 900,
    maxStamina: 160,
    maxPoise: 100,
    moveSpeed: 2.2,
    aggroRange: 24,
    fightRange: 12,
    attackDamage: 42,
    attackInterval: 2.0,
    windup: 0.9,
    style: "magic",
    animPack: combat("staffFire").pack,
    ai: "caster_burst",
    scale: 1.1,
    roleId: "hostile-ud-lich",
  },
  /** Surface elite / forge brute replacement. */
  "elite-ironclad": {
    id: "elite-ironclad",
    name: "Dwarf Ironclad",
    raceId: "dwarves",
    presetId: "knight",
    weaponId: "hammer",
    offHand: "shield",
    level: 12,
    weaponTier: 3,
    skillTreeNodes: ["w_combo", "w_special", "w_power"],
    skillLabels: ["Shield Bash", "Seismic Slam", "Charge", "Cataclysm"],
    attributes: attrs(75, 35, 25, 80, 30, 20, 80, 50),
    maxHp: 320,
    maxStamina: 100,
    maxPoise: 120,
    moveSpeed: 2.3,
    aggroRange: 14,
    fightRange: 2.4,
    attackDamage: 36,
    attackInterval: 1.85,
    windup: 0.7,
    style: "melee",
    animPack: combat("hammer").pack,
    ai: "melee_pressure",
    scale: 1.0,
    roleId: "hostile-dwf-knight",
  },
};

/** Map dungeon map id → boss profile id. */
export const DUNGEON_MAP_BOSS: Record<string, string> = {
  default: "forge-moloch",
  "forge-depths": "forge-moloch",
  "chicken-gun-town": "elite-ironclad",
  "crypt-halls": "crypt-death-knight",
  dungeon: "crypt-death-knight",
  "temple-agama": "temple-bladewarden",
  "agama-map": "temple-bladewarden",
};

export function getDungeonBossProfile(id: string): DungeonBossProfile {
  return DUNGEON_BOSS_PROFILES[id] ?? DUNGEON_BOSS_PROFILES["forge-moloch"]!;
}

export function bossProfileForMap(mapId: string): DungeonBossProfile {
  const id = DUNGEON_MAP_BOSS[mapId] ?? "forge-moloch";
  return getDungeonBossProfile(id);
}

/** Mesh ids for cool armour — gear preset + ensure weapon meshes visible. */
export function meshIdsForBoss(profile: DungeonBossProfile): string[] {
  if (profile.meshIds?.length) return profile.meshIds.slice();
  return getPreset(profile.raceId, profile.presetId).visibleMeshes.slice();
}

/** Build EntityPrefab-shaped combat data for AI / logging. */
export function bossAsPrefab(profile: DungeonBossProfile): EntityPrefab {
  const w = combat(profile.weaponId);
  return {
    id: profile.roleId,
    label: profile.name,
    kind: "hostile",
    raceId: profile.raceId,
    presetId: profile.presetId,
    meshIds: meshIdsForBoss(profile),
    weaponId: profile.weaponId,
    offHand: profile.offHand,
    combat: {
      range: profile.fightRange,
      attackCooldown: profile.attackInterval,
      damage: profile.attackDamage,
      hitWindow: [0.28, 0.55],
      style: profile.style,
      animPack: profile.animPack || w.pack,
      masterWeaponType: w.master,
    },
    aggro: 0.95,
    moveSpeed: profile.moveSpeed,
    maxHp: profile.maxHp,
    isPlayer: false,
  };
}

/** Scale damage by attributes (simple player-like formula). */
export function bossScaledDamage(profile: DungeonBossProfile, isSkill: boolean): number {
  const a = profile.attributes;
  const phys = a.strength * 0.35 + a.endurance * 0.1;
  const mag = a.intellect * 0.4 + a.spirit * 0.15;
  const base =
    profile.style === "magic" || profile.style === "ranged"
      ? profile.attackDamage + mag
      : profile.attackDamage + phys;
  const tierMul = 1 + profile.weaponTier * 0.06;
  const skillMul = isSkill ? 1.55 : 1;
  return Math.round(base * tierMul * skillMul);
}

/**
 * Grudge Warlords (Unity / uMMORPG) cast roles → grudge6 Toon RTS kits.
 *
 * Source package (not the website): local Toon RTS export used by the Unity
 * game — race customizable FBX + Standard Units atlases + gear presets.
 * Roles map to existing RACE_ASSETS + RACE_GEAR_PRESETS (no capsule/Meshy).
 *
 * Training NPC combat uses the full 6-race grudge6 kit (WK / BRB / ELF / DWF /
 * ORC / UD) with weapon-coherent presets so Danger Room opponents train against
 * every race asset, not orcs-only.
 */
import type { RaceId } from "./raceAssets";
import type { PresetId } from "./gearPresets";

export type WarlordsRoleKind =
  | "player"
  | "hostile"
  | "traveler"
  | "merchant"
  | "guard"
  | "quest_npc";

export interface WarlordsRole {
  /** Stable id for spawners / UI. */
  id: string;
  /** Display name (Unity-style). */
  label: string;
  kind: WarlordsRoleKind;
  raceId: RaceId;
  presetId: PresetId;
  /** Short note about Unity package origin. */
  note?: string;
}

/** AI strategy multipliers derived from gear class (FighterBrain bias). */
export interface RoleStrategyBias {
  aggression: number;
  caution: number;
  skillFrequency: number;
}

/** Full cast catalog from Warlords / Toon RTS package review. */
export const WARLORDS_ROLES: WarlordsRole[] = [
  // ── Player race kits (Toon RTS Characters_customizable) ─────────────────
  { id: "player-wk-knight", label: "W. Kingdoms Knight", kind: "player", raceId: "western-kingdoms", presetId: "knight", note: "WK_Characters_customizable" },
  { id: "player-wk-warrior", label: "W. Kingdoms Warrior", kind: "player", raceId: "western-kingdoms", presetId: "warrior" },
  { id: "player-wk-ranger", label: "W. Kingdoms Archer", kind: "player", raceId: "western-kingdoms", presetId: "ranger" },
  { id: "player-wk-mage", label: "W. Kingdoms Wizard", kind: "player", raceId: "western-kingdoms", presetId: "mage" },
  { id: "player-brb-warrior", label: "Barbarian Warrior", kind: "player", raceId: "barbarians", presetId: "warrior", note: "BRB_Characters_customizable" },
  { id: "player-orc-warrior", label: "Orc Warrior", kind: "player", raceId: "orcs", presetId: "warrior", note: "ORC_Characters_customizable" },
  { id: "player-elf-ranger", label: "High Elf Ranger", kind: "player", raceId: "high-elves", presetId: "ranger" },
  { id: "player-dwf-knight", label: "Dwarf Knight", kind: "player", raceId: "dwarves", presetId: "knight" },
  { id: "player-ud-mage", label: "Undead Lich", kind: "player", raceId: "undead", presetId: "mage" },

  // ── Hostile NPCs / combat spawn — FULL grudge6 race roster for training ─
  // Orcs
  { id: "hostile-orc-warrior", label: "Orc Raider", kind: "hostile", raceId: "orcs", presetId: "warrior", note: "ORC_Characters training" },
  { id: "hostile-orc-warchief", label: "Orc Warchief", kind: "hostile", raceId: "orcs", presetId: "knight" },
  { id: "hostile-orc-brawler", label: "Orc Brawler", kind: "hostile", raceId: "orcs", presetId: "unarmed" },
  { id: "hostile-orc-hunter", label: "Orc Hunter", kind: "hostile", raceId: "orcs", presetId: "ranger" },
  { id: "hostile-orc-shaman", label: "Orc Shaman", kind: "hostile", raceId: "orcs", presetId: "mage" },
  // Undead
  { id: "hostile-ud-warrior", label: "Risen Warrior", kind: "hostile", raceId: "undead", presetId: "warrior" },
  { id: "hostile-ud-dk", label: "Death Knight", kind: "hostile", raceId: "undead", presetId: "knight" },
  { id: "hostile-ud-shade", label: "Shade Archer", kind: "hostile", raceId: "undead", presetId: "ranger" },
  { id: "hostile-ud-lich", label: "Lich", kind: "hostile", raceId: "undead", presetId: "mage" },
  { id: "hostile-ud-risen", label: "Risen Brawler", kind: "hostile", raceId: "undead", presetId: "unarmed" },
  // Barbarians
  { id: "hostile-brb-warrior", label: "Barbarian Raider", kind: "hostile", raceId: "barbarians", presetId: "warrior" },
  { id: "hostile-brb-knight", label: "Barbarian Champion", kind: "hostile", raceId: "barbarians", presetId: "knight" },
  { id: "hostile-brb-ranger", label: "Barbarian Hunter", kind: "hostile", raceId: "barbarians", presetId: "ranger" },
  { id: "hostile-brb-mage", label: "Barbarian Shaman", kind: "hostile", raceId: "barbarians", presetId: "mage" },
  { id: "hostile-brb-brawler", label: "Barbarian Brawler", kind: "hostile", raceId: "barbarians", presetId: "unarmed" },
  // High Elves
  { id: "hostile-elf-warrior", label: "Elf Spearman", kind: "hostile", raceId: "high-elves", presetId: "warrior" },
  { id: "hostile-elf-knight", label: "Elf Bladewarden", kind: "hostile", raceId: "high-elves", presetId: "knight" },
  { id: "hostile-elf-ranger", label: "Elf Ranger", kind: "hostile", raceId: "high-elves", presetId: "ranger" },
  { id: "hostile-elf-mage", label: "Elf Mage", kind: "hostile", raceId: "high-elves", presetId: "mage" },
  { id: "hostile-elf-brawler", label: "Elf Duelist", kind: "hostile", raceId: "high-elves", presetId: "unarmed" },
  // Dwarves
  { id: "hostile-dwf-warrior", label: "Dwarf Axeman", kind: "hostile", raceId: "dwarves", presetId: "warrior" },
  { id: "hostile-dwf-knight", label: "Dwarf Ironclad", kind: "hostile", raceId: "dwarves", presetId: "knight" },
  { id: "hostile-dwf-ranger", label: "Dwarf Crossbow", kind: "hostile", raceId: "dwarves", presetId: "ranger" },
  { id: "hostile-dwf-mage", label: "Dwarf Runecaster", kind: "hostile", raceId: "dwarves", presetId: "mage" },
  { id: "hostile-dwf-brawler", label: "Dwarf Brawler", kind: "hostile", raceId: "dwarves", presetId: "unarmed" },
  // Western Kingdoms (human)
  { id: "hostile-wk-warrior", label: "Renegade Warrior", kind: "hostile", raceId: "western-kingdoms", presetId: "warrior" },
  { id: "hostile-wk-knight", label: "Fallen Knight", kind: "hostile", raceId: "western-kingdoms", presetId: "knight" },
  { id: "hostile-wk-ranger", label: "Brigand Archer", kind: "hostile", raceId: "western-kingdoms", presetId: "ranger" },
  { id: "hostile-wk-mage", label: "Hedge Wizard", kind: "hostile", raceId: "western-kingdoms", presetId: "mage" },
  { id: "hostile-wk-brawler", label: "Street Fighter", kind: "hostile", raceId: "western-kingdoms", presetId: "unarmed" },

  // ── Travelers (road / town wanderers — light kit) ───────────────────────
  { id: "traveler-wk-unarmed", label: "Kingdom Traveler", kind: "traveler", raceId: "western-kingdoms", presetId: "unarmed" },
  { id: "traveler-wk-ranger", label: "Wayfarer Archer", kind: "traveler", raceId: "western-kingdoms", presetId: "ranger" },
  { id: "traveler-elf-ranger", label: "Elven Wanderer", kind: "traveler", raceId: "high-elves", presetId: "ranger" },
  { id: "traveler-brb-unarmed", label: "Barbarian Traveler", kind: "traveler", raceId: "barbarians", presetId: "unarmed" },
  { id: "traveler-dwf-unarmed", label: "Dwarf Traveler", kind: "traveler", raceId: "dwarves", presetId: "unarmed" },

  // ── Merchants / quest / guards (uMMORPG Npc prefab roles) ───────────────
  { id: "merchant-wk-unarmed", label: "Kingdom Merchant", kind: "merchant", raceId: "western-kingdoms", presetId: "unarmed" },
  { id: "merchant-dwf-unarmed", label: "Dwarf Trader", kind: "merchant", raceId: "dwarves", presetId: "unarmed" },
  { id: "guard-wk-knight", label: "City Guard", kind: "guard", raceId: "western-kingdoms", presetId: "knight" },
  { id: "guard-wk-warrior", label: "Watch Warrior", kind: "guard", raceId: "western-kingdoms", presetId: "warrior" },
  { id: "quest-elf-mage", label: "Elven Sage", kind: "quest_npc", raceId: "high-elves", presetId: "mage" },
  { id: "quest-ud-mage", label: "Necromancer Contact", kind: "quest_npc", raceId: "undead", presetId: "mage" },
];

const byId = new Map(WARLORDS_ROLES.map((r) => [r.id, r]));

export function getWarlordsRole(id: string): WarlordsRole | undefined {
  return byId.get(id);
}

export function warlordsRolesOfKind(kind: WarlordsRoleKind): WarlordsRole[] {
  return WARLORDS_ROLES.filter((r) => r.kind === kind);
}

/**
 * Default multi-race wave for survival / Brawler / Danger Room training.
 * Cycles all six grudge6 races (not orcs-only).
 */
export const DEFAULT_HOSTILE_ROLES: readonly string[] = [
  "hostile-orc-warrior",
  "hostile-ud-dk",
  "hostile-brb-warrior",
  "hostile-elf-ranger",
  "hostile-dwf-knight",
  "hostile-wk-mage",
  "hostile-orc-hunter",
  "hostile-ud-lich",
  "hostile-brb-brawler",
  "hostile-elf-mage",
  "hostile-dwf-warrior",
  "hostile-wk-ranger",
];

/** Full hostile catalog ids (all races × presets) for training NPC combat. */
export function allHostileRoleIds(): string[] {
  return warlordsRolesOfKind("hostile").map((r) => r.id);
}

/** Map arsenal weapon kind → gear preset for Warlords-style opponents. */
export function presetForWeaponKind(kind: string | undefined): PresetId {
  switch ((kind || "").toLowerCase()) {
    case "bow":
    case "crossbow":
    case "longbow":
    case "ranged":
    case "rifle":
    case "gun":
      return "ranger";
    case "staff":
    case "tome":
    case "wand":
    case "magic":
      return "mage";
    case "shield":
    case "sword":
    case "1h":
      return "knight";
    case "unarmed":
    case "fist":
    case "none":
      return "unarmed";
    default:
      return "warrior";
  }
}

/**
 * Class-based AI strategy for FighterBrain bias.
 * Mages cast more; rangers kite/cast; knights defend; warriors press.
 */
export function strategyBiasForPreset(presetId: PresetId | string | undefined): RoleStrategyBias {
  switch (presetId) {
    case "mage":
      return { aggression: 0.72, caution: 1.15, skillFrequency: 1.35 };
    case "ranger":
      return { aggression: 0.8, caution: 1.2, skillFrequency: 1.25 };
    case "knight":
      return { aggression: 0.95, caution: 1.35, skillFrequency: 0.95 };
    case "unarmed":
      return { aggression: 1.15, caution: 0.75, skillFrequency: 0.85 };
    case "warrior":
    default:
      return { aggression: 1.2, caution: 0.85, skillFrequency: 1.05 };
  }
}

export interface PickHostileRoleOpts {
  /** Ring / spawn index for stable multi-race cycling. */
  index?: number;
  /** Prefer roles matching this gear preset (from weapon). */
  presetId?: PresetId;
  /** Explicit role id (Admin / map author). */
  roleId?: string;
  /** Ally guards use knight/warrior kits instead of hostiles. */
  faction?: "enemy" | "ally";
}

/**
 * Pick a grudge6 Warlords role for an NPC opponent.
 * Priority: explicit roleId → weapon-coherent multi-race cycle → default hostile list.
 */
export function pickHostileRole(opts: PickHostileRoleOpts = {}): WarlordsRole {
  if (opts.roleId) {
    const explicit = getWarlordsRole(opts.roleId);
    if (explicit) return explicit;
  }

  // Allies: city-guard style kits (still full race variety)
  if (opts.faction === "ally") {
    const guards = warlordsRolesOfKind("guard");
    const travelers = warlordsRolesOfKind("traveler");
    const pool = guards.length ? guards : travelers;
    const preset = opts.presetId;
    const matched = preset
      ? pool.filter((r) => r.presetId === preset)
      : pool;
    const list = matched.length ? matched : pool;
    if (list.length) {
      const i = Math.abs(opts.index ?? 0) % list.length;
      return list[i]!;
    }
  }

  const hostiles = warlordsRolesOfKind("hostile");
  const preset = opts.presetId;
  // Prefer same class across all races so bow → rangers of every race, etc.
  const matched = preset ? hostiles.filter((r) => r.presetId === preset) : hostiles;
  const pool = matched.length ? matched : hostiles;
  if (pool.length) {
    const i = Math.abs(opts.index ?? 0) % pool.length;
    return pool[i]!;
  }

  // Absolute fallback
  return (
    getWarlordsRole("hostile-orc-warrior") ?? {
      id: "hostile-orc-warrior",
      label: "Orc Raider",
      kind: "hostile",
      raceId: "orcs",
      presetId: "warrior",
    }
  );
}

/** Weapon id / kind → role pick for spawners that only know arsenal ids. */
export function pickHostileRoleForWeapon(
  weaponId: string | undefined,
  weaponKind: string | undefined,
  index = 0,
  faction: "enemy" | "ally" = "enemy",
  roleId?: string,
): WarlordsRole {
  const presetId = presetForWeaponKind(weaponKind || weaponId);
  return pickHostileRole({ index, presetId, faction, roleId });
}

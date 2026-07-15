/**
 * Grudge Warlords (Unity / uMMORPG) cast roles → grudge6 Toon RTS kits.
 *
 * Source package (not the website): local Toon RTS export used by the Unity
 * game — race customizable FBX + Standard Units atlases + gear presets.
 * Roles map to existing RACE_ASSETS + RACE_GEAR_PRESETS (no capsule/Meshy).
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

  // ── Hostile NPCs / combat spawn (uMMORPG Monster / Enemy prefab roles) ──
  { id: "hostile-orc-warrior", label: "Orc Raider", kind: "hostile", raceId: "orcs", presetId: "warrior", note: "Default survival / Danger Room opponent" },
  { id: "hostile-orc-warchief", label: "Orc Warchief", kind: "hostile", raceId: "orcs", presetId: "knight" },
  { id: "hostile-orc-brawler", label: "Orc Brawler", kind: "hostile", raceId: "orcs", presetId: "unarmed" },
  { id: "hostile-orc-hunter", label: "Orc Hunter", kind: "hostile", raceId: "orcs", presetId: "ranger" },
  { id: "hostile-orc-shaman", label: "Orc Shaman", kind: "hostile", raceId: "orcs", presetId: "mage" },
  { id: "hostile-ud-warrior", label: "Risen Warrior", kind: "hostile", raceId: "undead", presetId: "warrior" },
  { id: "hostile-ud-dk", label: "Death Knight", kind: "hostile", raceId: "undead", presetId: "knight" },
  { id: "hostile-brb-warrior", label: "Barbarian Raider", kind: "hostile", raceId: "barbarians", presetId: "warrior" },

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

/** Default hostile wave for survival / Brawler (Unity orc opponents). */
export const DEFAULT_HOSTILE_ROLES: readonly string[] = [
  "hostile-orc-warrior",
  "hostile-orc-warchief",
  "hostile-orc-brawler",
];

/** Map arsenal weapon kind → gear preset for Warlords-style opponents. */
export function presetForWeaponKind(kind: string | undefined): PresetId {
  switch ((kind || "").toLowerCase()) {
    case "bow":
    case "crossbow":
    case "longbow":
    case "ranged":
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
      return "unarmed";
    default:
      return "warrior";
  }
}

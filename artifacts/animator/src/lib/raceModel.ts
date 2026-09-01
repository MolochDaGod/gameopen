/**
 * Fleet character → grudge6 race-model resolver.
 *
 * Fleet characters (`grudgeAuth.fetchCharacters()`) carry an opaque `raceId`
 * (and optional `classId`) sourced from the Warlords / GrudgeBuilder SSOT. The
 * in-gameopen avatar for the vendored grudge character-kit is a customizable
 * race FBX ({@link ../three/grudge/GrudgeAvatar.GrudgeAvatar}) keyed by a
 * canonical grudge {@link RaceId} + gear {@link PresetId}.
 *
 * This module is the small join between the two: a `FactionCharacterRegistry`
 * (canonical grudge6 race metadata) plus a `resolveRaceModel` /
 * `avatarIdForCharacter` `CharacterModelResolver` that normalizes arbitrary
 * fleet race/class strings onto that registry. grudge6 races load as FBX.
 */
import {
  PRESET_IDS,
  RACE_ASSETS,
  RACE_IDS,
  type PresetId,
  type RaceId,
} from "../three/grudge";
import type { GrudgeCharacter } from "./grudgeAuth";

export interface FactionCharacterEntry {
  raceId: RaceId;
  name: string;
  abbr: string;
  color: string;
}

/**
 * Canonical grudge6 race registry — the authoritative set of playable factions
 * the FBX character-kit ships, surfaced with display metadata for pickers.
 */
export const FactionCharacterRegistry: readonly FactionCharacterEntry[] = RACE_IDS.map(
  (id) => {
    const a = RACE_ASSETS[id];
    return { raceId: id, name: a.name, abbr: a.abbr, color: a.color };
  },
);

/** Default race/preset used when a fleet character carries no resolvable hint. */
export const DEFAULT_RACE_ID: RaceId = "western-kingdoms";
export const DEFAULT_PRESET_ID: PresetId = "knight";

/** Aliases mapping arbitrary fleet race strings onto a canonical grudge {@link RaceId}. */
const RACE_ALIASES: Record<string, RaceId> = {
  barbarian: "barbarians",
  barbarians: "barbarians",
  brb: "barbarians",
  dwarf: "dwarves",
  dwarves: "dwarves",
  dwf: "dwarves",
  elf: "high-elves",
  elves: "high-elves",
  "high-elf": "high-elves",
  high_elf: "high-elves",
  highelf: "high-elves",
  "high-elves": "high-elves",
  orc: "orcs",
  orcs: "orcs",
  undead: "undead",
  ud: "undead",
  human: "western-kingdoms",
  humans: "western-kingdoms",
  wk: "western-kingdoms",
  kingdom: "western-kingdoms",
  kingdoms: "western-kingdoms",
  "western-kingdoms": "western-kingdoms",
};

/** Aliases mapping arbitrary fleet class strings onto a gear {@link PresetId}. */
const CLASS_ALIASES: Record<string, PresetId> = {
  mage: "mage",
  wizard: "mage",
  shaman: "mage",
  lich: "mage",
  sorcerer: "mage",
  knight: "knight",
  paladin: "knight",
  warchief: "knight",
  "death-knight": "knight",
  ranger: "ranger",
  archer: "ranger",
  hunter: "ranger",
  scout: "ranger",
  warrior: "warrior",
  barbarian: "warrior",
  berserker: "warrior",
  fighter: "warrior",
  monk: "unarmed",
  brawler: "unarmed",
  unarmed: "unarmed",
};

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Normalize an arbitrary fleet race string to a canonical grudge {@link RaceId}. */
export function resolveRaceId(raceId: string | undefined): RaceId {
  const key = norm(raceId);
  if (!key) return DEFAULT_RACE_ID;
  if (RACE_ALIASES[key]) return RACE_ALIASES[key];
  // Accept an exact canonical id even if not aliased above.
  if ((RACE_IDS as string[]).includes(key)) return key as RaceId;
  return DEFAULT_RACE_ID;
}

/** Normalize an arbitrary fleet class string to a gear {@link PresetId}. */
export function resolvePresetId(classId: string | undefined): PresetId {
  const key = norm(classId);
  if (CLASS_ALIASES[key]) return CLASS_ALIASES[key];
  if ((PRESET_IDS as string[]).includes(key)) return key as PresetId;
  return DEFAULT_PRESET_ID;
}

/**
 * The Studio avatar id encoding a grudge race + preset. {@link ../three/Studio}
 * recognizes the `grudge:` scheme and spawns a {@link GrudgeAvatar} for it.
 */
export function grudgeAvatarId(raceId: RaceId, presetId: PresetId): string {
  return `grudge:${raceId}:${presetId}`;
}

export interface ResolvedRaceModel {
  raceId: RaceId;
  presetId: PresetId;
  /** Studio avatar id (`grudge:<race>:<preset>`). */
  avatarId: string;
}

/** Resolve a fleet character to its grudge6 race model + Studio avatar id. */
export function resolveRaceModel(character: GrudgeCharacter | null | undefined): ResolvedRaceModel {
  const raceId = resolveRaceId(character?.raceId);
  const presetId = resolvePresetId(character?.classId);
  return { raceId, presetId, avatarId: grudgeAvatarId(raceId, presetId) };
}

/** Parse a `grudge:<race>:<preset>` avatar id back into its parts, or null. */
export function parseGrudgeAvatarId(
  id: string,
): { raceId: RaceId; presetId: PresetId } | null {
  if (!id || !id.startsWith("grudge:")) return null;
  const [, race, preset] = id.split(":");
  if (!race || !(RACE_IDS as string[]).includes(race)) return null;
  const presetId = (PRESET_IDS as string[]).includes(preset)
    ? (preset as PresetId)
    : DEFAULT_PRESET_ID;
  return { raceId: race as RaceId, presetId };
}

/**
 * HARD SSOT join for every UI string → Studio spawn id.
 *
 * Danger Room / lobby / account still emit legacy ids:
 *   race-human, race-orc, grudge-western-kingdoms-warrior, human, explorer, …
 * Studio only boots modular grudge6 for `grudge:<race>:<preset>`.
 *
 * Practice: **always** call this before setCharacter / spawnCharacter for
 * warlords / Danger / dressing race heroes. Explorer/voxel stays "explorer".
 */
export function normalizeToGrudgeAvatarId(
  id: string | null | undefined,
  classHint?: string,
): string {
  const raw = String(id || "").trim();
  if (!raw) return grudgeAvatarId(DEFAULT_RACE_ID, resolvePresetId(classHint || "warrior"));

  // Voxel / Mine-Loader procedural body only
  if (raw === "explorer" || raw.startsWith("avatar-") || raw === "led-monk") {
    return "explorer";
  }

  // Canonical
  const colon = parseGrudgeAvatarId(raw);
  if (colon) return grudgeAvatarId(colon.raceId, colon.presetId);

  // Hyphen form from characterHubLaunch: grudge-western-kingdoms-warrior
  if (raw.startsWith("grudge-") || raw.startsWith("grudge_")) {
    const rest = raw.replace(/^grudge[-_]/, "");
    // Longest race match first (western-kingdoms before western)
    const races = [...RACE_IDS].sort((a, b) => b.length - a.length);
    for (const race of races) {
      if (rest === race || rest.startsWith(`${race}-`) || rest.startsWith(`${race}_`)) {
        const tail =
          rest === race ? classHint || "warrior" : rest.slice(race.length + 1);
        return grudgeAvatarId(race, resolvePresetId(tail || classHint || "warrior"));
      }
    }
  }

  // Catalog race-* (race-human → western-kingdoms warrior)
  if (raw.startsWith("race-")) {
    const slug = raw.slice(5);
    return grudgeAvatarId(
      resolveRaceId(slug === "high-elf" || slug === "highelf" ? "high-elves" : slug),
      resolvePresetId(classHint || "warrior"),
    );
  }

  // Bare race / class tokens
  const asRace = resolveRaceId(raw);
  if (raw && (RACE_ALIASES[norm(raw)] || (RACE_IDS as string[]).includes(norm(raw)))) {
    return grudgeAvatarId(asRace, resolvePresetId(classHint || "warrior"));
  }

  // Fleet character-shaped "western-kingdoms" etc.
  if (norm(raw).includes("kingdom") || norm(raw).includes("human") || norm(raw) === "wk") {
    return grudgeAvatarId("western-kingdoms", resolvePresetId(classHint || "warrior"));
  }

  // Default: real grudge6, never silent explorer for unknown warlords ids
  return grudgeAvatarId(DEFAULT_RACE_ID, resolvePresetId(classHint || "warrior"));
}

/** True when Studio must spawn GrudgeAvatar (loadGrudge6CombatRig), not Character/Explorer. */
export function isGrudge6StudioId(id: string): boolean {
  const n = normalizeToGrudgeAvatarId(id);
  return n.startsWith("grudge:");
}

/**
 * Playtest roster for GRUDOX / Open animator Danger Room.
 *
 * Surfaces every default grudge6 modular race × gear preset so playtesters can
 * pick them without knowing `grudge:<race>:<preset>` strings.
 *
 * Production spawn: Studio → GrudgeAvatar (loadRaceKit / loadGrudge6CombatRig).
 * Not Heroes-of-Grudge class GLBs (`grudge-western-kingdoms-knight`) — those stay
 * a separate catalog row for baked multipack smoke.
 *
 * @see raceAssets.ts · gearPresets.ts · lib/raceModel.ts
 */

import { RACE_ASSETS, RACE_IDS, type RaceId } from "./raceAssets";
import {
  PRESET_IDS,
  RACE_GEAR_PRESETS,
  type PresetId,
} from "./gearPresets";

/** One pickable playtest hero. */
export interface GrudgePlaytestEntry {
  /** Studio setCharacter id — always `grudge:<race>:<preset>`. */
  id: string;
  /** Short button label. */
  name: string;
  /** Longer subtitle for tooltips. */
  blurb: string;
  raceId: RaceId;
  presetId: PresetId;
  /** Race accent for UI chips. */
  color: string;
  /** Default recommended for that race (warrior/knight). */
  isDefault: boolean;
}

/** Default class per race for one-click playtest (product defaults). */
export const DEFAULT_PLAYTEST_PRESET: Record<RaceId, PresetId> = {
  barbarians: "warrior",
  dwarves: "warrior",
  "high-elves": "ranger",
  orcs: "warrior",
  undead: "knight",
  "western-kingdoms": "warrior",
};

/**
 * Full matrix: 6 races × 5 presets = 30 playtest ids.
 * Order: races in RACE_IDS order, presets mage→knight→ranger→warrior→unarmed.
 */
export function buildGrudge6PlaytestRoster(): GrudgePlaytestEntry[] {
  const out: GrudgePlaytestEntry[] = [];
  for (const raceId of RACE_IDS) {
    const race = RACE_ASSETS[raceId];
    const defPreset = DEFAULT_PLAYTEST_PRESET[raceId] ?? "warrior";
    for (const presetId of PRESET_IDS) {
      const preset =
        RACE_GEAR_PRESETS[raceId].find((p) => p.id === presetId) ??
        RACE_GEAR_PRESETS[raceId][0];
      out.push({
        id: `grudge:${raceId}:${presetId}`,
        name: `${race.abbr} ${preset.label}`,
        blurb: `${race.name} · ${preset.description}`,
        raceId,
        presetId,
        color: race.color,
        isDefault: presetId === defPreset,
      });
    }
  }
  return out;
}

/** Cached full roster. */
export const GRUDGE6_PLAYTEST_ROSTER: readonly GrudgePlaytestEntry[] =
  buildGrudge6PlaytestRoster();

/** Six race defaults only (one button each) for compact picker rows. */
export const GRUDGE6_RACE_DEFAULTS: readonly GrudgePlaytestEntry[] =
  GRUDGE6_PLAYTEST_ROSTER.filter((e) => e.isDefault);

/** Group full roster by race for Admin panel sections. */
export function grudge6PlaytestByRace(): {
  raceId: RaceId;
  raceName: string;
  color: string;
  entries: GrudgePlaytestEntry[];
}[] {
  return RACE_IDS.map((raceId) => {
    const race = RACE_ASSETS[raceId];
    return {
      raceId,
      raceName: race.name,
      color: race.color,
      entries: GRUDGE6_PLAYTEST_ROSTER.filter((e) => e.raceId === raceId),
    };
  });
}

/** True if id is a grudge6 playtest / fleet avatar id. */
export function isGrudge6PlaytestId(id: string): boolean {
  return /^grudge:[a-z0-9-]+:[a-z0-9-]+$/i.test(id || "");
}

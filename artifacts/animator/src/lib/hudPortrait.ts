/**
 * Resolve a 2D portrait for the Danger Room combat HUD unit frame.
 * Uses race/class PNGs from public/races + fleet CDN (same cascade as
 * characterPortrait, but works from animator characterId strings).
 */
import { publicUrl, FLEET } from "./fleet";
import {
  parseGrudgeAvatarId,
  resolveRaceId,
  resolvePresetId,
} from "./raceModel";
import type { RaceId, PresetId } from "../three/grudge";
import { fleetRaceToPaper, paperRacePngStem, type PaperRaceKey } from "./characterPortrait";

export interface HudPortrait {
  url: string;
  candidates: string[];
  paperRace: PaperRaceKey;
}

function racePaths(paper: PaperRaceKey, preset: PresetId): string[] {
  const stem = paperRacePngStem(paper);
  return [
    publicUrl(`races/portraits/${stem}_${preset}.png`),
    publicUrl(`races/portraits/${stem}-${preset}.png`),
    publicUrl(`races/${stem}_${preset}.png`),
    publicUrl(`races/${stem}.png`),
    `${FLEET.assets}/portraits/${stem}.png`,
    `${FLEET.assets}/races/${stem}.png`,
    publicUrl("races/human.png"),
  ];
}

/**
 * Map an animator characterId / fleet avatar id onto portrait URLs.
 * Accepts: grudge:race:preset, race-human, western-kingdoms, explorer, etc.
 */
export function resolveHudPortrait(
  characterId: string,
  opts?: { avatarUrl?: string | null; raceId?: string | null; classId?: string | null },
): HudPortrait {
  const candidates: string[] = [];

  if (opts?.avatarUrl && String(opts.avatarUrl).trim()) {
    const u = String(opts.avatarUrl).trim();
    candidates.push(u.startsWith("http") || u.startsWith("/") || u.startsWith("data:") ? u : publicUrl(u));
  }

  // grudge:race:preset
  let raceId: RaceId = "western-kingdoms";
  let presetId: PresetId = "knight";
  const parsed = parseGrudgeAvatarId(characterId);
  if (parsed) {
    raceId = parsed.raceId;
    presetId = parsed.presetId;
  }
  if (opts?.raceId) raceId = resolveRaceId(opts.raceId);
  if (opts?.classId) presetId = resolvePresetId(opts.classId);

  // Heuristic from characterId string when no grudge parse
  if (!opts?.raceId) {
    const id = characterId.toLowerCase();
    if (id.includes("orc")) raceId = resolveRaceId("orc");
    else if (id.includes("elf")) raceId = resolveRaceId("elf");
    else if (id.includes("dwarf")) raceId = resolveRaceId("dwarf");
    else if (id.includes("barb")) raceId = resolveRaceId("barbarian");
    else if (id.includes("undead")) raceId = resolveRaceId("undead");
    else if (id.includes("human") || id.includes("wk") || id.includes("kingdom"))
      raceId = resolveRaceId("human");
    if (id.includes("mage") || id.includes("wizard")) presetId = resolvePresetId("mage");
    else if (id.includes("ranger") || id.includes("archer")) presetId = resolvePresetId("ranger");
    else if (id.includes("warrior")) presetId = resolvePresetId("warrior");
    else if (id.includes("knight")) presetId = resolvePresetId("knight");
  }

  const paper = fleetRaceToPaper(raceId);
  for (const p of racePaths(paper, presetId)) candidates.push(p);

  const seen = new Set<string>();
  const unique = candidates.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  return {
    url: unique[0] || publicUrl("races/human.png"),
    candidates: unique.slice(1),
    paperRace: paper,
  };
}

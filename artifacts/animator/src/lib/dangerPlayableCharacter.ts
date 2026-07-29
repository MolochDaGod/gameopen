/**
 * Danger Room playable character bridge.
 *
 * Resolves who you fight as in https://open.grudge-studio.com/danger from:
 *  1. URL deep-links from Asset-Rig-Editor / Annihilate (`?hero=` `?race=` `?class=`)
 *  2. Fleet account selected character (Railway / Open session)
 *  3. Safe grudge6 default (WK warrior)
 *
 * Always returns a Studio-ready grudge6 kit (avatar id + mesh_ids + weapon + anim pack).
 * Does NOT use Explorer Mixamo FBX for production danger (404 on Vercel).
 */

import {
  parseAnnihilateHero,
  heroFromLocation,
  applyAnnihilateHeroToStudio,
  type AnnihilateHeroSpec,
  type AnnihilateStudioTarget,
} from "./annihilateHero";
import type { GrudgeCharacter } from "./grudgeAuth";
import { resolveRaceId, resolvePresetId, grudgeAvatarId } from "./raceModel";
import { getPreset, type RaceId, type PresetId } from "../three/grudge";
import { familyFromAnimPack, type WeaponFamily } from "../three/grudge/weaponSkillPacks";
import type { AnimPack } from "../three/grudge/anims";

export type PlayableSource = "url-hero" | "url-are" | "fleet-character" | "default";

export interface DangerPlayableCharacter {
  source: PlayableSource;
  /** Display name for start screen / HUD */
  displayName: string;
  /** Annihilate-compatible spec (always filled) */
  spec: AnnihilateHeroSpec;
  /** Fleet character id when source is fleet */
  fleetCharacterId?: string;
  /** Deep-link that recreates this playable */
  dangerUrl: string;
}

const PRESET_TO_WEAPON: Record<PresetId, string> = {
  warrior: "sword",
  knight: "sword",
  ranger: "bow",
  mage: "staffArcane",
  unarmed: "none",
};

const CLASS_TO_PRESET: Record<string, PresetId> = {
  warrior: "warrior",
  fighter: "warrior",
  knight: "knight",
  mage: "mage",
  wizard: "mage",
  ranger: "ranger",
  archer: "ranger",
  shapeshifter: "unarmed",
  unarmed: "unarmed",
};

function buildSpec(
  raceId: RaceId,
  classKey: string,
  presetId: PresetId,
  heroToken: string,
  meshIds?: string[],
): AnnihilateHeroSpec {
  const preset = getPreset(raceId, presetId);
  const animPack = preset.animPack as AnimPack;
  const weaponFamily = familyFromAnimPack(animPack) as WeaponFamily;
  return {
    hero: heroToken,
    raceId,
    classKey,
    presetId,
    studioAvatarId: grudgeAvatarId(raceId, presetId),
    meshIds: meshIds?.length ? [...meshIds] : [...preset.visibleMeshes],
    weaponFamily,
    animPack,
    weaponId: PRESET_TO_WEAPON[presetId] ?? "sword",
  };
}

/**
 * Parse Asset-Rig-Editor style query:
 *   ?are=1&race=barbarians&class=warrior&name=my_hero
 *   ?race=wk&class=mage
 *   ?hero=brb_warrior (existing annihilate)
 */
export function parseAreQuery(
  search = typeof window !== "undefined" ? window.location.search : "",
): AnnihilateHeroSpec | null {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const raceRaw = q.get("race") || q.get("bakeRace") || "";
    const classRaw = q.get("class") || q.get("bakeClass") || q.get("cls") || "";
    const name = q.get("name") || q.get("custom") || q.get("label") || "";
    const are = q.get("are") || q.get("from") || "";
    // Explicit ARE flag or race+class without hero
    if (!raceRaw && !classRaw) return null;
    if (!are && !q.get("race") && !q.get("bakeRace")) {
      // If only class, still allow with default race
      if (!classRaw) return null;
    }
    const raceId = resolveRaceId(raceRaw || "western-kingdoms");
    const classKey = (classRaw || "warrior").toLowerCase().replace(/\s+/g, "_");
    const presetId =
      CLASS_TO_PRESET[classKey] ?? resolvePresetId(classKey) ?? "warrior";
    const heroToken =
      name
        ? `are_${name}_${raceId}_${classKey}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_")
        : `${raceId}_${classKey}`.replace(/-/g, "_");
    return buildSpec(raceId, classKey, presetId as PresetId, heroToken);
  } catch {
    return null;
  }
}

/** Fleet character → playable annihilate-style spec. */
export function playableFromFleetCharacter(
  ch: GrudgeCharacter,
): DangerPlayableCharacter {
  const raceId = resolveRaceId(ch.raceId);
  const classKey = String(
    (ch as { classId?: string }).classId ||
      (ch as { class?: string }).class ||
      "warrior",
  )
    .toLowerCase()
    .replace(/\s+/g, "_");
  const presetId =
    CLASS_TO_PRESET[classKey] ?? resolvePresetId(classKey) ?? resolvePresetId(ch.classId);
  const heroToken = `fleet_${ch.id.slice(0, 8)}_${raceId}_${classKey}`;
  // mesh_ids: sync path uses gear preset; async resolveCharacterEquipmentVisual in App.
  const preset = getPreset(raceId, presetId);
  const meshIds = [...preset.visibleMeshes];
  const spec = buildSpec(raceId, classKey, presetId, heroToken, meshIds);
  return {
    source: "fleet-character",
    displayName: ch.name || "Hero",
    spec,
    fleetCharacterId: ch.id,
    dangerUrl: dangerDeepLink({
      hero: `${raceId.split("-")[0]}_${classKey}`,
      name: ch.name,
    }),
  };
}

export function dangerDeepLink(opts: {
  hero?: string;
  race?: string;
  classId?: string;
  name?: string;
  fromAre?: boolean;
}): string {
  const base =
    typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? `${window.location.origin}/danger`
      : "https://open.grudge-studio.com/danger";
  const q = new URLSearchParams();
  if (opts.hero) q.set("hero", opts.hero);
  if (opts.race) q.set("race", opts.race);
  if (opts.classId) q.set("class", opts.classId);
  if (opts.name) q.set("name", opts.name);
  if (opts.fromAre) q.set("are", "1");
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Master resolver for Danger Room boot.
 */
export function resolveDangerPlayable(opts: {
  search?: string;
  fleetCharacter?: GrudgeCharacter | null;
}): DangerPlayableCharacter {
  const search = opts.search ?? (typeof window !== "undefined" ? window.location.search : "");

  // 1) Explicit hero / character token (annihilate)
  const fromHero = heroFromLocation(search);
  if (fromHero) {
    // heroFromLocation also parses bare race= as hero — prefer ARE if are=1
    let areFlag = false;
    try {
      const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
      areFlag = q.get("are") === "1" || q.get("from") === "are";
    } catch {
      /* ignore */
    }
    if (!areFlag || !parseAreQuery(search)) {
      return {
        source: "url-hero",
        displayName: fromHero.hero.replace(/_/g, " "),
        spec: fromHero,
        dangerUrl: dangerDeepLink({ hero: fromHero.hero }),
      };
    }
  }

  // 2) Asset-Rig-Editor / bake labels
  const fromAre = parseAreQuery(search);
  if (fromAre) {
    return {
      source: "url-are",
      displayName: fromAre.hero.replace(/^are_/, "").replace(/_/g, " "),
      spec: fromAre,
      dangerUrl: dangerDeepLink({
        race: fromAre.raceId,
        classId: fromAre.classKey,
        name: fromAre.hero,
        fromAre: true,
      }),
    };
  }

  // 3) Fleet selected character
  if (opts.fleetCharacter) {
    return playableFromFleetCharacter(opts.fleetCharacter);
  }

  // 4) Default grudge6 WK warrior
  const def = buildSpec("western-kingdoms", "warrior", "warrior", "wk_warrior");
  return {
    source: "default",
    displayName: "WK Warrior",
    spec: def,
    dangerUrl: dangerDeepLink({ hero: "wk_warrior" }),
  };
}

/** Apply resolved playable to Studio (mesh_ids + character + weapon). */
export function applyDangerPlayableToStudio(
  studio: AnnihilateStudioTarget,
  playable: DangerPlayableCharacter,
): void {
  applyAnnihilateHeroToStudio(studio, playable.spec);
  studio.flashMessage?.(
    `DANGER · ${playable.displayName.toUpperCase()} · ${playable.spec.animPack} · ${playable.source}`,
    2.8,
  );
}

export type { AnnihilateHeroSpec, AnnihilateStudioTarget };

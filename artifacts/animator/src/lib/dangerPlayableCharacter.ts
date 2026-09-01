/**
 * Danger Room playable character bridge — Open /danger is **all-era**.
 *
 * Resolves who you fight as in https://open.grudge-studio.com/danger from:
 *  1. `?era=` (voxel | warlords | nexus | armada)
 *  2. URL deep-links from Asset-Rig-Editor / Annihilate (`?hero=` `?race=` `?class=`)
 *  3. Fleet account selected character (Railway / Open session)
 *  4. Era default: Warlords WK Toon · Voxel Mixamo explorer
 *
 * Lanes (never cross-bind): warlords → Bip001 loadRaceKit · voxel/nexus/armada → Mixamo explorer.
 * GRUDOX voxel Danger is a separate host (tvs-showcase) — see entryCatch PRODUCT_STARTS.grudoxVoxelDanger.
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
import { resolveCharacterEquipmentVisualSync } from "./characterEquipmentMesh";
import { isWarlordsToonPlayCharacter } from "./characterPortrait";
import type { FleetAnimRigLane } from "../three/anim/fleetAnimSsot";

export type DangerEraId = "voxel" | "warlords" | "nexus" | "armada";

export const DANGER_ERA_OPTIONS: {
  id: DangerEraId;
  label: string;
  blurb: string;
  lane: FleetAnimRigLane;
}[] = [
  {
    id: "voxel",
    label: "Voxel",
    blurb: "Mixamo explorer · Mine / GRUDOX / Blox heroes",
    lane: "mixamo-explorer",
  },
  {
    id: "warlords",
    label: "Warlords",
    blurb: "Toon RTS Bip001 · loadRaceKit play kit",
    lane: "bip001-baked",
  },
  {
    id: "nexus",
    label: "Nexus",
    blurb: "era=nexus roster · Mixamo kit until dedicated mesh",
    lane: "mixamo-explorer",
  },
  {
    id: "armada",
    label: "Armada",
    blurb: "era=armada roster · Mixamo kit until dedicated mesh",
    lane: "mixamo-explorer",
  },
];

const ERA_SET = new Set<string>(DANGER_ERA_OPTIONS.map((e) => e.id));
const STORAGE_ERA = "grudge_danger_era";

export function dangerLaneForEra(era: DangerEraId): FleetAnimRigLane {
  return DANGER_ERA_OPTIONS.find((e) => e.id === era)?.lane ?? "bip001-baked";
}

export function parseDangerEra(
  search = typeof window !== "undefined" ? window.location.search : "",
  fleetEra?: string | null,
): DangerEraId {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const raw = (q.get("era") || "").toLowerCase();
    if (ERA_SET.has(raw)) return raw as DangerEraId;
  } catch {
    /* ignore */
  }
  const fe = (fleetEra || "").toLowerCase();
  if (ERA_SET.has(fe)) return fe as DangerEraId;
  try {
    const stored = localStorage.getItem(STORAGE_ERA);
    if (stored && ERA_SET.has(stored)) return stored as DangerEraId;
  } catch {
    /* private */
  }
  return "warlords";
}

export function persistDangerEra(era: DangerEraId) {
  try {
    localStorage.setItem(STORAGE_ERA, era);
  } catch {
    /* private */
  }
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("era", era);
    window.history.replaceState({}, "", u.toString());
  } catch {
    /* ignore */
  }
}

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
  era: DangerEraId;
  lane: FleetAnimRigLane;
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
  // Prefer full equipment visual (mesh_ids / gear_preset / class) — never ignore account kit.
  // Lazy import-safe: sync resolver is pure and does not hit network.
  let raceId = resolveRaceId(ch.raceId);
  let classKey = String(
    (ch as { classId?: string }).classId ||
      (ch as { class?: string }).class ||
      "warrior",
  )
    .toLowerCase()
    .replace(/\s+/g, "_");
  let presetId: PresetId =
    CLASS_TO_PRESET[classKey] ?? resolvePresetId(classKey) ?? resolvePresetId(ch.classId);
  let meshIds: string[] = [...getPreset(raceId, presetId).visibleMeshes];

  try {
    const vis = resolveCharacterEquipmentVisualSync(ch);
    raceId = vis.raceId;
    presetId = vis.presetId;
    if (vis.meshIds?.length >= 2) meshIds = [...vis.meshIds];
    classKey = String(presetId);
  } catch {
    /* keep class preset meshes */
  }

  const heroToken = `fleet_${ch.id.slice(0, 8)}_${raceId}_${classKey}`;
  const spec = buildSpec(raceId, classKey, presetId, heroToken, meshIds);
  const era: DangerEraId = "warlords";
  return {
    source: "fleet-character",
    displayName: ch.name || "Hero",
    spec,
    fleetCharacterId: ch.id,
    era,
    lane: "bip001-baked",
    dangerUrl: dangerDeepLink({
      hero: `${raceId.split("-")[0]}_${classKey}`,
      name: ch.name,
      era,
    }),
  };
}

function playableVoxelExplorer(
  ch: GrudgeCharacter | null,
  era: DangerEraId,
): DangerPlayableCharacter {
  const spec = buildSpec("western-kingdoms", "warrior", "warrior", "explorer");
  spec.studioAvatarId = "explorer";
  spec.meshIds = [];
  const name = ch?.name || "Explorer";
  return {
    source: ch ? "fleet-character" : "default",
    displayName: name,
    spec,
    fleetCharacterId: ch?.id,
    era,
    lane: "mixamo-explorer",
    dangerUrl: dangerDeepLink({ name, era }),
  };
}

export function dangerDeepLink(opts: {
  hero?: string;
  race?: string;
  classId?: string;
  name?: string;
  fromAre?: boolean;
  era?: DangerEraId;
}): string {
  const base =
    typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? `${window.location.origin}/danger`
      : "https://open.grudge-studio.com/danger";
  const q = new URLSearchParams();
  if (opts.era) q.set("era", opts.era);
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
  era?: DangerEraId;
}): DangerPlayableCharacter {
  const search = opts.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const fleetEra =
    opts.fleetCharacter &&
    String(
      (opts.fleetCharacter as { gameEra?: string }).gameEra ||
        (opts.fleetCharacter as { game_era?: string }).game_era ||
        "",
    );
  const era = opts.era || parseDangerEra(search, fleetEra);
  const lane = dangerLaneForEra(era);

  const withEra = (p: DangerPlayableCharacter): DangerPlayableCharacter => ({
    ...p,
    era,
    lane: p.lane || lane,
  });

  // 1) Explicit hero / character token (annihilate) — Warlords Toon path
  const fromHero = heroFromLocation(search);
  if (fromHero && lane === "bip001-baked") {
    let areFlag = false;
    try {
      const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
      areFlag = q.get("are") === "1" || q.get("from") === "are";
    } catch {
      /* ignore */
    }
    if (!areFlag || !parseAreQuery(search)) {
      return withEra({
        source: "url-hero",
        displayName: fromHero.hero.replace(/_/g, " "),
        spec: fromHero,
        era,
        lane: "bip001-baked",
        dangerUrl: dangerDeepLink({ hero: fromHero.hero, era }),
      });
    }
  }

  // 2) Asset-Rig-Editor / bake labels — Warlords Toon
  const fromAre = parseAreQuery(search);
  if (fromAre && lane === "bip001-baked") {
    return withEra({
      source: "url-are",
      displayName: fromAre.hero.replace(/^are_/, "").replace(/_/g, " "),
      spec: fromAre,
      era,
      lane: "bip001-baked",
      dangerUrl: dangerDeepLink({
        race: fromAre.raceId,
        classId: fromAre.classKey,
        name: fromAre.hero,
        fromAre: true,
        era,
      }),
    });
  }

  // 3) Mixamo explorer lane (voxel / nexus / armada)
  if (lane === "mixamo-explorer") {
    const ch = opts.fleetCharacter ?? null;
    if (ch && isWarlordsToonPlayCharacter(ch) && era === "warlords") {
      return playableFromFleetCharacter(ch);
    }
    return playableVoxelExplorer(ch, era);
  }

  // 4) Fleet Warlords Toon
  if (opts.fleetCharacter && isWarlordsToonPlayCharacter(opts.fleetCharacter)) {
    return playableFromFleetCharacter(opts.fleetCharacter);
  }

  // 5) Default grudge6 WK warrior
  const def = buildSpec("western-kingdoms", "warrior", "warrior", "wk_warrior");
  return {
    source: "default",
    displayName: "WK Warrior",
    spec: def,
    era: "warlords",
    lane: "bip001-baked",
    dangerUrl: dangerDeepLink({ hero: "wk_warrior", era: "warlords" }),
  };
}

/** Apply resolved playable to Studio (mesh_ids + character + weapon). */
export function applyDangerPlayableToStudio(
  studio: AnnihilateStudioTarget,
  playable: DangerPlayableCharacter,
): void {
  if (playable.lane === "mixamo-explorer") {
    studio.setEquipmentMeshIds(null);
    studio.setCharacter("explorer");
    if (playable.spec.weaponId && playable.spec.weaponId !== "none") {
      try {
        studio.setWeapon(playable.spec.weaponId);
      } catch {
        /* explorer may ignore arsenal ids */
      }
    }
    studio.flashMessage?.(
      `DANGER · ${playable.era.toUpperCase()} · ${playable.displayName.toUpperCase()} · mixamo-explorer · ${playable.source}`,
      2.8,
    );
    return;
  }
  applyAnnihilateHeroToStudio(studio, playable.spec);
  studio.flashMessage?.(
    `DANGER · ${playable.era.toUpperCase()} · ${playable.displayName.toUpperCase()} · ${playable.spec.animPack} · ${playable.source}`,
    2.8,
  );
}

export type { AnnihilateHeroSpec, AnnihilateStudioTarget };

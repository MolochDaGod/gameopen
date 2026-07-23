/**
 * Annihilate-demo hero boot — grudge6 race + class → Danger Room loadout.
 *
 * URL: https://grudge-studio.com/annihilate-demo?hero=elf_worge
 *   or open.grudge-studio.com/annihilate-demo?hero=wk_warrior
 *
 * Maps hero tokens onto:
 *  - Studio avatar id `grudge:<raceId>:<presetId>` (GrudgeAvatar combat rig)
 *  - gear preset mesh_ids (armor/weapon visibility)
 *  - Weapon / anim pack (weapon skills + MM)
 *  - Hand-bone / socket expectations (Bip001 containers)
 *
 * Danger Room owns Controller dodge (X), MM dash, VFX, arsenal skills.
 */

import type { RaceId } from "../three/grudge/raceAssets";
import type { AnimPack } from "../three/grudge/anims";
import type { PresetId } from "../three/grudge/gearPresets";
import { getPreset } from "../three/grudge/gearPresets";
import type { WeaponFamily } from "../three/grudge/weaponSkillPacks";
import { familyFromAnimPack } from "../three/grudge/weaponSkillPacks";
import { grudgeAvatarId } from "./raceModel";

export interface AnnihilateHeroSpec {
  /** Raw ?hero= token */
  hero: string;
  raceId: RaceId;
  /** Class / archetype key (warrior, worge, mage, ranger, …) */
  classKey: string;
  /** Gear preset id (mage | knight | ranger | warrior | unarmed) */
  presetId: PresetId;
  /**
   * Studio avatar id for GrudgeAvatar: `grudge:<race>:<preset>`.
   * Do not use bare race slugs — those skip the combat rig path.
   */
  studioAvatarId: string;
  /** Child mesh visibility list for kit equip */
  meshIds: string[];
  /** Weapon family for skill packs + MM */
  weaponFamily: WeaponFamily;
  /** grudge6 anim pack id */
  animPack: AnimPack;
  /** Preferred arsenal weapon id when Studio has it */
  weaponId: string;
}

const RACE_TOKEN: Record<string, RaceId> = {
  elf: "high-elves",
  elfs: "high-elves",
  highelf: "high-elves",
  "high-elves": "high-elves",
  wk: "western-kingdoms",
  human: "western-kingdoms",
  "western-kingdoms": "western-kingdoms",
  brb: "barbarians",
  barb: "barbarians",
  barbarian: "barbarians",
  barbarians: "barbarians",
  orc: "orcs",
  orcs: "orcs",
  ud: "undead",
  undead: "undead",
  dwf: "dwarves",
  dwarf: "dwarves",
  dwarves: "dwarves",
};

/** Class token → gear preset + arsenal weapon override. */
const CLASS_TOKEN: Record<
  string,
  { presetId: PresetId; weaponId: string }
> = {
  worge: { presetId: "unarmed", weaponId: "none" },
  beast: { presetId: "unarmed", weaponId: "none" },
  unarmed: { presetId: "unarmed", weaponId: "none" },
  brawler: { presetId: "unarmed", weaponId: "none" },
  warrior: { presetId: "warrior", weaponId: "axe" },
  fighter: { presetId: "warrior", weaponId: "axe" },
  knight: { presetId: "knight", weaponId: "sword" },
  ranger: { presetId: "ranger", weaponId: "bow" },
  archer: { presetId: "ranger", weaponId: "bow" },
  mage: { presetId: "mage", weaponId: "staffArcane" },
  wizard: { presetId: "mage", weaponId: "staff" },
  staff: { presetId: "mage", weaponId: "staff" },
  berserker: { presetId: "warrior", weaponId: "greatsword" },
  barbarian: { presetId: "warrior", weaponId: "axe" },
  greataxe: { presetId: "warrior", weaponId: "greataxe" },
  spear: { presetId: "warrior", weaponId: "spear" },
};

/**
 * Parse `elf_worge`, `wk-warrior`, `high-elves/mage` style tokens.
 */
export function parseAnnihilateHero(raw: string | null | undefined): AnnihilateHeroSpec | null {
  if (!raw || !String(raw).trim()) return null;
  const token = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/\//g, "_");

  const parts = token.split("_").filter(Boolean);
  if (parts.length === 0) return null;

  let racePart = parts[0]!;
  let classPart = parts.length > 1 ? parts.slice(1).join("_") : "warrior";

  if (parts[0] === "high" && parts[1] === "elves") {
    racePart = "high-elves";
    classPart = parts.length > 2 ? parts.slice(2).join("_") : "warrior";
  } else if (parts[0] === "western" && parts[1] === "kingdoms") {
    racePart = "western-kingdoms";
    classPart = parts.length > 2 ? parts.slice(2).join("_") : "warrior";
  }

  const raceId = RACE_TOKEN[racePart] ?? RACE_TOKEN[racePart.replace(/s$/, "")];
  if (!raceId) {
    console.warn(`[annihilate-hero] unknown race token "${racePart}" in hero=${raw}`);
    return null;
  }

  const cls = CLASS_TOKEN[classPart] ?? CLASS_TOKEN.warrior!;
  const preset = getPreset(raceId, cls.presetId);
  const animPack = preset.animPack;
  const weaponFamily = familyFromAnimPack(animPack);
  const studioAvatarId = grudgeAvatarId(raceId, cls.presetId);

  return {
    hero: token,
    raceId,
    classKey: classPart,
    presetId: cls.presetId,
    studioAvatarId,
    meshIds: [...preset.visibleMeshes],
    weaponFamily,
    animPack,
    weaponId: cls.weaponId,
  };
}

/** Read ?hero= from the current URL (or provided search string). */
export function heroFromLocation(
  search = typeof window !== "undefined" ? window.location.search : "",
): AnnihilateHeroSpec | null {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    return parseAnnihilateHero(q.get("hero") || q.get("character") || q.get("race"));
  } catch {
    return null;
  }
}

/**
 * Hand / socket readiness summary for boot logs (Bip001 + Mixamo).
 */
export function formatHandBoneReport(opts: {
  handR?: string | null;
  handL?: string | null;
  containerR?: string | null;
  containerL?: string | null;
}): string {
  const parts = [
    opts.containerR ? `R-socket:${opts.containerR}` : null,
    opts.handR ? `R-hand:${opts.handR}` : null,
    opts.containerL ? `L-socket:${opts.containerL}` : null,
    opts.handL ? `L-hand:${opts.handL}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "NO HAND BONES (weapons will float)";
}

/** Apply hero to a Studio-like surface (set mesh ids before character). */
export interface AnnihilateStudioTarget {
  setEquipmentMeshIds(ids: string[] | null | undefined): void;
  setCharacter(id: string): void;
  setWeapon(id: string): void;
  flashMessage?(text: string, duration?: number): void;
  reportHandSockets?(): string;
}

export function applyAnnihilateHeroToStudio(
  studio: AnnihilateStudioTarget,
  spec: AnnihilateHeroSpec,
): void {
  // Order matters: mesh_ids must be pending before setCharacter spawn.
  studio.setEquipmentMeshIds(spec.meshIds);
  studio.setCharacter(spec.studioAvatarId);
  if (spec.weaponId && spec.weaponId !== "none") {
    studio.setWeapon(spec.weaponId);
  } else {
    try {
      studio.setWeapon("none");
    } catch {
      /* optional */
    }
  }
  studio.flashMessage?.(
    `ANNIHILATE · ${spec.hero.toUpperCase()} · ${spec.animPack} · ${spec.meshIds.length} meshes`,
    2.6,
  );
  console.info(
    "[annihilate-demo] hero boot",
    spec.hero,
    "avatar=",
    spec.studioAvatarId,
    "pack=",
    spec.animPack,
    "weapon=",
    spec.weaponId,
    "meshes=",
    spec.meshIds.length,
    "— Danger: X dodge · E block · C parry · F/1–4 skills · MM",
  );
}

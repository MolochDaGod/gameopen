/**
 * Combat motion styles — player-facing choices for retargeted / baked anim packs.
 *
 * Danger Room is system-driven: pick a **style** (Samurai, Knight, …) to choose
 * which Bip001 pack drives loco + LMB + skills, independent of mesh race.
 * Styles map to {@link AnimPack} + optional skill-clip preferences.
 */

import type { AnimPack } from "./anims";

/** Stable style ids (persist / HUD). */
export type CombatStyleId =
  | "auto"
  | "samurai"
  | "knight"
  | "spearman"
  | "berserker"
  | "striker"
  | "mage"
  | "archer"
  | "gunner";

export interface CombatStyleDef {
  id: CombatStyleId;
  /** Short UI label */
  label: string;
  /** One-line blurb for Admin / loadout */
  blurb: string;
  /**
   * Logical anim pack. `auto` uses weapon → pack mapping instead.
   * `samurai` is a first-class pack built from retargeted sword + Madarame skills.
   */
  animPack: AnimPack | "auto";
  /** Preferred skill clip names for HUD slots 1–4 (fall back to attack). */
  skillClips?: [string, string, string, string];
  /** Icon key for Admin grid (matches Icon name when possible). */
  icon?: string;
}

/**
 * Styles available as player choices (retargeted Bip001 packs).
 * Samurai = curated slash/thrust/overhead set from Madarame + sword loco.
 */
export const COMBAT_STYLES: readonly CombatStyleDef[] = [
  {
    id: "auto",
    label: "Weapon Default",
    blurb: "Follow equipped weapon (sword→knight, spear→Madarame, …)",
    animPack: "auto",
    icon: "equip",
  },
  {
    id: "samurai",
    label: "Samurai",
    blurb: "Retargeted draw-slash / thrust / overhead / special (katana feel)",
    animPack: "samurai",
    skillClips: ["slash", "thrust", "overhead", "special"],
    icon: "attack",
  },
  {
    id: "knight",
    label: "Knight",
    blurb: "Sword & shield idle / run / attack (Mixamo retarget bake)",
    animPack: "sword_shield",
    skillClips: ["attack", "attack2", "attack3", "attack4"],
    icon: "defend",
  },
  {
    id: "spearman",
    label: "Spearman",
    blurb: "Madarame polearm full skill set (retargeted to Bip001)",
    animPack: "polearm",
    skillClips: ["skill1", "skill2", "skill3", "skill4"],
    icon: "charge",
  },
  {
    id: "berserker",
    label: "Berserker",
    blurb: "2H heavy — polearm combat until twohand bake ships",
    animPack: "twohand",
    skillClips: ["overhead", "power", "combo", "special"],
    icon: "siege",
  },
  {
    id: "striker",
    label: "Striker",
    blurb: "Unarmed / kick fight idle + punch (retargeted)",
    animPack: "unarmed",
    skillClips: ["attack", "skill1", "skill2", "skill3"],
    icon: "move",
  },
  {
    id: "mage",
    label: "Mage",
    blurb: "Staff cast + standing walk/run (magic pack)",
    animPack: "magic",
    skillClips: ["attack", "skill1", "skill2", "skill3"],
    icon: "skill-slot",
  },
  {
    id: "archer",
    label: "Archer",
    blurb: "Longbow aim / walk / run (retargeted)",
    animPack: "longbow",
    skillClips: ["attack", "skill1", "skill2", "skill3"],
    icon: "scout",
  },
  {
    id: "gunner",
    label: "Gunner",
    blurb: "Rifle / pistol bake when present; else unarmed fallback",
    animPack: "rifle",
    skillClips: ["attack", "skill1", "skill2", "skill3"],
    icon: "ambush",
  },
] as const;

const BY_ID = new Map(COMBAT_STYLES.map((s) => [s.id, s]));

export function getCombatStyle(id: string | null | undefined): CombatStyleDef {
  return BY_ID.get((id || "auto") as CombatStyleId) ?? COMBAT_STYLES[0]!;
}

export function listCombatStyles(): readonly CombatStyleDef[] {
  return COMBAT_STYLES;
}

const STORAGE_KEY = "grudge.open.combatStyle";

export function loadStoredCombatStyle(): CombatStyleId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (v && BY_ID.has(v as CombatStyleId)) return v as CombatStyleId;
  } catch {
    /* */
  }
  return "auto";
}

export function storeCombatStyle(id: CombatStyleId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* */
  }
}

/**
 * Resolve style → concrete AnimPack for loaders.
 * `auto` returns null so callers use weapon / class preset mapping.
 */
export function animPackForCombatStyle(
  styleId: CombatStyleId | string | null | undefined,
): AnimPack | null {
  const s = getCombatStyle(styleId);
  if (s.animPack === "auto") return null;
  return s.animPack;
}

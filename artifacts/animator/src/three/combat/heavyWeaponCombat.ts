/**
 * Heavy 2H combat profiles — greataxe, hammer2h, greatsword.
 *
 * Clip source: Madarame polearm bake (same roles as spear) with **per-weapon
 * MM / intensity / timeScale** so axe reads heavier and slower, mace more
 * impactful, greatsword lean + annihilate dash / jump / slide patterns.
 *
 * Annihilate reference (D:\annihilate-reference):
 *  - dash → dashAttack (slide + damage tag)
 *  - SwordBlaster: tall cyan slash projectile, multi-angle, type-3 = knockDown
 *  - Pop: single-frame AoE knockback sphere
 *  - airAttack: jump + lift velocity
 *
 * Open maps those to Controller.dash, Vfx slash projectiles, aoeBlast, hop.
 */

import type { WeaponId, SkillKind } from "../types";

/** Per-weapon feel multipliers applied to shared Madarame stages. */
export type HeavyWeaponProfile = {
  weaponId: WeaponId;
  label: string;
  /** Motion-math scale (1 = spear baseline). */
  mmScale: number;
  /** Damage / force intensity (1 = baseline). */
  intensity: number;
  /** Animation playback rate (1 = normal; <1 slower heavier swings). */
  timeScale: number;
  /** Combo stage dash distances (m) for stages 0..3 */
  stageDashM: [number, number, number, number];
  /** Extra dash on skill gap-closers */
  skillDashMul: number;
  /** AoE radius mul on finishers */
  aoeMul: number;
  /** Primary VFX color */
  color: number;
  /** Prefer these clip roles (Madarame) for LMB stages */
  comboClips: [string[], string[], string[], string[]];
  /** Jump / air attack clip candidates */
  jumpClips: string[];
  /** Slide / dash attack clip candidates */
  slideClips: string[];
  /** Whether dash skill fires annihilate-style slash projectiles */
  slashProjectiles: boolean;
  /** Number of slash blaster lanes (1 or 3 like SwordBlaster angles) */
  blasterCount: 1 | 3;
};

/** Madarame stage map shared by 2H family (same files, different MM). */
const MADARAME_COMBO: HeavyWeaponProfile["comboClips"] = [
  ["attack", "attack1", "thrust"],
  ["attack2", "slash"],
  ["attack4", "overhead"], // drive-in +MM
  ["attack3"], // finisher
];

export const HEAVY_WEAPON_PROFILES: Record<string, HeavyWeaponProfile> = {
  greataxe: {
    weaponId: "greataxe",
    label: "Great Axe",
    mmScale: 1.15,
    intensity: 1.25,
    timeScale: 0.88,
    stageDashM: [0.55, 0.65, 1.35, 0.85],
    skillDashMul: 1.2,
    aoeMul: 1.25,
    color: 0xff6020,
    comboClips: MADARAME_COMBO,
    jumpClips: ["attack5", "jumpAttack", "attack4"],
    slideClips: ["skill2", "attack5", "attack"],
    slashProjectiles: false,
    blasterCount: 1,
  },
  hammer2h: {
    weaponId: "hammer2h",
    label: "War Hammer 2H",
    mmScale: 1.05,
    intensity: 1.35,
    timeScale: 0.82,
    stageDashM: [0.45, 0.55, 1.15, 0.7],
    skillDashMul: 1.0,
    aoeMul: 1.4,
    color: 0xffb040,
    comboClips: MADARAME_COMBO,
    jumpClips: ["attack5", "jumpAttack", "overhead", "attack4"],
    slideClips: ["skill2", "attack4", "attack"],
    slashProjectiles: false,
    blasterCount: 1,
  },
  /** Greatsword: Madarame base + annihilate dash / jump / slide identity */
  greatsword: {
    weaponId: "greatsword",
    label: "Great Sword",
    mmScale: 1.25,
    intensity: 1.2,
    timeScale: 0.95,
    stageDashM: [0.7, 0.85, 1.6, 1.0],
    skillDashMul: 1.45,
    aoeMul: 1.15,
    color: 0x70e8ff,
    comboClips: [
      ["attack", "attack1"],
      ["attack2", "slash"],
      ["attack4", "overhead"],
      ["attack3", "special"],
    ],
    // Prefer great-sword-jump-attack when FBX loaded on Character; else Madarame
    jumpClips: [
      "great-sword-jump-attack",
      "jumpAttack",
      "attack5",
      "attack4",
    ],
    slideClips: [
      "great-sword-slide-attack",
      "skill2",
      "attack5",
      "dashAttack",
      "attack",
    ],
    slashProjectiles: true,
    blasterCount: 3,
  },
};

export function isHeavy2hWeapon(weaponId: WeaponId | string | null | undefined): boolean {
  const w = String(weaponId || "").toLowerCase();
  return w === "greataxe" || w === "hammer2h" || w === "greatsword";
}

export function heavyProfile(
  weaponId: WeaponId | string | null | undefined,
): HeavyWeaponProfile | null {
  const w = String(weaponId || "").toLowerCase();
  return HEAVY_WEAPON_PROFILES[w] || null;
}

/** Apply profile to base MM (motion-math units). */
export function scaledMm(baseMm: number, profile: HeavyWeaponProfile): number {
  return Math.round(baseMm * profile.mmScale);
}

/** Apply profile to metres dash. */
export function scaledDashM(baseM: number, profile: HeavyWeaponProfile): number {
  return baseM * profile.mmScale * profile.skillDashMul;
}

/** Signature kit rows for T0 / Studio (4 slots). */
export function heavySignatureRows(weaponId: WeaponId | string): {
  label: string;
  clip: string;
  kind: SkillKind;
  mode?: "default" | "dash";
  mm: number;
  cooldown: number;
  skillId?: string;
  damage?: number;
  timeScale?: number;
  dashM?: number;
  blasters?: boolean;
}[] {
  const p = heavyProfile(weaponId);
  if (!p) return [];
  const base = p.intensity * 40;
  if (p.weaponId === "greatsword") {
    return [
      {
        label: "GS Combo",
        clip: "attack",
        kind: "slash",
        mm: scaledMm(55, p),
        cooldown: 1.4,
        skillId: "gs_combo",
        damage: base,
        timeScale: p.timeScale,
      },
      {
        label: "Jump Smash",
        clip: p.jumpClips[0] || "attack5",
        kind: "slam",
        mode: "dash",
        mm: scaledMm(90, p),
        cooldown: 4.5,
        skillId: "gs_jump",
        damage: base * 1.3,
        timeScale: p.timeScale,
        dashM: scaledDashM(1.2, p),
      },
      {
        label: "Slide Dash",
        clip: p.slideClips[0] || "skill2",
        kind: "slash",
        mode: "dash",
        mm: scaledMm(100, p),
        cooldown: 6.0,
        skillId: "gs_slide",
        damage: base * 1.4,
        timeScale: p.timeScale * 1.15,
        dashM: scaledDashM(4.5, p),
        blasters: true,
      },
      {
        label: "Whirlwind AoE",
        clip: "special",
        kind: "nova",
        mm: scaledMm(40, p),
        cooldown: 12,
        skillId: "gs_aoe",
        damage: base * 1.8,
        timeScale: p.timeScale * 1.1,
        blasters: true,
      },
    ];
  }
  // greataxe / hammer2h — Madarame-weighted
  const isAxe = p.weaponId === "greataxe";
  return [
    {
      label: isAxe ? "Axe Combo" : "Maul Combo",
      clip: "attack",
      kind: isAxe ? "slash" : "slam",
      mm: scaledMm(50, p),
      cooldown: 1.5,
      skillId: `${p.weaponId}_combo`,
      damage: base,
      timeScale: p.timeScale,
    },
    {
      label: isAxe ? "Cleave Drive" : "Quake Drive",
      clip: "attack4",
      kind: "slam",
      mode: "dash",
      mm: scaledMm(95, p),
      cooldown: 4.0,
      skillId: `${p.weaponId}_drive`,
      damage: base * 1.25,
      timeScale: p.timeScale,
      dashM: scaledDashM(2.2, p),
    },
    {
      label: isAxe ? "Spin Execute" : "Anvil Drop",
      clip: "skill2",
      kind: "nova",
      mode: "dash",
      mm: scaledMm(70, p),
      cooldown: 7.5,
      skillId: `${p.weaponId}_aoe`,
      damage: base * 1.5,
      timeScale: p.timeScale,
      dashM: scaledDashM(1.8, p),
    },
    {
      label: isAxe ? "Apocalypse" : "Cataclysm",
      clip: "special",
      kind: "nova",
      mm: scaledMm(45, p),
      cooldown: 14,
      skillId: `${p.weaponId}_ult`,
      damage: base * 2.0,
      timeScale: p.timeScale * 0.95,
    },
  ];
}

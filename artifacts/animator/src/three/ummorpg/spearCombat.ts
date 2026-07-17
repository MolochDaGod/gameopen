/**
 * uMMORPG SPEAR combat — ScriptableSkill concepts for Open / Danger Room.
 *
 * Madarame polearm bake (author-validated clips):
 *   attack1_1 / attack1_2  → base spear attacks (LMB combo openers)
 *   attack1_4              → combo finisher entry (+MM gap close)
 *   attack1_3              → true finisher hit (after 1_4)
 *   attack1_5              → lunging attack skill
 *   skill2_1               → speed move · blur/slash · AoE finisher (ability 3)
 *
 * Bake roles: attack=1_1, attack2=1_2, attack3=1_3, attack4=1_4, attack5=1_5, skill2=skill2_1
 */

import type { SkillKind, WeaponId } from "../types";

/**
 * LMB spear combo stages → Madarame clip roles.
 * Stage 2 plays attack4 (+MM); Studio chains attack3 as impact finisher.
 */
export const SPEAR_COMBO_CLIPS: readonly string[][] = [
  ["attack", "thrust", "attack1"], // attack1_1 base
  ["attack2", "slash"], // attack1_2 base
  ["attack4", "overhead"], // attack1_4 finisher entry (+MM)
  ["attack3"], // attack1_3 true finisher (optional 4th stage)
];

/** Strong gap-close MM on stage 2 (attack1_4). */
export const SPEAR_FINISHER_ENTRY_MM = 95;

/** Master catalog skill id → polearm baked role / clip key. */
export const SPEAR_ANIM_CLIP: Record<string, string> = {
  // Documents pack + Madarame roles
  // upward-thrust · spear1 · lance-spartan · rising-thrust
  spear_thrust: "attack1", // multiUpward Thrust
  spear_lunge: "attack3", // lance-spartan dash
  spear_sweep: "attack2", // spear1 mid chain
  // Secondary
  spear_javelin: "skill",
  spear_vault: "attack3",
  spear_wall: "skill",
  // Ability
  spear_impale: "stab", // rising thrust (11Upward)
  spear_cyclone: "skill", // spear1 flurry
  spear_dragon: "special",
  spear_phantom: "skill",
  // Ultimate
  spear_storm: "skill",
  spear_dragontail: "special",
  // T0 starter
  t0_spear_quick_thrust: "attack1",
  t0_spear_pole_guard: "idle",
  t0_spear_reach_strike: "attack1",
  t0_spear_sweeping_jab: "attack2",
  // Local aliases
  thrust: "attack1",
  charge: "attack3",
  skewer: "attack3",
  sweep: "attack2",
  combo: "attack1",
  special: "skill",
  power: "stab",
  finisher: "attack3",
  speed: "skill",
};

/**
 * Preferred 4-slot bar:
 *  1 Thrust (1_1) · 2 Lunge (1_5) · 3 Speed/AoE (skill2_1) · 4 Dragontail
 */
export const SPEAR_HOTBAR_PREFER: [string, string, string, string] = [
  "spear_thrust",
  "spear_lunge",
  "spear_cyclone",
  "spear_dragontail",
];

export type SpearMotionKind = "none" | "lunge" | "charge" | "vault" | "throw";

export interface SpearSkillRuntime {
  id: string;
  name: string;
  description: string;
  /** Polearm clip role */
  clip: string;
  kind: SkillKind;
  /** Motion-math (+ = gap close) */
  mm: number;
  mode: "default" | "dash";
  motion: SpearMotionKind;
  /** Dash distance metres (overrides mm when set) */
  dashM: number;
  /** Dash duration seconds */
  dashDur: number;
  /** Windup before damage / impact (cast telegraph) */
  castTime: number;
  cooldown: number;
  damage: number;
  range: number;
  stamina: number;
  /** VFX tint */
  vfxColor: number;
  /** Icon CDN relative path when known */
  icon?: string;
  /** Hit window fraction of anim [start, end] */
  hitWindow: [number, number];
}

/**
 * Full uMMORPG SPEAR tree as runtime defs (offline-safe fallback when catalog
 * not yet warmed). Numbers align with master-weaponSkills SPEAR (2026-06).
 */
export const SPEAR_UMMORPG_SKILLS: readonly SpearSkillRuntime[] = [
  {
    id: "spear_thrust",
    name: "Quick Thrust",
    description: "Base spear jab (Madarame attack1_1).",
    clip: "attack",
    kind: "thrust",
    mm: 45,
    mode: "default",
    motion: "lunge",
    dashM: 0.45,
    dashDur: 0.16,
    castTime: 0.08,
    cooldown: 0.85,
    damage: 40,
    range: 4,
    stamina: 3,
    vfxColor: 0xc8e8ff,
    icon: "/icons/pack/weapons/Spear_01.png",
    hitWindow: [0.2, 0.45],
  },
  {
    id: "spear_lunge",
    name: "Piercing Lunge",
    description: "Lunging spear skill (Madarame attack1_5) — gap close.",
    clip: "attack5",
    kind: "thrust",
    mm: 100,
    mode: "dash",
    motion: "lunge",
    dashM: 3.2,
    dashDur: 0.34,
    castTime: 0.14,
    cooldown: 3.2,
    damage: 55,
    range: 6,
    stamina: 6,
    vfxColor: 0x90d0ff,
    icon: "/icons/pack/weapons/Spear_05.png",
    hitWindow: [0.3, 0.58],
  },
  {
    id: "spear_sweep",
    name: "Second Jab",
    description: "Second base spear attack (Madarame attack1_2).",
    clip: "attack2",
    kind: "slash",
    mm: 40,
    mode: "default",
    motion: "none",
    dashM: 0.4,
    dashDur: 0.18,
    castTime: 0.1,
    cooldown: 1.2,
    damage: 42,
    range: 4,
    stamina: 3,
    vfxColor: 0xb0e0ff,
    icon: "/icons/pack/weapons/Spear_10.png",
    hitWindow: [0.25, 0.52],
  },
  {
    id: "spear_javelin",
    name: "Javelin Throw",
    description: "Throw spear; pierce first target (ranged poke).",
    clip: "skill2",
    kind: "bolt",
    mm: -70,
    mode: "default",
    motion: "throw",
    dashM: 0,
    dashDur: 0,
    castTime: 0.25,
    cooldown: 8,
    damage: 65,
    range: 20,
    stamina: 8,
    vfxColor: 0xffe8a0,
    icon: "/icons/pack/weapons/Spear_01.png",
    hitWindow: [0.35, 0.55],
  },
  {
    id: "spear_vault",
    name: "Finisher Drive",
    description: "Combo finisher entry (Madarame attack1_4) with +MM gap close → chains attack1_3.",
    clip: "attack4",
    kind: "slam",
    mm: 95,
    mode: "dash",
    motion: "charge",
    dashM: 2.4,
    dashDur: 0.3,
    castTime: 0.12,
    cooldown: 5,
    damage: 62,
    range: 5.5,
    stamina: 8,
    vfxColor: 0x60b8ff,
    icon: "/icons/pack/weapons/Spear_05.png",
    hitWindow: [0.35, 0.65],
  },
  {
    id: "spear_wall",
    name: "Wall of Spears",
    description: "Plant zone — slow enemies in radius.",
    clip: "skill3",
    kind: "nova",
    mm: 0,
    mode: "default",
    motion: "none",
    dashM: 0,
    dashDur: 0,
    castTime: 0.35,
    cooldown: 15,
    damage: 40,
    range: 6,
    stamina: 10,
    vfxColor: 0x88c0ff,
    hitWindow: [0.4, 0.7],
  },
  {
    id: "spear_impale",
    name: "Impale",
    description: "Root + bleed skewer.",
    clip: "overhead",
    kind: "thrust",
    mm: 70,
    mode: "default",
    motion: "lunge",
    dashM: 1.2,
    dashDur: 0.24,
    castTime: 0.22,
    cooldown: 10,
    damage: 50,
    range: 4,
    stamina: 8,
    vfxColor: 0xff9090,
    hitWindow: [0.35, 0.6],
  },
  {
    id: "spear_cyclone",
    name: "Spear Rush",
    description:
      "Speed move (Madarame skill2_1) — blur + slash, AoE finisher. Ability 3.",
    clip: "skill2",
    kind: "nova",
    mm: 70,
    mode: "dash",
    motion: "charge",
    dashM: 2.8,
    dashDur: 0.38,
    castTime: 0.1,
    cooldown: 8,
    damage: 80,
    range: 5,
    stamina: 10,
    vfxColor: 0xa0d8ff,
    hitWindow: [0.28, 0.72],
  },
  {
    id: "spear_dragon",
    name: "Dragon Strike",
    description: "Fire pierce thrust.",
    clip: "special",
    kind: "fireDragon",
    mm: 85,
    mode: "dash",
    motion: "charge",
    dashM: 3.5,
    dashDur: 0.35,
    castTime: 0.25,
    cooldown: 14,
    damage: 100,
    range: 6,
    stamina: 12,
    vfxColor: 0xff8040,
    hitWindow: [0.4, 0.65],
  },
  {
    id: "spear_phantom",
    name: "Phantom Lance",
    description: "Homing phantom spears.",
    clip: "skill2",
    kind: "bolt",
    mm: -60,
    mode: "default",
    motion: "throw",
    dashM: 0,
    dashDur: 0,
    castTime: 0.3,
    cooldown: 16,
    damage: 90,
    range: 12,
    stamina: 12,
    vfxColor: 0xc0a0ff,
    hitWindow: [0.35, 0.6],
  },
  {
    id: "spear_storm",
    name: "Storm of Spears",
    description: "AoE rain — slow zone.",
    clip: "skill4",
    kind: "nova",
    mm: 0,
    mode: "default",
    motion: "none",
    dashM: 0,
    dashDur: 0,
    castTime: 0.45,
    cooldown: 50,
    damage: 200,
    range: 10,
    stamina: 18,
    vfxColor: 0x70c0ff,
    hitWindow: [0.4, 0.85],
  },
  {
    id: "spear_dragontail",
    name: "Dragontail Sweep",
    description: "Ultimate 360° knockup — air combo.",
    clip: "special",
    kind: "nova",
    mm: 50,
    mode: "default",
    motion: "none",
    dashM: 0.8,
    dashDur: 0.28,
    castTime: 0.35,
    cooldown: 60,
    damage: 260,
    range: 6,
    stamina: 20,
    vfxColor: 0xffd080,
    hitWindow: [0.35, 0.8],
  },
] as const;

const BY_ID = new Map(SPEAR_UMMORPG_SKILLS.map((s) => [s.id, s]));

export function isSpearWeapon(weaponId: WeaponId | string | null | undefined): boolean {
  const w = String(weaponId || "").toLowerCase();
  return w === "spear" || w === "javelin" || w === "lance" || w === "halberd";
}

export function spearSkillById(id: string | null | undefined): SpearSkillRuntime | null {
  if (!id) return null;
  return BY_ID.get(id) || null;
}

/** Resolve clip role from skill id or free text. */
export function spearClipForSkillId(id: string | null | undefined): string {
  if (!id) return "thrust";
  if (SPEAR_ANIM_CLIP[id]) return SPEAR_ANIM_CLIP[id]!;
  const sk = BY_ID.get(id);
  if (sk) return sk.clip;
  if (/lunge|charge|vault|skewer/i.test(id)) return "skill1";
  if (/sweep|cyclone|spin/i.test(id)) return "slash";
  if (/throw|javelin|phantom/i.test(id)) return "skill2";
  if (/ultimate|dragon|bankai|special/i.test(id)) return "special";
  return "thrust";
}

/** Infer gap-close motion from master skill name/effects. */
export function spearMotionFromMeta(
  name: string,
  effects?: string[] | null,
  description?: string,
): SpearMotionKind {
  const blob = `${name} ${(effects || []).join(" ")} ${description || ""}`.toLowerCase();
  if (/vault/.test(blob)) return "vault";
  if (/charge|rush|gap/.test(blob)) return "charge";
  if (/lunge|skewer|pierce.*forward|forward/.test(blob)) return "lunge";
  if (/throw|javelin|phantom/.test(blob)) return "throw";
  return "none";
}

/**
 * Preferred Danger hotbar (4 skills) — thrust, lunge, vault charge, ultimate.
 * Falls back to SPEAR_UMMORPG order if ids missing.
 */
export function spearHotbarSkills(): SpearSkillRuntime[] {
  return SPEAR_HOTBAR_PREFER.map(
    (id) => BY_ID.get(id) || SPEAR_UMMORPG_SKILLS.find((s) => s.id === id)!,
  ).filter(Boolean);
}

/** Signature-row shape used by Studio / t0SignatureSkills. */
export function spearSignatureRows(): {
  label: string;
  clip: string;
  kind: SkillKind;
  mode?: "default" | "dash";
  mm: number;
  cooldown: number;
  iconUrl?: string | null;
  skillId?: string;
  damage?: number;
  castTime?: number;
  dashM?: number;
  dashDur?: number;
  motion?: SpearMotionKind;
  vfxColor?: number;
  hitWindow?: [number, number];
}[] {
  return spearHotbarSkills().map((s) => ({
    label: s.name,
    clip: s.clip,
    kind: s.kind,
    mode: s.mode,
    mm: s.mm,
    cooldown: s.cooldown,
    iconUrl: s.icon ? `https://assets.grudge-studio.com${s.icon}` : null,
    skillId: s.id,
    damage: s.damage,
    castTime: s.castTime,
    dashM: s.dashM,
    dashDur: s.dashDur,
    motion: s.motion,
    vfxColor: s.vfxColor,
    hitWindow: s.hitWindow,
  }));
}

/**
 * Charge / vault execution plan for Controller.dash + Vfx.
 * distance prefers skill.dashM, else mm * 0.01 * scale.
 */
export function spearChargePlan(skill: SpearSkillRuntime): {
  distance: number;
  duration: number;
  impactAt: number;
  chargeColor: number;
  telegraph: number;
  isGapClose: boolean;
} {
  const isGap =
    skill.motion === "lunge" || skill.motion === "charge" || skill.motion === "vault";
  const distance = isGap
    ? Math.max(0.4, skill.dashM || Math.abs(skill.mm) * 0.01 * 1.2)
    : Math.abs(skill.dashM || 0);
  return {
    distance,
    duration: Math.max(0.16, skill.dashDur || 0.28),
    impactAt: skill.hitWindow[0] * 0.9 + 0.15,
    chargeColor: skill.vfxColor,
    telegraph: skill.castTime,
    isGapClose: isGap && distance >= 0.8,
  };
}

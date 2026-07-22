/**
 * Canonical weapon skill definition — mesh, collider, VFX, impact, CD, combos.
 *
 * Every fleet game (Open / Voxel / Warlords / RTS) binds skills to this shape.
 * Production packs ship baked anims + mesh paths under assets.grudge-studio.com
 * or same-origin public/; hosts resolve URLs via their asset resolver.
 */

import type { FleetSlashVariantId } from "./constants.js";

/** Collider attached to a weapon skill hit volume (SI metres). */
export type SkillColliderDef =
  | {
      type: "sphere";
      radius: number;
      /** Local offset from cast origin / hand (x,y,z) m */
      offset?: [number, number, number];
    }
  | {
      type: "capsule";
      radius: number;
      halfHeight: number;
      offset?: [number, number, number];
      /** Local axis unit vector */
      axis?: [number, number, number];
    }
  | {
      type: "box";
      halfExtents: [number, number, number];
      offset?: [number, number, number];
    };

/** Projectile spawned by a skill (Getsuga, bolt, fireball, …). */
export type SkillProjectileDef = {
  kind: "slash_wave" | "bolt" | "orb" | "beam" | "custom";
  speed: number;
  range: number;
  /** Production mesh path (optional — procedural fallback OK) */
  meshPath?: string;
  /** Getsuga family tint id */
  slashVariant?: FleetSlashVariantId;
  contactRadius?: number;
  followWeapon?: boolean;
  followDuration?: number;
  unparryable?: boolean;
};

/** Combo stage chain for multi-hit skills / LMB packs. */
export type SkillComboDef = {
  /** Ordered anim clip ids or role names */
  stages: string[];
  /** Input window between stages (s) */
  windowSec: number;
  /** Optional per-stage slash variant */
  stageVariants?: FleetSlashVariantId[];
};

/**
 * Full weapon skill — the SSOT row every host should load / display / cast.
 */
export type FleetWeaponSkill = {
  /** Stable id: e.g. sword_sig1, greatsword_fire_tornado */
  id: string;
  /** Weapon family id (sword, greatsword, bow, …) */
  weaponId: string;
  /** HUD slot 0..3 (1–4 in UI) */
  slot: 0 | 1 | 2 | 3;
  label: string;
  /** Role tag for HUD chrome */
  role?: "combo" | "special" | "ranged" | "power" | "utility";

  // ── Animation (baked, ready) ──────────────────────────────────────────
  /** Primary cast / attack clip path or registry key */
  animClip?: string;
  /** Secondary clip (recovery / follow-through) */
  animClipEnd?: string;
  /** Animator role fallback when clip missing */
  animRole?: string;
  combo?: SkillComboDef;

  // ── Mesh + collider (production) ──────────────────────────────────────
  /** Optional skill-specific mesh (GLB) attached for duration */
  meshPath?: string;
  /** Hit volume — required for contact skills */
  collider?: SkillColliderDef;
  /** Weapon mesh remains equipped; skill may spawn extra mesh */
  attachToHand?: "main" | "off" | "none";

  // ── VFX (cast / trail / impact) ───────────────────────────────────────
  /** Sandbox / catalog effect id at cast start */
  castEffectId?: string;
  /** Impact / explode effect id on hit */
  impactEffectId?: string;
  /** Continuous trail color hex */
  trailColor?: number;
  projectile?: SkillProjectileDef;
  /** Ground AoE on impact (m) */
  aoeRadius?: number;

  // ── Timing & economy ──────────────────────────────────────────────────
  /** Full skill cooldown (s) */
  cooldown: number;
  /** Cast / windup before damage (s) */
  castDuration?: number;
  /** Active hit frames length (s) */
  activeDuration?: number;
  staminaCost: number;

  // ── Damage ────────────────────────────────────────────────────────────
  damage: number;
  poiseDamage?: number;
  force?: number;
  shieldBreak?: boolean;
  unparryable?: boolean;

  // ── Meta ──────────────────────────────────────────────────────────────
  iconUrl?: string | null;
  tags?: string[];
};

/** Validate a skill row for production readiness (missing mesh/collider/cd). */
export type SkillReadiness = {
  id: string;
  ok: boolean;
  missing: string[];
  warnings: string[];
};

export function assessWeaponSkillReadiness(skill: FleetWeaponSkill): SkillReadiness {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!skill.id) missing.push("id");
  if (!skill.label) missing.push("label");
  if (!skill.cooldown && skill.cooldown !== 0) missing.push("cooldown");
  if (skill.staminaCost == null) missing.push("staminaCost");
  if (skill.damage == null) missing.push("damage");
  if (!skill.animClip && !skill.animRole && !skill.combo?.stages?.length) {
    missing.push("animClip|animRole|combo");
  }
  if (!skill.collider && !skill.projectile && !skill.aoeRadius) {
    warnings.push("no collider/projectile/aoe — pure buff?");
  }
  if (skill.projectile?.kind === "slash_wave" && !skill.projectile.slashVariant) {
    warnings.push("slash_wave without slashVariant");
  }
  if (!skill.castEffectId && !skill.impactEffectId && !skill.projectile) {
    warnings.push("no VFX ids");
  }
  return {
    id: skill.id,
    ok: missing.length === 0,
    missing,
    warnings,
  };
}

/** Build a minimal valid skill for scaffolding. */
export function scaffoldWeaponSkill(
  partial: Partial<FleetWeaponSkill> &
    Pick<FleetWeaponSkill, "id" | "weaponId" | "slot" | "label">,
): FleetWeaponSkill {
  return {
    cooldown: 2.5,
    staminaCost: 16,
    damage: 20,
    force: 2,
    castDuration: 0.25,
    activeDuration: 0.2,
    ...partial,
  };
}

/**
 * Damage + impact resolution — range falloff, facing, force tiers, smash KB.
 */

import {
  ANGLE,
  IMPACT,
  RANGE,
  angleBetween,
  clamp,
  degToRad,
} from "./worldMath";
import {
  attackRelativeYaw,
  distXZ,
  type Vec2,
  lookYaw,
  forwardFromYaw,
} from "./combatGeometry";
import type { DefenseResult } from "./defenseMath";

export type HitContext = {
  attackerPos: Vec2;
  attackerYaw: number;
  defenderPos: Vec2;
  defenderYaw: number;
  /** Base weapon damage. */
  baseDamage: number;
  force: 1 | 2 | 3;
  /** Optional max range for falloff (melee uses reach). */
  maxRange?: number;
  /** Crit if within crit cone + luck host flag. */
  allowCrit?: boolean;
  /** Defense already resolved (optional). */
  defense?: DefenseResult;
};

export type ImpactResult = {
  damage: number;
  poiseDamage: number;
  knockback: { x: number; z: number; speed: number };
  knockUp: number;
  stun: number;
  crit: boolean;
  backstab: boolean;
  rangeMul: number;
  facingMul: number;
  label: string;
};

function rangeMul(dist: number, maxRange: number): number {
  if (maxRange <= 1e-6) return 1;
  const t = dist / maxRange;
  if (t <= IMPACT.fullDamageRangeFrac) return 1;
  const u =
    (t - IMPACT.fullDamageRangeFrac) / (1 - IMPACT.fullDamageRangeFrac);
  return clamp(1 - u * (1 - IMPACT.minRangeMul), IMPACT.minRangeMul, 1);
}

/**
 * Full impact after optional defense.
 */
export function resolveImpact(ctx: HitContext): ImpactResult {
  const dist = distXZ(ctx.attackerPos, ctx.defenderPos);
  const maxR = ctx.maxRange ?? RANGE.meleeLight;
  const rMul = rangeMul(dist, maxR);

  // Facing: attacker→defender vs attacker yaw
  const toDef = lookYaw(ctx.attackerPos, ctx.defenderPos);
  const aimErr = angleBetween(ctx.attackerYaw, toDef);
  const facingMul = aimErr > degToRad(ANGLE.strikeHalfDeg) ? 0.55 : 1;

  // Backstab: attack from behind defender
  const rel = attackRelativeYaw(
    ctx.defenderYaw,
    ctx.attackerPos,
    ctx.defenderPos,
  );
  const backstab = rel > degToRad(125);
  const backMul = backstab ? IMPACT.backstabMul : 1;

  // Crit: head-on within crit cone
  const crit =
    !!ctx.allowCrit &&
    aimErr <= degToRad(ANGLE.critHalfDeg) &&
    !backstab;

  let dmg = ctx.baseDamage * rMul * facingMul * backMul;
  if (crit) dmg *= 1.5;

  const def = ctx.defense;
  if (def) {
    dmg *= def.damageMul;
  }

  const force = ctx.force;
  const poise =
    dmg * 0.65 + force * 4 + (def?.poiseReturn ?? 0) * 10;

  // Knockback direction: away from attacker
  const away = forwardFromYaw(lookYaw(ctx.attackerPos, ctx.defenderPos));
  let kbSpeed =
    IMPACT.knockbackPerTier * force * (def?.knockbackMul ?? 1);
  if (crit) kbSpeed *= 1.15;
  if (def && def.damageMul === 0) kbSpeed = 0;

  // Smash clamp (metres of effective shove)
  const smashM = clamp(
    kbSpeed / 6.15,
    0,
    IMPACT.smashMaxM,
  );
  kbSpeed = smashM * 6.15;

  const knockUp =
    force >= 3 && smashM >= IMPACT.smashMinM * 0.85 ? 2.2 : force >= 2 ? 0.6 : 0;

  const stun =
    (def?.attackerStun ?? 0) > 0
      ? 0
      : IMPACT.stunPerTier * force * (crit ? 1.2 : 1);

  let label = crit ? "CRIT" : backstab ? "BACKSTAB" : "HIT";
  if (def && def.kind !== "none") label = def.label;

  return {
    damage: Math.max(0, dmg),
    poiseDamage: poise,
    knockback: { x: away.x * kbSpeed, z: away.z * kbSpeed, speed: kbSpeed },
    knockUp,
    stun,
    crit,
    backstab,
    rangeMul: rMul,
    facingMul,
    label,
  };
}

/**
 * Clip-cut impact pulse radius (parry/block bubbles) in metres.
 */
export function defenseBubbleRadius(kind: "parry" | "block"): number {
  return kind === "parry" ? RANGE.parryBubble : RANGE.blockBubble;
}

/**
 * Smash knockback metres from force (aligns combatCuts SMASH_KB).
 */
export function smashMetersFromForce(force: number, stacks = 0): number {
  const base = IMPACT.smashMinM + force * IMPACT.smashMinM * 0.35;
  const stack = Math.min(4, stacks) * 0.2;
  return clamp(base + stack, IMPACT.smashMinM, IMPACT.smashMaxM);
}

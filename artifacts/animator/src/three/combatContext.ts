/**
 * Combat context — Albion-style / Smash-adjacent state for skill & animation picks.
 *
 * Skills and clip selection read this snapshot each press so the same button can
 * play different animations / VFX depending on:
 *  airborne · after attack N · after damage · enemy windup · parry · stun ·
 *  knockdown · ragdoll / tumble · hover
 *
 * Studio fills the snapshot each frame; skill combos query it on cast.
 */

/** High-level combat situation for state-dependent skills. */
export type CombatSituation =
  | "ground"
  | "air"
  | "hover"
  | "after_light"
  | "after_skill"
  | "after_damage"
  | "enemy_attacking"
  | "parry"
  | "block"
  | "stunned"
  | "knockdown"
  | "ragdoll";

export interface CombatContextSnapshot {
  airborne: boolean;
  grounded: boolean;
  hovering: boolean;
  /** Player CC state string when available. */
  playerState: string;
  blocking: boolean;
  /** Seconds since last taken damage (large = not recently hit). */
  afterDamageT: number;
  /** Seconds remaining of tumble / launch ragdoll. */
  tumbleT: number;
  /** Last LMB combo stage 0–2, or -1. */
  lastComboStage: number;
  /** Last skill slot 0–3, or -1. */
  lastSkillSlot: number;
  /** Part index of multi-part skill chain (0 = opener). */
  skillPart: number;
  /** Window left to continue multi-part skill (s). */
  skillPartWindow: number;
  /** Nearest enemy is in attack windup / active. */
  enemyAttacking: boolean;
  /** Enemy is stunned / fallen. */
  enemyVulnerable: boolean;
}

export function emptyCombatContext(): CombatContextSnapshot {
  return {
    airborne: false,
    grounded: true,
    hovering: false,
    playerState: "idle",
    blocking: false,
    afterDamageT: 99,
    tumbleT: 0,
    lastComboStage: -1,
    lastSkillSlot: -1,
    skillPart: 0,
    skillPartWindow: 0,
    enemyAttacking: false,
    enemyVulnerable: false,
  };
}

/** Rank situations for clip/VFX priority (first match wins). */
export function situationsFromContext(ctx: CombatContextSnapshot): CombatSituation[] {
  const out: CombatSituation[] = [];
  if (ctx.tumbleT > 0.05) out.push("ragdoll");
  if (ctx.playerState === "fallen" || ctx.playerState === "stunned") {
    if (ctx.playerState === "fallen") out.push("knockdown");
    if (ctx.playerState === "stunned") out.push("stunned");
  }
  if (ctx.playerState === "parry") out.push("parry");
  if (ctx.blocking) out.push("block");
  if (ctx.afterDamageT < 0.85) out.push("after_damage");
  if (ctx.hovering) out.push("hover");
  if (ctx.airborne && !ctx.hovering) out.push("air");
  if (ctx.enemyAttacking) out.push("enemy_attacking");
  if (ctx.lastSkillSlot >= 0 && ctx.skillPartWindow > 0) out.push("after_skill");
  if (ctx.lastComboStage >= 0) out.push("after_light");
  out.push("ground");
  return out;
}

/**
 * Pick first available clip from candidates that match current situations.
 * `table` maps situation → ordered clip name list.
 */
export function pickStateClip(
  table: Partial<Record<CombatSituation, string[]>>,
  ctx: CombatContextSnapshot,
  hasClip: (name: string) => boolean,
  fallback: string[] = ["attack"],
): string | null {
  const order = situationsFromContext(ctx);
  for (const sit of order) {
    const list = table[sit];
    if (!list) continue;
    for (const n of list) {
      if (hasClip(n)) return n;
    }
  }
  for (const n of fallback) {
    if (hasClip(n)) return n;
  }
  return null;
}

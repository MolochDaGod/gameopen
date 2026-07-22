/**
 * Pure fleet combat rules — shared by Open Studio, Voxel games, Warlords hosts.
 * No Three.js. Hosts supply stamina numbers and apply returned plans.
 */

import {
  FLEET_DODGE,
  FLEET_SLIDE,
  FLEET_PARRY,
  FLEET_STAMINA_COST,
  type FleetSlashVariantId,
} from "./constants.js";

// ---------------------------------------------------------------------------
// Dodge
// ---------------------------------------------------------------------------

export type DodgePlan = {
  /** Metres to travel */
  distance: number;
  /** Stamina to spend now */
  cost: number;
  /** cur / max */
  ratio: number;
  /** True when locked to min distance band */
  short: boolean;
};

/**
 * Stamina-scaled dodge plan.
 * - cost = staminaFrac × maxStamina (capped to current)
 * - under lowStaminaRatio → minDistance
 * - full stamina → maxDistance
 */
export function planDodge(currentStamina: number, maxStamina: number): DodgePlan {
  const maxS = Math.max(1, maxStamina);
  const cur = Math.max(0, currentStamina);
  const ratio = cur / maxS;
  const cost = Math.min(cur, maxS * FLEET_DODGE.staminaFrac);
  const minD = FLEET_DODGE.minDistance;
  const maxD = FLEET_DODGE.maxDistance;
  let distance: number;
  let short = false;
  if (ratio < FLEET_DODGE.lowStaminaRatio) {
    distance = minD;
    short = true;
  } else {
    const t = (ratio - FLEET_DODGE.lowStaminaRatio) / (1 - FLEET_DODGE.lowStaminaRatio);
    const u = Math.max(0, Math.min(1, t));
    distance = minD + (maxD - minD) * u;
  }
  return { distance, cost, ratio, short };
}

// ---------------------------------------------------------------------------
// Slide contact resolution
// ---------------------------------------------------------------------------

export type DefenderCombatState =
  | "idle"
  | "attack"
  | "dodge"
  | "parry"
  | "block"
  | "stagger"
  | "stunned"
  | "fallen"
  | "getUp"
  | "dead"
  | string;

export type SlideContactVerdict =
  | { kind: "trip"; damage: number; poise: number; unparryable: true }
  | { kind: "blocked"; stunAttackerSec: number; damage: 0 }
  | { kind: "parryBreak"; damage: number; poise: number; knockdown: true };

/**
 * Resolve combat-slide contact against a defender's current state.
 * - block → stop slider, no damage, short stun on attacker
 * - parry → break into knockdown + damage (unparryable)
 * - else → trip damage (unparryable)
 */
export function resolveSlideContact(defenderState: DefenderCombatState): SlideContactVerdict {
  if (defenderState === "block") {
    return { kind: "blocked", stunAttackerSec: FLEET_SLIDE.blockStunSec, damage: 0 };
  }
  if (defenderState === "parry") {
    return {
      kind: "parryBreak",
      damage: FLEET_SLIDE.damage,
      poise: FLEET_SLIDE.poiseDamage,
      knockdown: true,
    };
  }
  return {
    kind: "trip",
    damage: FLEET_SLIDE.damage,
    poise: FLEET_SLIDE.poiseDamage,
    unparryable: true,
  };
}

/** Payload flags for hosts building AttackPayload for a slide trip. */
export function slideAttackPayload(): {
  force: number;
  damage: number;
  poiseDamage: number;
  unparryable: true;
} {
  return {
    force: FLEET_SLIDE.force,
    damage: FLEET_SLIDE.damage,
    poiseDamage: FLEET_SLIDE.poiseDamage,
    unparryable: true,
  };
}

// ---------------------------------------------------------------------------
// Parry side → clip list
// ---------------------------------------------------------------------------

export type ParrySide = "left" | "right" | "front";

export function parryClipsForSide(side: ParrySide): readonly string[] {
  return FLEET_PARRY.animBySide[side] ?? FLEET_PARRY.animBySide.front;
}

/**
 * Failed-parry stamina: drain debt now, restore evenly over failStamRecoverSec.
 * Returns { debt, recoverSec, ratePerSec }.
 */
export function planFailedParryStamina(): {
  debt: number;
  recoverSec: number;
  ratePerSec: number;
} {
  const debt = FLEET_PARRY.failStamDebt;
  const recoverSec = FLEET_PARRY.failStamRecoverSec;
  return { debt, recoverSec, ratePerSec: debt / Math.max(0.05, recoverSec) };
}

// ---------------------------------------------------------------------------
// Slash / Getsuga variant from combo stage
// ---------------------------------------------------------------------------

export function slashVariantForStage(
  stage: number,
  opts?: { finisher?: boolean; kind?: string },
): FleetSlashVariantId {
  if (opts?.finisher || opts?.kind === "finisher") return "slashyellow";
  if (opts?.kind === "heavy" || stage >= 2) return "slashred";
  if (stage <= 0) return "slashblue";
  return "slashpurple";
}

// ---------------------------------------------------------------------------
// Physical stamina gate
// ---------------------------------------------------------------------------

export function canAffordPhysical(
  currentStamina: number,
  cost: number,
  minFrac = 0.35,
): boolean {
  return currentStamina >= Math.max(1, cost * minFrac);
}

export { FLEET_STAMINA_COST };

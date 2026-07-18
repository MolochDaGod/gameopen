/**
 * Dodge / parry / block directional resolution.
 * Windows + cones from worldMath (ASOD lattice timing + 90° angle peaks).
 */

import {
  ANGLE,
  IMPACT,
  TIMING,
  angleBetween,
  clamp,
  degToRad,
  radToDeg,
} from "./worldMath";
import {
  attackRelativeYaw,
  type Vec2,
  dodgeLateralDir,
  lookYaw,
} from "./combatGeometry";

export type DefenseKind = "none" | "block" | "parry" | "perfectParry" | "dodge" | "dodgePunish";

export type DefenseInput = {
  /** Defender world yaw (facing). */
  defenderYaw: number;
  defenderPos: Vec2;
  attackerPos: Vec2;
  /**
   * Seconds since defense key pressed (0 at press).
   * For sustained block, pass age of block hold start.
   */
  defenseAge: number;
  /** Which defense is active. */
  mode: "block" | "parry" | "dodge" | "none";
  /** Attack force tier 1..3 (for chip / overwhelm). */
  attackForce?: 1 | 2 | 3;
  /** True if defender is in i-frame (dodge mid-window). */
  invulnerable?: boolean;
};

export type DefenseResult = {
  kind: DefenseKind;
  /** Damage multiplier applied to the hit (0 = full negate). */
  damageMul: number;
  /** Poise damage returned to attacker (parry). */
  poiseReturn: number;
  /** Stun seconds on attacker if any. */
  attackerStun: number;
  /** Suggested knockback scale on defender (0 if negated). */
  knockbackMul: number;
  /** Relative attack angle deg (0 = front). */
  relativeDeg: number;
  /** True if direction was wrong (hit through). */
  wrongDirection: boolean;
  /** Human-readable flash. */
  label: string;
};

function relativeDeg(inp: DefenseInput): number {
  return radToDeg(
    attackRelativeYaw(inp.defenderYaw, inp.attackerPos, inp.defenderPos),
  );
}

function inCone(relRad: number, halfDeg: number): boolean {
  return relRad <= degToRad(halfDeg);
}

/**
 * Resolve defensive outcome for one incoming attack.
 * Pure function — host maps to animations / VFX / damage apply.
 */
export function resolveDefense(inp: DefenseInput): DefenseResult {
  const rel = attackRelativeYaw(
    inp.defenderYaw,
    inp.attackerPos,
    inp.defenderPos,
  );
  const relD = radToDeg(rel);
  const force = inp.attackForce ?? 1;

  // Invuln dodge mid-window
  if (inp.mode === "dodge" || inp.invulnerable) {
    const t = inp.defenseAge;
    const inIframe =
      inp.invulnerable ||
      (t >= TIMING.dodgeIframeStart && t <= TIMING.dodgeIframeEnd);
    // Side dodge preferred: attack more from front-side than pure back
    const sideOk =
      relD >= ANGLE.dodgeSideMinDeg * 0.35 ||
      relD <= 180 - ANGLE.dodgeSideMinDeg * 0.35;

    if (inIframe && sideOk) {
      // Early press = punish window on attacker (they whiff)
      if (t <= TIMING.parryPerfect) {
        return {
          kind: "dodgePunish",
          damageMul: 0,
          poiseReturn: 0.35 * force,
          attackerStun: 0.25,
          knockbackMul: 0,
          relativeDeg: relD,
          wrongDirection: false,
          label: "DODGE PUNISH",
        };
      }
      return {
        kind: "dodge",
        damageMul: 0,
        poiseReturn: 0,
        attackerStun: 0,
        knockbackMul: 0,
        relativeDeg: relD,
        wrongDirection: false,
        label: "DODGE",
      };
    }
    // Late dodge or wrong timing → hit
    return {
      kind: "none",
      damageMul: 1,
      poiseReturn: 0,
      attackerStun: 0,
      knockbackMul: 1,
      relativeDeg: relD,
      wrongDirection: !sideOk,
      label: "HIT",
    };
  }

  if (inp.mode === "parry") {
    const age = inp.defenseAge;
    const faceOk = inCone(rel, ANGLE.parryHalfDeg);
    const perfectFace = inCone(rel, ANGLE.perfectParryHalfDeg);
    if (!faceOk) {
      return {
        kind: "none",
        damageMul: 1,
        poiseReturn: 0,
        attackerStun: 0,
        knockbackMul: 1,
        relativeDeg: relD,
        wrongDirection: true,
        label: "HIT · bad angle",
      };
    }
    if (age <= TIMING.parryPerfect && perfectFace) {
      return {
        kind: "perfectParry",
        damageMul: 0,
        poiseReturn: IMPACT.parryPoiseReturn * force,
        attackerStun: TIMING.parryWindow * 1.2,
        knockbackMul: 0,
        relativeDeg: relD,
        wrongDirection: false,
        label: "PERFECT PARRY",
      };
    }
    if (age <= TIMING.parryWindow) {
      return {
        kind: "parry",
        damageMul: 0,
        poiseReturn: 0.75 * force,
        attackerStun: TIMING.parryWindow * 0.7,
        knockbackMul: 0,
        relativeDeg: relD,
        wrongDirection: false,
        label: "PARRY",
      };
    }
    // Late parry falls to block-ish chip
    return {
      kind: "block",
      damageMul: IMPACT.blockChip * 0.5,
      poiseReturn: 0,
      attackerStun: 0,
      knockbackMul: 0.35,
      relativeDeg: relD,
      wrongDirection: false,
      label: "LATE PARRY · chip",
    };
  }

  if (inp.mode === "block") {
    const faceOk = inCone(rel, ANGLE.blockHalfDeg);
    if (!faceOk) {
      return {
        kind: "none",
        damageMul: 1,
        poiseReturn: 0,
        attackerStun: 0,
        knockbackMul: 1,
        relativeDeg: relD,
        wrongDirection: true,
        label: "HIT · guard break angle",
      };
    }
    // Overwhelm: force 3 chips more
    const chip =
      force >= 3 ? IMPACT.blockChip * 1.15 : IMPACT.blockChip * (force * 0.55);
    return {
      kind: "block",
      damageMul: clamp(chip, 0.05, IMPACT.blockChip),
      poiseReturn: 0,
      attackerStun: 0,
      knockbackMul: 0.25 + force * 0.08,
      relativeDeg: relD,
      wrongDirection: false,
      label: force >= 3 ? "BLOCK · heavy chip" : "BLOCK",
    };
  }

  return {
    kind: "none",
    damageMul: 1,
    poiseReturn: 0,
    attackerStun: 0,
    knockbackMul: 1,
    relativeDeg: relD,
    wrongDirection: false,
    label: "HIT",
  };
}

/**
 * Dodge impulse displacement (metres) along best lateral axis.
 */
export function dodgeImpulse(
  defenderYaw: number,
  defenderPos: Vec2,
  attackerPos: Vec2,
  distanceM = 2.2,
): Vec2 {
  const atkYaw = lookYaw(defenderPos, attackerPos);
  const lat = dodgeLateralDir(defenderYaw, atkYaw);
  return {
    x: lat.x * distanceM,
    z: lat.z * distanceM,
  };
}

/** Whether attack is within block frontal cone only (no timing). */
export function canBlockDirection(
  defenderYaw: number,
  attackerPos: Vec2,
  defenderPos: Vec2,
): boolean {
  const rel = attackRelativeYaw(defenderYaw, attackerPos, defenderPos);
  return rel <= degToRad(ANGLE.blockHalfDeg);
}

/** Export timing mirrors for hosts still on T0 names. */
export const DEFENSE_WINDOWS = {
  parryPerfect: TIMING.parryPerfect,
  parryDeflect: TIMING.parryWindow,
  dodgePunish: TIMING.parryPerfect,
  dodgeIframeStart: TIMING.dodgeIframeStart,
  dodgeIframeEnd: TIMING.dodgeIframeEnd,
  dodgeDuration: TIMING.dodgeDuration,
  blockChipFraction: IMPACT.blockChip,
} as const;

/**
 * Heavy Crossbow — Albion-inspired shotgun / magical siege bow.
 *
 * Feel:
 *  - Short cast times; blast resolves from the **cast-start footprint** (dodgeable)
 *  - Cone "shotgun" pellets with strong knockback
 *  - Magical charged bolts + rifle-melee when enemies close
 *  - M3 uppercut knock-up → LMB follow-up bolt to airborne targets
 */
import type { WeaponId } from "./types";

export function isCrossbowWeapon(id: WeaponId): boolean {
  return id === "crossbow";
}

export const XBOW = {
  /** Primary cone half-angle (deg). */
  coneHalfDeg: 28,
  /** Cone length (m) for primary shotgun blast. */
  coneRange: 7.5,
  /** Short cast before cone resolves (s) — leave the footprint to dodge. */
  castTime: 0.28,
  /** Pellets in the primary cone. */
  pellets: 5,
  pelletDamage: 9,
  knockForceMul: 1.35,
  /** Melee bash when enemy within this planar range. */
  meleeRange: 2.4,
  meleeDamage: 20,
  /** Fire rate lock after primary (s). */
  fireLock: 0.42,
  /** Magical charged bolt (F / power). */
  chargeTime: 0.55,
  chargeDamage: 32,
  chargeColor: 0xb070ff,
  boltColor: 0xffc070,
  coneColor: 0xff9a40,
  /** Skill 2 explosive cone */
  explosiveRange: 8.5,
  explosiveHalfDeg: 32,
  explosiveDamage: 18,
  explosiveCast: 0.38,
  /** Skill 4 sweeping bolt */
  sweepRange: 11,
  sweepHalfDeg: 40,
  sweepDamage: 14,
  sweepCast: 0.45,
  /** Skill 3 trap placement */
  trapRange: 10,
  trapRadius: 2.4,
  trapDamage: 22,
  trapCast: 0.35,
  /** After M3 uppercut, LMB prioritizes airborne bolt for this long (s). */
  airFollowWindow: 1.35,
} as const;

/** Skill slot → cast placement kind (null = non-placement cone at cast origin). */
export type XbowSkillPlace = "none" | "trap" | "cone";

export function xbowSkillPlace(slot: 0 | 1 | 2 | 3): XbowSkillPlace {
  switch (slot) {
    case 2:
      return "trap"; // caltrops / ground trap
    default:
      return "none"; // cone from cast footprint
  }
}

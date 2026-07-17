/**
 * Beam cast profiles + session — charge ethereal → locked-aim beam damage line.
 *
 * Once cast starts, direction is frozen (no re-aim). Beam fires at end of cast
 * animation. Radius 0.1–1 m along a line from caster toward lock dir.
 *
 * Different weapons (staffs, 2H casters, guns) pick profiles via weapon id.
 */

import type { WeaponId } from "../types";

export type BeamPhysicsMode = "none" | "stun" | "launch" | "explode" | "ragdoll";

export type BeamCastProfile = {
  id: string;
  label: string;
  /** Seconds of charge (cast animation window). */
  castTime: number;
  /** Beam sustain duration after release. */
  beamLife: number;
  /** Max beam length (m). */
  length: number;
  /** Damage cylinder radius 0.1–1. */
  radius: number;
  /** Damage per tick while beam is active. */
  damagePerTick: number;
  /** Tick interval (s). */
  tickInterval: number;
  color: number;
  coreColor: number;
  /** Charge / ethereal palette. */
  chargeColor: number;
  physics: BeamPhysicsMode;
  /** Horizontal shove on hit (m/s scale into launch/knock). */
  knockback: number;
  /** Vertical launch impulse (0 = none). */
  knockUp: number;
  /** Prefer these cast clips in order. */
  castAnims: string[];
  /** Prefer these release / beam clips. */
  releaseAnims: string[];
};

/** Staff elemental / default beam kits. */
export const BEAM_PROFILES: Record<string, BeamCastProfile> = {
  staff_default: {
    id: "staff_default",
    label: "Arcane Beam",
    castTime: 0.55,
    beamLife: 0.85,
    length: 18,
    radius: 0.45,
    damagePerTick: 14,
    tickInterval: 0.08,
    color: 0x9fd8ff,
    coreColor: 0xffffff,
    chargeColor: 0xb0d8ff,
    physics: "stun",
    knockback: 2.2,
    knockUp: 1.2,
    castAnims: ["cast", "magicAttack", "chargedShot", "castSpell"],
    releaseAnims: ["magicArea", "castSpell2", "attack"],
  },
  staff_fire: {
    id: "staff_fire",
    label: "Solar Beam",
    castTime: 0.6,
    beamLife: 0.9,
    length: 16,
    radius: 0.55,
    damagePerTick: 18,
    tickInterval: 0.07,
    color: 0xff7a2a,
    coreColor: 0xfff0c0,
    chargeColor: 0xffaa40,
    physics: "explode",
    knockback: 3.5,
    knockUp: 3.8,
    castAnims: ["cast", "magicAttack", "castSpell"],
    releaseAnims: ["magicArea", "castSpell2"],
  },
  staff_ice: {
    id: "staff_ice",
    label: "Glacier Beam",
    castTime: 0.65,
    beamLife: 1.0,
    length: 17,
    radius: 0.5,
    damagePerTick: 12,
    tickInterval: 0.09,
    color: 0x88d0ff,
    coreColor: 0xe8f8ff,
    chargeColor: 0xa0e0ff,
    physics: "stun",
    knockback: 1.6,
    knockUp: 0.4,
    castAnims: ["cast", "magicAttack"],
    releaseAnims: ["magicArea", "cast"],
  },
  staff_nature: {
    id: "staff_nature",
    label: "Leyline Beam",
    castTime: 0.5,
    beamLife: 0.8,
    length: 15,
    radius: 0.4,
    damagePerTick: 13,
    tickInterval: 0.08,
    color: 0x6ee7a0,
    coreColor: 0xd0ffd8,
    chargeColor: 0x80f0b0,
    physics: "stun",
    knockback: 2.0,
    knockUp: 1.5,
    castAnims: ["cast", "magicAttack"],
    releaseAnims: ["magicArea"],
  },
  staff_storm: {
    id: "staff_storm",
    label: "Storm Beam",
    castTime: 0.48,
    beamLife: 0.75,
    length: 20,
    radius: 0.35,
    damagePerTick: 16,
    tickInterval: 0.06,
    color: 0x70b0ff,
    coreColor: 0xffffff,
    chargeColor: 0xa0c8ff,
    physics: "launch",
    knockback: 2.8,
    knockUp: 5.0,
    castAnims: ["cast", "chargedShot", "magicAttack"],
    releaseAnims: ["magicArea", "castSpell2"],
  },
  wand: {
    id: "wand",
    label: "Wand Beam",
    castTime: 0.4,
    beamLife: 0.55,
    length: 12,
    radius: 0.28,
    damagePerTick: 10,
    tickInterval: 0.08,
    color: 0xc4a0ff,
    coreColor: 0xf0e8ff,
    chargeColor: 0xd0b0ff,
    physics: "stun",
    knockback: 1.4,
    knockUp: 0.8,
    castAnims: ["cast", "magicAttack", "attack"],
    releaseAnims: ["cast", "attack"],
  },
  tome: {
    id: "tome",
    label: "Scripture Beam",
    castTime: 0.7,
    beamLife: 1.1,
    length: 14,
    radius: 0.6,
    damagePerTick: 11,
    tickInterval: 0.1,
    color: 0xffe08a,
    coreColor: 0xfff8e0,
    chargeColor: 0xffd060,
    physics: "ragdoll",
    knockback: 3.0,
    knockUp: 4.2,
    castAnims: ["cast", "castSpell", "magicAttack"],
    releaseAnims: ["magicArea", "castSpell2"],
  },
  gun_beam: {
    id: "gun_beam",
    label: "Plasma Beam",
    castTime: 0.5,
    beamLife: 1.2,
    length: 22,
    radius: 0.32,
    damagePerTick: 15,
    tickInterval: 0.06,
    color: 0x7fd8ff,
    coreColor: 0xffffff,
    chargeColor: 0x9fd8ff,
    physics: "launch",
    knockback: 2.5,
    knockUp: 3.2,
    castAnims: ["chargedShot", "cast", "attack"],
    releaseAnims: ["chargedShot", "attack"],
  },
  twohand_cast: {
    id: "twohand_cast",
    label: "Great Cast Beam",
    castTime: 0.75,
    beamLife: 0.7,
    length: 16,
    radius: 0.7,
    damagePerTick: 20,
    tickInterval: 0.08,
    color: 0xd0a0ff,
    coreColor: 0xffffff,
    chargeColor: 0xb080ff,
    physics: "explode",
    knockback: 4.0,
    knockUp: 5.5,
    castAnims: ["cast", "magicAttack", "chargedShot", "attack"],
    releaseAnims: ["magicArea", "attack"],
  },
};

export function clampBeamRadius(r: number): number {
  return Math.min(1, Math.max(0.1, r));
}

export function beamProfileForWeapon(weaponId: WeaponId): BeamCastProfile {
  const id = weaponId.toLowerCase();
  if (id === "staffFire" || id === "stafffire") return BEAM_PROFILES.staff_fire!;
  if (id === "staffIce" || id === "staffice") return BEAM_PROFILES.staff_ice!;
  if (id === "staffNature" || id === "staffnature") return BEAM_PROFILES.staff_nature!;
  if (id === "staffStorm" || id === "staffstorm") return BEAM_PROFILES.staff_storm!;
  if (id === "staff" || id === "staffHoly") return BEAM_PROFILES.staff_default!;
  if (id === "wand") return BEAM_PROFILES.wand!;
  if (id === "tome") return BEAM_PROFILES.tome!;
  if (id.includes("rifle") || id === "pistol" || id === "shotgun" || id.includes("gun"))
    return BEAM_PROFILES.gun_beam!;
  if (id.includes("great") || id === "scythe" || id === "hammer2h")
    return BEAM_PROFILES.twohand_cast!;
  return BEAM_PROFILES.staff_default!;
}

export type BeamCastSession = {
  profile: BeamCastProfile;
  /** World origin at cast start (hand/chest). */
  origin: { x: number; y: number; z: number };
  /** Frozen aim direction (unit XZ). */
  dir: { x: number; y: number; z: number };
  /** Elapsed since cast started. */
  elapsed: number;
  phase: "charge" | "beam" | "done";
  /** Damage tick accumulator in beam phase. */
  tickAcc: number;
  /** Token to cancel if weapon swaps. */
  token: number;
};

export function createBeamSession(
  profile: BeamCastProfile,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  token: number,
): BeamCastSession {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  return {
    profile: {
      ...profile,
      radius: clampBeamRadius(profile.radius),
    },
    origin: { ...origin },
    dir: { x: dir.x / len, y: dir.y / len, z: dir.z / len },
    elapsed: 0,
    phase: "charge",
    tickAcc: 0,
    token,
  };
}

/**
 * Perpendicular distance from point P to infinite line origin+t*dir,
 * plus the clamped projection along the segment [0, length].
 * Returns null if the closest point on the infinite line is outside [0, length]
 * (with a small end-cap allowance).
 */
export function pointOnBeamSegment(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  length: number,
  point: { x: number; y: number; z: number },
  radius: number,
): { dist: number; proj: number; closest: { x: number; y: number; z: number } } | null {
  const vx = point.x - origin.x;
  const vy = point.y - origin.y;
  const vz = point.z - origin.z;
  const proj = vx * dir.x + vy * dir.y + vz * dir.z;
  if (proj < -radius * 0.25 || proj > length + radius * 0.25) return null;
  const cx = origin.x + dir.x * proj;
  const cy = origin.y + dir.y * proj;
  const cz = origin.z + dir.z * proj;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const dz = point.z - cz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > radius) return null;
  return { dist, proj, closest: { x: cx, y: cy, z: cz } };
}

/** Advance session; returns phase transitions for VFX/damage hooks. */
export function advanceBeamSession(
  session: BeamCastSession,
  dt: number,
): { enteredBeam: boolean; shouldTick: boolean; done: boolean } {
  if (session.phase === "done") {
    return { enteredBeam: false, shouldTick: false, done: true };
  }
  session.elapsed += dt;
  let enteredBeam = false;
  if (session.phase === "charge" && session.elapsed >= session.profile.castTime) {
    session.phase = "beam";
    session.tickAcc = 0;
    enteredBeam = true;
  }
  let shouldTick = false;
  if (session.phase === "beam") {
    const beamAge = session.elapsed - session.profile.castTime;
    if (beamAge >= session.profile.beamLife) {
      session.phase = "done";
      return { enteredBeam, shouldTick: false, done: true };
    }
    session.tickAcc += dt;
    if (session.tickAcc >= session.profile.tickInterval) {
      session.tickAcc = 0;
      shouldTick = true;
    }
  }
  return { enteredBeam, shouldTick, done: false };
}

/** Map physics mode → launch upVel (clean launch ≥ 8 forces fallen on land). */
export function beamLaunchUpVel(profile: BeamCastProfile): number {
  switch (profile.physics) {
    case "explode":
      return Math.max(8.5, profile.knockUp + 4);
    case "ragdoll":
      return Math.max(9.0, profile.knockUp + 5);
    case "launch":
      return Math.max(6.5, profile.knockUp);
    case "stun":
      return Math.max(0, profile.knockUp * 0.5);
    default:
      return profile.knockUp;
  }
}

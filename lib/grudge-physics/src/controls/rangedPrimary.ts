/**
 * Ranged primary fire SSOT — projectile release timing lined up with attack
 * animation intensity + tick feel.
 *
 * Design:
 *  - Play shoot / draw / cast clip first
 *  - Wait `releaseLead` (fraction of clip or absolute seconds) at the peak
 *    intensity beat of the anim, then spawn the projectile
 *  - Projectile speed/range/damage scale with weapon combat intensity
 *  - Fire-rate lock rides clip length so spam never clips the pose
 *
 * Used by Studio.doRangedPrimaryShot / doStaffBolt / (reference for guns).
 */

/**
 * Fleet SSOT in @workspace/grudge-physics — no animator / getWeapon imports.
 * Hosts pass combat intensity explicitly via {@link applyIntensity}.
 */

export type RangedProjectileKind = "arrow" | "bullet" | "bolt" | "spell";

/** Loose weapon id string (matches Open WeaponId). */
export type RangedWeaponId = string;

export interface RangedPrimaryTune {
  kind: RangedProjectileKind;
  /** Preferred clip names in order (first available wins). */
  clips: readonly string[];
  /**
   * Seconds after anim start when the projectile leaves the hand/muzzle.
   * Tuned to typical bow draw-release, gun muzzle flash, staff cast peak.
   */
  releaseLead: number;
  /** Fallback fire-rate lock if clip length unknown (s). */
  fireLock: number;
  /** Fraction of clip duration that remains locked after release (playthrough). */
  playthrough: number;
  /** Base projectile speed (m/s) before intensity scale. */
  speed: number;
  /** Max travel (m) without a soft-lock target. */
  range: number;
  /** Base damage before intensity scale. */
  damage: number;
  /** Tracer / core color. */
  color: number;
  /** Recoil kick pitch/yaw magnitudes. */
  recoil: { pitch: number; yaw: number };
  /** Projectile visual scale (arrow longer, bullet snappier). */
  scale: number;
  /** Use elongated bolt trail vs charged energy slug. */
  visual: "arrow" | "slug" | "spell";
  /** Muzzle flash intensity scale. */
  muzzleScale: number;
}

const BOW: RangedPrimaryTune = {
  kind: "arrow",
  clips: ["shooting-arrow", "attack1", "chargedShot", "attack"],
  // Draw → release sits near mid of shooting-arrow (~0.22–0.28s on most packs)
  releaseLead: 0.24,
  fireLock: 0.48,
  playthrough: 0.72,
  speed: 42,
  range: 30,
  damage: 16,
  color: 0xffe2a0,
  recoil: { pitch: 0.014, yaw: 0.008 },
  scale: 1.05,
  visual: "arrow",
  muzzleScale: 0.85,
};

const CROSSBOW: RangedPrimaryTune = {
  kind: "bolt",
  clips: ["chargedShot", "attack1", "attack"],
  releaseLead: 0.16,
  fireLock: 0.42,
  playthrough: 0.65,
  speed: 48,
  range: 28,
  damage: 18,
  color: 0xffc070,
  recoil: { pitch: 0.022, yaw: 0.014 },
  scale: 1.1,
  visual: "slug",
  muzzleScale: 1.0,
};

const PISTOL: RangedPrimaryTune = {
  kind: "bullet",
  clips: ["chargedShot", "attack1", "attack"],
  releaseLead: 0.06,
  fireLock: 0.2,
  playthrough: 0.55,
  speed: 58,
  range: 26,
  damage: 11,
  color: 0xfff2a8,
  recoil: { pitch: 0.026, yaw: 0.018 },
  scale: 0.95,
  visual: "slug",
  muzzleScale: 1.15,
};

const RIFLE: RangedPrimaryTune = {
  kind: "bullet",
  clips: ["chargedShot", "attack1", "attack"],
  releaseLead: 0.07,
  fireLock: 0.22,
  playthrough: 0.5,
  speed: 62,
  range: 32,
  damage: 10,
  color: 0xffe8b0,
  recoil: { pitch: 0.02, yaw: 0.012 },
  scale: 0.9,
  visual: "slug",
  muzzleScale: 1.05,
};

const SNIPER: RangedPrimaryTune = {
  kind: "bullet",
  clips: ["chargedShot", "attack1", "attack"],
  releaseLead: 0.11,
  fireLock: 0.55,
  playthrough: 0.7,
  speed: 78,
  range: 40,
  damage: 28,
  color: 0xffd080,
  recoil: { pitch: 0.038, yaw: 0.01 },
  scale: 1.2,
  visual: "slug",
  muzzleScale: 1.35,
};

const SHOTGUN: RangedPrimaryTune = {
  kind: "bullet",
  clips: ["chargedShot", "attack1", "attack"],
  releaseLead: 0.09,
  fireLock: 0.55,
  playthrough: 0.68,
  speed: 36,
  range: 12,
  damage: 8,
  color: 0xffb070,
  recoil: { pitch: 0.045, yaw: 0.03 },
  scale: 1.0,
  visual: "slug",
  muzzleScale: 1.4,
};

const STAFF: RangedPrimaryTune = {
  kind: "spell",
  clips: ["magicAttack", "cast", "attack1", "attack"],
  // Cast peak before bolt leaves the staff head
  releaseLead: 0.18,
  fireLock: 0.38,
  playthrough: 0.7,
  speed: 28,
  range: 22,
  damage: 15,
  color: 0xb98cff,
  recoil: { pitch: 0.01, yaw: 0.006 },
  scale: 1.15,
  visual: "spell",
  muzzleScale: 1.0,
};

const BY_ID: Record<string, RangedPrimaryTune> = {
  bow: BOW,
  crossbow: CROSSBOW,
  pistol: PISTOL,
  rifle: RIFLE,
  "hunter-rifle": SNIPER,
  shotgun: SHOTGUN,
  staff: STAFF,
  staffFire: { ...STAFF, color: 0xff7040 },
  staffIce: { ...STAFF, color: 0x70d0ff },
  staffStorm: { ...STAFF, color: 0xa0b0ff },
  staffNature: { ...STAFF, color: 0x70e090 },
  staffHoly: { ...STAFF, color: 0xffe8a0 },
  wand: { ...STAFF, releaseLead: 0.12, fireLock: 0.3, speed: 32 },
  tome: { ...STAFF, releaseLead: 0.2, fireLock: 0.42 },
};

export function rangedPrimaryTune(weaponId: RangedWeaponId): RangedPrimaryTune {
  if (BY_ID[weaponId]) return { ...BY_ID[weaponId]! };
  if (/bow/i.test(weaponId)) return { ...BOW };
  if (/staff|wand|tome|magic/i.test(weaponId)) return { ...STAFF };
  if (/sniper|hunter/i.test(weaponId)) return { ...SNIPER };
  if (/shotgun/i.test(weaponId)) return { ...SHOTGUN };
  if (/pistol/i.test(weaponId)) return { ...PISTOL };
  if (/rifle|gun|crossbow/i.test(weaponId)) return { ...RIFLE };
  return { ...RIFLE };
}

/**
 * Scale speed/damage/range from weapon combat intensity (1–100).
 * Intensity mid (50) ≈ 1.0 multiplier. Hosts pass intensity from their combat table.
 */
export function applyIntensity(
  tune: RangedPrimaryTune,
  intensity = 50,
): RangedPrimaryTune {
  const n = Math.min(1, Math.max(0.01, (Number.isFinite(intensity) ? intensity : 50) / 100));
  const dmgMul = 0.75 + n * 0.55;
  const spdMul = 0.88 + n * 0.28;
  const rangeMul = 0.9 + n * 0.25;
  return {
    ...tune,
    damage: Math.round(tune.damage * dmgMul * 10) / 10,
    speed: Math.round(tune.speed * spdMul),
    range: Math.round(tune.range * rangeMul * 10) / 10,
    color: tune.color,
  };
}

/**
 * Resolve fire lock from played clip duration so the pose finishes cleanly.
 * `clipDur` from playClipOnce; falls back to tune.fireLock.
 */
export function rangedFireLock(tune: RangedPrimaryTune, clipDur: number): number {
  if (clipDur > 0.05) {
    // Stay locked through release + most of the recovery
    return Math.max(tune.fireLock * 0.85, clipDur * tune.playthrough);
  }
  return tune.fireLock;
}

/**
 * Absolute delay until projectile spawn (seconds).
 * Caps so very long clips don't feel laggy.
 */
export function rangedReleaseDelay(tune: RangedPrimaryTune, clipDur: number): number {
  if (clipDur > 0.12) {
    // Prefer fixed lead, but never past 55% of the clip (intensity peak window)
    return Math.min(tune.releaseLead, clipDur * 0.55);
  }
  return tune.releaseLead;
}

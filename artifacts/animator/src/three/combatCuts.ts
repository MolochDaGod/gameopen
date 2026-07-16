/**
 * Cut-animation presets — short, timing-based slices of longer clips.
 *
 * A "cut" trims the slow wind-up (fraction `from`→`to`), plays at `timeScale`,
 * and blends in quickly. Used for AAA-feel reactive skills (utility kick, etc.)
 * where the full authored clip is too slow to start.
 */

export interface ClipCutOpts {
  /** Start fraction of the parent clip [0..1]. */
  from?: number;
  /** End fraction of the parent clip [0..1]. */
  to?: number;
  /** Playback rate (2 = twice as fast). */
  timeScale?: number;
  /** Crossfade into the cut (seconds). Keep short for snaps. */
  fade?: number;
}

/**
 * Smash-style knockback targets (metres of horizontal travel after damp).
 * With vel damp ≈ exp(-6t), distance ≈ v0/6 → pushSpeed ≈ meters * 6.15.
 */
export const SMASH_KB = {
  /** Minimum shove on a clean unguarded hit (m). */
  minMeters: 2.0,
  /** Cap so combos don't rocket people across the map (m). */
  maxMeters: 5.2,
  /** Maps physForce*outcomeScale → metres before stack. */
  forceToMeters: 0.3,
  /** Per stacked unblocked hit (combo / multi-hit projectile). */
  stackPerHit: 0.2,
  stackCap: 4,
  /** Window to keep stacking (s). */
  stackWindow: 1.15,
  /** Horizontal speed = meters * this (matches damp τ≈1/6). */
  metersToSpeed: 6.15,
  /** Launch (rising→fallen) when shove reaches this many metres. */
  launchAtMeters: 3.35,
  /** Extra launch on 3+ hit stacks even if meters is lower. */
  launchAtStack: 2,
} as const;

/** Parry (KeyQ) — cut into the parry snap, 2×, stun window. */
export const PARRY_CUT = {
  from: 0.28,
  to: 1,
  timeScale: 2.1,
  fade: 0.035,
  /** Brief i-frames after the press so timing is readable. */
  invuln: 0.22,
  forceFieldRadius: 1.15,
  forceFieldLife: 0.28,
  /** Stun on the attacker when perfect parry lands (s). */
  stunOnSuccess: 1.4,
} as const satisfies ClipCutOpts & {
  invuln: number;
  forceFieldRadius: number;
  forceFieldLife: number;
  stunOnSuccess: number;
};

/** KeyE forcefield guard pulse — short raised block + hex shield. */
export const FORCEFIELD_CUT = {
  from: 0.2,
  to: 0.85,
  timeScale: 1.8,
  fade: 0.04,
  /** How long the CC block stay raised (s). */
  holdSec: 0.38,
  radius: 1.45,
  life: 0.55,
  cooldown: 0.85,
  color: 0x66e0ff,
} as const satisfies ClipCutOpts & {
  holdSec: number;
  radius: number;
  life: number;
  cooldown: number;
  color: number;
};

/** Space recovery from tumble/ragdoll — cut into backflip / kip-up. */
export const RECOVERY_CUT = {
  from: 0.15,
  to: 1,
  timeScale: 1.65,
  fade: 0.05,
  /** Controller.backflip duration / hop height. */
  flipDuration: 0.62,
  flipHop: 2.35,
  invuln: 0.48,
  cooldown: 1.05,
} as const satisfies ClipCutOpts & {
  flipDuration: number;
  flipHop: number;
  invuln: number;
  cooldown: number;
};

/** Longbow standing-dodge cut — snappier phase-slide (KeyX / AA DD). */
export const DODGE_CUT = {
  from: 0.12,
  to: 1,
  timeScale: 1.75,
  fade: 0.06,
} as const satisfies ClipCutOpts;

/** Utility Kick (KeyV) — cut into the strike, 2×, foot wave on impact. */
export const UTILITY_KICK_CUT = {
  /** Skip slow setup; start near the kick extension. */
  from: 0.4,
  to: 1,
  timeScale: 2,
  /** Snappy blend into the cut (not a long crossfade). */
  fade: 0.04,
  /**
   * When impact resolves as a fraction of the *played* cut wall-clock duration.
   * ~0.55–0.7 lands on the foot plant for most kick clips.
   */
  impactAt: 0.62,
  /** Motion-blur ghost count at cut-in. */
  blurCount: 5,
  blurLife: 0.22,
  /** Foot impact AoE (m). */
  aoeRadius: 2.7,
  /** Shield-break window (s) after connect. */
  shieldBreakSec: 2.2,
  /** Base knockback multiplier on skillForce. */
  pushForceMul: 1.55,
  /** Damage component of the multi-push blast. */
  blastDamage: 18,
  /** Cooldown after cast. */
  cooldown: 0.55,
} as const satisfies ClipCutOpts & {
  impactAt: number;
  blurCount: number;
  blurLife: number;
  aoeRadius: number;
  shieldBreakSec: number;
  pushForceMul: number;
  blastDamage: number;
  cooldown: number;
};

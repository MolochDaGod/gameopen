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

/**
 * Utility Kick (KeyV) + Shadow Kick smart-parry.
 *
 * Clip: `animations/extra/utility-kick` (Mixamo-style standing kick).
 * Runtime full length is whatever the loaded clip reports (typically ~1.0–1.4s);
 * all fractions below are of that full clip.
 *
 * Phases (wall-clock ≈ fraction × fullDur / timeScale):
 *
 *  1. **OPEN (parry window)** — `openFrom`→`openTo` at `openTimeScale`
 *     Body is **planted** (no dash). This is the smart-parry trigger window:
 *     if melee damage would land, we teleport behind the attacker and jump to
 *     FINISH at high speed (Shadow Kick).
 *
 *  2. **COMMIT** (no parry) — `finishFrom`→`finishTo` at `finishTimeScale`
 *     Short lunge + foot-wave impact (original V-kick offense).
 *
 *  3. **SHADOW FINISH** (parry fired) — same finish slice at `shadowTimeScale`
 *     Instant warp behind foe, no open leftover, impact ASAP.
 *
 * Example at fullDur = 1.2s:
 *  - Open:  (0.38−0)×1.2 / 1.0  = **0.46s** planted parry window
 *  - Commit finish: (1−0.40)×1.2 / 2.1 ≈ **0.34s** to impact ~0.21s in
 *  - Shadow finish: (1−0.42)×1.2 / 3.2 ≈ **0.22s** total after teleport
 */
export const UTILITY_KICK_CUT = {
  // ── Open (planted smart-parry window) ─────────────────────────────────
  /** Start of open (fraction of full clip). */
  openFrom: 0,
  /** End of open / start of kick extension (was the old skip-to `from: 0.4`). */
  openTo: 0.38,
  /** Open plays near real-time so the plant reads as a read window. */
  openTimeScale: 1.0,
  // ── Finish (strike portion) ───────────────────────────────────────────
  finishFrom: 0.4,
  finishTo: 1,
  finishTimeScale: 2.1,
  /** Shadow Kick finish after successful smart parry — faster. */
  shadowTimeScale: 3.2,
  /** Snappy blend into cuts. */
  fade: 0.04,
  /**
   * Impact as fraction of the *played finish* wall-clock duration.
   * ~0.55–0.7 lands on the foot plant for most kick clips.
   */
  impactAt: 0.58,
  /** Shadow finish hits earlier in the sped-up slice. */
  shadowImpactAt: 0.42,
  /** Motion-blur ghost count at finish / shadow cut-in. */
  blurCount: 5,
  blurLife: 0.22,
  /** Extra afterimages on shadow teleport. */
  shadowBlurCount: 8,
  shadowBlurLife: 0.32,
  /** Foot impact AoE (m). */
  aoeRadius: 2.7,
  /** Shield-break window (s) after connect. */
  shieldBreakSec: 2.2,
  /** Base knockback multiplier on skillForce. */
  pushForceMul: 1.55,
  /** Shadow Kick force / damage mul. */
  shadowForceMul: 1.85,
  shadowDamageMul: 1.35,
  /** Damage component of the multi-push blast. */
  blastDamage: 18,
  /** Metres behind attacker to land on shadow parry. */
  shadowBehindM: 1.35,
  /** Brief i-frames covering the teleport + finish start. */
  shadowInvuln: 0.55,
  /** Cooldown after cast (armed at open start). */
  cooldown: 0.85,
  // Legacy aliases used by any remaining from/to callers
  from: 0.4,
  to: 1,
  timeScale: 2.1,
} as const satisfies ClipCutOpts & {
  openFrom: number;
  openTo: number;
  openTimeScale: number;
  finishFrom: number;
  finishTo: number;
  finishTimeScale: number;
  shadowTimeScale: number;
  impactAt: number;
  shadowImpactAt: number;
  blurCount: number;
  blurLife: number;
  shadowBlurCount: number;
  shadowBlurLife: number;
  aoeRadius: number;
  shieldBreakSec: number;
  pushForceMul: number;
  shadowForceMul: number;
  shadowDamageMul: number;
  blastDamage: number;
  shadowBehindM: number;
  shadowInvuln: number;
  cooldown: number;
};

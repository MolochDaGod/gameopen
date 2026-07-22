/**
 * Cut-animation presets — short, timing-based slices of longer clips.
 *
 * Fractions + knockback align to three/math worldMath (ASOD lattice + TIMING).
 * A "cut" trims slow wind-up (from→to), plays at timeScale, blends in quickly.
 */

import { CLIP_CUT, IMPACT, RANGE, TIMING } from "./math/worldMath";

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
  minMeters: IMPACT.smashMinM,
  maxMeters: IMPACT.smashMaxM,
  forceToMeters: 0.3,
  stackPerHit: 0.2,
  stackCap: 4,
  stackWindow: TIMING.u * 3.8,
  metersToSpeed: 6.15,
  launchAtMeters: IMPACT.smashMinM * 1.675,
  launchAtStack: 2,
} as const;

/**
 * Parry (KeyC) — lattice-aligned cut + bubble + success counter.
 * Perfect timing → rebound / stun / uppercut dash; miss → full damage + slow stam.
 */
export const PARRY_CUT = {
  ...CLIP_CUT.parry,
  invuln: TIMING.parryPerfect * 1.85,
  forceFieldRadius: RANGE.parryBubble * 0.55,
  forceFieldLife: TIMING.parryWindow * 0.93,
  stunOnSuccess: TIMING.parryWindow * 4.6,
  /** Short lunge into the parried foe before the uppercut. */
  uppercutDashM: 2.35,
  uppercutDashDur: 0.12,
  /** Delay after parry snap before the uppercut lands (s). */
  uppercutDelay: 0.08,
  /** Launch up-velocity handed to Targets.launch (clean knock-up ≥ 8). */
  uppercutUpVel: 9.4,
  uppercutDamage: 26,
  uppercutRadius: 2.6,
  /** Failed parry: stamina debt recovered evenly over this many seconds. */
  failStamRecoverSec: 2.0,
  /** Extra stamina lost on a failed (late) parry, restored over failStamRecoverSec. */
  failStamDebt: 22,
} as const satisfies ClipCutOpts & {
  invuln: number;
  forceFieldRadius: number;
  forceFieldLife: number;
  stunOnSuccess: number;
  uppercutDashM: number;
  uppercutDashDur: number;
  uppercutDelay: number;
  uppercutUpVel: number;
  uppercutDamage: number;
  uppercutRadius: number;
  failStamRecoverSec: number;
  failStamDebt: number;
};

/** KeyE forcefield guard pulse. */
export const FORCEFIELD_CUT = {
  ...CLIP_CUT.block,
  holdSec: TIMING.blockWindow * 0.42,
  radius: RANGE.blockBubble * 0.55,
  life: TIMING.u * 1.83,
  cooldown: TIMING.u * 2.83,
  color: 0x66e0ff,
} as const satisfies ClipCutOpts & {
  holdSec: number;
  radius: number;
  life: number;
  cooldown: number;
  color: number;
};

/** Space recovery from tumble/ragdoll. */
export const RECOVERY_CUT = {
  ...CLIP_CUT.recovery,
  flipDuration: TIMING.u * 2.07,
  flipHop: 2.35,
  invuln: TIMING.u * 1.6,
  cooldown: TIMING.u * 3.5,
} as const satisfies ClipCutOpts & {
  flipDuration: number;
  flipHop: number;
  invuln: number;
  cooldown: number;
};

/** Dodge cut (i-frames use TIMING.dodgeIframe*). Distance scales with stamina in Studio. */
export const DODGE_CUT = {
  ...CLIP_CUT.dodge,
  duration: TIMING.dodgeDuration,
  iframeStart: TIMING.dodgeIframeStart,
  iframeEnd: TIMING.dodgeIframeEnd,
  /** Max roll travel at full stamina (+0.5 m over prior baseline). */
  distance: 2.7,
  /** Floor travel when stamina &lt; 15% of max. */
  minDistance: 0.5,
  /** Fraction of max stamina spent per dodge (uses available if lower). */
  staminaFrac: 0.4,
  /** Below this stamina ratio, distance locks to minDistance. */
  lowStaminaRatio: 0.15,
} as const satisfies ClipCutOpts & {
  duration: number;
  iframeStart: number;
  iframeEnd: number;
  distance: number;
  minDistance: number;
  staminaFrac: number;
  lowStaminaRatio: number;
};

/**
 * Combat slide (Alt) — running-slide clip + rear push. Trips on contact:
 * unparryable damage; blocked → slider stops + 0.2s stun; parry broken → knockdown.
 */
export const SLIDE_CUT = {
  from: 0.05,
  to: 0.95,
  timeScale: 1.15,
  fade: 0.06,
  /** Base slide travel (m) before rear-push boost. */
  distance: 3.4,
  /** Extra push from behind (m) for total travel feel. */
  rearPushM: 0.85,
  duration: 0.55,
  cooldown: 0.95,
  /** Stamina cost (absolute). */
  staminaCost: 22,
  hitRadius: 1.15,
  damage: 16,
  poiseDamage: 28,
  /** Stuck on raised block (slider stunned). */
  blockStunSec: 0.2,
  color: 0xc8e0ff,
} as const satisfies ClipCutOpts & {
  distance: number;
  rearPushM: number;
  duration: number;
  cooldown: number;
  staminaCost: number;
  hitRadius: number;
  damage: number;
  poiseDamage: number;
  blockStunSec: number;
  color: number;
};

/** Shared physical action stamina costs (player). */
export const STAMINA_COST = {
  uppercut: 16,
  stab: 14,
  throw: 18,
  jump: 8,
  doubleJump: 12,
  /** Block raise uses CC config; this is an extra tap tax if needed. */
  blockTap: 0,
  /** Parry uses CC config. */
  parry: 0,
  slide: 22,
} as const;

/** Longbow standing-dodge cut — snappier phase-slide (KeyX / AA DD). */
export const LONGBOW_DODGE_CUT = {
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

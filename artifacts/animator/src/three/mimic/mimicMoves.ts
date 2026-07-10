/**
 * The Mimic's authored, clip-less move kit. The vol.glb mimic rig ships ZERO
 * animation clips, so idle / walk / attack are procedural pose offsets — the
 * same approach as the Danger Room bear (`../bear/bearAttacks.ts`). This module
 * is pure + unit-tested: it only supplies pose offsets, the two-attack data, the
 * telegraph blink, and the acid-lob arc sampler. The actual strike / projectile
 * resolve through the Mimic controller + the shared combat contract.
 */

export type MimicAttackName = "melee" | "acid";

export interface MimicAttack {
  name: MimicAttackName;
  /** Playback-speed multiplier applied to the shared attack pose. */
  speed: number;
  /** Multiplier on the base melee strike damage. */
  damageMul: number;
  /** Extra reach (m) added to the melee strike. */
  reachBonus: number;
  /** Forward maneuver-motion lunge (Grudge MM units) on commit; 0 = none. */
  mmLunge: number;
  /** Telegraph / prep seconds before the strike or projectile commits. */
  prep: number;
  /** Extra readable hold (s) at the tell's peak — the melee "blink" window. */
  pausePeak: number;
  /** True = ranged acid lob; false = melee. */
  ranged: boolean;
  /** AoE radius (m) of the acid burst on landing (ranged only). */
  aoeRadius: number;
}

/**
 * The mimic's two attacks, per the encounter spec:
 *  - **melee** — fast (1.5×), lunges +30 MM forward, short 0.25 s tell + blink.
 *  - **acid** — slow (0.75×), 1 s prep, lobs an arcing acid glob that bursts in
 *    a 3 m AoE where it lands.
 */
export const MIMIC_ATTACKS: Record<MimicAttackName, MimicAttack> = {
  melee: {
    name: "melee",
    speed: 1.5,
    damageMul: 1.2,
    reachBonus: 0.4,
    mmLunge: 30,
    prep: 0.25,
    pausePeak: 0.25,
    ranged: false,
    aoeRadius: 0,
  },
  acid: {
    name: "acid",
    speed: 0.75,
    damageMul: 1.0,
    reachBonus: 0,
    mmLunge: 0,
    prep: 1.0,
    pausePeak: 0,
    ranged: true,
    aoeRadius: 3,
  },
};

/** Base duration (s) of the shared attack pose before speed scaling. */
export const MIMIC_ATTACK_BASE_DURATION = 0.9;

/** Wall-clock duration (s) of an attack's pose at its playback speed. */
export function mimicAttackDuration(name: MimicAttackName): number {
  return MIMIC_ATTACK_BASE_DURATION / MIMIC_ATTACKS[name].speed;
}

/** Pick an attack by distance: melee when in reach, else the ranged acid lob. */
export function chooseMimicAttack(distance: number, meleeRange = 2.4): MimicAttackName {
  return distance <= meleeRange ? "melee" : "acid";
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}
function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** Procedural pose offset applied to the mimic body each frame. */
export interface MimicPose {
  /** + = rear up / nose up, − = lurch / dip down (rad). */
  pitch: number;
  /** Vertical lift (m). */
  lift: number;
  /** Forward offset along facing (m). */
  lunge: number;
  /** Side-to-side sway (m) — the barrel waddle. */
  sway: number;
  /** Jaw / mouth-open amount 0..1 (drives the Mouth_* parts). */
  mouth: number;
}

/** Disguised / idle barrel: a slow settle bob, mouth shut. */
export function mimicIdlePose(elapsed: number): MimicPose {
  return { pitch: 0, lift: 0.03 * Math.sin(elapsed * 1.6), lunge: 0, sway: 0, mouth: 0 };
}

/** Waddle walk: alternating side rock + step bob + a hint of forward lean. */
export function mimicWalkPose(elapsed: number): MimicPose {
  const step = elapsed * 6.5;
  return {
    pitch: 0.05 * Math.sin(step),
    lift: 0.05 * Math.abs(Math.sin(step)),
    lunge: 0,
    sway: 0.12 * Math.sin(step * 0.5),
    mouth: 0.1 + 0.05 * Math.sin(step),
  };
}

/**
 * Shared attack pose at normalized phase 0..1 (reused at both attack speeds):
 *  - **melee**: a fast forward chomp-lunge (dip head, snap mouth shut).
 *  - **acid**: rear back + mouth wide (charge), then heave forward as it spits.
 * Every channel returns to ~0 at phase 0 and 1 so the body settles cleanly back
 * onto the idle / walk loop. Pure — driven deterministically from elapsed phase.
 */
export function mimicAttackPose(name: MimicAttackName, phase: number): MimicPose {
  const p = clamp01(phase);
  if (name === "acid") {
    const windEnd = 0.6; // long charge (reads with the 0.75× speed + prep)
    if (p < windEnd) {
      const w = smoothstep(p / windEnd);
      return { pitch: 0.45 * w, lift: 0.1 * w, lunge: -0.15 * w, sway: 0, mouth: 0.9 * w };
    }
    const s = (p - windEnd) / (1 - windEnd);
    const heave = Math.sin(s * Math.PI); // 0 → 1 → 0 (the spit)
    return {
      pitch: 0.45 * (1 - s) - 0.3 * heave,
      lift: 0.1 * (1 - s),
      lunge: -0.15 * (1 - s) + 0.35 * heave,
      sway: 0,
      mouth: Math.max(0.9 * (1 - s), 0.7 * heave),
    };
  }
  // melee: quick chomp-lunge.
  const windEnd = 0.35;
  if (p < windEnd) {
    const w = smoothstep(p / windEnd);
    return { pitch: -0.1 * w, lift: 0.05 * w, lunge: 0.2 * w, sway: 0, mouth: 0.7 * w };
  }
  const s = (p - windEnd) / (1 - windEnd);
  const chomp = Math.sin(s * Math.PI);
  return {
    pitch: -0.1 * (1 - s) - 0.15 * chomp,
    lift: 0.05 * (1 - s),
    lunge: 0.2 * (1 - s) + 0.7 * chomp,
    sway: 0,
    mouth: Math.max(0.7 * (1 - s), 0.3 * chomp),
  };
}

/**
 * Telegraph blink 0..1: `beats` sharp on/off pulses across a wind-up `duration`,
 * used to flash the mimic bright before it commits so the tell is unmistakable.
 */
export function telegraphBlink(elapsed: number, duration: number, beats = 3): number {
  if (duration <= 0) return 0;
  const t = clamp01(elapsed / duration);
  const s = Math.sin(t * beats * Math.PI * 2);
  return s > 0 ? s : 0;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Sample the acid lob's ballistic arc (a quadratic Bézier) at normalized time
 * `t` 0..1, from `from` to a FIXED `to` (the player's position captured at the
 * moment of projection — the lob does NOT home). `peak` lifts the control point
 * above the higher endpoint so it flies in a readable arc. Writes into `out` to
 * avoid per-frame allocation and returns it.
 */
export function acidArcPoint(from: Vec3, to: Vec3, peak: number, t: number, out: Vec3): Vec3 {
  const u = clamp01(t);
  const iu = 1 - u;
  const cx = (from.x + to.x) / 2;
  const cy = Math.max(from.y, to.y) + peak;
  const cz = (from.z + to.z) / 2;
  // B(u) = iu² P0 + 2·iu·u·C + u² P1
  out.x = iu * iu * from.x + 2 * iu * u * cx + u * u * to.x;
  out.y = iu * iu * from.y + 2 * iu * u * cy + u * u * to.y;
  out.z = iu * iu * from.z + 2 * iu * u * cz + u * u * to.z;
  return out;
}

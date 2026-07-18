/**
 * Uniform world math SSOT — derived from geometric analysis of
 * `another_shape_of_data.glb` (Sketchfab “Another shape of data”, mindon / CC-BY)
 * plus fleet combat conventions (MM motion-math, metre world, clip cuts).
 *
 * Lattice findings (world-space after root Y-up matrix):
 *   • Primary edge unit U ≈ 0.54768 (modes 0.55, 1.10≈2U, 1.64≈3U)
 *   • Fine grain ≈ 0.01 (matches motion-math MM scale)
 *   • Angle peaks: collinear 0°/180°, orthogonal ~90°, soft cones 70–115°
 *   • Structure is Y-dominant (vertical variance ≫ XZ)
 *
 * All combat systems (projectile, damage, impact, dodge, parry, block,
 * cut-clip timing) should import from here — not invent local constants.
 */

// ---------------------------------------------------------------------------
// Lattice (reference mesh) → combat units
// ---------------------------------------------------------------------------

/** Measured primary edge length from another_shape_of_data.glb. */
export const ASOD_LATTICE_U = 0.54768;

/** Measured fine grain (≈ Sketchfab sub-edge / MM tick). */
export const ASOD_LATTICE_FINE = 0.01;

/** Combat cell size in metres — rounded lattice unit for clean gameplay. */
export const WORLD_CELL_M = 0.55;

/** Motion-math unit: 1 MM = 1 cm. 100 MM = 1 m body displacement. */
export const MM_TO_M = 0.01;

/** Inverse: metres → MM. */
export const M_TO_MM = 100;

/** Degrees ↔ radians helpers (pure). */
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function degToRad(d: number): number {
  return d * DEG;
}
export function radToDeg(r: number): number {
  return r * RAD;
}

/** Clamp helper used across combat math. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Shortest signed angle delta in radians (−π..π). */
export function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Absolute smallest angle between two yaw headings (0..π). */
export function angleBetween(a: number, b: number): number {
  return Math.abs(angleDelta(a, b));
}

// ---------------------------------------------------------------------------
// Motion-math (MM) ↔ metres
// ---------------------------------------------------------------------------

/** Map MM (−100…+100 typical) → metres. */
export function mmToMeters(mm: number, scale = MM_TO_M): number {
  return mm * scale;
}

/** Metres → MM. */
export function metersToMm(m: number, scale = MM_TO_M): number {
  return m / scale;
}

/** Lattice multiples → metres (1U, 2U, 3U structure from ASOD). */
export function latticeMeters(units: number): number {
  return units * WORLD_CELL_M;
}

// ---------------------------------------------------------------------------
// Timing lattice (1 : 2 : 3 from edge modes U : 2U : 3U)
// ---------------------------------------------------------------------------

/**
 * Active-frame quantum — maps to lattice U.
 * Attack phases use integer multiples (matches T0 ref ≈ windup 0.8 / active 0.3 / recovery 0.6).
 */
export const TIME_U = 0.3;

export const TIMING = {
  /** One lattice time unit (active hit window base). */
  u: TIME_U,
  /** Windup = 3U (telegraph). */
  windup: TIME_U * 3,
  /** Active = 1U (hurt frames). */
  active: TIME_U * 1,
  /** Recovery = 2U. */
  recovery: TIME_U * 2,
  /** Full attack ≈ 6U. */
  attackTotal: TIME_U * 6,
  /** Parry window = 1U (narrow). */
  parryWindow: TIME_U * 1,
  /** Perfect parry = 0.4U. */
  parryPerfect: TIME_U * 0.4,
  /** Block hold = 3U. */
  blockWindow: TIME_U * 3,
  /** Dodge total = ~1.83U (0.55s). */
  dodgeDuration: TIME_U * 1.833,
  /** Dodge i-frames start / end (fractions of dodge). */
  dodgeIframeStart: 0.04,
  dodgeIframeEnd: 0.42,
  /** Projectile lifetime base. */
  projectileLife: TIME_U * 4,
} as const;

// ---------------------------------------------------------------------------
// Directional cones (degrees) — from ASOD angle histogram (90° / soft 70–115°)
// ---------------------------------------------------------------------------

export const ANGLE = {
  /** Full frontal block cone (half-angle from facing). 90° total width. */
  blockHalfDeg: 45,
  /** Parry / deflect — tighter face-on. */
  parryHalfDeg: 28,
  /** Perfect parry — very tight. */
  perfectParryHalfDeg: 18,
  /** Dodge side window: lateral relative to attack (not front). */
  dodgeSideMinDeg: 55,
  dodgeSideMaxDeg: 125,
  /** Melee strike facing cone (attacker must face target). */
  strikeHalfDeg: 55,
  /** Projectile homing max turn per second (deg). */
  projectileTurnRateDeg: 120,
  /** Impact “sweet spot” angle for crit (head-on). */
  critHalfDeg: 22,
  /** Orthogonal grid snap (ASOD 90° peak). */
  gridSnapDeg: 90,
} as const;

// ---------------------------------------------------------------------------
// Ranges (metres) — lattice multiples
// ---------------------------------------------------------------------------

export const RANGE = {
  /** Melee light reach ≈ 2U. */
  meleeLight: latticeMeters(2),
  /** Melee heavy / spear ≈ 3U. */
  meleeHeavy: latticeMeters(3),
  /** Gap-close dash distance for +100 MM skills. */
  dashMax: mmToMeters(100),
  /** Keep-distance for −100 MM. */
  kitingPull: mmToMeters(100),
  /** Default projectile range. */
  projectile: latticeMeters(12),
  /** AoE impact radius light / heavy. */
  aoeLight: latticeMeters(1),
  aoeHeavy: latticeMeters(2),
  /** Forcefield / parry bubble. */
  parryBubble: latticeMeters(2),
  blockBubble: latticeMeters(2.5),
} as const;

// ---------------------------------------------------------------------------
// Damage / impact
// ---------------------------------------------------------------------------

export const IMPACT = {
  /** Falloff: full damage inside this fraction of max range. */
  fullDamageRangeFrac: 0.55,
  /** Min damage multiplier at max range. */
  minRangeMul: 0.35,
  /** Facing mul when attacker is behind target (backstab). */
  backstabMul: 1.35,
  /** Facing mul when blocked frontally (before chip). */
  frontalBlockMul: 0.15,
  /** Chip through overwhelmed block. */
  blockChip: 0.4,
  /** Perfect parry returns this fraction as poise break on attacker. */
  parryPoiseReturn: 1.1,
  /** Base knockback m/s per force tier. */
  knockbackPerTier: 2.8,
  /** Smash knockback metres (from combatCuts SMASH_KB alignment). */
  smashMinM: 2.0,
  smashMaxM: 5.2,
  /** Impact stun seconds per force tier. */
  stunPerTier: 0.18,
} as const;

// ---------------------------------------------------------------------------
// Clip cut fractions — lattice-aligned windup trims
// ---------------------------------------------------------------------------

/**
 * Cut clip fractions: skip early windup so reactive skills snap.
 * `from` ≈ recovery lattice (2/6 of clip) → mid windup.
 */
export const CLIP_CUT = {
  parry: { from: 0.28, to: 1, timeScale: 2.1, fade: 0.035 },
  block: { from: 0.2, to: 0.85, timeScale: 1.8, fade: 0.04 },
  dodge: { from: 0.12, to: 0.9, timeScale: 1.55, fade: 0.04 },
  recovery: { from: 0.15, to: 1, timeScale: 1.65, fade: 0.05 },
  lightAttack: { from: 0.18, to: 0.72, timeScale: 1.35, fade: 0.05 },
  heavyAttack: { from: 0.1, to: 0.85, timeScale: 1.1, fade: 0.06 },
} as const;

// ---------------------------------------------------------------------------
// World system identity (for debug / telemetry)
// ---------------------------------------------------------------------------

export const WORLD_MATH_META = {
  id: "grudge.world-math.v1",
  sourceGlb: "another_shape_of_data.glb",
  sourcePath: "C:/Users/nugye/Documents/another_shape_of_data.glb",
  sketchfab:
    "https://sketchfab.com/3d-models/another-shape-of-data-19c7499276284e7f80498e442a00f8d1",
  latticeU: ASOD_LATTICE_U,
  latticeFine: ASOD_LATTICE_FINE,
  worldCellM: WORLD_CELL_M,
  mmToM: MM_TO_M,
  notes:
    "Uniform combat world: metres + MM + lattice timing + directional cones. Do not invent parallel scales.",
} as const;

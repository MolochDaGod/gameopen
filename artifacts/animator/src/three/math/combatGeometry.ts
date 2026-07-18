/**
 * Directional combat geometry — facing cones, attack arcs, world yaw.
 * Built on worldMath (ASOD lattice + orthogonal angle peaks).
 */

import {
  ANGLE,
  RANGE,
  angleBetween,
  angleDelta,
  clamp,
  degToRad,
  latticeMeters,
  mmToMeters,
  radToDeg,
} from "./worldMath";

export type Vec2 = { x: number; z: number };

/** Yaw (rad) from XZ direction (Three.js: 0 faces +Z, increases toward +X). */
export function yawFromDir(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Unit forward from yaw. */
export function forwardFromYaw(yaw: number): Vec2 {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

/** Horizontal distance. */
export function distXZ(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** Normalize XZ (0,0 → 0,1). */
export function normXZ(dx: number, dz: number): Vec2 {
  const l = Math.hypot(dx, dz);
  if (l < 1e-8) return { x: 0, z: 1 };
  return { x: dx / l, z: dz / l };
}

/**
 * True if `targetYaw` is within ±halfAngleDeg of `facingYaw`
 * (defender facing attack origin, or attacker facing target).
 */
export function inFacingCone(
  facingYaw: number,
  targetYaw: number,
  halfAngleDeg: number,
): boolean {
  const half = degToRad(halfAngleDeg);
  return angleBetween(facingYaw, targetYaw) <= half;
}

/** Yaw from A looking toward B. */
export function lookYaw(from: Vec2, to: Vec2): number {
  return yawFromDir(to.x - from.x, to.z - from.z);
}

/**
 * Attack approach yaw relative to defender facing.
 * 0 = head-on from front, π = from behind.
 */
export function attackRelativeYaw(
  defenderYaw: number,
  attackerPos: Vec2,
  defenderPos: Vec2,
): number {
  const fromAtk = lookYaw(defenderPos, attackerPos);
  // Direction attack is coming from = fromAtk; front of defender = defenderYaw
  return angleBetween(defenderYaw, fromAtk);
}

export type ArcSpec = {
  /** Origin XZ */
  origin: Vec2;
  /** Facing yaw of attacker */
  yaw: number;
  /** Reach metres */
  reach: number;
  /** Half-angle of swing cone (deg) */
  halfAngleDeg: number;
  /** Inner dead zone (m) — too close to hit */
  inner?: number;
};

/** Point-in-melee-arc test. */
export function inMeleeArc(arc: ArcSpec, point: Vec2): boolean {
  const d = distXZ(arc.origin, point);
  const inner = arc.inner ?? 0.25;
  if (d < inner || d > arc.reach) return false;
  const to = lookYaw(arc.origin, point);
  return inFacingCone(arc.yaw, to, arc.halfAngleDeg);
}

/** Default light / heavy arcs from world ranges. */
export function lightStrikeArc(origin: Vec2, yaw: number): ArcSpec {
  return {
    origin,
    yaw,
    reach: RANGE.meleeLight,
    halfAngleDeg: ANGLE.strikeHalfDeg,
    inner: 0.2,
  };
}

export function heavyStrikeArc(origin: Vec2, yaw: number): ArcSpec {
  return {
    origin,
    yaw,
    reach: RANGE.meleeHeavy,
    halfAngleDeg: ANGLE.strikeHalfDeg * 0.85,
    inner: 0.25,
  };
}

/**
 * Snap yaw to orthogonal grid (ASOD 90° peak) for root-motion / grid dash.
 * Useful for dodge cardinal snaps.
 */
export function snapYawOrthogonal(yaw: number): number {
  const deg = radToDeg(yaw);
  const snapped = Math.round(deg / 90) * 90;
  return degToRad(snapped);
}

/**
 * Lateral dodge direction: pick left/right of facing that increases
 * separation from attack approach vector.
 */
export function dodgeLateralDir(
  defenderYaw: number,
  attackFromYaw: number,
): Vec2 {
  const fwd = forwardFromYaw(defenderYaw);
  const left = { x: -fwd.z, z: fwd.x };
  const right = { x: fwd.z, z: -fwd.x };
  // Prefer side that faces away from attack origin direction
  const atkDir = forwardFromYaw(attackFromYaw);
  const leftDot = left.x * atkDir.x + left.z * atkDir.z;
  const rightDot = right.x * atkDir.x + right.z * atkDir.z;
  // Move opposite to attack approach (negative dot preferred)
  return leftDot < rightDot ? left : right;
}

/** MM skill displacement along facing (signed: +forward −back). */
export function mmDisplacement(
  yaw: number,
  mm: number,
): { dx: number; dz: number; meters: number } {
  const meters = mmToMeters(mm);
  const f = forwardFromYaw(yaw);
  return { dx: f.x * meters, dz: f.z * meters, meters };
}

/** Smooth damp angle toward target (rad). */
export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  const d = angleDelta(current, target);
  return current + d * (1 - Math.exp(-lambda * dt));
}

/** Clamp turn rate (deg/s). */
export function turnToward(
  current: number,
  target: number,
  maxDegPerSec: number,
  dt: number,
): number {
  const max = degToRad(maxDegPerSec) * dt;
  const d = angleDelta(current, target);
  return current + clamp(d, -max, max);
}

/** Progress 0..1 along lattice cell steps. */
export function cellsToMeters(cells: number): number {
  return latticeMeters(cells);
}

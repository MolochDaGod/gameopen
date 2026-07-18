/**
 * Projectile trajectories — uniform metres / MM / lattice ranges.
 */

import {
  ANGLE,
  IMPACT,
  RANGE,
  TIMING,
  clamp,
  degToRad,
  mmToMeters,
} from "./worldMath";
import {
  distXZ,
  forwardFromYaw,
  lookYaw,
  normXZ,
  turnToward,
  type Vec2,
  yawFromDir,
} from "./combatGeometry";

export type ProjectileKind = "bolt" | "slash_wave" | "homing" | "arc" | "beam";

export type ProjectileSpec = {
  kind: ProjectileKind;
  /** Spawn position XZ (+ optional y handled by host). */
  origin: Vec2;
  /** Initial yaw. */
  yaw: number;
  /** Speed m/s. */
  speed: number;
  /** Max travel metres. */
  maxRange: number;
  /** Hit radius metres. */
  radius: number;
  /** Base damage. */
  damage: number;
  /** Force tier for impact/knockback. */
  force: 1 | 2 | 3;
  /** Homing target (optional). */
  target?: Vec2 | null;
  /** Homing turn rate deg/s. */
  turnRateDeg?: number;
  /** Gravity for arc shots (m/s²) — host applies on Y. */
  gravity?: number;
  /** MM origin (for skill-authored distance). */
  mm?: number;
};

export type ProjectileState = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  traveled: number;
  life: number;
  alive: boolean;
  /** Last frame hit candidates resolved by host. */
  hit: boolean;
};

export function createProjectile(spec: ProjectileSpec): ProjectileState & { spec: ProjectileSpec } {
  return {
    spec,
    x: spec.origin.x,
    z: spec.origin.z,
    yaw: spec.yaw,
    speed: spec.speed,
    traveled: 0,
    life: TIMING.projectileLife * (spec.kind === "beam" ? 0.5 : 1),
    alive: true,
    hit: false,
  };
}

/** Default bolt from skill MM + facing. */
export function boltFromSkill(
  origin: Vec2,
  yaw: number,
  mm = 80,
  damage = 22,
): ProjectileSpec {
  const range = Math.max(RANGE.projectile * 0.5, Math.abs(mmToMeters(mm)) * 1.2);
  return {
    kind: "bolt",
    origin,
    yaw,
    speed: 22 + Math.abs(mm) * 0.08,
    maxRange: range,
    radius: 0.35,
    damage,
    force: Math.abs(mm) >= 90 ? 3 : Math.abs(mm) >= 50 ? 2 : 1,
    mm,
  };
}

/**
 * Integrate one projectile step. Returns new state (immutable style).
 */
export function stepProjectile(
  p: ProjectileState & { spec: ProjectileSpec },
  dt: number,
): ProjectileState & { spec: ProjectileSpec } {
  if (!p.alive) return p;
  let { x, z, yaw, speed, traveled, life } = p;
  const spec = p.spec;

  // Homing
  if (spec.kind === "homing" && spec.target) {
    const want = lookYaw({ x, z }, spec.target);
    yaw = turnToward(
      yaw,
      want,
      spec.turnRateDeg ?? ANGLE.projectileTurnRateDeg,
      dt,
    );
  }

  // Arc: speed constant in XZ; gravity is host Y
  const f = forwardFromYaw(yaw);
  const step = speed * dt;
  x += f.x * step;
  z += f.z * step;
  traveled += step;
  life -= dt;

  let alive = life > 0 && traveled < spec.maxRange;
  let hit = false;

  // Homing impact proximity
  if (alive && spec.target) {
    const d = distXZ({ x, z }, spec.target);
    if (d <= spec.radius + 0.4) {
      hit = true;
      alive = false;
    }
  }

  return { spec, x, z, yaw, speed, traveled, life, alive, hit };
}

/**
 * Damage multiplier by travel fraction (range falloff from IMPACT).
 */
export function projectileDamageMul(traveled: number, maxRange: number): number {
  if (maxRange <= 1e-6) return 1;
  const t = traveled / maxRange;
  if (t <= IMPACT.fullDamageRangeFrac) return 1;
  const u =
    (t - IMPACT.fullDamageRangeFrac) / (1 - IMPACT.fullDamageRangeFrac);
  return clamp(
    1 - u * (1 - IMPACT.minRangeMul),
    IMPACT.minRangeMul,
    1,
  );
}

/** Resolved damage after falloff. */
export function projectileDamage(
  base: number,
  traveled: number,
  maxRange: number,
): number {
  return base * projectileDamageMul(traveled, maxRange);
}

/**
 * Aim yaw with optional predictive lead (target velocity XZ).
 */
export function aimYawWithLead(
  from: Vec2,
  to: Vec2,
  targetVel: Vec2,
  projectileSpeed: number,
): number {
  const d = distXZ(from, to);
  const t = projectileSpeed > 1e-3 ? d / projectileSpeed : 0;
  const lead = {
    x: to.x + targetVel.x * t,
    z: to.z + targetVel.z * t,
  };
  return lookYaw(from, lead);
}

/**
 * Slash-wave: short wide projectile (cleave residual).
 */
export function slashWaveSpec(
  origin: Vec2,
  yaw: number,
  force: 1 | 2 | 3 = 2,
): ProjectileSpec {
  return {
    kind: "slash_wave",
    origin,
    yaw,
    speed: 14 + force * 2,
    maxRange: RANGE.meleeHeavy * (1.5 + force * 0.25),
    radius: 0.55 + force * 0.1,
    damage: 14 + force * 6,
    force,
  };
}

/** Reflect projectile yaw 180° (parry return). */
export function reflectYaw(yaw: number): number {
  return yaw + Math.PI;
}

/** Spread shot yaws (deg offsets). */
export function spreadYaws(centerYaw: number, count: number, spreadDeg: number): number[] {
  if (count <= 1) return [centerYaw];
  const out: number[] = [];
  const half = degToRad(spreadDeg) / 2;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    out.push(centerYaw - half + t * half * 2);
  }
  return out;
}

// re-export geometry helpers used by hosts
export { forwardFromYaw, normXZ, yawFromDir };

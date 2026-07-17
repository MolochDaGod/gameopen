/**
 * Warlords-era physics / locomotion constants — SSOT for every Open scene host
 * (Danger Room, dungeon, voxel arena, brawler, islands, zones, instances).
 *
 * Import these instead of hardcoding gravity / capsule / tick per game.
 */

/** Fixed physics substep (Hz). Match Rapier world.timestep. */
export const PHYSICS_HZ = 60;
export const PHYSICS_DT = 1 / PHYSICS_HZ;
/** Max physics substeps per render frame (prevents spiral of death). */
export const PHYSICS_MAX_SUBSTEPS = 5;

/** Default world gravity Y (m/s²). Danger Room / arena baseline. */
export const GRAVITY_Y = -12;

/**
 * Character capsule (metres). Total height ≈ 2*radius + 2*halfHeight.
 * Matches productionRuntime.PLAYER_CAPSULE / human-scale grudge6.
 */
export const PLAYER_CAPSULE = {
  radius: 0.35,
  halfHeight: 0.55,
  /** KCC skin / offset */
  controllerOffset: 0.08,
} as const;

/** Feet → capsule centre (m). */
export function capsuleCenterOffset(
  radius = PLAYER_CAPSULE.radius,
  halfHeight = PLAYER_CAPSULE.halfHeight,
): number {
  return radius + halfHeight;
}

/** Canonical fitted character height (m). */
export const PLAYER_HEIGHT_M = 1.8;

/** Locomotion defaults (Controller). */
export const LOCOMOTION = {
  walkSpeed: 4.2,
  sprintMult: 1.55,
  jumpSpeed: 7.2,
  maxJumps: 2,
  knockbackDamp: 7,
  roomBound: 15,
  /** Wall-run / wall-jump probe reach (m) */
  wallProbe: 0.62,
} as const;

/** Ledge / mantle probe defaults (m). */
export const LEDGE = {
  /** Max forward reach for lip detect */
  forward: 0.55,
  /** Min climbable lip height above feet */
  minHeight: 0.45,
  /** Max climbable lip height above feet */
  maxHeight: 1.65,
  /** Downward cast length from chest after forward hit */
  downCast: 1.2,
} as const;

import type * as THREE from "three";

/**
 * Pluggable world-collision backend used by every Warlords scene Controller.
 * `from` is body **feet** position; `delta` is attempted displacement; result is
 * corrected feet position + grounded flag.
 */
export interface CollisionProvider {
  move(
    from: THREE.Vector3,
    delta: THREE.Vector3,
  ): { pos: THREE.Vector3; grounded: boolean };
}

/** XZ circle obstacle (pillars, NPCs) — analytic wall probe / push-out. */
export interface CircleObstacle {
  x: number;
  z: number;
  r: number;
}

/** Result of a wall proximity probe. */
export interface WallHit {
  /** Outward normal (points away from wall into free space). */
  normal: { x: number; y: number; z: number };
  /** Gap from body to wall surface (m). */
  dist: number;
}

/** Result of a ledge / mantle lip probe. */
export interface LedgeHit {
  /** World-space lip stand point (feet). */
  stand: { x: number; y: number; z: number };
  /** Height of lip above current feet (m). */
  height: number;
  /** Horizontal outward normal of the wall face. */
  normal: { x: number; y: number; z: number };
}

/** Scene host kinds for bootstrap helpers / docs. */
export type WarlordsSceneKind =
  | "danger-room"
  | "dungeon"
  | "voxel-arena"
  | "brawler"
  | "island"
  | "zone"
  | "instance"
  | "editor";

/**
 * Casting-mouse state — placement for weapon skills that need a ground aim:
 * AoE, trap, turret, wall, heal, teleport, cone footprint, etc.
 *
 * Flow:
 *  1. Skill press → {@link beginCastPlacement}
 *  2. Each frame → {@link tickCastAim} updates ground reticle from camera ray
 *  3. LMB → confirm · RMB / Esc → cancel
 *  4. Optional short cast timer then resolve callback
 *
 * Pure data + helpers; Studio owns the reticle mesh + resolve side-effects.
 */
import type * as THREE from "three";

export type CastPlacementKind =
  | "aoe"
  | "cone"
  | "trap"
  | "turret"
  | "wall"
  | "heal"
  | "teleport";

export interface CastPlacementSpec {
  kind: CastPlacementKind;
  /** Stable skill id for logging / HUD. */
  skillId: string;
  /** Hotbar slot 0–3 or -1 for F-skill. */
  slot: number;
  /** Max planar range from caster to place point (m). */
  maxRange: number;
  /** AoE / trap radius or cone length (m). */
  radius: number;
  /** Cone half-angle degrees (cone kind only). */
  coneHalfDeg?: number;
  /** Wind-up after confirm before effect resolves (s). 0 = instant on confirm. */
  castTime: number;
  /** Reticle / telegraph color. */
  color: number;
  /**
   * When true, freeze caster origin+facing at begin (Albion-style cone from
   * cast start — dodge out of the footprint). Placement aim is still shown for
   * facing preview but resolve uses frozen origin.
   */
  freezeOrigin: boolean;
}

export interface CastPlacementSession extends CastPlacementSpec {
  active: true;
  /** Frozen at begin. */
  originX: number;
  originY: number;
  originZ: number;
  faceX: number;
  faceZ: number;
  /** Live ground aim (clamped to maxRange). */
  aimX: number;
  aimZ: number;
  /** Elapsed after confirm while casting (before resolve). */
  confirmElapsed: number;
  confirmed: boolean;
}

export function beginCastPlacement(
  spec: CastPlacementSpec,
  origin: { x: number; y: number; z: number },
  face: { x: number; z: number },
): CastPlacementSession {
  const fl = Math.hypot(face.x, face.z) || 1;
  const fx = face.x / fl;
  const fz = face.z / fl;
  // Default aim a few metres ahead
  const ahead = Math.min(spec.maxRange, Math.max(2, spec.radius * 0.85));
  return {
    ...spec,
    active: true,
    originX: origin.x,
    originY: origin.y,
    originZ: origin.z,
    faceX: fx,
    faceZ: fz,
    aimX: origin.x + fx * ahead,
    aimZ: origin.z + fz * ahead,
    confirmElapsed: 0,
    confirmed: false,
  };
}

/** Project camera ray onto y=0 ground plane. */
export function groundFromRay(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
): { x: number; z: number } | null {
  if (Math.abs(direction.y) < 1e-5) return null;
  const t = -origin.y / direction.y;
  if (t < 0.05) return null;
  return {
    x: origin.x + direction.x * t,
    z: origin.z + direction.z * t,
  };
}

/** Clamp aim to maxRange from frozen origin (or live caster if not freeze). */
export function clampAim(
  session: CastPlacementSession,
  aimX: number,
  aimZ: number,
  liveOrigin?: { x: number; z: number },
): { x: number; z: number } {
  const ox = session.freezeOrigin ? session.originX : (liveOrigin?.x ?? session.originX);
  const oz = session.freezeOrigin ? session.originZ : (liveOrigin?.z ?? session.originZ);
  let dx = aimX - ox;
  let dz = aimZ - oz;
  const d = Math.hypot(dx, dz);
  if (d > session.maxRange && d > 1e-4) {
    const s = session.maxRange / d;
    dx *= s;
    dz *= s;
  }
  return { x: ox + dx, z: oz + dz };
}

/** Point-in-cone test (planar) for shotgun / sweeping bolts. */
export function inCone(
  originX: number,
  originZ: number,
  faceX: number,
  faceZ: number,
  px: number,
  pz: number,
  range: number,
  halfDeg: number,
): boolean {
  const dx = px - originX;
  const dz = pz - originZ;
  const dist = Math.hypot(dx, dz);
  if (dist > range || dist < 0.05) return false;
  const fl = Math.hypot(faceX, faceZ) || 1;
  const fx = faceX / fl;
  const fz = faceZ / fl;
  const dot = (dx * fx + dz * fz) / dist;
  const cos = Math.cos((halfDeg * Math.PI) / 180);
  return dot >= cos;
}

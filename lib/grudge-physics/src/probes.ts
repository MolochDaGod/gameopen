import { LEDGE, LOCOMOTION } from "./constants";
import type { CircleObstacle, LedgeHit, WallHit } from "./types";

/**
 * Analytic wall probe for flat arenas (Danger Room, brawler).
 * Room AABB walls + optional obstacle circles (pillars / NPCs).
 * Mesh worlds should prefer Rapier KCC + optional mesh-bvh raycasts instead.
 */
export function probeWallAnalytic(
  pos: { x: number; y: number; z: number },
  opts: {
    bound?: number;
    reach?: number;
    obstacles?: CircleObstacle[];
  } = {},
): WallHit | null {
  const reach = opts.reach ?? LOCOMOTION.wallProbe;
  const b = opts.bound ?? LOCOMOTION.roomBound;
  const candidates: WallHit[] = [];

  if (pos.x >= b - reach)
    candidates.push({ normal: { x: -1, y: 0, z: 0 }, dist: Math.max(0, b - pos.x) });
  if (pos.x <= -b + reach)
    candidates.push({ normal: { x: 1, y: 0, z: 0 }, dist: Math.max(0, pos.x + b) });
  if (pos.z >= b - reach)
    candidates.push({ normal: { x: 0, y: 0, z: -1 }, dist: Math.max(0, b - pos.z) });
  if (pos.z <= -b + reach)
    candidates.push({ normal: { x: 0, y: 0, z: 1 }, dist: Math.max(0, pos.z + b) });

  if (opts.obstacles) {
    for (const o of opts.obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-4) continue;
      const gap = d - o.r;
      if (gap < reach && gap > -0.25) {
        candidates.push({
          normal: { x: dx / d, y: 0, z: dz / d },
          dist: Math.max(0, gap),
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i]!.dist < best.dist) best = candidates[i]!;
  }
  return best;
}

/**
 * Ledge lip probe from pure height samples.
 * Hosts supply `sampleHeight(x,z)` from navmesh, raycast, or mesh-bvh.
 *
 * Casts forward from body along face yaw, then checks that the landing height
 * is a climbable step above current feet.
 */
export function probeLedge(
  feet: { x: number; y: number; z: number },
  faceYaw: number,
  sampleHeight: (x: number, z: number) => number | null,
  opts: Partial<typeof LEDGE> = {},
): LedgeHit | null {
  const forward = opts.forward ?? LEDGE.forward;
  const minH = opts.minHeight ?? LEDGE.minHeight;
  const maxH = opts.maxHeight ?? LEDGE.maxHeight;

  const fx = Math.sin(faceYaw);
  const fz = Math.cos(faceYaw);
  const lx = feet.x + fx * forward;
  const lz = feet.z + fz * forward;
  const hy = sampleHeight(lx, lz);
  if (hy == null || !Number.isFinite(hy)) return null;

  const height = hy - feet.y;
  if (height < minH || height > maxH) return null;

  // Require the cell in front to be higher than behind (lip, not slope ramp).
  const behind = sampleHeight(feet.x - fx * 0.15, feet.z - fz * 0.15);
  if (behind != null && hy - behind < minH * 0.5) return null;

  return {
    stand: { x: lx, y: hy, z: lz },
    height,
    normal: { x: -fx, y: 0, z: -fz },
  };
}

/** Push a point outside overlapping XZ circles (Danger Room living obstacles). */
export function resolveCirclePush(
  pos: { x: number; z: number },
  obstacles: CircleObstacle[],
  playerRadius = 0.35,
  bound = LOCOMOTION.roomBound,
): { x: number; z: number } {
  let x = pos.x;
  let z = pos.z;
  for (const o of obstacles) {
    const dx = x - o.x;
    const dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const minDist = o.r + playerRadius;
    if (d < minDist && d > 1e-6) {
      const s = minDist / d;
      x = o.x + dx * s;
      z = o.z + dz * s;
    } else if (d <= 1e-6) {
      x = o.x + minDist;
    }
  }
  x = Math.max(-bound, Math.min(bound, x));
  z = Math.max(-bound, Math.min(bound, z));
  return { x, z };
}

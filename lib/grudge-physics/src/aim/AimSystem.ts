/**
 * Aim combat helpers SSOT — free-aim limits, recoil, FOV kick, spread, damage zones.
 *
 * Ray construction: {@link screenCenterRay} / {@link screenAimRay} from `../aimRay`.
 * Fleet host: Danger Room Studio, Brawler, Editor play, islands.
 */
import * as THREE from "three";
import {
  screenCenterRay,
  screenAimRay,
  resolveHitZone,
  type AimHit,
  type HitZone,
} from "../aimRay";

export type { AimHit, HitZone };
export { screenCenterRay, screenAimRay, resolveHitZone };

/** Soft-lock free-aim max (NDC half-extent) — generous mouse play. */
export const AIM_SOFT_MAX = 0.48;
/** Hard FOCUS free-aim max — tight micro-adjust around centre. */
export const AIM_HARD_MAX = 0.14;
/** Non-combat / harvest free-aim max. */
export const AIM_FREE_MAX = 0.55;

/**
 * Rotate `dir` by a random offset inside a cone of half-angle `spreadRad`.
 */
export function applySpread(
  dir: THREE.Vector3,
  spreadRad: number,
  rng: () => number = Math.random,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  out.copy(dir).normalize();
  if (spreadRad <= 1e-6) return out;
  const up = Math.abs(out.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(up, out).normalize();
  const bitangent = new THREE.Vector3().crossVectors(out, tangent).normalize();
  const theta = rng() * Math.PI * 2;
  const radius = Math.tan(spreadRad) * Math.sqrt(rng());
  out
    .addScaledVector(tangent, Math.cos(theta) * radius)
    .addScaledVector(bitangent, Math.sin(theta) * radius)
    .normalize();
  return out;
}

/**
 * Damage multiplier for a hit. Headshots double damage. Close-range bonus stacks.
 */
export function damageMultiplier(
  zone: HitZone,
  distance: number,
  opts: { closeRange?: number; closeBonus?: number; headBonus?: number } = {},
): number {
  const { closeRange = 0, closeBonus = 2, headBonus = 2 } = opts;
  let mult = 1;
  if (zone === "head") mult *= headBonus;
  if (closeRange > 0 && distance <= closeRange) mult *= closeBonus;
  return mult;
}

/**
 * Cast the screen-centre ray against `targets` and return the nearest surface hit.
 */
export function raycastSceneFromCamera(
  camera: THREE.Camera,
  targets: THREE.Object3D[],
  far = 100,
  raycaster = new THREE.Raycaster(),
): AimHit | null {
  const ray = screenCenterRay(camera);
  raycaster.set(ray.origin, ray.direction);
  raycaster.far = far;
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    if (!h.face && !h.point) continue;
    const normal = h.face
      ? h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize()
      : ray.direction.clone().negate();
    return {
      point: h.point.clone(),
      normal,
      distance: h.distance,
      object: h.object,
      zone: resolveHitZone(h.object),
    };
  }
  return null;
}

/** Orient a quaternion so +Z faces along the surface normal. */
export function lookAlongNormal(normal: THREE.Vector3, out = new THREE.Quaternion()): THREE.Quaternion {
  return out.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
}

/**
 * Recoil accumulator: pitch/yaw kicks + bloom for crosshair gap.
 * API: kick(pitch, bloom, yawJitter?) — third arg randomizes yaw.
 * Convenience: kick(pitch, bloom) used by guns; yaw derived from pitch.
 */
export class Recoil {
  pitch = 0;
  yaw = 0;
  bloom = 0;

  constructor(
    private recovery = 8,
    private bloomRecovery = 5,
    private maxBloom = 0.08,
  ) {}

  /**
   * @param pitch  camera pitch kick (rad, +up)
   * @param bloom  crosshair bloom add (rad) — OR legacy second-arg yaw if using kickPitchYaw
   * @param yawJitter  random horizontal kick amplitude (default pitch*0.4)
   */
  kick(pitch: number, bloom = 0.02, yawJitter = pitch * 0.4) {
    this.pitch += pitch;
    this.yaw += (Math.random() * 2 - 1) * yawJitter;
    this.bloom = Math.min(this.maxBloom, this.bloom + bloom);
  }

  /** Explicit pitch + yaw kick (for rangedPrimary tunes that specify both). */
  kickPitchYaw(pitch: number, yaw: number, bloom = Math.abs(pitch) * 0.8) {
    this.pitch += pitch;
    this.yaw += yaw * (Math.random() < 0.5 ? -1 : 1);
    this.bloom = Math.min(this.maxBloom, this.bloom + bloom);
  }

  update(dt: number) {
    const k = Math.exp(-this.recovery * dt);
    this.pitch *= k;
    this.yaw *= k;
    this.bloom *= Math.exp(-this.bloomRecovery * dt);
    if (Math.abs(this.pitch) < 1e-5) this.pitch = 0;
    if (Math.abs(this.yaw) < 1e-5) this.yaw = 0;
    if (this.bloom < 1e-5) this.bloom = 0;
  }

  reset() {
    this.pitch = 0;
    this.yaw = 0;
    this.bloom = 0;
  }
}

/** FOV sprint-kick: ease live FOV toward sprint while sprinting. */
export function fovKick(
  current: number,
  base: number,
  sprintFov: number,
  sprinting: boolean,
  dt: number,
  rate = 8,
): number {
  const target = sprinting ? sprintFov : base;
  return current + (target - current) * Math.min(1, rate * dt);
}

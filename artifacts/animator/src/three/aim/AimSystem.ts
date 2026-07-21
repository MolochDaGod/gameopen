/**
 * @deprecated Import from `@workspace/grudge-physics` instead.
 * Thin re-export so existing relative imports keep working while the fleet
 * SSOT lives in the shared package (one Open deploy → all native modes).
 */
export {
  AIM_SOFT_MAX,
  AIM_HARD_MAX,
  AIM_FREE_MAX,
  Recoil,
  fovKick,
  applySpread,
  damageMultiplier,
  lookAlongNormal,
  screenCenterRay,
  screenAimRay,
  resolveHitZone,
  raycastSceneFromCamera as raycastScene,
  type AimHit,
  type HitZone,
} from "@workspace/grudge-physics";

import * as THREE from "three";

/**
 * Shared aim / raycast helpers for Warlords scenes.
 * Hosts pass their own mesh lists; optional mesh-bvh acceleration is applied
 * via {@link installMeshBvh} before casting.
 */

export type HitZone = "head" | "body" | "none";

export interface AimHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  object: THREE.Object3D;
  zone: HitZone;
}

/** Screen-centre aim ray (first/third-person crosshair). */
export function screenCenterRay(
  camera: THREE.Camera,
  out = new THREE.Ray(),
): THREE.Ray {
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  out.origin.copy(origin);
  out.direction.copy(dir.normalize());
  return out;
}

/**
 * Free-aim ray through NDC offset (soft lock / harvest reticle).
 * NDC: x right, y up.
 */
export function screenAimRay(
  camera: THREE.Camera,
  ndcX = 0,
  ndcY = 0,
  out = new THREE.Ray(),
): THREE.Ray {
  if (Math.abs(ndcX) < 1e-5 && Math.abs(ndcY) < 1e-5) {
    return screenCenterRay(camera, out);
  }
  const cam = camera as THREE.PerspectiveCamera;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const near = new THREE.Vector3(ndcX, ndcY, 0.5);
  near.unproject(cam);
  const dir = near.sub(origin).normalize();
  out.origin.copy(origin);
  out.direction.copy(dir);
  return out;
}

/** Resolve head/body zone from object name chain. */
export function resolveHitZone(object: THREE.Object3D): HitZone {
  let o: THREE.Object3D | null = object;
  while (o) {
    const n = (o.name || "").toLowerCase();
    if (/head|skull|helmet|face/.test(n)) return "head";
    if (/body|torso|chest|spine|hips/.test(n)) return "body";
    o = o.parent;
  }
  return "none";
}

const _raycaster = new THREE.Raycaster();

/** Cast a ray against a list of scene roots. */
export function raycastScene(
  ray: THREE.Ray,
  roots: THREE.Object3D[],
  maxDist = 100,
): AimHit | null {
  _raycaster.ray.copy(ray);
  _raycaster.far = maxDist;
  _raycaster.near = 0;
  const hits = _raycaster.intersectObjects(roots, true);
  if (!hits.length) return null;
  const h = hits[0]!;
  return {
    point: h.point.clone(),
    normal: (h.face?.normal
      ? h.face.normal.clone().transformDirection(h.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0)
    ).normalize(),
    distance: h.distance,
    object: h.object,
    zone: resolveHitZone(h.object),
  };
}

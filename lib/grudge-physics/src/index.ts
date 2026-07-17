/**
 * @workspace/grudge-physics — Warlords-era physics SSOT
 *
 * Use this package for every game scene: Danger Room, dungeons, islands,
 * zones, instances, voxel arena, brawler, editor playtest.
 *
 * Stack:
 *  - three@^0.184 (peer)
 *  - @dimforge/rapier3d-compat@^0.19.3
 *  - three-mesh-bvh (optional peer) for dense mesh raycasts
 *  - Shared KCC capsule + CollisionProvider for Controller
 */

export * from "./constants";
export * from "./types";
export {
  PhysicsWorld,
  ensureRapier,
  RAPIER,
  capsuleCenterOffset,
} from "./PhysicsWorld";
export { CharacterCapsuleKcc } from "./CharacterCapsuleKcc";
export {
  probeWallAnalytic,
  probeLedge,
  resolveCirclePush,
} from "./probes";
export {
  screenCenterRay,
  screenAimRay,
  raycastScene,
  resolveHitZone,
  type AimHit,
  type HitZone,
} from "./aimRay";
export {
  installMeshBvh,
  accelerateMesh,
  accelerateObject3D,
  isMeshBvhInstalled,
} from "./meshBvh";
export {
  closestSegmentSegment,
  capsulesOverlap,
  sweptCapsuleHit,
  type Vec3,
  type CapsuleSeg,
} from "./sweptCapsule";
export { createScenePhysics, type ScenePhysics, type ScenePhysicsOptions } from "./bootstrap";

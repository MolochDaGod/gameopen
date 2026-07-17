/**
 * Danger Room / scene host facade over the fleet SSOT
 * `@workspace/grudge-physics` ({@link PhysicsWorld}).
 *
 * Prefer importing from `@workspace/grudge-physics` in new code.
 * This file keeps existing Studio / Dungeon / Brawler imports working.
 */

export {
  PhysicsWorld as PhysicsSystem,
  PhysicsWorld,
  ensureRapier,
  RAPIER,
  CharacterCapsuleKcc,
  createScenePhysics,
  PLAYER_CAPSULE,
  GRAVITY_Y,
  PHYSICS_DT,
  PHYSICS_HZ,
  PHYSICS_MAX_SUBSTEPS,
  type CollisionProvider,
  type ScenePhysics,
} from "@workspace/grudge-physics";

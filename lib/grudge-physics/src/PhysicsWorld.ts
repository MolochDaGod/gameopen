import RAPIER from "@dimforge/rapier3d-compat";
import {
  GRAVITY_Y,
  PHYSICS_DT,
  PHYSICS_MAX_SUBSTEPS,
  PLAYER_CAPSULE,
  capsuleCenterOffset,
} from "./constants";
import { CharacterCapsuleKcc } from "./CharacterCapsuleKcc";

/**
 * Renderer-agnostic Rapier physics core — SSOT for all Warlords-era scenes.
 *
 * Rapier is pure simulation (no three.js dependency). Callers create a
 * {@link PhysicsWorld}, `await init()`, then add ground / trimeshes / player KCC.
 * Fixed-step accumulator decouples sim from variable render dt.
 */
export class PhysicsWorld {
  world: RAPIER.World | null = null;
  ready = false;

  private accum = 0;
  private readonly fixed = PHYSICS_DT;

  async init(gravityY = GRAVITY_Y): Promise<void> {
    await ensureRapier();
    this.world = new RAPIER.World({ x: 0, y: gravityY, z: 0 });
    this.world.timestep = this.fixed;
    this.ready = true;
  }

  /** Advance the simulation by `dt` seconds in fixed sub-steps. */
  step(dt: number): void {
    const world = this.world;
    if (!world) return;
    this.accum += Math.min(dt, 0.1);
    let steps = 0;
    while (this.accum >= this.fixed && steps < PHYSICS_MAX_SUBSTEPS) {
      world.step();
      this.accum -= this.fixed;
      steps++;
    }
  }

  /**
   * Static triangle-mesh collider from world-space geometry
   * (dungeon walls / island terrain / instance meshes).
   */
  addStaticTrimesh(vertices: Float32Array, indices: Uint32Array): RAPIER.Collider | null {
    const world = this.world;
    if (!world) return null;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    return world.createCollider(desc, body);
  }

  /**
   * Flat ground cuboid whose TOP face sits at `y`.
   * Danger Room / brawler / island fallback floors.
   */
  addGroundPlane(y = 0, half = 60, thickness = 0.5): RAPIER.Collider | null {
    const world = this.world;
    if (!world) return null;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, y - thickness, 0),
    );
    const desc = RAPIER.ColliderDesc.cuboid(half, thickness, half).setFriction(0.9);
    return world.createCollider(desc, body);
  }

  /**
   * Kinematic capsule rigid body + collider for a character at capsule **centre**.
   */
  makeCapsuleBody(
    center: { x: number; y: number; z: number },
    radius = PLAYER_CAPSULE.radius,
    halfHeight = PLAYER_CAPSULE.halfHeight,
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null {
    const world = this.world;
    if (!world) return null;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        center.x,
        center.y,
        center.z,
      ),
    );
    const collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius),
      body,
    );
    return { body, collider };
  }

  /** Kinematic character controller (autostep + ground snap). */
  makeCharacterController(
    offset = PLAYER_CAPSULE.controllerOffset,
  ): RAPIER.KinematicCharacterController | null {
    const world = this.world;
    if (!world) return null;
    const c = world.createCharacterController(offset);
    c.enableAutostep(0.5, 0.2, true);
    c.enableSnapToGround(0.5);
    c.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(false);
    return c;
  }

  /**
   * Create a player {@link CollisionProvider} at feet position `spawn`.
   * Use for Danger Room, brawler, island flats, and as the restore target when
   * leaving dungeon/instance trimesh modes.
   */
  createPlayerKcc(
    spawn: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    opts?: { radius?: number; halfHeight?: number; offset?: number },
  ): CharacterCapsuleKcc | null {
    if (!this.world) return null;
    return CharacterCapsuleKcc.create(this, spawn, opts);
  }

  dispose(): void {
    this.world?.free();
    this.world = null;
    this.ready = false;
  }
}

let initPromise: Promise<void> | null = null;

/** Initialise the Rapier wasm runtime exactly once across all instances. */
export function ensureRapier(): Promise<void> {
  if (!initPromise) initPromise = RAPIER.init();
  return initPromise;
}

export { RAPIER, capsuleCenterOffset };

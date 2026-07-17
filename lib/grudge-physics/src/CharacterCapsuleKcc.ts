import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { PLAYER_CAPSULE, capsuleCenterOffset } from "./constants";
import type { PhysicsWorld } from "./PhysicsWorld";
import type { CollisionProvider } from "./types";

/**
 * Shared player capsule + kinematic character controller.
 * Implements {@link CollisionProvider} for Controller.move reconciliation.
 *
 * Used by: Danger Room, Dungeon, VoxelArena, Brawler, Island, Zone instances.
 */
export class CharacterCapsuleKcc implements CollisionProvider {
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private world: RAPIER.World;
  private readonly centerOff: number;
  /** When true, each move() also steps the world (standalone hosts). */
  private readonly stepOnMove: boolean;

  private constructor(
    world: RAPIER.World,
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
    controller: RAPIER.KinematicCharacterController,
    centerOff: number,
    stepOnMove: boolean,
  ) {
    this.world = world;
    this.body = body;
    this.collider = collider;
    this.controller = controller;
    this.centerOff = centerOff;
    this.stepOnMove = stepOnMove;
  }

  static create(
    physics: PhysicsWorld,
    spawn: { x: number; y: number; z: number },
    opts?: {
      radius?: number;
      halfHeight?: number;
      offset?: number;
      /** Default true for Danger Room; dungeon may set false if host steps once. */
      stepOnMove?: boolean;
    },
  ): CharacterCapsuleKcc | null {
    const world = physics.world;
    if (!world) return null;
    const radius = opts?.radius ?? PLAYER_CAPSULE.radius;
    const halfHeight = opts?.halfHeight ?? PLAYER_CAPSULE.halfHeight;
    const centerOff = capsuleCenterOffset(radius, halfHeight);
    const center = {
      x: spawn.x,
      y: spawn.y + centerOff,
      z: spawn.z,
    };
    const cap = physics.makeCapsuleBody(center, radius, halfHeight);
    if (!cap) return null;
    const controller = physics.makeCharacterController(
      opts?.offset ?? PLAYER_CAPSULE.controllerOffset,
    );
    if (!controller) return null;
    // Build broadphase so the first query sees colliders.
    world.step();
    return new CharacterCapsuleKcc(
      world,
      cap.body,
      cap.collider,
      controller,
      centerOff,
      opts?.stepOnMove ?? true,
    );
  }

  move(
    from: THREE.Vector3,
    delta: THREE.Vector3,
  ): { pos: THREE.Vector3; grounded: boolean } {
    const center = {
      x: from.x,
      y: from.y + this.centerOff,
      z: from.z,
    };
    this.body.setTranslation(center, true);
    this.controller.computeColliderMovement(this.collider, {
      x: delta.x,
      y: delta.y,
      z: delta.z,
    });
    const mv = this.controller.computedMovement();
    const nc = {
      x: center.x + mv.x,
      y: center.y + mv.y,
      z: center.z + mv.z,
    };
    this.body.setTranslation(nc, true);
    const grounded = this.controller.computedGrounded();
    if (this.stepOnMove) this.world.step();
    // Return feet pos — allocate Vector3 via plain object then host clones.
    // Hosts pass THREE.Vector3; we construct minimal compatible shape.
    const pos = from.clone();
    pos.set(nc.x, nc.y - this.centerOff, nc.z);
    return { pos, grounded };
  }

  /** Teleport capsule to feet position (spawn / respawn). */
  teleportFeet(feet: { x: number; y: number; z: number }): void {
    this.body.setTranslation(
      { x: feet.x, y: feet.y + this.centerOff, z: feet.z },
      true,
    );
  }

  get centerOffset(): number {
    return this.centerOff;
  }
}

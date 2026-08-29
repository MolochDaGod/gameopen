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
   * Static heightfield collider — same contract as three.js
   * `RapierPhysics.addHeightfield` in physics_rapier_terrain:
   *   addHeightfield(mesh, width-1, depth-1, heightData, { x: extentsX, y: 1, z: extentsZ })
   *
   * Prefer for large islands over full trimesh (production-world TERRAIN_RULES).
   * Pair with {@link sampleHeightfieldY} / {@link heightAtFromHeightfield} for
   * Controller feet + FootGrounder (same grid as physics).
   *
   * @param nrows — depth cells = vertexDepth − 1
   * @param ncols — width cells = vertexWidth − 1
   * @param heights — (nrows+1)*(ncols+1) row-major heights
   * @param scale — world size { x: fullWidthM, y: heightScale, z: fullDepthM }
   */
  addStaticHeightfield(
    nrows: number,
    ncols: number,
    heights: Float32Array | number[],
    scale: { x: number; y: number; z: number },
    opts?: {
      translation?: { x: number; y: number; z: number };
      /** Unit quaternion { x, y, z, w }; default identity */
      rotation?: { x: number; y: number; z: number; w: number };
      friction?: number;
    },
  ): RAPIER.Collider | null {
    const world = this.world;
    if (!world) return null;
    if (nrows < 1 || ncols < 1) return null;
    const expected = (nrows + 1) * (ncols + 1);
    if (heights.length < expected) {
      console.warn(
        `[PhysicsWorld] heightfield heights length ${heights.length} < expected ${expected}`,
      );
      return null;
    }
    const heightsArr =
      heights instanceof Float32Array ? heights : Float32Array.from(heights);
    try {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed();
      const t = opts?.translation;
      if (t) bodyDesc.setTranslation(t.x, t.y, t.z);
      const r = opts?.rotation;
      if (r) bodyDesc.setRotation({ x: r.x, y: r.y, z: r.z, w: r.w });
      const body = world.createRigidBody(bodyDesc);
      // Rapier API: heightfield(nrows, ncols, heights, scale)
      let desc = RAPIER.ColliderDesc.heightfield(nrows, ncols, heightsArr, scale);
      if (!desc) return null;
      desc = desc.setFriction(opts?.friction ?? 0.9);
      return world.createCollider(desc, body);
    } catch (e) {
      console.warn("[PhysicsWorld] addStaticHeightfield failed", e);
      return null;
    }
  }

  /**
   * Convenience: heightfield from our {@link HeightfieldGrid} (vertex dims).
   * Converts width/depth vertices → Rapier nrows/ncols cells.
   */
  addHeightfieldGrid(
    grid: {
      width: number;
      depth: number;
      heights: Float32Array;
      scale: { x: number; y: number; z: number };
      origin?: { x: number; y: number; z: number };
    },
    opts?: { friction?: number },
  ): RAPIER.Collider | null {
    const nrows = Math.max(1, grid.depth - 1);
    const ncols = Math.max(1, grid.width - 1);
    return this.addStaticHeightfield(nrows, ncols, grid.heights, grid.scale, {
      translation: grid.origin ?? { x: 0, y: 0, z: 0 },
      friction: opts?.friction,
    });
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
   * Static cuboid collider (harvest props, walls, crates). Centre + half-extents (SI m).
   * Set `sensor: true` for tool-hit volumes that do not block the KCC.
   */
  addStaticCuboid(
    center: { x: number; y: number; z: number },
    halfExtents: { x: number; y: number; z: number },
    opts?: { friction?: number; sensor?: boolean },
  ): RAPIER.Collider | null {
    const world = this.world;
    if (!world) return null;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );
    let desc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.05, halfExtents.x),
      Math.max(0.05, halfExtents.y),
      Math.max(0.05, halfExtents.z),
    ).setFriction(opts?.friction ?? 0.75);
    if (opts?.sensor) desc = desc.setSensor(true);
    return world.createCollider(desc, body);
  }

  /**
   * Static sphere collider (pinata debris sensors, pickups).
   */
  addStaticSphere(
    center: { x: number; y: number; z: number },
    radius: number,
    opts?: { friction?: number; sensor?: boolean },
  ): RAPIER.Collider | null {
    const world = this.world;
    if (!world) return null;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );
    let desc = RAPIER.ColliderDesc.ball(Math.max(0.04, radius)).setFriction(
      opts?.friction ?? 0.4,
    );
    if (opts?.sensor !== false) desc = desc.setSensor(true);
    return world.createCollider(desc, body);
  }

  /**
   * Static convex hull from world-space points (x,y,z interleaved Float32Array).
   * Prefer for harvest props (trees/rocks) — cheaper than full trimesh, better than box.
   * Falls back to null if hull fails (degenerate geometry).
   */
  addStaticConvexHull(
    points: Float32Array,
    opts?: { friction?: number; sensor?: boolean },
  ): RAPIER.Collider | null {
    const world = this.world;
    if (!world || points.length < 9) return null;
    try {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      let desc = RAPIER.ColliderDesc.convexHull(points);
      if (!desc) return null;
      desc = desc.setFriction(opts?.friction ?? 0.7);
      if (opts?.sensor) desc = desc.setSensor(true);
      return world.createCollider(desc, body);
    } catch {
      return null;
    }
  }

  /** Remove a collider + its parent rigid body (if sole collider). */
  removeCollider(collider: RAPIER.Collider | null | undefined): void {
    const world = this.world;
    if (!world || !collider) return;
    try {
      const body = collider.parent();
      world.removeCollider(collider, true);
      if (body && body.numColliders() === 0) {
        world.removeRigidBody(body);
      }
    } catch {
      /* already freed */
    }
  }

  /**
   * Kinematic capsule rigid body + collider for a character at capsule **centre**.
   */
  makeCapsuleBody(
    center: { x: number; y: number; z: number },
    radius: number = PLAYER_CAPSULE.radius,
    halfHeight: number = PLAYER_CAPSULE.halfHeight,
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
    opts?: {
      radius?: number;
      halfHeight?: number;
      offset?: number;
      stepOnMove?: boolean;
    },
  ): CharacterCapsuleKcc | null {
    if (!this.world) return null;
    return CharacterCapsuleKcc.create(this, spawn, opts);
  }

  /**
   * Closest Rapier ray hit. `dir` should be unit-length; hit point is
   * origin + dir * toi. Prefer this over Three.js Raycaster for world queries
   * (ground, LOS, harvest) so the same colliders the KCC uses are the SSOT.
   */
  castRay(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxToi = 200,
    opts?: { solid?: boolean },
  ): {
    toi: number;
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
  } | null {
    const world = this.world;
    if (!world) return null;
    const ray = new RAPIER.Ray(origin, dir);
    const hit = world.castRayAndGetNormal(ray, maxToi, opts?.solid !== false);
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    const n = hit.normal;
    return {
      toi: hit.timeOfImpact,
      x: p.x,
      y: p.y,
      z: p.z,
      nx: n.x,
      ny: n.y,
      nz: n.z,
    };
  }

  /** Downward ground sample (metres). Null if nothing under the probe. */
  heightAt(x: number, z: number, fromY = 400, maxToi = 800): number | null {
    const hit = this.castRay({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }, maxToi, {
      solid: true,
    });
    return hit ? hit.y : null;
  }

  /**
   * True when a chest-height segment from `from` to `to` is unblocked
   * (or only grazes within `skin` of the destination).
   */
  lineOfSight(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    skin = 0.45,
  ): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return true;
    const inv = 1 / len;
    const hit = this.castRay(from, { x: dx * inv, y: dy * inv, z: dz * inv }, len, {
      solid: true,
    });
    if (!hit) return true;
    return hit.toi >= len - skin;
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
  if (!initPromise) initPromise = RAPIER.init({});
  return initPromise;
}

export { RAPIER, capsuleCenterOffset };

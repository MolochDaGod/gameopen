import type { WarlordsSceneKind } from "./types";
import { GRAVITY_Y } from "./constants";
import { PhysicsWorld } from "./PhysicsWorld";
import { CharacterCapsuleKcc } from "./CharacterCapsuleKcc";
import { installMeshBvh } from "./meshBvh";

export interface ScenePhysicsOptions {
  /** Scene host kind (docs / telemetry only). */
  kind?: WarlordsSceneKind;
  /** World gravity Y. Default GRAVITY_Y; dungeon mesh KCC often uses 0. */
  gravityY?: number;
  /** Add a flat ground plane at y=0 (Danger Room / brawler / island fallback). */
  ground?: boolean | { y?: number; half?: number };
  /**
   * Rapier heightfield terrain (three.js physics_rapier_terrain pattern).
   * When set, preferred over a flat ground plane for outdoor islands.
   */
  heightfield?: {
    width: number;
    depth: number;
    heights: Float32Array;
    scale: { x: number; y: number; z: number };
    origin?: { x: number; y: number; z: number };
    friction?: number;
  };
  /** Create a player KCC at spawn (feet). */
  player?: boolean | { x: number; y: number; z: number };
  /** Install three-mesh-bvh accelerated raycast if available. */
  meshBvh?: boolean;
}

export interface ScenePhysics {
  physics: PhysicsWorld;
  playerKcc: CharacterCapsuleKcc | null;
  kind: WarlordsSceneKind;
}

/**
 * One-call bootstrap for Warlords scene hosts.
 *
 * ```ts
 * const { physics, playerKcc } = await createScenePhysics({
 *   kind: "danger-room",
 *   ground: true,
 *   player: { x: 0, y: 0, z: 0 },
 *   meshBvh: true,
 * });
 * controller.setCollision(playerKcc);
 * // each frame:
 * physics.step(dt);
 * ```
 */
export async function createScenePhysics(
  opts: ScenePhysicsOptions = {},
): Promise<ScenePhysics> {
  const kind = opts.kind ?? "danger-room";
  if (opts.meshBvh) await installMeshBvh();

  const physics = new PhysicsWorld();
  await physics.init(opts.gravityY ?? GRAVITY_Y);

  if (opts.heightfield) {
    const hf = opts.heightfield;
    const col = physics.addHeightfieldGrid(
      {
        width: hf.width,
        depth: hf.depth,
        heights: hf.heights,
        scale: hf.scale,
        origin: hf.origin,
      },
      { friction: hf.friction },
    );
    if (!col && opts.ground !== false) {
      // Fail closed to flat ground so KCC never free-falls
      physics.addGroundPlane(0, Math.max(hf.scale.x, hf.scale.z) * 0.5);
    }
  } else if (opts.ground) {
    const g = typeof opts.ground === "object" ? opts.ground : {};
    physics.addGroundPlane(g.y ?? 0, g.half ?? 60);
  }

  let playerKcc: CharacterCapsuleKcc | null = null;
  if (opts.player) {
    const spawn =
      typeof opts.player === "object" ? opts.player : { x: 0, y: 0, z: 0 };
    playerKcc = physics.createPlayerKcc(spawn, { stepOnMove: false });
  }

  return { physics, playerKcc, kind };
}

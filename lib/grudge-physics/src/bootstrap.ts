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

  if (opts.ground) {
    const g = typeof opts.ground === "object" ? opts.ground : {};
    physics.addGroundPlane(g.y ?? 0, g.half ?? 60);
  }

  let playerKcc: CharacterCapsuleKcc | null = null;
  if (opts.player) {
    const spawn =
      typeof opts.player === "object" ? opts.player : { x: 0, y: 0, z: 0 };
    playerKcc = physics.createPlayerKcc(spawn);
  }

  return { physics, playerKcc, kind };
}

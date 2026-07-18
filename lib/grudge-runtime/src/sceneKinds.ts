/**
 * Uniform scene kinds for all Warlords-era hosts.
 * Keep in lockstep with `@workspace/grudge-physics` WarlordsSceneKind.
 */

export const SCENE_KINDS = [
  "danger-room",
  "dungeon",
  "voxel-arena",
  "brawler",
  "island",
  "zone",
  "instance",
  "editor",
  "lobby",
  "realms",
  "sailing",
  "war",
] as const;

export type SceneKind = (typeof SCENE_KINDS)[number];

export function isSceneKind(v: string): v is SceneKind {
  return (SCENE_KINDS as readonly string[]).includes(v);
}

/**
 * Recommended physics bootstrap flags per scene kind
 * (hosts still call createScenePhysics from grudge-physics).
 */
export const SCENE_PHYSICS_DEFAULTS: Record<
  SceneKind,
  { ground: boolean; keepRoomBounds: boolean; meshBvh: boolean; gravityY?: number }
> = {
  "danger-room": { ground: true, keepRoomBounds: true, meshBvh: true },
  dungeon: { ground: false, keepRoomBounds: false, meshBvh: true, gravityY: 0 },
  "voxel-arena": { ground: false, keepRoomBounds: false, meshBvh: true, gravityY: 0 },
  brawler: { ground: true, keepRoomBounds: true, meshBvh: false },
  island: { ground: false, keepRoomBounds: false, meshBvh: true },
  zone: { ground: true, keepRoomBounds: true, meshBvh: true },
  instance: { ground: false, keepRoomBounds: false, meshBvh: true },
  editor: { ground: true, keepRoomBounds: true, meshBvh: false },
  lobby: { ground: false, keepRoomBounds: false, meshBvh: true },
  realms: { ground: false, keepRoomBounds: false, meshBvh: false },
  sailing: { ground: false, keepRoomBounds: false, meshBvh: true },
  war: { ground: true, keepRoomBounds: false, meshBvh: false },
};

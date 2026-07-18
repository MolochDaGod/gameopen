/**
 * Uniform world location — every Warlords scene reports where the player is
 * with the same shape (islands, zones, instances, dungeons, Danger Room).
 */

import { newGrudgeId } from "./ids";
import type { SceneKind } from "./sceneKinds";

/** 3D feet position (metres, world space). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Authoritative placement of a player / entity in the fleet. */
export interface WorldLocation {
  /** Scene host kind (danger-room, island, dungeon, …). */
  kind: SceneKind;
  /**
   * Zone / cabinet / GRUDOX id (e.g. `lobby-island`, `brawler`, `minegrudge`).
   * Empty string when not in a fleet zone card.
   */
  zoneId: string;
  /**
   * Runtime instance id for a private dungeon run, island session, or match.
   * Stable for the life of the session; mint with {@link newInstanceId}.
   */
  instanceId: string;
  /** Optional world / map seed label (deterministic gen only — not entity ids). */
  seed?: string;
  /** Optional content map / deployment id (`seed-grudge-plains`, dungeon file). */
  mapId?: string;
  /** Feet position when known. */
  position?: Vec3;
  /** Yaw radians when known. */
  yaw?: number;
  /** Parent location when nested (dungeon inside island portal). */
  parent?: Pick<WorldLocation, "kind" | "zoneId" | "instanceId" | "mapId">;
}

/** Mint a new runtime instance id. */
export function newInstanceId(): string {
  return newGrudgeId("instance");
}

/** Canonical Danger Room home location. */
export function dangerRoomLocation(opts?: {
  instanceId?: string;
  position?: Vec3;
}): WorldLocation {
  return {
    kind: "danger-room",
    zoneId: "danger",
    instanceId: opts?.instanceId ?? newInstanceId(),
    mapId: "danger-room",
    position: opts?.position ?? { x: 0, y: 0, z: 4 },
    yaw: 0,
  };
}

/** Dungeon instance entered from a portal / door. */
export function dungeonLocation(opts: {
  mapId: string;
  instanceId?: string;
  seed?: string;
  parent?: WorldLocation;
  position?: Vec3;
}): WorldLocation {
  return {
    kind: "dungeon",
    zoneId: opts.parent?.zoneId ?? "dungeon",
    instanceId: opts.instanceId ?? newInstanceId(),
    mapId: opts.mapId,
    seed: opts.seed,
    position: opts.position,
    parent: opts.parent
      ? {
          kind: opts.parent.kind,
          zoneId: opts.parent.zoneId,
          instanceId: opts.parent.instanceId,
          mapId: opts.parent.mapId,
        }
      : undefined,
  };
}

/** Island / lobby world placement. */
export function islandLocation(opts: {
  zoneId?: string;
  mapId?: string;
  instanceId?: string;
  seed?: string;
  position?: Vec3;
  yaw?: number;
}): WorldLocation {
  return {
    kind: "island",
    zoneId: opts.zoneId ?? "lobby-island",
    instanceId: opts.instanceId ?? newInstanceId(),
    mapId: opts.mapId ?? "lobby-island",
    seed: opts.seed,
    position: opts.position,
    yaw: opts.yaw,
  };
}

/** Zone / GRUDOX cabinet shell (may embed another host). */
export function zoneLocation(zoneId: string, opts?: Partial<WorldLocation>): WorldLocation {
  return {
    kind: "zone",
    zoneId,
    instanceId: opts?.instanceId ?? newInstanceId(),
    mapId: opts?.mapId,
    seed: opts?.seed,
    position: opts?.position,
    yaw: opts?.yaw,
    parent: opts?.parent,
  };
}

/** Compact string for logs / multiplayer join payloads. */
export function formatLocation(loc: WorldLocation): string {
  const bits = [loc.kind, loc.zoneId || "-", loc.instanceId, loc.mapId || ""].filter(Boolean);
  if (loc.position) {
    bits.push(
      `${loc.position.x.toFixed(1)},${loc.position.y.toFixed(1)},${loc.position.z.toFixed(1)}`,
    );
  }
  return bits.join("|");
}

/** Shallow equality of identity fields (not position). */
export function samePlace(a: WorldLocation, b: WorldLocation): boolean {
  return (
    a.kind === b.kind &&
    a.zoneId === b.zoneId &&
    a.instanceId === b.instanceId &&
    (a.mapId ?? "") === (b.mapId ?? "")
  );
}

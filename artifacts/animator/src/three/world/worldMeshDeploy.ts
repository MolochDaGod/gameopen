/**
 * Production world-mesh deploy contract — layers, physics, colliders, nodes,
 * UUID, locations. Complements characterDeploy + worldScale (1.8 m human).
 *
 * Use when placing buildings, islands, boats, bosses, props into a live sector.
 */

import { HUMAN_HEIGHT_M } from "../boss/volcanoBossCatalog";

/** Forge / Rapier semantic layers used fleet-wide. */
export const WORLD_PHYSICS_LAYERS = [
  "Default",
  "Terrain",
  "Player",
  "NPC",
  "Item",
  "Projectile",
  "Trigger",
  "Water",
  "IgnoreRaycast",
  "UI3D",
] as const;

export type WorldPhysicsLayer = (typeof WORLD_PHYSICS_LAYERS)[number];

export type ColliderKind = "none" | "box" | "capsule" | "trimesh" | "heightfield" | "sphere";

/**
 * One production deploy node (mesh instance in a sector/island).
 */
export type WorldMeshNode = {
  /** Stable fleet id — prefer grudgeUuid when registered */
  id: string;
  grudgeUuid?: string;
  /** CDN or local mesh key */
  meshKey: string;
  /** Kind for scale bands (building, boat, island, world_boss, …) */
  kind: string;
  /** World position (metres, Y-up, XZ ground) */
  position: [number, number, number];
  /** Yaw radians */
  rotationY?: number;
  /** Uniform scale after SI bake (usually 1) */
  scale?: number;
  /** Target height/longest after fit (m) — null = author metres */
  sizeHintM?: number;
  physicsLayer: WorldPhysicsLayer;
  collider: {
    kind: ColliderKind;
    /** half-extents or radius depending on kind */
    params?: number[];
  };
  /** Sector / island placement */
  location: {
    sectorId?: string;
    archetype?: string;
    tags?: string[];
    /** Named pin e.g. hellmaw_caldera */
    pin?: string;
  };
  /** Optional anim pack / boss id */
  runtime?: {
    bossId?: string;
    enemyId?: string;
    animPack?: string;
  };
};

/** Required fields checklist for production push. */
export function validateWorldMeshNode(n: WorldMeshNode): {
  ok: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!n.id) missing.push("id");
  if (!n.meshKey) missing.push("meshKey");
  if (!n.kind) missing.push("kind");
  if (!n.position || n.position.length !== 3) missing.push("position[x,y,z]");
  if (!n.physicsLayer) missing.push("physicsLayer");
  if (!n.collider?.kind) missing.push("collider.kind");
  if (!n.location) missing.push("location");
  if (!n.grudgeUuid) warnings.push("grudgeUuid missing — register for fleet Use panel");
  if (n.physicsLayer === "Terrain" && n.collider.kind === "none") {
    warnings.push("Terrain without collider");
  }
  if (n.kind === "world_boss" && !n.runtime?.bossId) {
    warnings.push("world_boss without runtime.bossId");
  }
  // Scale sanity vs human
  if (n.sizeHintM != null) {
    if (n.kind === "character" && (n.sizeHintM < 1.4 || n.sizeHintM > 2.4)) {
      warnings.push(`character sizeHintM ${n.sizeHintM} off human ${HUMAN_HEIGHT_M}`);
    }
    if (n.kind === "world_boss" && n.sizeHintM > 12) {
      warnings.push(`world_boss sizeHintM ${n.sizeHintM} may be 100× unit error`);
    }
  }
  return { ok: missing.length === 0, missing, warnings };
}

/** Hellmaw / volcanic world-boss production nodes. */
export const HELLMAW_WORLD_NODES: WorldMeshNode[] = [
  {
    id: "hellmaw_shadow_flame_mantis",
    meshKey: "models/bosses/shadow-flame-mantis.prod.glb",
    kind: "world_boss",
    position: [12, 0, -8],
    rotationY: 0,
    scale: 1,
    sizeHintM: 3.2,
    physicsLayer: "NPC",
    collider: { kind: "capsule", params: [0.9, 2.4] },
    location: {
      sectorId: "s",
      archetype: "volcanic",
      tags: ["hellmaw", "boss_event", "world_boss", "volcanic"],
      pin: "hellmaw_caldera",
    },
    runtime: {
      bossId: "shadow_flame_mantis",
      animPack: "mantis_native",
    },
  },
  {
    id: "hellmaw_ash_ghast_a",
    meshKey: "models/enemies/volcano/minecraft-ghast.prod.glb",
    kind: "volcano_ranged",
    position: [12 + 22, 2.5, -8],
    sizeHintM: 2.4,
    physicsLayer: "NPC",
    collider: { kind: "sphere", params: [1.1] },
    location: {
      sectorId: "s",
      tags: ["hellmaw", "volcanic", "ambient"],
      pin: "hellmaw_air_a",
    },
    runtime: { enemyId: "volcano_ghast" },
  },
  {
    id: "hellmaw_ash_ghast_b",
    meshKey: "models/enemies/volcano/minecraft-ghast.prod.glb",
    kind: "volcano_ranged",
    position: [12 - 22, 2.5, -8],
    sizeHintM: 2.4,
    physicsLayer: "NPC",
    collider: { kind: "sphere", params: [1.1] },
    location: {
      sectorId: "s",
      tags: ["hellmaw", "volcanic", "ambient"],
      pin: "hellmaw_air_b",
    },
    runtime: { enemyId: "volcano_ghast" },
  },
];

export function listHellmawDeployReport() {
  return HELLMAW_WORLD_NODES.map((n) => ({
    id: n.id,
    ...validateWorldMeshNode(n),
    layer: n.physicsLayer,
    collider: n.collider.kind,
    sizeHintM: n.sizeHintM,
    humans: n.sizeHintM != null ? n.sizeHintM / HUMAN_HEIGHT_M : null,
  }));
}

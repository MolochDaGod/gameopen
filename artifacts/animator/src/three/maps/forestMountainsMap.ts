/**
 * Forest-in-the-mountains dense harvest zone.
 *
 * Source: the_landscape_is_a_forest_in_the_mountains (1).glb
 * Asset: public/models/maps/forest_mountains/forest_mountains.glb
 *
 * Node names are AI hash / Dupli IDs — classification is **geometry + material
 * clusters**, not English keywords:
 *  - Terrain = largest horizontal footprint (heightmap layer)
 *  - Wood = tall thin / multi-mat Cylinder trees + Dupli canopies
 *  - Ore = squat medium rocks
 *  - Forage = small low props
 *
 * Each harvestable gets:
 *  - hrvd_ definition · hrvl_ location · hrvi_ instance UUIDs
 *  - convex/cuboid collider plan for Rapier bake
 *  - harvest anim roles (axe/pick/gather)
 *  - raycast pick via harvestId
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  definitionId,
  locationIdForCell,
  newInstanceId,
} from "../harvest/harvestIds";
import { HarvestLayer } from "../harvest/layers";
import { applyGameLayer, GamePlayLayer } from "../gameplay/GamePlayLayers";
import { createTerrainHeightSampler } from "../brawler/survivalEnvironment";
import { ORC_AGENT } from "./pirateVillageMap";
import { applyMapScaleForOrc } from "./mapOrcScale";

const BASE = import.meta.env.BASE_URL || "/";

export type ForestHarvestKind = "wood" | "ore" | "forage";

export interface ForestHarvestDef {
  /** hrvd_<slug> */
  defId: string;
  slug: string;
  kind: ForestHarvestKind;
  tool: string;
  materialId: string;
  label: string;
  maxHp: number;
  /** Player one-shot roles for anim database */
  playerSwing: string[];
  breakFx: "leaf" | "spark" | "dust";
  chunkCount: number;
  /** Collider preference for bake */
  collider: "convex" | "cuboid";
}

export interface ForestHarvestNode {
  /** hrvi_ */
  instanceId: string;
  /** hrvl_ */
  locationId: string;
  defId: string;
  kind: ForestHarvestKind;
  tool: string;
  materialId: string;
  label: string;
  hp: number;
  maxHp: number;
  mesh: THREE.Object3D;
  /** World center for raycast / pinata */
  position: THREE.Vector3;
  halfExtents: { x: number; y: number; z: number };
  /** Sampled world-space points for convex hull (capped). */
  convexPoints: Float32Array | null;
  materialKey: string;
}

export interface ForestMountainsMapResult {
  root: THREE.Group;
  terrain: THREE.Mesh[];
  harvestNodes: ForestHarvestNode[];
  defs: ForestHarvestDef[];
  heightAt: (x: number, z: number) => number | null;
  boundHalf: number;
  scale: number;
  agent: typeof ORC_AGENT;
  worldSeed: string;
  stats: {
    meshCount: number;
    terrainCount: number;
    wood: number;
    ore: number;
    forage: number;
    skipped: number;
  };
}

/** Catalog of harvest definitions for this map (bake / Q&A). */
export const FOREST_MOUNTAIN_DEFS: ForestHarvestDef[] = [
  {
    defId: definitionId("fm_pine_tree"),
    slug: "fm_pine_tree",
    kind: "wood",
    tool: "axe",
    materialId: "pine-log",
    label: "Mountain Pine",
    maxHp: 70,
    playerSwing: ["harvestChop", "Axe", "Attack"],
    breakFx: "leaf",
    chunkCount: 8,
    collider: "convex",
  },
  {
    defId: definitionId("fm_canopy_tree"),
    slug: "fm_canopy_tree",
    kind: "wood",
    tool: "axe",
    materialId: "oak-log",
    label: "Forest Canopy Tree",
    maxHp: 55,
    playerSwing: ["harvestChop", "Axe"],
    breakFx: "leaf",
    chunkCount: 7,
    collider: "convex",
  },
  {
    defId: definitionId("fm_boulder"),
    slug: "fm_boulder",
    kind: "ore",
    tool: "pick",
    materialId: "iron-ore",
    label: "Mountain Boulder",
    maxHp: 80,
    playerSwing: ["harvestMine", "Attack"],
    breakFx: "spark",
    chunkCount: 8,
    collider: "convex",
  },
  {
    defId: definitionId("fm_ore_rock"),
    slug: "fm_ore_rock",
    kind: "ore",
    tool: "pick",
    materialId: "copper-ore",
    label: "Ore Rock",
    maxHp: 50,
    playerSwing: ["harvestMine"],
    breakFx: "spark",
    chunkCount: 6,
    collider: "cuboid",
  },
  {
    defId: definitionId("fm_forage"),
    slug: "fm_forage",
    kind: "forage",
    tool: "hand",
    materialId: "cotton-thread",
    label: "Forest Forage",
    maxHp: 15,
    playerSwing: ["harvestGather"],
    breakFx: "dust",
    chunkCount: 3,
    collider: "cuboid",
  },
];

function loadGltf(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (g) => resolve(g.scene), undefined, reject);
  });
}

function matKey(mesh: THREE.Mesh): string {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats
    .map((m) => (m && "name" in m ? String((m as THREE.Material).name || "") : ""))
    .join("|")
    .slice(0, 64);
}

function meshSize(mesh: THREE.Object3D): {
  size: THREE.Vector3;
  center: THREE.Vector3;
  footprint: number;
  aspect: number;
  volume: number;
} {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const footprint = size.x * size.z;
  const aspect = size.y / Math.max(size.x, size.z, 0.01);
  return { size, center, footprint, aspect, volume: size.x * size.y * size.z };
}

/**
 * Geometry role when names are meaningless hashes.
 */
export function classifyForestMeshGeometry(
  size: THREE.Vector3,
  footprint: number,
  aspect: number,
  opts?: { terrainFootprintMin?: number },
): "ground" | "wood" | "ore" | "forage" | "skip" {
  const terrainMin = opts?.terrainFootprintMin ?? 80;
  // Large terrain slab / mountain shell
  if (footprint >= terrainMin && aspect < 0.85) return "ground";
  if (footprint >= terrainMin * 2) return "ground";
  // Tall trees
  if (size.y >= 2.2 && aspect >= 1.35) return "wood";
  if (size.y >= 3.5 && aspect >= 1.0) return "wood";
  // Rocks / ore
  if (size.y >= 0.45 && size.y <= 5 && aspect < 1.4 && footprint >= 0.35 && footprint < terrainMin) {
    return "ore";
  }
  // Small forage
  if (size.y < 1.4 && footprint < 3.5 && footprint > 0.05) return "forage";
  // Tiny noise / floating bits
  if (size.y < 0.15 || footprint < 0.02) return "skip";
  // Medium ambiguous → wood if taller
  if (aspect >= 1.2) return "wood";
  if (footprint > 2) return "ore";
  return "forage";
}

function pickDef(kind: ForestHarvestKind, size: THREE.Vector3): ForestHarvestDef {
  if (kind === "wood") {
    return size.y > 5
      ? FOREST_MOUNTAIN_DEFS[0]!
      : FOREST_MOUNTAIN_DEFS[1]!;
  }
  if (kind === "ore") {
    return size.y > 1.8
      ? FOREST_MOUNTAIN_DEFS[2]!
      : FOREST_MOUNTAIN_DEFS[3]!;
  }
  return FOREST_MOUNTAIN_DEFS[4]!;
}

/**
 * Sample mesh vertices in world space for convex hull (max points).
 */
export function sampleConvexPoints(
  mesh: THREE.Mesh,
  maxPoints = 48,
): Float32Array | null {
  const geo = mesh.geometry;
  if (!geo?.attributes?.position) return null;
  const pos = geo.attributes.position;
  const count = pos.count;
  if (count < 4) return null;
  mesh.updateWorldMatrix(true, false);
  const mw = mesh.matrixWorld;
  const step = Math.max(1, Math.floor(count / maxPoints));
  const pts: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < count && pts.length / 3 < maxPoints; i += step) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mw);
    pts.push(v.x, v.y, v.z);
  }
  // Always include bbox corners for stability
  const box = new THREE.Box3().setFromObject(mesh);
  const corners = [
    box.min,
    box.max,
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
  ];
  for (const c of corners) pts.push(c.x, c.y, c.z);
  return new Float32Array(pts);
}

function reGroundAndCenter(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!Number.isFinite(box.min.y)) return;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.x -= (b2.min.x + b2.max.x) / 2;
  root.position.z -= (b2.min.z + b2.max.z) / 2;
  root.updateMatrixWorld(true);
}

/**
 * Load dense forest mountain harvest zone.
 */
export async function loadForestMountainsMap(opts?: {
  scale?: number;
  worldSeed?: string;
  /** Max harvest instances to register (perf). */
  maxHarvest?: number;
}): Promise<ForestMountainsMapResult> {
  const worldSeed = opts?.worldSeed ?? "forest-mountains-harvest-01";
  const maxHarvest = opts?.maxHarvest ?? 220;
  const url = `${BASE}models/maps/forest_mountains/forest_mountains.glb`;

  const scene = await loadGltf(url);
  const root = new THREE.Group();
  root.name = "ForestMountainsHarvestZone";
  root.add(scene);
  // 2 m orc SI fit (door/storey/footprint), then re-ground/center
  const scaleReport = applyMapScaleForOrc(root, { fixedScale: opts?.scale });
  const scale = scaleReport.scale;
  reGroundAndCenter(root);

  // First pass: measure all meshes
  type Cand = {
    mesh: THREE.Mesh;
    size: THREE.Vector3;
    center: THREE.Vector3;
    footprint: number;
    aspect: number;
    volume: number;
    mat: string;
  };
  const cands: Cand[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const { size, center, footprint, aspect, volume } = meshSize(m);
    if (!Number.isFinite(size.x) || volume <= 0) return;
    cands.push({
      mesh: m,
      size,
      center,
      footprint,
      aspect,
      volume,
      mat: matKey(m),
    });
  });

  // Terrain = top footprint meshes
  const byFoot = [...cands].sort((a, b) => b.footprint - a.footprint);
  const terrainFloor = byFoot[0] ? byFoot[0].footprint * 0.12 : 80;
  const terrain: THREE.Mesh[] = [];
  for (const c of byFoot) {
    if (c.footprint >= terrainFloor || c.footprint >= 100) {
      const role = classifyForestMeshGeometry(c.size, c.footprint, c.aspect, {
        terrainFootprintMin: terrainFloor,
      });
      if (role === "ground" || c.footprint >= byFoot[0]!.footprint * 0.35) {
        terrain.push(c.mesh);
        applyGameLayer(c.mesh, "terrain");
        c.mesh.userData.nav = true;
        c.mesh.receiveShadow = true;
        c.mesh.userData.harvestTerrain = true;
      }
    }
    if (terrain.length >= 12) break;
  }
  // Fallback: largest mesh only
  if (!terrain.length && byFoot[0]) {
    terrain.push(byFoot[0].mesh);
    applyGameLayer(byFoot[0].mesh, "terrain");
    byFoot[0].mesh.userData.nav = true;
  }

  const heightAt = terrain.length
    ? createTerrainHeightSampler(terrain)
    : () => 0;

  const harvestNodes: ForestHarvestNode[] = [];
  let wood = 0;
  let ore = 0;
  let forage = 0;
  let skipped = 0;
  const terrainSet = new Set(terrain);

  for (const c of cands) {
    if (terrainSet.has(c.mesh)) continue;
    if (harvestNodes.length >= maxHarvest) {
      skipped++;
      continue;
    }
    const role = classifyForestMeshGeometry(c.size, c.footprint, c.aspect, {
      terrainFootprintMin: terrainFloor,
    });
    if (role === "ground" || role === "skip") {
      skipped++;
      continue;
    }

    const def = pickDef(role, c.size);
    const pos = c.center.clone();
    // Seat on heightmap if possible
    const hy = heightAt(pos.x, pos.z);
    if (hy != null && Number.isFinite(hy)) {
      // keep mesh where it is; location uses feet-ish y
      pos.y = Math.min(pos.y, hy + c.size.y * 0.5);
    }

    const key = `${c.mesh.name}|${c.mat}|${pos.x.toFixed(1)},${pos.z.toFixed(1)}`;
    const instanceId = newInstanceId(worldSeed, key);
    const locationId = locationIdForCell(
      worldSeed,
      pos.x,
      pos.y,
      pos.z,
      def.slug,
    );

    const half = {
      x: Math.max(0.2, c.size.x * 0.45),
      y: Math.max(0.25, c.size.y * 0.5),
      z: Math.max(0.2, c.size.z * 0.45),
    };

    const convexPoints =
      def.collider === "convex" ? sampleConvexPoints(c.mesh, 40) : null;

    applyGameLayer(c.mesh, "harvest", {
      extraBits: HarvestLayer.HARVESTABLE,
    });
    c.mesh.userData.harvest = {
      kind: def.kind === "forage" ? "fiber" : def.kind,
      tool: def.tool,
      hp: def.maxHp,
      label: def.label,
      materialId: def.materialId,
    };
    c.mesh.userData.harvestId = instanceId;
    c.mesh.userData.harvestInstanceId = instanceId;
    c.mesh.userData.harvestLocationId = locationId;
    c.mesh.userData.harvestDefId = def.defId;
    c.mesh.userData.harvestMaterialId = def.materialId;
    c.mesh.userData.harvestTool = def.tool;
    c.mesh.userData.harvestKind = def.kind;
    c.mesh.userData.harvestable = true;
    c.mesh.userData.playerSwing = def.playerSwing;
    c.mesh.userData.breakFx = def.breakFx;
    c.mesh.userData.chunkCount = def.chunkCount;
    c.mesh.userData.colliderType = def.collider;
    c.mesh.userData.layers =
      (Number(c.mesh.userData.layers) || 0) | GamePlayLayer.HARVESTABLE;
    c.mesh.userData.harvestLayer = HarvestLayer.HARVESTABLE;
    c.mesh.castShadow = true;

    harvestNodes.push({
      instanceId,
      locationId,
      defId: def.defId,
      kind: def.kind,
      tool: def.tool,
      materialId: def.materialId,
      label: def.label,
      hp: def.maxHp,
      maxHp: def.maxHp,
      mesh: c.mesh,
      position: pos,
      halfExtents: half,
      convexPoints,
      materialKey: c.mat,
    });

    if (def.kind === "wood") wood++;
    else if (def.kind === "ore") ore++;
    else forage++;
  }

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const hx = Math.max(24, (box.max.x - box.min.x) * 0.55);
  const hz = Math.max(24, (box.max.z - box.min.z) * 0.55);
  const boundHalf = Math.min(140, Math.max(hx, hz));

  return {
    root,
    terrain,
    harvestNodes,
    defs: FOREST_MOUNTAIN_DEFS,
    heightAt,
    boundHalf,
    scale,
    agent: ORC_AGENT,
    worldSeed,
    stats: {
      meshCount: cands.length,
      terrainCount: terrain.length,
      wood,
      ore,
      forage,
      skipped,
    },
  };
}

/**
 * Collider bake descriptors for harvest nodes + terrain.
 */
export function forestColliderPlans(map: ForestMountainsMapResult): Array<{
  type: "trimesh" | "convex" | "cuboid";
  layer: "ground" | "harvest";
  mesh?: THREE.Mesh;
  center?: THREE.Vector3;
  halfExtents?: { x: number; y: number; z: number };
  points?: Float32Array;
  instanceId?: string;
  sensor?: boolean;
}> {
  const plans: Array<{
    type: "trimesh" | "convex" | "cuboid";
    layer: "ground" | "harvest";
    mesh?: THREE.Mesh;
    center?: THREE.Vector3;
    halfExtents?: { x: number; y: number; z: number };
    points?: Float32Array;
    instanceId?: string;
    sensor?: boolean;
  }> = [];

  for (const t of map.terrain.slice(0, 8)) {
    plans.push({ type: "trimesh", layer: "ground", mesh: t });
  }
  for (const n of map.harvestNodes) {
    if (n.convexPoints && n.convexPoints.length >= 12) {
      plans.push({
        type: "convex",
        layer: "harvest",
        points: n.convexPoints,
        instanceId: n.instanceId,
        center: n.position,
      });
    } else {
      plans.push({
        type: "cuboid",
        layer: "harvest",
        center: n.position,
        halfExtents: n.halfExtents,
        instanceId: n.instanceId,
      });
    }
  }
  return plans;
}

/** Raycast harvestables under a ray (tool swing / LMB). */
export function raycastForestHarvest(
  map: ForestMountainsMapResult,
  raycaster: THREE.Raycaster,
  maxDist = 28,
): ForestHarvestNode | null {
  const meshes = map.harvestNodes.map((n) => n.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  for (const h of hits) {
    if (h.distance > maxDist) continue;
    let o: THREE.Object3D | null = h.object;
    while (o) {
      const id = o.userData.harvestInstanceId || o.userData.harvestId;
      if (id) {
        const node = map.harvestNodes.find((n) => n.instanceId === id);
        if (node && node.hp > 0) return node;
      }
      o = o.parent;
    }
  }
  return null;
}

export function forestMountainsQaSummary(map: ForestMountainsMapResult): string {
  const s = map.stats;
  return [
    `Forest mountains harvest zone seed=${map.worldSeed} scale=${map.scale}`,
    `meshes=${s.meshCount} terrain=${s.terrainCount} wood=${s.wood} ore=${s.ore} forage=${s.forage} skipped=${s.skipped}`,
    `boundHalf=${map.boundHalf.toFixed(1)}m · UUIDs hrvl_/hrvi_/hrvd_ · convex+cuboid bake plans`,
    `Q&A: height raycast loco · axe trees · pick boulders · pinata absorb · generative dense node field`,
  ].join("\n");
}

/**
 * Road Pack breakdown for `/world` VoxGrudge lab + voxel editor.
 *
 * Source: Sketchfab "Road Pack" (Mineways-style material meshes) — NOT Kenney
 * modular tiles. Each mesh = one material cluster useful for:
 *  - biome ground (grass/dirt/snow/mesa/nether)
 *  - roads / paths (cobble, stone slab, clay, wood slab)
 *  - trees (oak log/leaves, acacia)
 *  - structure trim + rails for connections
 *
 * Binary: R2 `models/packs/road_pack.glb` (not git). Local bake copy optional.
 * Kenney 8m roads remain the modular connector SSOT for full open world.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import type { BlockTypeId } from "@workspace/voxel-canonical";
import { colorForBlockType } from "./types";
import type { BlockData, PieceShape } from "./types";

export const ROAD_PACK_R2_KEY = "models/packs/road_pack.glb";

export type RoadPackUse =
  | "roads"
  | "biomes"
  | "trees"
  | "buildings"
  | "connections"
  | "foundation"
  | "biome_accent";

export interface RoadPackPiece {
  meshIndex: number;
  material: string;
  role: string;
  biome: string;
  use: RoadPackUse[];
}

/** Hardcoded catalog (mirrors content/worlds/road-pack-catalog.json). */
export const ROAD_PACK_PIECES: readonly RoadPackPiece[] = [
  { meshIndex: 0, material: "Acacia_Log", role: "tree_trunk", biome: "savanna", use: ["trees", "biome_accent"] },
  { meshIndex: 1, material: "Bedrock", role: "bedrock", biome: "deep", use: ["foundation"] },
  { meshIndex: 2, material: "Block_of_Quartz", role: "structure_quartz", biome: "city", use: ["buildings", "connections"] },
  { meshIndex: 3, material: "Brown_Mushroom_Block", role: "mushroom", biome: "fungal", use: ["trees", "biome_accent"] },
  { meshIndex: 4, material: "Clay", role: "path_clay", biome: "river", use: ["roads", "connections"] },
  { meshIndex: 5, material: "Cobblestone", role: "road_cobble", biome: "plains", use: ["roads", "connections"] },
  { meshIndex: 6, material: "Colored_Terracotta", role: "structure_terracotta", biome: "mesa", use: ["buildings"] },
  { meshIndex: 7, material: "Dirt", role: "ground_dirt", biome: "plains", use: ["biomes", "roads"] },
  { meshIndex: 8, material: "Double_Oak_Slab", role: "path_wood", biome: "forest", use: ["roads", "connections"] },
  { meshIndex: 9, material: "Double_Stone_Slab", role: "road_stone_slab", biome: "city", use: ["roads", "connections"] },
  { meshIndex: 10, material: "Grass", role: "ground_grass_soft", biome: "plains", use: ["biomes"] },
  { meshIndex: 11, material: "Grass_Block", role: "ground_grass", biome: "plains", use: ["biomes"] },
  { meshIndex: 12, material: "Mossy_Cobblestone", role: "road_mossy", biome: "forest", use: ["roads", "connections"] },
  { meshIndex: 13, material: "Nether_Wart", role: "plant_nether", biome: "nether", use: ["biome_accent"] },
  { meshIndex: 14, material: "Netherrack", role: "ground_nether", biome: "nether", use: ["biomes"] },
  { meshIndex: 15, material: "Oak_Leaves", role: "tree_canopy_a", biome: "forest", use: ["trees"] },
  { meshIndex: 16, material: "Oak_Leaves", role: "tree_canopy_b", biome: "forest", use: ["trees"] },
  { meshIndex: 17, material: "Oak_Log", role: "tree_trunk_oak", biome: "forest", use: ["trees"] },
  { meshIndex: 18, material: "Oak_Planks", role: "structure_wood", biome: "village", use: ["buildings"] },
  { meshIndex: 19, material: "Oak_Slab", role: "path_wood_slab", biome: "village", use: ["roads"] },
  { meshIndex: 20, material: "Quartz_Stairs", role: "structure_stairs", biome: "city", use: ["buildings", "connections"] },
  { meshIndex: 21, material: "Rail", role: "rail", biome: "industry", use: ["connections"] },
  { meshIndex: 22, material: "Red_Mushroom", role: "mushroom_red", biome: "fungal", use: ["biome_accent"] },
  { meshIndex: 23, material: "Red_Sandstone", role: "ground_mesa", biome: "mesa", use: ["biomes", "roads"] },
  { meshIndex: 24, material: "Red_Sandstone_Slab", role: "path_mesa", biome: "mesa", use: ["roads"] },
  { meshIndex: 25, material: "Snow", role: "ground_snow_soft", biome: "tundra", use: ["biomes"] },
  { meshIndex: 26, material: "Snow_Block", role: "ground_snow", biome: "tundra", use: ["biomes"] },
  { meshIndex: 27, material: "Soul_Sand", role: "ground_soul", biome: "nether", use: ["biomes"] },
  { meshIndex: 28, material: "Stone", role: "road_stone", biome: "mountains", use: ["roads", "biomes"] },
  { meshIndex: 29, material: "Stone_Slab", role: "road_slab", biome: "city", use: ["roads", "connections"] },
  { meshIndex: 30, material: "Terracotta", role: "structure_clay", biome: "mesa", use: ["buildings"] },
  { meshIndex: 31, material: "Wool", role: "structure_wool", biome: "village", use: ["buildings"] },
] as const;

/** Material → voxel-canonical placeable block type (best effort). */
export const MATERIAL_TO_BLOCK: Record<string, BlockTypeId> = {
  Grass_Block: "grass",
  Grass: "grass",
  Dirt: "dirt",
  Stone: "stone",
  Cobblestone: "stone",
  Mossy_Cobblestone: "stone",
  Stone_Slab: "stone",
  Double_Stone_Slab: "stone",
  Snow: "snow",
  Snow_Block: "snow",
  Red_Sandstone: "sand",
  Red_Sandstone_Slab: "sand",
  Clay: "dirt",
  Oak_Planks: "woodPlanks",
  Oak_Log: "log",
  Acacia_Log: "log",
  Bedrock: "stone",
  Netherrack: "brickRed",
  Soul_Sand: "dirt",
  Block_of_Quartz: "brickGrey",
  Oak_Leaves: "leaves",
  Oak_Slab: "woodPlanks",
  Double_Oak_Slab: "woodPlanks",
  Rail: "coal",
  Terracotta: "brickYellow",
  Colored_Terracotta: "brickYellow",
  Wool: "blockBlank",
};

export function piecesForUse(use: RoadPackUse): RoadPackPiece[] {
  return ROAD_PACK_PIECES.filter((p) => p.use.includes(use));
}

export function pieceByRole(role: string): RoadPackPiece | undefined {
  return ROAD_PACK_PIECES.find((p) => p.role === role);
}

// ── GLB load / isolate ───────────────────────────────────────────────────────

let packRoot: THREE.Object3D | null = null;
let packMeshes: THREE.Mesh[] = [];
let packLoad: Promise<void> | null = null;

export async function ensureRoadPackLoaded(): Promise<boolean> {
  if (packRoot && packMeshes.length) return true;
  if (!packLoad) {
    packLoad = (async () => {
      const { scene } = await loadGltfFirst(
        [ROAD_PACK_R2_KEY, "models/packs/road_pack.glb"],
        sharedGltfLoader(),
        { prepMaterials: true },
      );
      packRoot = scene;
      const meshes: THREE.Mesh[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) meshes.push(m);
      });
      // Prefer Object_N order from catalog meshIndex
      meshes.sort((a, b) => {
        const na = parseInt(String(a.name).replace(/\D/g, ""), 10);
        const nb = parseInt(String(b.name).replace(/\D/g, ""), 10);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.name.localeCompare(b.name);
      });
      packMeshes = meshes;
      console.info(
        `[roadPack] loaded meshes=${packMeshes.length} roles=${ROAD_PACK_PIECES.length}`,
      );
    })().catch((err) => {
      packLoad = null;
      console.warn("[roadPack] load failed — lab continues without GLB scatter", err);
      throw err;
    });
  }
  try {
    await packLoad;
    return !!(packRoot && packMeshes.length);
  } catch {
    return false;
  }
}

/**
 * Clone one material cluster, fit height, feet on y=0.
 * Returns null if pack missing or index OOB.
 */
export async function extractRoadPackPiece(
  meshIndex: number,
  targetHeight = 1.2,
): Promise<THREE.Group | null> {
  const ok = await ensureRoadPackLoaded();
  if (!ok) return null;
  const src = packMeshes[meshIndex];
  if (!src) return null;

  const wrap = new THREE.Group();
  const clone = src.clone(true);
  wrap.add(clone);
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y || 1;
  const s = targetHeight / h;
  wrap.scale.setScalar(s);
  wrap.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(wrap);
  const c = box2.getCenter(new THREE.Vector3());
  wrap.position.x -= c.x;
  wrap.position.z -= c.z;
  wrap.position.y -= box2.min.y;
  wrap.userData.roadPack = {
    meshIndex,
    material: ROAD_PACK_PIECES[meshIndex]?.material,
    role: ROAD_PACK_PIECES[meshIndex]?.role,
  };
  wrap.name = `roadPack:${ROAD_PACK_PIECES[meshIndex]?.role ?? meshIndex}`;
  return wrap;
}

// ── Voxel block layout (works offline even if GLB fails) ─────────────────────

export interface BiomeRoadLayoutOpts {
  /** Half-grid extent (cells). Default 20. */
  half?: number;
  spokeCount?: number;
  ringRadii?: number[];
  /** Fill grass interior. */
  fillGrass?: boolean;
}

/**
 * Generate block list: grass fill + cobble spokes + stone ring connectors +
 * biome wedges (snow/sand/dirt) + leaf accents.
 * Pure data — apply via VoxelEditor load / setMap.
 */
export function buildBiomeRoadBlocks(opts: BiomeRoadLayoutOpts = {}): BlockData[] {
  const half = opts.half ?? 20;
  const spokes = opts.spokeCount ?? 8;
  const rings = opts.ringRadii ?? [6, 12, 18];
  const fillGrass = opts.fillGrass !== false;
  const blocks: BlockData[] = [];
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const seen = new Set<string>();

  const put = (
    x: number,
    y: number,
    z: number,
    type: BlockTypeId,
    shape: PieceShape = "block",
  ) => {
    if (x < -half || x > half || z < -half || z > half || y < 0) return;
    const k = key(x, y, z);
    if (seen.has(k)) return;
    seen.add(k);
    blocks.push({
      x,
      y,
      z,
      shape,
      color: colorForBlockType(type),
      rotation: 0,
      type,
    });
  };

  // Ground fill
  if (fillGrass) {
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        put(x, 0, z, "grass");
      }
    }
  }

  // Biome wedges: 4 sectors replace grass underlay (plains dirt / mesa sand / tundra snow / nether-red)
  const biomeTypes: BlockTypeId[] = ["dirt", "sand", "snow", "brickRed"];
  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) {
      const a = Math.atan2(z, x);
      const sector = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 4) % 4;
      const r = Math.hypot(x, z);
      if (r > 4 && r < half - 1) {
        // Overwrite grass with biome (same cell — replace)
        const k = key(x, 0, z);
        seen.delete(k);
        put(x, 0, z, biomeTypes[sector]!);
      }
    }
  }

  // Radial spokes (roads) — cobble / stone slab
  for (let s = 0; s < spokes; s++) {
    const ang = (s / spokes) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    for (let t = 0; t <= half; t++) {
      const x = Math.round(dx * t);
      const z = Math.round(dz * t);
      const k = key(x, 0, z);
      seen.delete(k);
      put(x, 0, z, s % 2 === 0 ? "stone" : "dirt");
      // Side path slabs as markers (y=1 edge accents rare)
      if (t > 2 && t % 4 === 0) {
        put(x, 1, z, "stone", "slab");
      }
    }
  }

  // Concentric connector rings
  for (const R of rings) {
    const steps = Math.max(24, Math.floor(R * 6));
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const x = Math.round(Math.cos(ang) * R);
      const z = Math.round(Math.sin(ang) * R);
      const k = key(x, 0, z);
      seen.delete(k);
      put(x, 0, z, "stone");
    }
  }

  // Hub cross at origin
  for (let i = -2; i <= 2; i++) {
    for (const [x, z] of [
      [i, 0],
      [0, i],
    ] as const) {
      const k = key(x, 0, z);
      seen.delete(k);
      put(x, 0, z, "stone");
    }
  }

  // Tree trunk accents (wood pillars) off the roads
  for (let s = 0; s < spokes; s++) {
    const ang = (s / spokes) * Math.PI * 2 + 0.35;
    for (const dist of [8, 14]) {
      const x = Math.round(Math.cos(ang) * dist);
      const z = Math.round(Math.sin(ang) * dist);
      put(x, 1, z, "log", "pillar");
      put(x, 2, z, "log", "pillar");
      put(x, 3, z, "leaves", "block");
    }
  }

  return blocks;
}

/**
 * Scatter road-pack GLB accents along spokes/rings into a scene group.
 * Safe no-op if pack fails to load.
 */
export async function scatterRoadPackAccents(
  parent: THREE.Object3D,
  opts?: { spokeCount?: number; ringRadii?: number[] },
): Promise<number> {
  const ok = await ensureRoadPackLoaded();
  if (!ok) return 0;

  const spokes = opts?.spokeCount ?? 8;
  const rings = opts?.ringRadii ?? [6, 12];
  const roadPieces = piecesForUse("roads");
  const treePieces = piecesForUse("trees");
  let n = 0;

  // Road accents at ring×spoke junctions
  for (let s = 0; s < spokes; s++) {
    const ang = (s / spokes) * Math.PI * 2;
    for (const R of rings) {
      const piece = roadPieces[s % roadPieces.length]!;
      const inst = await extractRoadPackPiece(piece.meshIndex, 0.85 + (s % 3) * 0.15);
      if (!inst) continue;
      inst.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      inst.rotation.y = -ang + Math.PI / 2;
      parent.add(inst);
      n++;
    }
  }

  // Trees in biome wedges
  for (let s = 0; s < spokes; s++) {
    const ang = (s / spokes) * Math.PI * 2 + 0.4;
    const dist = 10 + (s % 3) * 2;
    const piece = treePieces[s % treePieces.length]!;
    const inst = await extractRoadPackPiece(piece.meshIndex, 1.4 + (s % 2) * 0.4);
    if (!inst) continue;
    inst.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    inst.rotation.y = Math.random() * Math.PI * 2;
    parent.add(inst);
    n++;
  }

  return n;
}

/** Kenney modular road CDN (full world connectors) — separate from road_pack.glb */
export const KENNEY_ROADS_CDN =
  "https://assets.grudge-studio.com/voxgrudge/models/kenney/roads/";

export const KENNEY_ROAD_TILES = [
  "road-straight",
  "road-bend",
  "road-intersection",
  "road-crossroad",
  "road-end",
  "road-roundabout",
] as const;

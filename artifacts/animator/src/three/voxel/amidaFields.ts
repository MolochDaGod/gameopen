/**
 * Fields near the city of Amida — farm/camp pack for `/world` + `/voxel`.
 *
 * Source: Sketchfab “Fields near the city of Amida” (Mineways multi-mesh).
 * Binary: R2 `models/packs/fields_near_the_city_of_amida.glb` (not git).
 *
 * 62 meshes / 5 materials (Fence atlas, Fence_0, Glass, Redstone torch).
 * Material names are atlas clusters — roles come from curated meshIndex catalog.
 * Codex: each role maps to voxel-canonical terrain + optional `/api/blocks` slug hints.
 */

import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import type { BlockTypeId } from "@workspace/voxel-canonical";
import {
  fetchBlockCatalog,
  findCatalogBlock,
  catalogTypeId,
} from "@workspace/voxel-canonical";
import { colorForBlockType } from "./types";
import type { BlockData, PieceShape } from "./types";

export const AMIDA_FIELDS_R2_KEY = "models/packs/fields_near_the_city_of_amida.glb";

export type AmidaUse =
  | "field"
  | "farm"
  | "fence"
  | "camp"
  | "structure"
  | "path"
  | "prop";

export type AmidaGroup =
  | "field"
  | "farm"
  | "fence"
  | "camp"
  | "structure"
  | "path"
  | "prop";

export interface AmidaPiece {
  meshIndex: number;
  material: string;
  role: string;
  group: AmidaGroup;
  use: AmidaUse[];
  codexTerrain: BlockTypeId;
  codexHint?: string;
}

/** Hardcoded catalog (mirrors content/worlds/amida-fields-catalog.json). */
export const AMIDA_PIECES: readonly AmidaPiece[] = [
  { meshIndex: 0, material: "Glass_Pane", role: "glass_pane", group: "camp", use: ["camp", "prop"], codexTerrain: "ice", codexHint: "window / pane" },
  { meshIndex: 1, material: "Redstone_Torch_active", role: "torch_a", group: "camp", use: ["camp", "prop"], codexTerrain: "exclamation", codexHint: "camp light" },
  { meshIndex: 2, material: "Redstone_Torch_active_0", role: "torch_b", group: "camp", use: ["camp", "prop"], codexTerrain: "exclamation", codexHint: "camp light tall" },
  { meshIndex: 3, material: "Fence", role: "wall_main_a", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 4, material: "Fence", role: "wall_main_b", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 5, material: "Fence", role: "wall_main_c", group: "structure", use: ["structure"], codexTerrain: "log" },
  { meshIndex: 6, material: "Fence", role: "field_dense_a", group: "field", use: ["field", "farm"], codexTerrain: "grass" },
  { meshIndex: 7, material: "Fence", role: "fence_tall_a", group: "fence", use: ["fence", "farm"], codexTerrain: "log" },
  { meshIndex: 8, material: "Fence", role: "wall_trim_a", group: "structure", use: ["structure"], codexTerrain: "woodPlanks" },
  { meshIndex: 9, material: "Fence", role: "field_dense_b", group: "field", use: ["field", "farm"], codexTerrain: "dirt" },
  { meshIndex: 10, material: "Fence", role: "fence_rail_a", group: "fence", use: ["fence", "farm"], codexTerrain: "log" },
  { meshIndex: 11, material: "Fence", role: "prop_dot", group: "prop", use: ["prop"], codexTerrain: "blockBlank" },
  { meshIndex: 12, material: "Fence", role: "field_dense_c", group: "field", use: ["field", "farm"], codexTerrain: "grass" },
  { meshIndex: 13, material: "Fence", role: "fence_post_thin", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 14, material: "Fence", role: "crop_stack", group: "farm", use: ["farm", "prop"], codexTerrain: "leaves" },
  { meshIndex: 15, material: "Fence", role: "wall_mid_a", group: "structure", use: ["structure"], codexTerrain: "woodPlanks" },
  { meshIndex: 16, material: "Fence", role: "wall_mid_b", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 17, material: "Fence", role: "roof_or_wall_a", group: "structure", use: ["structure", "camp"], codexTerrain: "brickYellow" },
  { meshIndex: 18, material: "Fence", role: "wall_main_d", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 19, material: "Fence", role: "wall_mid_c", group: "structure", use: ["structure"], codexTerrain: "log" },
  { meshIndex: 20, material: "Fence", role: "field_patch_a", group: "field", use: ["field", "farm"], codexTerrain: "dirt" },
  { meshIndex: 21, material: "Fence", role: "fence_gate_a", group: "fence", use: ["fence", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 22, material: "Fence", role: "fence_rail_b", group: "fence", use: ["fence", "farm"], codexTerrain: "log" },
  { meshIndex: 23, material: "Fence", role: "field_dense_d", group: "field", use: ["field", "farm"], codexTerrain: "grass" },
  { meshIndex: 24, material: "Fence", role: "wall_side_a", group: "structure", use: ["structure"], codexTerrain: "woodPlanks" },
  { meshIndex: 25, material: "Fence", role: "fence_tall_b", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 26, material: "Fence", role: "fence_post_b", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 27, material: "Fence", role: "camp_block_a", group: "camp", use: ["camp", "structure"], codexTerrain: "woodPlanks" },
  { meshIndex: 28, material: "Fence", role: "camp_block_b", group: "camp", use: ["camp", "structure"], codexTerrain: "blockSquare" },
  { meshIndex: 29, material: "Fence", role: "path_slab_a", group: "path", use: ["path", "farm"], codexTerrain: "stone" },
  { meshIndex: 30, material: "Fence", role: "path_slab_b", group: "path", use: ["path", "farm"], codexTerrain: "stone" },
  { meshIndex: 31, material: "Fence", role: "farm_prop_a", group: "farm", use: ["farm", "prop"], codexTerrain: "leaves" },
  { meshIndex: 32, material: "Fence", role: "farm_prop_b", group: "farm", use: ["farm", "prop"], codexTerrain: "leaves" },
  { meshIndex: 33, material: "Fence", role: "farm_prop_c", group: "farm", use: ["farm", "prop"], codexTerrain: "dirt" },
  { meshIndex: 34, material: "Fence", role: "wall_main_e", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 35, material: "Fence", role: "wall_trim_b", group: "structure", use: ["structure"], codexTerrain: "log" },
  { meshIndex: 36, material: "Fence", role: "wall_trim_c", group: "structure", use: ["structure"], codexTerrain: "woodPlanks" },
  { meshIndex: 37, material: "Fence_0", role: "field_alt_a", group: "field", use: ["field", "farm"], codexTerrain: "grass" },
  { meshIndex: 38, material: "Fence_0", role: "fence_alt_a", group: "fence", use: ["fence", "farm"], codexTerrain: "log" },
  { meshIndex: 39, material: "Fence_0", role: "fence_alt_b", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 40, material: "Fence_0", role: "prop_thin", group: "prop", use: ["prop"], codexTerrain: "blockBlank" },
  { meshIndex: 41, material: "Fence_0", role: "crop_bed", group: "farm", use: ["farm", "prop"], codexTerrain: "dirt" },
  { meshIndex: 42, material: "Fence_0", role: "fence_rail_c", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 43, material: "Fence_0", role: "fence_rail_d", group: "fence", use: ["fence"], codexTerrain: "woodPlanks" },
  { meshIndex: 44, material: "Fence_0", role: "fence_rail_e", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 45, material: "Fence_0", role: "wall_alt_a", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 46, material: "Fence_0", role: "field_alt_b", group: "field", use: ["field", "farm"], codexTerrain: "dirt" },
  { meshIndex: 47, material: "Fence_0", role: "wall_alt_b", group: "structure", use: ["structure"], codexTerrain: "log" },
  { meshIndex: 48, material: "Fence_0", role: "farm_prop_d", group: "farm", use: ["farm", "prop"], codexTerrain: "leaves" },
  { meshIndex: 49, material: "Fence_0", role: "field_alt_c", group: "field", use: ["field", "farm"], codexTerrain: "grass" },
  { meshIndex: 50, material: "Fence_0", role: "fence_alt_c", group: "fence", use: ["fence", "farm"], codexTerrain: "log" },
  { meshIndex: 51, material: "Fence_0", role: "farm_prop_e", group: "farm", use: ["farm", "prop"], codexTerrain: "leaves" },
  { meshIndex: 52, material: "Fence_0", role: "wall_alt_c", group: "structure", use: ["structure", "camp"], codexTerrain: "woodPlanks" },
  { meshIndex: 53, material: "Fence_0", role: "fence_rail_f", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 54, material: "Fence_0", role: "fence_alt_d", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 55, material: "Fence_0", role: "path_slab_c", group: "path", use: ["path", "farm"], codexTerrain: "stone" },
  { meshIndex: 56, material: "Fence_0", role: "fence_rail_g", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 57, material: "Fence_0", role: "field_alt_d", group: "field", use: ["field", "farm"], codexTerrain: "grass" },
  { meshIndex: 58, material: "Fence_0", role: "wall_alt_d", group: "structure", use: ["structure"], codexTerrain: "woodPlanks" },
  { meshIndex: 59, material: "Fence_0", role: "fence_dense", group: "fence", use: ["fence", "farm"], codexTerrain: "log" },
  { meshIndex: 60, material: "Fence_0", role: "fence_post_c", group: "fence", use: ["fence"], codexTerrain: "log" },
  { meshIndex: 61, material: "Fence_0", role: "fence_post_d", group: "fence", use: ["fence"], codexTerrain: "log" },
] as const;

/** Material → default terrain block (best effort atlas label). */
export const AMIDA_MATERIAL_TO_BLOCK: Record<string, BlockTypeId> = {
  Glass_Pane: "ice",
  Redstone_Torch_active: "exclamation",
  Redstone_Torch_active_0: "exclamation",
  Fence: "woodPlanks",
  Fence_0: "log",
};

/** Role → codex `/api/blocks` slug search hints (Mine-Loader catalog). */
export const AMIDA_CODEX_HINTS: Record<string, string[]> = {
  glass_pane: ["glass", "window", "pane"],
  torch_a: ["torch", "lantern", "light"],
  torch_b: ["torch", "lantern", "light"],
  field_dense_a: ["grass", "farmland", "dirt", "crop"],
  crop_stack: ["wheat", "crop", "plant", "leaves"],
  crop_bed: ["farmland", "dirt", "soil"],
  fence_tall_a: ["fence", "wood", "post"],
  path_slab_a: ["path", "cobble", "stone", "slab"],
  camp_block_a: ["planks", "crate", "chest", "camp"],
  wall_main_a: ["planks", "wall", "wood", "house"],
  farm_prop_a: ["crop", "plant", "bush"],
};

export function piecesForUse(use: AmidaUse): AmidaPiece[] {
  return AMIDA_PIECES.filter((p) => p.use.includes(use));
}

export function piecesForGroup(group: AmidaGroup): AmidaPiece[] {
  return AMIDA_PIECES.filter((p) => p.group === group);
}

export function pieceByRole(role: string): AmidaPiece | undefined {
  return AMIDA_PIECES.find((p) => p.role === role);
}

export function pieceByMeshIndex(meshIndex: number): AmidaPiece | undefined {
  return AMIDA_PIECES.find((p) => p.meshIndex === meshIndex);
}

// ── GLB load / isolate ───────────────────────────────────────────────────────

let packRoot: THREE.Object3D | null = null;
let packMeshes: THREE.Mesh[] = [];
let packLoad: Promise<void> | null = null;

export async function ensureAmidaFieldsLoaded(): Promise<boolean> {
  if (packRoot && packMeshes.length) return true;
  if (!packLoad) {
    packLoad = (async () => {
      const { scene } = await loadGltfFirst(
        [AMIDA_FIELDS_R2_KEY, "models/packs/fields_near_the_city_of_amida.glb"],
        sharedGltfLoader(),
        { prepMaterials: true },
      );
      packRoot = scene;
      const meshes: THREE.Mesh[] = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) meshes.push(m);
      });
      meshes.sort((a, b) => {
        const na = parseInt(String(a.name).replace(/\D/g, ""), 10);
        const nb = parseInt(String(b.name).replace(/\D/g, ""), 10);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.name.localeCompare(b.name);
      });
      packMeshes = meshes;
      console.info(
        `[amidaFields] loaded meshes=${packMeshes.length} roles=${AMIDA_PIECES.length}`,
      );
    })().catch((err) => {
      packLoad = null;
      console.warn("[amidaFields] load failed — lab continues without GLB scatter", err);
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
 * Clone one mesh cluster, fit height, feet on y=0.
 * Returns null if pack missing or index OOB.
 */
export async function extractAmidaPiece(
  meshIndex: number,
  targetHeight = 1.6,
): Promise<THREE.Group | null> {
  const ok = await ensureAmidaFieldsLoaded();
  if (!ok) return null;
  const src = packMeshes[meshIndex];
  if (!src) return null;

  const piece = pieceByMeshIndex(meshIndex);
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
  wrap.userData.amidaFields = {
    meshIndex,
    material: piece?.material,
    role: piece?.role,
    group: piece?.group,
    codexTerrain: piece?.codexTerrain,
  };
  wrap.name = `amida:${piece?.role ?? meshIndex}`;
  return wrap;
}

// ── Codex resolution ─────────────────────────────────────────────────────────

export interface AmidaCodexBinding {
  role: string;
  meshIndex: number;
  terrain: BlockTypeId;
  /** Resolved Mine-Loader catalog type `cat:slug` when a hint matches. */
  catalogType?: BlockTypeId;
  catalogName?: string;
  hints: string[];
}

/**
 * Bind Amida roles to Mine-Loader codex (`/api/blocks`).
 * Terrain always available offline; catalog types when API is reachable.
 */
export async function resolveAmidaCodexBindings(): Promise<AmidaCodexBinding[]> {
  let catalog: Awaited<ReturnType<typeof fetchBlockCatalog>> | null = null;
  try {
    catalog = await fetchBlockCatalog();
  } catch (err) {
    console.warn("[amidaFields] codex fetch failed — terrain-only bindings", err);
  }

  const bindings: AmidaCodexBinding[] = [];
  for (const p of AMIDA_PIECES) {
    const hints = AMIDA_CODEX_HINTS[p.role] ?? [];
    let catalogType: BlockTypeId | undefined;
    let catalogName: string | undefined;
    if (catalog && hints.length) {
      for (const h of hints) {
        const hit =
          findCatalogBlock(catalog, h) ||
          catalog.blocks.find(
            (b) =>
              b.slug?.toLowerCase().includes(h) ||
              b.name?.toLowerCase().includes(h) ||
              b.category?.toLowerCase().includes(h),
          );
        if (hit) {
          catalogType = catalogTypeId(hit.slug || hit.id);
          catalogName = hit.name || hit.slug;
          break;
        }
      }
    }
    bindings.push({
      role: p.role,
      meshIndex: p.meshIndex,
      terrain: p.codexTerrain,
      catalogType,
      catalogName,
      hints,
    });
  }
  return bindings;
}

/** Prefer catalog type when bound, else terrain. */
export function blockTypeForRole(
  role: string,
  bindings?: AmidaCodexBinding[],
): BlockTypeId {
  const b = bindings?.find((x) => x.role === role);
  if (b?.catalogType) return b.catalogType;
  if (b?.terrain) return b.terrain;
  return pieceByRole(role)?.codexTerrain ?? "grass";
}

// ── Voxel farm/camp layout (works offline even if GLB fails) ─────────────────

export interface AmidaFarmLayoutOpts {
  /** Half-grid extent (cells). Default 18. */
  half?: number;
  /** Prefer codex catalog types when provided. */
  bindings?: AmidaCodexBinding[];
}

/**
 * Generate Amida-style farm + camp:
 *  - grass fields with dirt plots
 *  - wood fence perimeter + gate
 *  - plank camp pad with crate accents
 *  - crop rows (leaves pillars)
 *  - stone paths + torch markers
 */
export function buildAmidaFarmBlocks(opts: AmidaFarmLayoutOpts = {}): BlockData[] {
  const half = opts.half ?? 18;
  const bindings = opts.bindings;
  const blocks: BlockData[] = [];
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const seen = new Set<string>();

  const t = (role: string, fallback: BlockTypeId): BlockTypeId =>
    blockTypeForRole(role, bindings) || fallback;

  const put = (
    x: number,
    y: number,
    z: number,
    type: BlockTypeId,
    shape: PieceShape = "block",
  ) => {
    if (x < -half || x > half || z < -half || z > half || y < 0 || y > 12) return;
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

  const grass = t("field_dense_a", "grass");
  const dirt = t("field_dense_b", "dirt");
  const planks = t("wall_main_a", "woodPlanks");
  const log = t("fence_tall_a", "log");
  const leaves = t("crop_stack", "leaves");
  const stone = t("path_slab_a", "stone");
  const torch = t("torch_a", "exclamation");
  const crate = t("camp_block_b", "blockSquare");
  const roof = t("roof_or_wall_a", "brickYellow");

  // Grass underlay
  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) {
      put(x, 0, z, grass);
    }
  }

  // Four farm plots (dirt) — N/E/S/W of center
  const plot = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = key(x, 0, z);
        seen.delete(k);
        put(x, 0, z, dirt);
      }
    }
  };
  plot(-14, -14, -6, -6);
  plot(6, -14, 14, -6);
  plot(-14, 6, -6, 14);
  plot(6, 6, 14, 14);

  // Crop rows on each plot (leaves pillars)
  const cropRows = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    axis: "x" | "z",
  ) => {
    if (axis === "x") {
      for (let x = x0 + 1; x < x1; x += 2) {
        for (let z = z0 + 1; z < z1; z++) {
          put(x, 1, z, leaves, "pillar");
        }
      }
    } else {
      for (let z = z0 + 1; z < z1; z += 2) {
        for (let x = x0 + 1; x < x1; x++) {
          put(x, 1, z, leaves, "pillar");
        }
      }
    }
  };
  cropRows(-14, -14, -6, -6, "x");
  cropRows(6, -14, 14, -6, "z");
  cropRows(-14, 6, -6, 14, "z");
  cropRows(6, 6, 14, 14, "x");

  // Stone cross paths through fields
  for (let i = -half; i <= half; i++) {
    const kx = key(i, 0, 0);
    const kz = key(0, 0, i);
    seen.delete(kx);
    seen.delete(kz);
    put(i, 0, 0, stone);
    put(0, 0, i, stone);
    if (Math.abs(i) % 5 === 0 && Math.abs(i) > 2) {
      put(i, 1, 0, stone, "slab");
      put(0, 1, i, stone, "slab");
    }
  }

  // Outer wood fence (log pillars on border, planks rails as walls)
  for (let x = -half; x <= half; x++) {
    for (const z of [-half, half]) {
      put(x, 1, z, log, "pillar");
      if (x % 2 === 0) put(x, 2, z, log, "wall");
    }
  }
  for (let z = -half + 1; z <= half - 1; z++) {
    for (const x of [-half, half]) {
      put(x, 1, z, log, "pillar");
      if (z % 2 === 0) put(x, 2, z, log, "wall");
    }
  }
  // Gate gaps on +Z and -Z paths
  for (const z of [-half, half]) {
    for (const x of [-1, 0, 1]) {
      const k1 = key(x, 1, z);
      const k2 = key(x, 2, z);
      seen.delete(k1);
      seen.delete(k2);
    }
  }

  // Camp pad (planks) at origin
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      const k = key(x, 0, z);
      seen.delete(k);
      put(x, 0, z, planks);
    }
  }
  // Camp walls (3-high, open +Z)
  for (let y = 1; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      put(x, y, -3, planks, "wall");
    }
    for (let z = -2; z <= 2; z++) {
      put(-3, y, z, planks, "wall");
      put(3, y, z, planks, "wall");
    }
  }
  // Roof slabs
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 2; z++) {
      put(x, 4, z, roof, "slab");
    }
  }
  // Interior crates
  put(-2, 1, -1, crate);
  put(2, 1, -1, crate);
  put(0, 1, -2, crate);

  // Torch markers at camp corners + path junctions
  for (const [x, z] of [
    [-4, -4],
    [4, -4],
    [-4, 4],
    [4, 4],
    [-10, 0],
    [10, 0],
    [0, -10],
    [0, 10],
  ] as const) {
    put(x, 1, z, torch, "pillar");
  }

  // Corner trees (log + leaves) — farm edge landmarks
  for (const [tx, tz] of [
    [-12, -12],
    [12, -12],
    [-12, 12],
    [12, 12],
  ] as const) {
    put(tx, 1, tz, log, "pillar");
    put(tx, 2, tz, log, "pillar");
    put(tx, 3, tz, leaves);
    put(tx + 1, 3, tz, leaves);
    put(tx - 1, 3, tz, leaves);
    put(tx, 3, tz + 1, leaves);
    put(tx, 3, tz - 1, leaves);
    put(tx, 4, tz, leaves);
  }

  return blocks;
}

/**
 * Scatter Amida GLB accents: camp walls, fence posts, crops, torches.
 * Safe no-op if pack fails to load.
 */
export async function scatterAmidaCampProps(
  parent: THREE.Object3D,
  opts?: { half?: number },
): Promise<number> {
  const ok = await ensureAmidaFieldsLoaded();
  if (!ok) return 0;

  const half = opts?.half ?? 14;
  const farm = piecesForUse("farm").filter((p) => p.role !== "prop_dot");
  const fence = piecesForUse("fence");
  const camp = piecesForUse("camp").filter((p) => !p.role.startsWith("glass"));
  const structure = piecesForGroup("structure").slice(0, 6);
  let n = 0;

  // Camp structure accents around pad
  for (let i = 0; i < Math.min(4, structure.length); i++) {
    const piece = structure[i]!;
    const ang = (i / 4) * Math.PI * 2 + 0.2;
    const inst = await extractAmidaPiece(piece.meshIndex, 1.8 + (i % 2) * 0.4);
    if (!inst) continue;
    inst.position.set(Math.cos(ang) * 5, 0, Math.sin(ang) * 5);
    inst.rotation.y = -ang;
    parent.add(inst);
    n++;
  }

  // Fence posts on outer ring
  for (let i = 0; i < 8; i++) {
    const piece = fence[i % fence.length]!;
    const ang = (i / 8) * Math.PI * 2;
    const inst = await extractAmidaPiece(piece.meshIndex, 1.2 + (i % 3) * 0.15);
    if (!inst) continue;
    inst.position.set(Math.cos(ang) * half, 0, Math.sin(ang) * half);
    inst.rotation.y = -ang + Math.PI / 2;
    parent.add(inst);
    n++;
  }

  // Farm crop props in plot centers
  const plotCenters: [number, number][] = [
    [-10, -10],
    [10, -10],
    [-10, 10],
    [10, 10],
  ];
  for (let i = 0; i < plotCenters.length; i++) {
    const [px, pz] = plotCenters[i]!;
    const piece = farm[i % farm.length]!;
    const inst = await extractAmidaPiece(piece.meshIndex, 0.9 + (i % 2) * 0.3);
    if (!inst) continue;
    inst.position.set(px, 0, pz);
    inst.rotation.y = (i * Math.PI) / 3;
    parent.add(inst);
    n++;
  }

  // Torches / camp lights
  const lights = camp.filter((p) => p.role.startsWith("torch"));
  for (let i = 0; i < 4; i++) {
    const piece = lights[i % Math.max(1, lights.length)] ?? camp[0];
    if (!piece) continue;
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const inst = await extractAmidaPiece(piece.meshIndex, 0.7);
    if (!inst) continue;
    inst.position.set(Math.cos(ang) * 4.5, 0, Math.sin(ang) * 4.5);
    parent.add(inst);
    n++;
  }

  return n;
}

/**
 * Full scene preview: place the entire Amida GLB (scaled) as a reference prop.
 * Use sparingly — heavy; accents via isolate are preferred for placement.
 */
export async function loadAmidaReferenceScene(
  targetWidth = 28,
): Promise<THREE.Group | null> {
  const ok = await ensureAmidaFieldsLoaded();
  if (!ok || !packRoot) return null;
  const wrap = new THREE.Group();
  const clone = packRoot.clone(true);
  wrap.add(clone);
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxXZ = Math.max(size.x, size.z, 0.001);
  const s = targetWidth / maxXZ;
  wrap.scale.setScalar(s);
  wrap.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(wrap);
  const c = box2.getCenter(new THREE.Vector3());
  wrap.position.x -= c.x;
  wrap.position.z -= c.z;
  wrap.position.y -= box2.min.y;
  wrap.name = "amidaFieldsReference";
  wrap.userData.amidaFields = { mode: "full_scene", r2Key: AMIDA_FIELDS_R2_KEY };
  return wrap;
}

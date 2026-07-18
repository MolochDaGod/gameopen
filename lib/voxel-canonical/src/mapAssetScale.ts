/**
 * Map vs prop asset evaluation + scale so map voxels match generated blocks.
 *
 * Fleet contract (Mine-Loader modelLibrary + kit pieces):
 *   **1 voxel block = 1 world unit (metre).**
 *
 * Seed/catalog GLBs often arrive as:
 *   · **props** — barrels, benches, modular walls (fit by targetHeight)
 *   · **map chunks** — castles, islands, full scenes (must NOT be crushed to 2–3 m tall)
 *
 * Applying prop-style `targetHeight / size.y` to a 350-unit castle yields scale ≈ 0.01
 * and the "little asset" bug. Maps use {@link scaleMapToBlockGrid} instead.
 */

/** World metres per generated block (Mine-Loader / Open voxel SSOT). */
export const VOXEL_BLOCK_METERS = 1;

/** Axis-aligned size of a mesh AABB in native file units. */
export type NativeBounds = { x: number; y: number; z: number };

export type AssetRole = "prop" | "map_chunk" | "structure" | "kit_module" | "unknown";

export type AssetEvalInput = {
  /** File basename or catalog id, e.g. castle_eltz.glb */
  name: string;
  /** Optional byte size of the GLB. */
  fileBytes?: number;
  /** Optional native AABB size (file units before scale). */
  bounds?: NativeBounds;
  /** Optional free tags from catalog. */
  tags?: string[];
  /** If true, force map_chunk. */
  forceMap?: boolean;
  /** If true, force prop (never map scale). */
  forceProp?: boolean;
};

export type AssetEvalResult = {
  role: AssetRole;
  /** Human reason for the classification (logs / UI). */
  reason: string;
  /** Suggested uniform scale so placement matches block grid. */
  scale: number;
  /** Estimated footprint in blocks after scale (XZ). */
  footprintBlocks: { w: number; d: number; h: number };
  /** True when prop height-fit must not be applied. */
  forbidPropHeightFit: boolean;
};

/** Names that almost always mean full map / chunk / scene, not a hand prop. */
const MAP_NAME_RE =
  /castle|fortress|citadel|keep|palace|town|city|village|island|overworld|realm|world|map|chunk|level|dungeon|temple|cathedral|smeltery|skycastle|eltz|retreat|biome|landscape|terrain|stronghold|siege/i;

/** Names that are small props even if large files (textures/atlases). */
const PROP_NAME_RE =
  /torch|barrel|crate|chest|bench|table|chair|fence|gate|hay|pumpkin|chicken|sword|axe|hammer|tool|icon|atlas|kit_wall|kit_floor/i;

/**
 * Classify a GLB for seed / editor placement.
 * Prefer explicit tags/force flags; fall back to name + size + bytes.
 */
export function evaluateAssetRole(input: AssetEvalInput): AssetEvalResult {
  const name = input.name || "unknown";
  const tags = (input.tags || []).map((t) => t.toLowerCase());
  const bounds = input.bounds ?? { x: 0, y: 0, z: 0 };
  const maxDim = Math.max(bounds.x, bounds.y, bounds.z, 0);
  const horiz = Math.max(bounds.x, bounds.z, 0);
  const bytes = input.fileBytes ?? 0;

  if (input.forceProp || tags.includes("prop") || tags.includes("furniture")) {
    const scale = 1;
    return finish("prop", "forced prop / furniture tag", scale, bounds);
  }
  if (input.forceMap || tags.includes("map") || tags.includes("map_chunk") || tags.includes("world")) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish("map_chunk", "forced map / map_chunk tag", scale, bounds);
  }
  if (tags.includes("kit") || tags.includes("kit_module") || /kit[_-]/i.test(name)) {
    // Kit pieces are authored at 1 unit = 1 block already
    return finish("kit_module", "building-kit module", 1, bounds);
  }
  if (PROP_NAME_RE.test(name) && maxDim < 25 && bytes < 8_000_000) {
    return finish("prop", "prop-like name + modest size", 1, bounds);
  }

  // Large files + map-ish names → map
  if (MAP_NAME_RE.test(name) && (bytes >= 8_000_000 || maxDim >= 40 || horiz >= 30)) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish(
      "map_chunk",
      `map name + large extent (max=${maxDim.toFixed(1)}, bytes=${bytes})`,
      scale,
      bounds,
    );
  }

  // Huge horizontal extent even without name → map
  if (horiz >= 80 || maxDim >= 120 || bytes >= 40_000_000) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish(
      "map_chunk",
      `extent/size implies full map (horiz=${horiz.toFixed(1)}, max=${maxDim.toFixed(1)})`,
      scale,
      bounds,
    );
  }

  // Medium buildings: structure, still not prop-height-crushed if wide
  if (MAP_NAME_RE.test(name) || (horiz >= 15 && maxDim >= 20)) {
    const scale = scaleMapToBlockGrid(bounds);
    return finish("structure", "structure-scale building", scale, bounds);
  }

  return finish("prop", "default prop", 1, bounds);
}

/**
 * Uniform scale so map voxels/units align with generated blocks.
 *
 * Rules:
 * 1. Native max dim in (20..2000) → treat as metres already → scale 1
 * 2. Native max dim > 2000 → likely centimetres → scale 0.01
 * 3. Known voxel-export pitch (e.g. Rascals 0.008) → scale = 1/pitch
 * 4. Tiny max dim (< 2) with huge mesh count is rare; leave scale 1
 *
 * Never uses prop `targetHeight` — that collapses continents to tables.
 */
export function scaleMapToBlockGrid(
  bounds: NativeBounds,
  opts?: {
    /** If known (Mineways / voxel export), override auto unit detect. */
    sourceBlockPitch?: number;
    targetBlockMeters?: number;
  },
): number {
  const target = opts?.targetBlockMeters ?? VOXEL_BLOCK_METERS;
  if (opts?.sourceBlockPitch && opts.sourceBlockPitch > 0) {
    return target / opts.sourceBlockPitch;
  }
  const maxDim = Math.max(bounds.x, bounds.y, bounds.z, 1e-6);
  // Centimetre-authored CAD / some Unity exports
  if (maxDim > 2000) return target * 0.01;
  // Already in metres / Minecraft-ish units (1 unit ≈ 1 block)
  if (maxDim >= 8) return target; // scale 1 when target is 1
  // Sub-meter diorama mistaken for map — still don't explode
  if (maxDim < 2) return target;
  return target;
}

/**
 * Prop height fit (existing editor behaviour) — only for role === prop.
 * Maps must call {@link scaleMapToBlockGrid} instead.
 */
export function scalePropToHeight(
  bounds: NativeBounds,
  targetHeight: number,
  footprint?: { w: number; d: number },
): number {
  const sy = Math.max(bounds.y, 1e-6);
  let scale = (targetHeight > 0 ? targetHeight : 2) / sy;
  if (footprint && footprint.w > 0 && footprint.d > 0) {
    const sx = Math.max(bounds.x, 1e-6);
    const sz = Math.max(bounds.z, 1e-6);
    scale = Math.min(scale, (footprint.w / sx) * 1.02, (footprint.d / sz) * 1.02);
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  return Math.min(32, Math.max(0.01, scale));
}

/**
 * Single entry: evaluate role then return correct scale for placement.
 */
export function placementScaleForAsset(
  input: AssetEvalInput,
  propTargetHeight?: number,
): AssetEvalResult {
  const evaled = evaluateAssetRole(input);
  if (evaled.role === "prop" && propTargetHeight != null && input.bounds) {
    const scale = scalePropToHeight(input.bounds, propTargetHeight);
    return {
      ...evaled,
      scale,
      footprintBlocks: footprintAfterScale(input.bounds, scale),
      forbidPropHeightFit: false,
    };
  }
  return evaled;
}

function footprintAfterScale(bounds: NativeBounds, scale: number) {
  return {
    w: Math.max(1, Math.round((bounds.x * scale) / VOXEL_BLOCK_METERS)),
    d: Math.max(1, Math.round((bounds.z * scale) / VOXEL_BLOCK_METERS)),
    h: Math.max(1, Math.round((bounds.y * scale) / VOXEL_BLOCK_METERS)),
  };
}

function finish(
  role: AssetRole,
  reason: string,
  scale: number,
  bounds: NativeBounds,
): AssetEvalResult {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    role,
    reason,
    scale: s,
    footprintBlocks: footprintAfterScale(bounds, s),
    forbidPropHeightFit: role === "map_chunk" || role === "structure",
  };
}

/** Catalog row for a seed-placeable map chunk (castle, island, fort). */
export type MapChunkDef = {
  id: string;
  label: string;
  /** Public / CDN path relative to models root */
  file: string;
  /** Role always map_chunk for this registry */
  role: "map_chunk";
  /** Optional known source pitch (Mineways etc.) */
  sourceBlockPitch?: number;
  /** Tags for filters */
  tags?: string[];
  /** Approx native bounds if measured offline */
  nativeBounds?: NativeBounds;
  /** File size hint for classification */
  fileBytes?: number;
  blurb?: string;
};

/**
 * Seed / warlords map chunks — never place via prop targetHeight.
 * castle_eltz: measured ~408×350×136 native units → scale 1 (metres already).
 */
export const MAP_CHUNKS: Record<string, MapChunkDef> = {
  castle_eltz: {
    id: "castle_eltz",
    label: "Castle Eltz",
    file: "models/warlords-era/worlds/castle_eltz.glb",
    role: "map_chunk",
    nativeBounds: { x: 408.228, y: 350, z: 136 },
    fileBytes: 163_443_404,
    tags: ["map", "castle", "chunk", "warlords"],
    blurb: "Full castle map chunk — scale so 1 unit = 1 voxel block (not prop height).",
  },
  castle: {
    id: "castle",
    label: "Castle",
    file: "models/warlords-era/buildings/castle.glb",
    role: "map_chunk",
    tags: ["map", "castle", "building"],
    blurb: "Castle scene — evaluate as map_chunk before prop fit.",
  },
  skycastle: {
    id: "skycastle",
    label: "Sky Castle",
    file: "models/warlords-era/buildings/skycastle.glb",
    role: "map_chunk",
    tags: ["map", "castle", "sky"],
  },
  entrance_to_fort: {
    id: "entrance_to_fort",
    label: "Fort Entrance",
    file: "models/warlords-era/buildings/entrance_to_fort.glb",
    role: "map_chunk",
    tags: ["map", "fort", "structure"],
  },
  rascals_retreat: {
    id: "rascals_retreat",
    label: "Rascals Retreat Collection",
    file: "models/worlds/rascals_retreat_collection.glb",
    role: "map_chunk",
    /** Documented Mineways-style pitch in SEED_WORLD_DEPLOY.md */
    sourceBlockPitch: 0.008,
    tags: ["map", "island", "rascals", "seed"],
    blurb: "Voxelize pitch 0.008 → scale = 125 so cells match 1 m blocks.",
  },
};

/** Resolve scale for a known map chunk id (or evaluate by name). */
export function scaleForMapChunkId(id: string, measured?: NativeBounds): number {
  const def = MAP_CHUNKS[id];
  const bounds = measured ?? def?.nativeBounds ?? { x: 100, y: 50, z: 100 };
  if (def?.sourceBlockPitch) {
    return scaleMapToBlockGrid(bounds, { sourceBlockPitch: def.sourceBlockPitch });
  }
  return evaluateAssetRole({
    name: def?.file ?? id,
    bounds,
    fileBytes: def?.fileBytes,
    tags: def?.tags,
    forceMap: true,
  }).scale;
}

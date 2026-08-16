/**
 * Deterministic chunked seed terrain for explorer / harvest overworlds.
 *
 * Same seed ⇒ same column heights and surface types (Minecraft-like).
 * Hub cells (starting town mesh) stay flat so the real map-chunk GLB sits at y=0.
 * Wilderness is generated in 16-column chunks around spawn + portal patches.
 *
 * 1 column = 1 m (VOXEL_BLOCK_METERS). No second world engine.
 */

import type { TerrainBlockId } from "./types";
import {
  chunkBlocks,
  DEFAULT_CHUNK_IDX,
  mixSeed,
  type SeedWorldBiome,
} from "./seedWorld";

/** Columns per generated chunk (Minecraft region cell). */
export const SEED_COLUMN_CHUNK = 16;

/** Chunks around spawn that always generate (−R..R). */
export const SEED_PLAY_CHUNK_RADIUS = 2;

/** Town mesh keep-out (matches deploymentToScene gen.hubRadius). */
export const SEED_DEFAULT_HUB_RADIUS = 36;

/** Extra wilderness ring (blocks) around each portal so beacons sit on terrain. */
export const SEED_PORTAL_PATCH = 16;

/** Full dirt/stone stack only inside this radius of spawn (metres). */
export const SEED_DETAIL_RADIUS = 40;

export type SeedTerrainField = {
  seed: number;
  biome: SeedWorldBiome;
  hubRadius: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
  /** Row-major (z * width + x) surface top Y in metres. Hub = 0. */
  heights: Float32Array;
  /** Parallel surface block types. Ignored when height ≤ 0. */
  types: TerrainBlockId[];
  /** Non-hub columns that should draw a dirt/stone stack. */
  detailCount: number;
};

export type GenerateSeedTerrainOpts = {
  seed: number;
  biome?: SeedWorldBiome;
  hubRadius?: number;
  /** Chunks around origin (default {@link SEED_PLAY_CHUNK_RADIUS}). */
  chunkRadius?: number;
  /** Extra XZ centres (portals) that must sit on generated columns. */
  extraCenters?: Array<{ x: number; z: number }>;
  extraRadius?: number;
  chunkIdx?: number;
};

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function hash01(ix: number, iz: number, seed: number): number {
  return mixSeed(mixSeed(seed, ix | 0), iz | 0) / 4294967296;
}

/** Value noise 0..1 at world XZ. */
export function valueNoise2(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fz = fade(z - z0);
  const v00 = hash01(x0, z0, seed);
  const v10 = hash01(x0 + 1, z0, seed);
  const v01 = hash01(x0, z0 + 1, seed);
  const v11 = hash01(x0 + 1, z0 + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fz;
}

export function fbm2(x: number, z: number, seed: number): number {
  return (
    valueNoise2(x, z, seed) * 0.62 +
    valueNoise2(x * 2.17, z * 2.17, mixSeed(seed, 91)) * 0.38
  );
}

export function isHubCell(x: number, z: number, hubRadius: number): boolean {
  if (hubRadius <= 0) return false;
  return x * x + z * z < hubRadius * hubRadius;
}

/** Integer surface top Y (metres) for a wilderness column. */
export function surfaceHeight(
  x: number,
  z: number,
  seed: number,
  biome: SeedWorldBiome,
): number {
  const n = fbm2(x * 0.045, z * 0.045, seed);
  const n2 = fbm2(x * 0.11, z * 0.11, mixSeed(seed, 7));
  let h: number;
  switch (biome) {
    case "mountains":
      h = 4 + n * 10 + n2 * 4;
      break;
    case "forest":
      h = 2 + n * 3 + n2 * 1.5;
      break;
    case "desert":
      h = 1 + n * 2.2;
      break;
    case "swamp":
      h = 1 + n * 1.6;
      break;
    case "tundra":
      h = 2 + n * 3;
      break;
    case "coast":
      h = 1 + n * 2.4;
      break;
    case "mixed":
      h = 2 + n * 4.5 + n2 * 2;
      break;
    case "plains":
    default:
      h = 2 + n * 2.4 + n2 * 0.8;
      break;
  }
  return Math.max(1, Math.min(22, Math.round(h)));
}

export function surfaceTypeAt(
  x: number,
  z: number,
  seed: number,
  biome: SeedWorldBiome,
  height: number,
): TerrainBlockId {
  const accent = hash01(x, z, mixSeed(seed, 0xb10c));
  switch (biome) {
    case "desert":
      return accent < 0.08 ? "stone" : "sand";
    case "tundra":
      return height >= 8 ? "stone" : "snow";
    case "coast":
      return height <= 1 ? "sand" : accent < 0.12 ? "stone" : "grass";
    case "swamp":
      return accent < 0.2 ? "dirt" : "grass";
    case "mountains":
      return height >= 10 ? "stone" : accent < 0.15 ? "dirt" : "grass";
    case "forest":
      return accent < 0.1 ? "dirt" : "grass";
    default:
      return accent < 0.06 ? "dirt" : "grass";
  }
}

export function heightAtCell(field: SeedTerrainField, x: number, z: number): number {
  if (x < field.minX || x > field.maxX || z < field.minZ || z > field.maxZ) return 0;
  const ix = x - field.minX;
  const iz = z - field.minZ;
  return field.heights[iz * field.width + ix] ?? 0;
}

export function typeAtCell(field: SeedTerrainField, x: number, z: number): TerrainBlockId {
  if (x < field.minX || x > field.maxX || z < field.minZ || z > field.maxZ) return "grass";
  const ix = x - field.minX;
  const iz = z - field.minZ;
  return field.types[iz * field.width + ix] ?? "grass";
}

/**
 * Generate a rectangular column field: hub flat, wilderness from seed, portal patches included.
 */
export function generateSeedTerrain(opts: GenerateSeedTerrainOpts): SeedTerrainField {
  const seed = opts.seed >>> 0;
  const biome = opts.biome ?? "mixed";
  const hubRadius = opts.hubRadius ?? SEED_DEFAULT_HUB_RADIUS;
  const chunkRadius = opts.chunkRadius ?? SEED_PLAY_CHUNK_RADIUS;
  const extraRadius = opts.extraRadius ?? SEED_PORTAL_PATCH;
  const worldHalf = Math.floor(chunkBlocks(opts.chunkIdx ?? DEFAULT_CHUNK_IDX) / 2);
  const playHalf = chunkRadius * SEED_COLUMN_CHUNK;

  let minX = -playHalf;
  let maxX = playHalf - 1;
  let minZ = -playHalf;
  let maxZ = playHalf - 1;

  for (const c of opts.extraCenters ?? []) {
    const x = Math.round(c.x);
    const z = Math.round(c.z);
    minX = Math.min(minX, x - extraRadius);
    maxX = Math.max(maxX, x + extraRadius);
    minZ = Math.min(minZ, z - extraRadius);
    maxZ = Math.max(maxZ, z + extraRadius);
  }

  minX = Math.max(minX, -worldHalf);
  maxX = Math.min(maxX, worldHalf - 1);
  minZ = Math.max(minZ, -worldHalf);
  maxZ = Math.min(maxZ, worldHalf - 1);

  const width = maxX - minX + 1;
  const depth = maxZ - minZ + 1;
  const heights = new Float32Array(width * depth);
  const types: TerrainBlockId[] = new Array(width * depth);
  let detailCount = 0;

  for (let iz = 0; iz < depth; iz++) {
    const z = minZ + iz;
    for (let ix = 0; ix < width; ix++) {
      const x = minX + ix;
      const i = iz * width + ix;
      if (isHubCell(x, z, hubRadius)) {
        heights[i] = 0;
        types[i] = "grass";
        continue;
      }
      const h = surfaceHeight(x, z, seed, biome);
      heights[i] = h;
      types[i] = surfaceTypeAt(x, z, seed, biome, h);
      if (x * x + z * z <= SEED_DETAIL_RADIUS * SEED_DETAIL_RADIUS) detailCount += 1;
    }
  }

  return {
    seed,
    biome,
    hubRadius,
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    heights,
    types,
    detailCount,
  };
}

export type SeedColumnBlock = {
  x: number;
  y: number;
  z: number;
  type: TerrainBlockId;
};

/**
 * Surface + optional dirt/stone stack as block cells (for overlay / tests).
 * Hub cells emit nothing — the town mesh is the ground.
 */
export function seedTerrainToColumnBlocks(
  field: SeedTerrainField,
  opts?: { detail?: boolean },
): SeedColumnBlock[] {
  const detail = opts?.detail !== false;
  const out: SeedColumnBlock[] = [];
  for (let iz = 0; iz < field.depth; iz++) {
    const z = field.minZ + iz;
    for (let ix = 0; ix < field.width; ix++) {
      const x = field.minX + ix;
      const i = iz * field.width + ix;
      const h = field.heights[i] ?? 0;
      if (h <= 0) continue;
      const type = field.types[i] ?? "grass";
      const topY = h - 1;
      out.push({ x, y: topY, z, type });
      if (!detail) continue;
      if (x * x + z * z > SEED_DETAIL_RADIUS * SEED_DETAIL_RADIUS) continue;
      if (topY >= 1) out.push({ x, y: topY - 1, z, type: "dirt" });
      if (topY >= 2) out.push({ x, y: 0, z, type: "stone" });
    }
  }
  return out;
}

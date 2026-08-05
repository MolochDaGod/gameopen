/**
 * Rapier heightfield terrain helpers — pattern from the official three.js example:
 * https://threejs.org/examples/?q=rapier#physics_rapier_terrain
 *
 * SSOT stack for outdoor maps:
 *  1. Float32Array height grid (row-major, width × depth vertices)
 *  2. Rapier ColliderDesc.heightfield (PhysicsWorld.addStaticHeightfield)
 *  3. sampleHeightfieldY for Controller feet + FootGrounder (same grid)
 *
 * SI metres only. Never use as character visual.
 */

export type HeightfieldScale = { x: number; y: number; z: number };

export type HeightfieldGrid = {
  /** Vertex count along X (columns). */
  width: number;
  /** Vertex count along Z (rows). */
  depth: number;
  /**
   * Row-major heights: index = i + j * width
   * i ∈ [0, width), j ∈ [0, depth)
   * Same layout as three.js physics_rapier_terrain `generateHeight`.
   */
  heights: Float32Array;
  /** World extents (full width/depth in metres) and vertical scale. */
  scale: HeightfieldScale;
  /** World-space centre of the heightfield (mesh position). */
  origin?: { x: number; y: number; z: number };
};

/**
 * Procedural radial sine terrain (demo / tests) — same idea as three.js
 * `generateHeight` in physics_rapier_terrain.
 */
export function generateRadialHeight(
  width: number,
  depth: number,
  minHeight: number,
  maxHeight: number,
  phaseMult = 12,
): Float32Array {
  const size = width * depth;
  const data = new Float32Array(size);
  const hRange = maxHeight - minHeight;
  const w2 = width / 2;
  const d2 = depth / 2;
  let p = 0;
  for (let j = 0; j < depth; j++) {
    for (let i = 0; i < width; i++) {
      const radius = Math.sqrt(
        Math.pow((i - w2) / w2, 2) + Math.pow((j - d2) / d2, 2),
      );
      data[p++] = (Math.sin(radius * phaseMult) + 1) * 0.5 * hRange + minHeight;
    }
  }
  return data;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Bilinear sample of a heightfield grid at world (x, z).
 * Returns null if outside the field extents (FootGrounder treats as void).
 *
 * Coordinate frame matches three.js PlaneGeometry(extentsX, extentsZ) rotated
 * −π/2 about X, centred at origin (or `origin`): local X/Z span
 * [−scale.x/2, +scale.x/2] × [−scale.z/2, +scale.z/2].
 */
export function sampleHeightfieldY(
  grid: HeightfieldGrid,
  worldX: number,
  worldZ: number,
): number | null {
  const { width, depth, heights, scale } = grid;
  if (width < 2 || depth < 2 || heights.length < width * depth) return null;

  const ox = grid.origin?.x ?? 0;
  const oy = grid.origin?.y ?? 0;
  const oz = grid.origin?.z ?? 0;

  // Local coords relative to field centre
  const lx = worldX - ox;
  const lz = worldZ - oz;
  const halfX = scale.x * 0.5;
  const halfZ = scale.z * 0.5;
  if (lx < -halfX || lx > halfX || lz < -halfZ || lz > halfZ) return null;

  // Map local XZ → continuous vertex indices [0, width-1] / [0, depth-1]
  const u = ((lx + halfX) / scale.x) * (width - 1);
  const v = ((lz + halfZ) / scale.z) * (depth - 1);
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const i1 = Math.min(width - 1, i0 + 1);
  const j1 = Math.min(depth - 1, j0 + 1);
  const fx = u - i0;
  const fz = v - j0;

  const h00 = heights[i0 + j0 * width]!;
  const h10 = heights[i1 + j0 * width]!;
  const h01 = heights[i0 + j1 * width]!;
  const h11 = heights[i1 + j1 * width]!;

  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  const h = (h0 * (1 - fz) + h1 * fz) * scale.y;
  return oy + h;
}

/**
 * Finite-difference normal for foot tilt (same spirit as terrainFootSample).
 */
export function normalFromHeightfield(
  grid: HeightfieldGrid,
  worldX: number,
  worldZ: number,
  epsilon = 0.28,
): { x: number; y: number; z: number } | null {
  const y = sampleHeightfieldY(grid, worldX, worldZ);
  if (y == null || !Number.isFinite(y)) return null;
  const yx0 = sampleHeightfieldY(grid, worldX - epsilon, worldZ);
  const yx1 = sampleHeightfieldY(grid, worldX + epsilon, worldZ);
  const yz0 = sampleHeightfieldY(grid, worldX, worldZ - epsilon);
  const yz1 = sampleHeightfieldY(grid, worldX, worldZ + epsilon);
  if (
    yx0 == null ||
    yx1 == null ||
    yz0 == null ||
    yz1 == null ||
    !Number.isFinite(yx0) ||
    !Number.isFinite(yx1) ||
    !Number.isFinite(yz0) ||
    !Number.isFinite(yz1)
  ) {
    return { x: 0, y: 1, z: 0 };
  }
  // Gradient → normal
  const nx = yx0 - yx1;
  const ny = 2 * epsilon;
  const nz = yz0 - yz1;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-8) return { x: 0, y: 1, z: 0 };
  return { x: nx / len, y: ny / len, z: nz / len };
}

/**
 * heightAt adapter for Controller / FootGrounder / SurfaceLocomotion.
 */
export function heightAtFromHeightfield(
  grid: HeightfieldGrid,
): (x: number, z: number) => number | null {
  return (x, z) => sampleHeightfieldY(grid, x, z);
}

/**
 * Rapier heightfield cell counts: nrows/ncols = vertexCount − 1
 * (matches three.js addHeightfield(mesh, width-1, depth-1, …)).
 */
export function rapierHeightfieldDims(
  width: number,
  depth: number,
): { nrows: number; ncols: number } {
  return {
    nrows: Math.max(1, depth - 1),
    ncols: Math.max(1, width - 1),
  };
}

export function validateHeightfieldGrid(grid: HeightfieldGrid): string | null {
  if (grid.width < 2 || grid.depth < 2) return "width/depth must be ≥ 2";
  if (grid.heights.length !== grid.width * grid.depth) {
    return `heights length ${grid.heights.length} ≠ width*depth ${grid.width * grid.depth}`;
  }
  if (!(grid.scale.x > 0 && grid.scale.z > 0)) return "scale.x/z must be > 0";
  if (!Number.isFinite(grid.scale.y) || grid.scale.y === 0) {
    return "scale.y must be finite non-zero";
  }
  for (let i = 0; i < Math.min(8, grid.heights.length); i++) {
    if (!Number.isFinite(grid.heights[i]!)) return "heights contain non-finite";
  }
  return null;
}

/** Clamp heights into a band (optional authoring safety). */
export function clampHeights(
  heights: Float32Array,
  minH: number,
  maxH: number,
): Float32Array {
  const out = new Float32Array(heights.length);
  for (let i = 0; i < heights.length; i++) {
    out[i] = clamp(heights[i]!, minH, maxH);
  }
  return out;
}

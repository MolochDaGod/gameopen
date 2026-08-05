import { describe, expect, it } from "vitest";
import {
  generateRadialHeight,
  sampleHeightfieldY,
  heightAtFromHeightfield,
  rapierHeightfieldDims,
  validateHeightfieldGrid,
  type HeightfieldGrid,
} from "./heightfieldTerrain";

describe("heightfieldTerrain (three.js physics_rapier_terrain pattern)", () => {
  it("generateRadialHeight fills width*depth", () => {
    const h = generateRadialHeight(16, 16, -2, 8);
    expect(h.length).toBe(256);
    expect(Math.min(...h)).toBeGreaterThanOrEqual(-2);
    expect(Math.max(...h)).toBeLessThanOrEqual(8);
  });

  it("rapier dims are vertex-1", () => {
    expect(rapierHeightfieldDims(128, 128)).toEqual({ nrows: 127, ncols: 127 });
  });

  it("sampleHeightfieldY centre matches grid mid height * scale.y", () => {
    const width = 5;
    const depth = 5;
    const heights = new Float32Array(width * depth);
    heights.fill(2);
    heights[2 + 2 * width] = 4; // centre vertex
    const grid: HeightfieldGrid = {
      width,
      depth,
      heights,
      scale: { x: 10, y: 1, z: 10 },
      origin: { x: 0, y: 0, z: 0 },
    };
    // Centre of field
    const y = sampleHeightfieldY(grid, 0, 0);
    expect(y).not.toBeNull();
    // Bilinear around centre — should be near 4 (all neighbours 2, centre 4)
    expect(y!).toBeGreaterThan(2);
    expect(y!).toBeLessThanOrEqual(4);
  });

  it("sampleHeightfieldY outside returns null (void for FootGrounder)", () => {
    const grid: HeightfieldGrid = {
      width: 4,
      depth: 4,
      heights: new Float32Array(16).fill(1),
      scale: { x: 10, y: 1, z: 10 },
    };
    expect(sampleHeightfieldY(grid, 100, 0)).toBeNull();
  });

  it("heightAtFromHeightfield adapts for Controller / FootGrounder", () => {
    const grid: HeightfieldGrid = {
      width: 8,
      depth: 8,
      heights: generateRadialHeight(8, 8, 0, 2),
      scale: { x: 40, y: 1, z: 40 },
    };
    const heightAt = heightAtFromHeightfield(grid);
    const y = heightAt(0, 0);
    expect(y).not.toBeNull();
    expect(Number.isFinite(y!)).toBe(true);
  });

  it("validateHeightfieldGrid catches length mismatch", () => {
    expect(
      validateHeightfieldGrid({
        width: 4,
        depth: 4,
        heights: new Float32Array(10),
        scale: { x: 10, y: 1, z: 10 },
      }),
    ).toMatch(/length/);
  });
});

import { describe, expect, it } from "vitest";
import {
  footSamplerFromHeightAt,
  footSamplerFromHeightfieldGrid,
  normalFromHeightField,
  FLAT_FOOT_SAMPLER,
} from "./terrainFootSample";
import { generateRadialHeight } from "@workspace/grudge-physics";

describe("terrainFootSample", () => {
  it("flat sampler is y=0 no normal", () => {
    const s = FLAT_FOOT_SAMPLER(3, 4);
    expect(s.y).toBe(0);
    expect(s.normal).toBeNull();
  });

  it("samples height field Y", () => {
    const heightAt = (x: number, z: number) => 2 + 0.1 * x;
    const samp = footSamplerFromHeightAt(heightAt);
    const s = samp(1, 0);
    expect(s.y).toBeCloseTo(2.1, 5);
    expect(s.normal).toBeTruthy();
    expect(s.normal!.y).toBeGreaterThan(0.5);
  });

  it("void height returns non-finite y", () => {
    const heightAt = () => null;
    const s = footSamplerFromHeightAt(heightAt)(0, 0);
    expect(Number.isFinite(s.y)).toBe(false);
  });

  it("normal points uphill on slope", () => {
    // Rising +X → normal leans toward -X
    const heightAt = (x: number) => x;
    const n = normalFromHeightField(heightAt as (x: number, z: number) => number | null, 0, 0, 0.5);
    expect(n).toBeTruthy();
    expect(n!.x).toBeLessThan(0);
    expect(n!.y).toBeGreaterThan(0);
  });

  it("footSamplerFromHeightfieldGrid matches three.js rapier terrain grid", () => {
    const width = 16;
    const depth = 16;
    const grid = {
      width,
      depth,
      heights: generateRadialHeight(width, depth, 0, 4),
      scale: { x: 100, y: 1, z: 100 },
      origin: { x: 0, y: 0, z: 0 },
    };
    const samp = footSamplerFromHeightfieldGrid(grid);
    const s = samp(0, 0);
    expect(Number.isFinite(s.y)).toBe(true);
    expect(s.normal).toBeTruthy();
    expect(s.normal!.y).toBeGreaterThan(0.3);
    // Outside extents → void
    const voidS = samp(200, 0);
    expect(Number.isFinite(voidS.y)).toBe(false);
  });
});

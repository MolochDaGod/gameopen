import { describe, expect, it } from "vitest";
import {
  evaluateAssetRole,
  scaleMapToBlockGrid,
  scalePropToHeight,
  scaleForMapChunkId,
  VOXEL_BLOCK_METERS,
} from "./mapAssetScale";

describe("mapAssetScale", () => {
  it("keeps VOXEL_BLOCK_METERS at 1", () => {
    expect(VOXEL_BLOCK_METERS).toBe(1);
  });

  it("classifies castle_eltz as map_chunk not prop", () => {
    const r = evaluateAssetRole({
      name: "castle_eltz.glb",
      fileBytes: 163_443_404,
      bounds: { x: 408.228, y: 350, z: 136 },
    });
    expect(r.role).toBe("map_chunk");
    expect(r.forbidPropHeightFit).toBe(true);
    // Already metre-scale → scale 1 (not height-fit to 3m)
    expect(r.scale).toBe(1);
    expect(r.footprintBlocks.w).toBeGreaterThan(50);
  });

  it("does not crush map with prop height fit", () => {
    const bounds = { x: 408, y: 350, z: 136 };
    const propScale = scalePropToHeight(bounds, 3);
    const mapScale = scaleMapToBlockGrid(bounds);
    expect(propScale).toBeLessThan(0.02); // the bug
    expect(mapScale).toBe(1);
  });

  it("scales centimetre maps to metres", () => {
    expect(scaleMapToBlockGrid({ x: 4000, y: 2000, z: 3000 })).toBeCloseTo(0.01);
  });

  it("scales Rascals pitch 0.008 to 1m blocks", () => {
    expect(
      scaleMapToBlockGrid({ x: 10, y: 5, z: 10 }, { sourceBlockPitch: 0.008 }),
    ).toBeCloseTo(125);
  });

  it("classifies torch as prop", () => {
    const r = evaluateAssetRole({
      name: "dying-torch.glb",
      fileBytes: 200_000,
      bounds: { x: 0.2, y: 1.2, z: 0.2 },
    });
    expect(r.role).toBe("prop");
    expect(r.forbidPropHeightFit).toBe(false);
  });

  it("scaleForMapChunkId castle_eltz is 1", () => {
    expect(scaleForMapChunkId("castle_eltz")).toBe(1);
  });

  it("scaleForMapChunkId rascals uses pitch", () => {
    expect(scaleForMapChunkId("rascals_retreat")).toBeCloseTo(125);
  });
});

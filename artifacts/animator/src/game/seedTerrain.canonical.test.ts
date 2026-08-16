import { describe, expect, it } from "vitest";
import {
  generateSeedTerrain,
  hashSeed,
  heightAtCell,
  isHubCell,
  seedTerrainToColumnBlocks,
  SEED_DEFAULT_HUB_RADIUS,
  surfaceHeight,
} from "@workspace/voxel-canonical";

describe("seedTerrain (canonical)", () => {
  it("is deterministic for the same seed", () => {
    const seed = hashSeed("explorer-town");
    const a = generateSeedTerrain({ seed, biome: "plains" });
    const b = generateSeedTerrain({ seed, biome: "plains" });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(a.types).toEqual(b.types);
    expect(a.width).toBeGreaterThan(32);
  });

  it("keeps the town hub flat and SI-scaled wilderness", () => {
    const field = generateSeedTerrain({
      seed: 1,
      biome: "mountains",
      hubRadius: SEED_DEFAULT_HUB_RADIUS,
      extraCenters: [{ x: 80, z: -40 }],
    });
    expect(isHubCell(0, 0, field.hubRadius)).toBe(true);
    expect(heightAtCell(field, 0, 0)).toBe(0);
    expect(heightAtCell(field, 40, 0)).toBeGreaterThan(0);
    expect(heightAtCell(field, 80, -40)).toBeGreaterThan(0);
    expect(surfaceHeight(50, 12, 99, "plains")).toBeLessThanOrEqual(22);
    expect(seedTerrainToColumnBlocks(field).every((b) => !isHubCell(b.x, b.z, field.hubRadius))).toBe(
      true,
    );
  });
});

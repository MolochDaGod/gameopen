import { describe, expect, it } from "vitest";
import {
  generateSeedTerrain,
  heightAtCell,
  isHubCell,
  seedTerrainToColumnBlocks,
  SEED_DEFAULT_HUB_RADIUS,
  surfaceHeight,
} from "./seedTerrain";
import { hashSeed } from "./seedWorld";

describe("seedTerrain", () => {
  it("is deterministic for the same seed", () => {
    const seed = hashSeed("explorer-town");
    const a = generateSeedTerrain({ seed, biome: "plains" });
    const b = generateSeedTerrain({ seed, biome: "plains" });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(a.types).toEqual(b.types);
    expect(a.width).toBeGreaterThan(32);
    expect(a.depth).toBeGreaterThan(32);
  });

  it("changes wilderness heights when the seed changes", () => {
    const a = generateSeedTerrain({ seed: hashSeed("alpha-42"), biome: "plains" });
    const b = generateSeedTerrain({ seed: hashSeed("beta-99"), biome: "plains" });
    const sample = (f: typeof a) =>
      [40, 42, 44].map((x) => heightAtCell(f, x, 0));
    expect(sample(a)).not.toEqual(sample(b));
  });

  it("keeps the starting-town hub flat so the lobby mesh sits at y=0", () => {
    const field = generateSeedTerrain({
      seed: 1,
      biome: "mountains",
      hubRadius: SEED_DEFAULT_HUB_RADIUS,
    });
    expect(isHubCell(0, 0, field.hubRadius)).toBe(true);
    expect(heightAtCell(field, 0, 0)).toBe(0);
    expect(heightAtCell(field, 10, 10)).toBe(0);
    expect(heightAtCell(field, 40, 0)).toBeGreaterThan(0);
  });

  it("covers portal patches and emits no hub column blocks", () => {
    const field = generateSeedTerrain({
      seed: 7,
      biome: "plains",
      extraCenters: [{ x: 80, z: -40 }],
    });
    expect(field.maxX).toBeGreaterThanOrEqual(80);
    expect(heightAtCell(field, 80, -40)).toBeGreaterThan(0);
    const blocks = seedTerrainToColumnBlocks(field);
    expect(blocks.every((b) => !isHubCell(b.x, b.z, field.hubRadius))).toBe(true);
    expect(blocks.length).toBeGreaterThan(100);
  });

  it("surfaceHeight stays in SI metres (not 100×)", () => {
    const h = surfaceHeight(50, 12, 99, "plains");
    expect(h).toBeGreaterThanOrEqual(1);
    expect(h).toBeLessThanOrEqual(22);
  });
});

import { describe, expect, it } from "vitest";
import {
  dungeonTemplateForTheme,
  generateShaderLabCave,
  hashSeed,
  SHADER_LAB_CAVE_TEMPLATE,
} from "@workspace/voxel-canonical";

describe("shaderLabCave (canonical)", () => {
  it("uses Shader.lab #voxel as the mine/cave dungeon", () => {
    expect(dungeonTemplateForTheme("mine")).toBe(SHADER_LAB_CAVE_TEMPLATE);
    expect(dungeonTemplateForTheme("cave")).toBe(SHADER_LAB_CAVE_TEMPLATE);
  });

  it("opens a wider room after the winding tunnel", () => {
    const field = generateShaderLabCave({ seed: hashSeed("cave-1") });
    expect(field.roomCenter.z).toBeGreaterThan(field.start.z + 20);
    expect(field.roomFloor.length).toBeGreaterThan(16);
    expect(field.blocks.some((b) => b.z >= field.length && b.type === "brickYellow")).toBe(true);
  });
});

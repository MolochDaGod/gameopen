import { describe, expect, it } from "vitest";
import {
  generateShaderLabCave,
  shaderLabMap,
  shaderLabPath,
  SHADER_LAB_CAVE_TEMPLATE,
} from "./shaderLabCave";
import { dungeonTemplateForTheme, hashSeed } from "./seedWorld";

describe("shaderLabCave", () => {
  it("maps mine/cave portals to the Shader.lab cave template", () => {
    expect(dungeonTemplateForTheme("mine")).toBe(SHADER_LAB_CAVE_TEMPLATE);
    expect(dungeonTemplateForTheme("cave")).toBe(SHADER_LAB_CAVE_TEMPLATE);
    expect(dungeonTemplateForTheme("crypt")).toBe("arena3");
  });

  it("is deterministic and keeps a winding tunnel", () => {
    const seed = hashSeed("explorer-town");
    const a = generateShaderLabCave({ seed });
    const b = generateShaderLabCave({ seed });
    expect(a.blocks).toEqual(b.blocks);
    expect(a.start.z).toBeLessThan(8);
    expect(a.roomCenter.z).toBe(a.length);
    expect(a.blocks.length).toBeGreaterThan(200);
  });

  it("opens a room at the end (more air than the tunnel mid)", () => {
    const field = generateShaderLabCave({ seed: 11, length: 40, roomRadius: 8 });
    const midAir = countAir(field.phase, 20, 40, 8);
    const roomAir = countAir(field.phase, field.length, 40, 8);
    expect(roomAir).toBeGreaterThan(midAir);
    expect(field.roomFloor.length).toBeGreaterThan(20);
    expect(shaderLabPath(0, 0).x).not.toBe(shaderLabPath(20, 0).x);
    expect(shaderLabMap(0, -4, 0)).toBeLessThanOrEqual(0);
  });
});

function countAir(phase: number, z: number, length: number, roomRadius: number): number {
  let n = 0;
  const p = shaderLabPath(z, phase);
  for (let x = Math.floor(p.x - 10); x <= Math.ceil(p.x + 10); x++) {
    for (let y = -2; y <= 6; y++) {
      if (shaderLabMap(x, y, z, { phase, length, roomRadius }) >= 0) n += 1;
    }
  }
  return n;
}

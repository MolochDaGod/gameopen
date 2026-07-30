import { describe, expect, it } from "vitest";
import { classifyIslandMesh } from "./islandMapLayers";

describe("islandMapLayers classify", () => {
  it("shipwreck roles", () => {
    expect(classifyIslandMesh("World", ["Sprytile_tilemap"], "shipwreck")).toBe("ground");
    expect(classifyIslandMesh("Water", [], "shipwreck")).toBe("swim");
    expect(classifyIslandMesh("Ladders", [], "shipwreck")).toBe("climb");
    expect(classifyIslandMesh("Palmtree_Straight", [], "shipwreck")).toBe("harvest");
    expect(classifyIslandMesh("Rock", [], "shipwreck")).toBe("harvest");
    expect(classifyIslandMesh("Ship", [], "shipwreck")).toBe("vehicle");
    expect(classifyIslandMesh("Lighthouse.001", [], "shipwreck")).toBe("solid");
  });

  it("arena: Tore chains are prop not harvest; Rock is harvest", () => {
    expect(classifyIslandMesh("Tore007_Metal_0", ["Metal"], "arena")).toBe("prop");
    expect(classifyIslandMesh("Chaine003", [], "arena")).toBe("prop");
    expect(classifyIslandMesh("Sphère044_Rock_0", ["Rock"], "arena")).toBe("harvest");
    expect(classifyIslandMesh("Arène_base_Sand_0", ["Sand"], "arena")).toBe("ground");
    expect(classifyIslandMesh("Escalier bois", [], "arena")).toBe("climb");
  });
});

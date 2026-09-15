import { describe, expect, it } from "vitest";
import {
  VOXEL_TOOLS_PACK,
  VOXEL_TOOL_MESH,
  voxelMeshForActivity,
  voxelMeshForHarvestId,
} from "./voxelTools";

describe("voxel harvest tools (toolsvoxel.glb)", () => {
  it("points at the Desktop pack path", () => {
    expect(VOXEL_TOOLS_PACK).toBe("models/tools/voxel/toolsvoxel.glb");
  });

  it("maps activity ids onto isolate roots", () => {
    expect(voxelMeshForActivity("pick")?.isolate).toBe("Pickaxe");
    expect(voxelMeshForActivity("tool_pickaxe")?.isolate).toBe("Pickaxe");
    expect(voxelMeshForActivity("fishingPole")?.isolate).toBe("FishingRod_Lvl2");
    expect(voxelMeshForActivity("rod")?.isolate).toBe("FishingRod_Lvl2");
    expect(voxelMeshForActivity("buildHammer")?.isolate).toBe("Hammer_Circle027");
    expect(voxelMeshForActivity("knife")?.socket).toBe("R");
    expect(voxelMeshForActivity("bucket")?.socket).toBe("L");
  });

  it("has no voxel mesh for hoe / hatchet (Toon kit / jade fallback)", () => {
    expect(voxelMeshForHarvestId("hoe")).toBeNull();
    expect(voxelMeshForHarvestId("hatchet")).toBeNull();
    expect(voxelMeshForHarvestId("pick")?.isolate).toBe("Pickaxe");
  });

  it("fits each isolate to SI hand length", () => {
    for (const spec of Object.values(VOXEL_TOOL_MESH)) {
      expect(spec.lengthM).toBeGreaterThan(0.1);
      expect(spec.lengthM).toBeLessThan(2);
    }
  });
});

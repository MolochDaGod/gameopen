import { describe, expect, it } from "vitest";
import {
  HARVEST_TOOL_ORDER,
  getHarvestTool,
  harvestToolList,
  resolveHarvestClip,
} from "./harvestTools";

describe("harvest tool kits", () => {
  it("lists 8 tools covering wood stone knife farm earth fish build", () => {
    expect(HARVEST_TOOL_ORDER).toEqual([
      "hatchet",
      "pick",
      "knife",
      "bucket",
      "hoe",
      "shovel",
      "fishingPole",
      "buildHammer",
    ]);
    expect(harvestToolList()).toHaveLength(8);
  });

  it("gives each tool a primary + 4 skills", () => {
    for (const id of HARVEST_TOOL_ORDER) {
      const t = getHarvestTool(id);
      expect(t.skills).toHaveLength(4);
      expect(t.primary.label.length).toBeGreaterThan(0);
      expect(t.domain.length).toBeGreaterThan(0);
    }
  });

  it("resolves farming + work clip aliases", () => {
    expect(resolveHarvestClip("water")).toBe("water");
    expect(resolveHarvestClip("startSwing")).toContain("start-swinging");
    expect(resolveHarvestClip("pushing")).toContain("pushing");
  });
});

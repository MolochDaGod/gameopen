import { describe, expect, it } from "vitest";
import {
  FLEET_GENERATED_CATALOG_CDN,
  findAssetByName,
  outdoorGeneratedProps,
  type FleetCatalog,
} from "./generatedFleetCatalog";

describe("generatedFleetCatalog", () => {
  it("CDN catalog URL is production R2 path", () => {
    expect(FLEET_GENERATED_CATALOG_CDN).toContain("assets.grudge-studio.com");
    expect(FLEET_GENERATED_CATALOG_CDN).toContain("three-generator");
  });

  it("findAssetByName matches exact and partial", () => {
    const catalog: FleetCatalog = {
      version: 1,
      updatedAt: "",
      source: "test",
      cdnRoot: "https://assets.grudge-studio.com",
      assets: [
        {
          id: "1",
          name: "horse",
          meshUrl: "https://assets.grudge-studio.com/models/props/generated/horse.glb",
          kind: "prop",
          tags: ["three-generator"],
          heightM: 1.6,
        },
      ],
    };
    expect(findAssetByName(catalog, "horse")?.id).toBe("1");
    expect(findAssetByName(catalog, "HOR")?.name).toBe("horse");
    expect(findAssetByName(catalog, "missing")).toBeNull();
    expect(outdoorGeneratedProps(catalog)).toHaveLength(1);
  });
});

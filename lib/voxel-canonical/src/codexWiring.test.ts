import { describe, expect, it } from "vitest";
import {
  buildableToSceneProp,
  isAllowedVoxelWeaponType,
  isForbiddenVoxelWeaponType,
  isPlaceableId,
  resolveBuildingProp,
  resolvePlaceType,
  type CodexBridge,
} from "./codexWiring";

const bridge: CodexBridge = {
  version: "1.0.0",
  terrainPlacePalette: ["stone", "grass", "woodPlanks"],
  terrainAliases: { grass_block: "grass", oak_planks: "woodPlanks" },
  materialToCell: {
    "iron-ore": { placeType: "coal", dropItem: "iron-ore" },
  },
  itemIdSpace: {
    stone: { family: "block_terrain", placeType: "stone" },
    sword_iron: { family: "weapon", placeType: null },
  },
  buildingsToStations: [
    {
      name: "Miner's Forge",
      voxelProp: "stations/workbench_advanced",
      modelKey: "workbench",
      aliases: ["workbench"],
      bench: true,
    },
  ],
};

describe("codexWiring", () => {
  it("maps aliases and materials to cell ids", () => {
    expect(resolvePlaceType("grass_block", bridge)).toBe("grass");
    expect(resolvePlaceType("iron-ore", bridge)).toBe("coal");
    expect(resolvePlaceType("cat:alloy-frame", bridge)).toBe("cat:alloy-frame");
    expect(resolvePlaceType("stone", bridge)).toBe("stone");
  });

  it("knows placeable vs held-only ids", () => {
    expect(isPlaceableId("stone", bridge)).toBe(true);
    expect(isPlaceableId("cat:alloy-frame", bridge)).toBe(true);
    expect(isPlaceableId("sword_iron", bridge)).toBe(false);
  });

  it("blocks Warlords class kits on voxel prefabs", () => {
    expect(isForbiddenVoxelWeaponType("WAND")).toBe(true);
    expect(isAllowedVoxelWeaponType("SWORD")).toBe(true);
    expect(isAllowedVoxelWeaponType("WAND")).toBe(false);
  });

  it("resolves buildings to shipped station props", () => {
    expect(resolveBuildingProp("workbench", bridge)?.voxelProp).toBe(
      "stations/workbench_advanced",
    );
  });

  it("emits scene props for multi-cell buildables", () => {
    const prop = buildableToSceneProp(
      { id: "fortress/armoury", kind: "armoury", occupy: "ground", wx: 6, wz: 6, heightM: 6 },
      { x: 4, y: 1, z: 2 },
    );
    expect(prop.model).toBe("fortress/armoury");
    expect(prop.footprint.wx).toBe(6);
    expect(prop.y).toBe(1);
  });
});

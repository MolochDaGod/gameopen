import { describe, expect, it } from "vitest";
import {
  classifyForestMeshGeometry,
  FOREST_MOUNTAIN_DEFS,
} from "./forestMountainsMap";
import { definitionId, locationIdForCell, uuidFromSeed } from "../harvest/harvestIds";
import * as THREE from "three";

describe("forest mountains geometry classify", () => {
  it("detects terrain as large flat footprint", () => {
    const size = new THREE.Vector3(80, 8, 70);
    const footprint = 80 * 70;
    const aspect = 8 / 80;
    expect(classifyForestMeshGeometry(size, footprint, aspect)).toBe("ground");
  });

  it("detects tall thin as wood", () => {
    const size = new THREE.Vector3(1.2, 6, 1.1);
    const footprint = 1.2 * 1.1;
    const aspect = 6 / 1.2;
    expect(classifyForestMeshGeometry(size, footprint, aspect)).toBe("wood");
  });

  it("detects squat rock as ore", () => {
    const size = new THREE.Vector3(2, 1.2, 1.8);
    const footprint = 2 * 1.8;
    const aspect = 1.2 / 2;
    expect(classifyForestMeshGeometry(size, footprint, aspect)).toBe("ore");
  });

  it("detects small low as forage", () => {
    const size = new THREE.Vector3(0.8, 0.4, 0.7);
    const footprint = 0.8 * 0.7;
    const aspect = 0.4 / 0.8;
    expect(classifyForestMeshGeometry(size, footprint, aspect)).toBe("forage");
  });
});

describe("harvest UUIDs", () => {
  it("stable location ids for same cell", () => {
    const a = locationIdForCell("seed1", 10.2, 0, -3.8, "fm_pine_tree");
    const b = locationIdForCell("seed1", 10.9, 0.1, -3.1, "fm_pine_tree");
    expect(a).toBe(b);
    expect(a.startsWith("hrvl_")).toBe(true);
  });

  it("defs use hrvd_ prefix", () => {
    for (const d of FOREST_MOUNTAIN_DEFS) {
      expect(d.defId.startsWith("hrvd_")).toBe(true);
    }
    expect(definitionId("test_slug")).toBe("hrvd_test_slug");
    expect(definitionId("Test Slug!")).toBe("hrvd_test-slug");
  });

  it("uuidFromSeed is deterministic", () => {
    expect(uuidFromSeed("abc")).toBe(uuidFromSeed("abc"));
  });
});

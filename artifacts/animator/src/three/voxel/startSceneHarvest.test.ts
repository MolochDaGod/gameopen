import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  classifyStartMeshGeometry,
  classifyStartMeshName,
  tagStartSceneHarvest,
} from "./startSceneHarvest";

describe("start scene harvest classify", () => {
  it("names sticks and stones from mesh tokens", () => {
    expect(classifyStartMeshName("Twig_01")).toBe("stick");
    expect(classifyStartMeshName("PebbleRock")).toBe("stone");
    expect(classifyStartMeshName("Terrain_Ground")).toBe("terrain");
    expect(classifyStartMeshName("House_Wall")).toBe("skip");
  });

  it("geometry: tall tree is wood, small squat is stone, twig is stick", () => {
    expect(classifyStartMeshGeometry(new THREE.Vector3(1.2, 6, 1.1))).toBe("wood");
    expect(classifyStartMeshGeometry(new THREE.Vector3(0.3, 0.9, 0.25))).toBe("stick");
    expect(classifyStartMeshGeometry(new THREE.Vector3(0.5, 0.4, 0.45))).toBe("stone");
    expect(classifyStartMeshGeometry(new THREE.Vector3(80, 4, 70))).toBe("terrain");
  });

  it("scatters starter sticks and stones when the scene has no debris", () => {
    const root = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 40));
    slab.name = "hub_floor";
    root.add(slab);
    const r = tagStartSceneHarvest(root, { seed: "explorer-town", hubRadius: 8, scatterMin: 10 });
    expect(r.scattered).toBe(14);
    expect(r.nodes.filter((n) => n.kind === "stick")).toHaveLength(8);
    expect(r.nodes.filter((n) => n.kind === "stone")).toHaveLength(6);
    expect(r.nodes.every((n) => n.mesh.userData.harvestable)).toBe(true);
  });
});

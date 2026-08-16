import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  classifyStartMeshGeometry,
  classifyStartMeshName,
  tagStartSceneHarvest,
} from "./startSceneHarvest";

describe("start scene harvest classify", () => {
  it("names sticks, stones, trees, and rocks from mesh tokens", () => {
    expect(classifyStartMeshName("Twig_01")).toBe("stick");
    expect(classifyStartMeshName("PebbleRock")).toBe("stone");
    expect(classifyStartMeshName("Pine_01")).toBe("wood");
    expect(classifyStartMeshName("Oak_Tree")).toBe("wood");
    expect(classifyStartMeshName("Boulder_02", ["Rock"])).toBe("ore");
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

  it("layers named trees and rocks as harvest with wood/ore script", () => {
    const root = new THREE.Group();
    const tree = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 5, 6));
    tree.name = "Pine_Tree";
    const rock = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.1));
    rock.name = "Boulder_01";
    rock.material = new THREE.MeshStandardMaterial({ name: "Rock" });
    root.add(tree, rock);
    const r = tagStartSceneHarvest(root, { seed: "t", hubRadius: 2, scatterMin: 0 });
    expect(r.trees).toBe(1);
    expect(r.rocks).toBe(1);
    expect(tree.userData.harvest.tool).toBe("axe");
    expect(rock.userData.harvest.tool).toBe("pick");
    expect(tree.userData.gameLayer).toBe("harvest");
    expect(rock.userData.islandRole).toBe("harvest");
  });
});

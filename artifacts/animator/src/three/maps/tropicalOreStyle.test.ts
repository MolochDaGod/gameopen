import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  TROPICAL_ORE_VEINS,
  buildGeometricOreChunk,
  extractRockTextureKit,
  styleTropicalIslandMaterials,
  tagIslandRocksAsOre,
} from "./tropicalOreStyle";
import { classifyTropicalMesh } from "./tropicalIslandHarvest";

describe("tropical ore style", () => {
  it("classifies rocks as ore harvest with materialId", () => {
    const big = classifyTropicalMesh("RocksBig", "Aset_rock_assembly");
    expect(big.role).toBe("harvest");
    expect(big.harvest?.kind).toBe("ore");
    expect(big.harvest?.tool).toBe("pick");
    expect(big.harvest?.materialId).toBeTruthy();
  });

  it("builds geometric ore chunk with harvest tags", () => {
    const kit = {
      rocksBig: null,
      rocksSmall: null,
      beach: null,
      palm: null,
    };
    const vein = TROPICAL_ORE_VEINS.find((v) => v.id === "copper-ore")!;
    const chunk = buildGeometricOreChunk(kit, vein, { seed: 1, targetHeightM: 1.2 });
    expect(chunk.userData.geometricOre).toBe(true);
    expect(chunk.userData.harvest.kind).toBe("ore");
    expect(chunk.userData.harvest.tool).toBe("pick");
    expect(chunk.userData.harvestMaterialId).toBe("copper-ore");
    expect(chunk.children.length).toBeGreaterThan(2);
  });

  it("tags rock meshes as ore veins", () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: "RocksSmall", color: 0x888888 }),
    );
    mesh.name = "RocksSmall_47";
    root.add(mesh);
    const n = tagIslandRocksAsOre(root, () => 0.1);
    expect(n).toBe(1);
    expect(mesh.userData.harvest.kind).toBe("ore");
    expect(mesh.userData.harvestMaterialId).toBeTruthy();
  });

  it("styles beach material roughness", () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ name: "BeachBaked", color: 0xffffff });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.name = "Beach";
    root.add(mesh);
    styleTropicalIslandMaterials(root);
    expect(mat.roughness).toBeGreaterThan(0.8);
  });

  it("extracts rock textures when present", () => {
    const tex = new THREE.Texture();
    tex.image = { width: 4, height: 4 };
    const mat = new THREE.MeshStandardMaterial({ name: "RocksBig", map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    const root = new THREE.Group();
    root.add(mesh);
    const kit = extractRockTextureKit(root);
    expect(kit.rocksBig).toBeTruthy();
  });
});

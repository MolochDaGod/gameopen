import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  centerXZOnPelvis,
  deployCharacterModel,
  findPelvisBone,
  groundFeetLocal,
  validateCharacterDeploy,
} from "./characterDeploy";
import { bodyBox } from "./fitCharacterHeight";

/**
 * Toy hero: Mesh (not incomplete SkinnedMesh) + Bip001 Pelvis bone.
 * Production kits are real SkinnedMeshes with skinIndex/weights.
 */
function makeBip001Hero(opts?: { height?: number; offsetY?: number; offsetX?: number }) {
  const h = opts?.height ?? 1.8;
  const root = new THREE.Group();
  root.userData.importPipeline = "glb-baked";
  root.userData.grudgeHeightFit = true;

  const pelvis = new THREE.Bone();
  pelvis.name = "Bip001 Pelvis";
  pelvis.position.set(opts?.offsetX ?? 0.2, h * 0.5, 0);
  root.add(pelvis);

  // BoxGeometry is centered at origin — translate so feet are at offsetY
  const geo = new THREE.BoxGeometry(0.5, h, 0.3);
  geo.translate(opts?.offsetX ?? 0.2, h / 2 + (opts?.offsetY ?? 0), 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.name = "Body";
  // bodyBox prefers SkinnedMesh; for tests also mark userData so we can expand via setFromObject fallback
  root.add(mesh);

  // Attach a properly-bound skinned proxy so bodyBox path is exercised when possible
  const skGeo = new THREE.BoxGeometry(0.5, h, 0.3);
  skGeo.translate(opts?.offsetX ?? 0.2, h / 2 + (opts?.offsetY ?? 0), 0);
  // Add trivial skin attributes so Three r184+ computeBoundingBox works
  const count = skGeo.attributes.position.count;
  const skinIndex = new THREE.BufferAttribute(new Uint16Array(count * 4), 4);
  const skinWeight = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
  for (let i = 0; i < count; i++) {
    skinWeight.setXYZW(i, 1, 0, 0, 0);
  }
  skGeo.setAttribute("skinIndex", skinIndex);
  skGeo.setAttribute("skinWeight", skinWeight);
  const sk = new THREE.SkinnedMesh(skGeo, new THREE.MeshStandardMaterial());
  sk.name = "BodySkin";
  const skPelvis = new THREE.Bone();
  skPelvis.name = "Bip001 Pelvis";
  sk.add(skPelvis);
  sk.bind(new THREE.Skeleton([skPelvis]));
  root.add(sk);

  root.updateMatrixWorld(true);
  return { root, pelvis, mesh };
}

describe("characterDeploy (Y-up / XZ ground)", () => {
  it("findPelvisBone prefers Bip001 Pelvis", () => {
    const { root, pelvis } = makeBip001Hero();
    const hips = new THREE.Bone();
    hips.name = "mixamorigHips";
    root.add(hips);
    expect(findPelvisBone(root)?.name).toBe(pelvis.name);
  });

  it("groundFeetLocal sits soles on y=0", () => {
    const { root } = makeBip001Hero({ offsetY: 0.4 });
    groundFeetLocal(root, 0);
    const box = bodyBox(root);
    expect(Math.abs(box.min.y)).toBeLessThan(0.08);
  });

  it("centerXZOnPelvis moves pelvis toward origin XZ", () => {
    const { root, pelvis } = makeBip001Hero({ offsetX: 1.5 });
    const before = new THREE.Vector3();
    pelvis.getWorldPosition(before);
    expect(Math.abs(before.x)).toBeGreaterThan(0.5);
    centerXZOnPelvis(root);
    const after = new THREE.Vector3();
    pelvis.getWorldPosition(after);
    expect(Math.abs(after.x)).toBeLessThan(Math.abs(before.x) + 0.01);
  });

  it("deployCharacterModel marks userData and grounds", () => {
    const { root } = makeBip001Hero({ offsetY: 0.25 });
    const r = deployCharacterModel(root, { facePlusZ: false, refitIfAbsurd: false });
    expect(root.userData.characterDeployed).toBe(true);
    expect(typeof r.heightM).toBe("number");
    expect(r.pelvis?.name).toMatch(/Pelvis/i);
    const box = bodyBox(root);
    expect(Math.abs(box.min.y)).toBeLessThan(0.1);
  });

  it("validateCharacterDeploy reports height issues on tiny models", () => {
    const root = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const count = geo.attributes.position.count;
    const skinIndex = new THREE.BufferAttribute(new Uint16Array(count * 4), 4);
    const skinWeight = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
    for (let i = 0; i < count; i++) skinWeight.setXYZW(i, 1, 0, 0, 0);
    geo.setAttribute("skinIndex", skinIndex);
    geo.setAttribute("skinWeight", skinWeight);
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
    const bone = new THREE.Bone();
    bone.name = "Bip001 Pelvis";
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    root.add(mesh);
    const v = validateCharacterDeploy(root);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.includes("height"))).toBe(true);
  });
});

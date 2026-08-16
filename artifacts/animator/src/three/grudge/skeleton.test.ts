import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { boneTreeRoot, unifySkeletons } from "./skeleton";
import { countVisibleSkeletonRoots, validateCharacterDeploy } from "../characterDeploy";

function makeBipTree(suffix = "") {
  const bip = new THREE.Bone();
  bip.name = "Bip001";
  const hip = new THREE.Bone();
  hip.name = "Bip001 Pelvis";
  const head = new THREE.Bone();
  head.name = "Bip001 Head";
  const hand = new THREE.Bone();
  hand.name = "Bip001 R Hand";
  bip.add(hip);
  hip.add(head);
  hip.add(hand);
  if (suffix) {
    bip.userData.tree = suffix;
  }
  return { bip, hip, head, hand };
}

function bindSkin(root: THREE.Object3D, bones: THREE.Bone[], name: string) {
  const geo = new THREE.BoxGeometry(0.3, 1.8, 0.3);
  const count = geo.attributes.position.count;
  const skinIndex = new THREE.BufferAttribute(new Uint16Array(count * 4), 4);
  const skinWeight = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
  for (let v = 0; v < count; v++) skinWeight.setXYZW(v, 1, 0, 0, 0);
  geo.setAttribute("skinIndex", skinIndex);
  geo.setAttribute("skinWeight", skinWeight);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.bind(new THREE.Skeleton(bones));
  root.add(mesh);
  return mesh;
}

function countBip001(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone && o.name === "Bip001") n++;
  });
  return n;
}

describe("unifySkeletons Toon RTS multi-tree", () => {
  it("collapses duplicate Bip001 trees onto the widest armature and prunes extras", () => {
    const root = new THREE.Group();
    const body = makeBipTree("body");
    const helm = makeBipTree("helm");
    root.add(body.bip);
    root.add(helm.bip);
    bindSkin(root, [body.bip, body.hip], "WK_Units_Body_C");
    bindSkin(root, [helm.head], "WK_Units_head_D");

    expect(countBip001(root)).toBe(2);
    const skel = unifySkeletons(root);
    expect(skel).toBeTruthy();
    expect(countBip001(root)).toBe(1);
    expect(root.userData.skeletonUnified).toBe(true);
    expect(root.userData.prunedBoneTrees).toBe(1);

    const bodyMesh = root.getObjectByName("WK_Units_Body_C") as THREE.SkinnedMesh;
    const headMesh = root.getObjectByName("WK_Units_head_D") as THREE.SkinnedMesh;
    const keepHip = bodyMesh.skeleton.bones.find((b) => b.name === "Bip001 Pelvis")!;
    const headBone = headMesh.skeleton.bones[0];
    expect(boneTreeRoot(keepHip)).toBe(boneTreeRoot(headBone));
    expect(countVisibleSkeletonRoots(root)).toBe(1);
    expect(validateCharacterDeploy(root).issues.some((i) => i.includes("multiple skeletons"))).toBe(
      false,
    );
  });

  it("keeps a single Bip001 tree unchanged", () => {
    const root = new THREE.Group();
    const t = makeBipTree();
    root.add(t.bip);
    bindSkin(root, [t.bip, t.hip, t.head], "body");
    unifySkeletons(root);
    expect(countBip001(root)).toBe(1);
    expect(root.userData.prunedBoneTrees).toBe(0);
  });
});

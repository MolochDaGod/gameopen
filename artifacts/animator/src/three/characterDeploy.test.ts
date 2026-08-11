import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  centerXZOnPelvis,
  deployCharacterModel,
  findPelvisBone,
  findDeployModel,
  groundFeetLocal,
  ensureHumanScale,
  validateCharacterDeploy,
  liftForClipFootClearance,
} from "./characterDeploy";
import { bodyBox } from "./fitCharacterHeight";
import { stripPositionTracks, stripScaleTracks, stabilizeClipForMixer } from "./clipTracks";

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

  it("ensureHumanScale re-grounds the marked deploy model not the holder", () => {
    const avatar = new THREE.Group();
    const holder = new THREE.Group();
    avatar.add(holder);
    const { root: model } = makeBip001Hero({ offsetY: 0.35 });
    model.userData.characterDeployed = true;
    model.userData.grudgeHeightFit = true;
    holder.add(model);
    groundFeetLocal(model, 0);
    const beforeHolderY = holder.position.y;
    ensureHumanScale(avatar, 1.8);
    // Holder must not absorb the ground offset (old bug: feet under floor)
    expect(Math.abs(holder.position.y - beforeHolderY)).toBeLessThan(0.05);
    const box = bodyBox(model);
    expect(Math.abs(box.min.y)).toBeLessThan(0.12);
    expect(findDeployModel(avatar)).toBe(model);
  });
});

describe("liftForClipFootClearance", () => {
  it("raises model when soles sit under groundY", () => {
    const { root } = makeBip001Hero();
    groundFeetLocal(root, 0);
    root.position.y -= 0.22;
    const clip = new THREE.AnimationClip("walk", 0.5, [
      new THREE.QuaternionKeyframeTrack(
        "Bip001 Pelvis.quaternion",
        [0, 0.5],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ),
    ]);
    const dy = liftForClipFootClearance(root, clip, { groundY: 0, samples: 4 });
    expect(dy).toBeGreaterThan(0.1);
    const box = bodyBox(root);
    expect(box.min.y).toBeGreaterThan(-0.05);
  });

  it("no-ops when already planted", () => {
    const { root } = makeBip001Hero();
    groundFeetLocal(root, 0);
    const clip = new THREE.AnimationClip("walk", 0.5, [
      new THREE.QuaternionKeyframeTrack(
        "Bip001 Pelvis.quaternion",
        [0, 0.5],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ),
    ]);
    const dy = liftForClipFootClearance(root, clip, { groundY: 0, samples: 3 });
    expect(dy).toBe(0);
  });
});

describe("stripPositionTracks", () => {
  it("drops limb and hip position tracks by default", () => {
    const clip = new THREE.AnimationClip("idle", 1, [
      new THREE.QuaternionKeyframeTrack("Bip001 Pelvis.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new THREE.VectorKeyframeTrack("Bip001 Pelvis.position", [0, 1], [0, 0.9, 0, 0, 0.85, 0]),
      new THREE.VectorKeyframeTrack("Bip001 L Foot.position", [0, 1], [0, 0, 0, 0, -0.1, 0]),
      new THREE.QuaternionKeyframeTrack("Bip001 L Foot.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    const out = stripPositionTracks(clip);
    expect(out.tracks.every((t) => t.name.endsWith(".quaternion"))).toBe(true);
    expect(out.tracks.length).toBe(2);
  });

  it("can keep pelvis position only", () => {
    const clip = new THREE.AnimationClip("idle", 1, [
      new THREE.VectorKeyframeTrack("Bip001 Pelvis.position", [0, 1], [0, 0.9, 0, 0, 0.9, 0]),
      new THREE.VectorKeyframeTrack("Bip001 L Foot.position", [0, 1], [0, 0, 0, 0, 0, 0]),
      new THREE.QuaternionKeyframeTrack("Bip001 Pelvis.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    const out = stripPositionTracks(clip, { keepRootPosition: true });
    expect(out.tracks.some((t) => t.name === "Bip001 Pelvis.position")).toBe(true);
    expect(out.tracks.some((t) => t.name.includes("Foot.position"))).toBe(false);
  });

  it("stripScaleTracks drops scale keys that squash limbs", () => {
    const clip = new THREE.AnimationClip("idle", 1, [
      new THREE.VectorKeyframeTrack("mixamorigHips.scale", [0, 1], [1, 1, 1, 2, 2, 2]),
      new THREE.QuaternionKeyframeTrack("mixamorigHips.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);
    const out = stripScaleTracks(clip);
    expect(out.tracks.some((t) => t.name.includes(".scale"))).toBe(false);
    expect(out.tracks.length).toBe(1);
  });

  it("stabilizeClipForMixer keeps hip bob, drops foot position", () => {
    const root = new THREE.Object3D();
    const hips = new THREE.Bone();
    hips.name = "mixamorigHips";
    root.add(hips);
    const foot = new THREE.Bone();
    foot.name = "mixamorigLeftFoot";
    root.add(foot);
    const clip = new THREE.AnimationClip("idle", 1, [
      new THREE.VectorKeyframeTrack("mixamorigHips.position", [0, 1], [5, 1, 5, 5, 1.05, 5]),
      new THREE.VectorKeyframeTrack("mixamorigLeftFoot.position", [0, 1], [0, 0, 0, 0, -0.2, 0]),
      new THREE.QuaternionKeyframeTrack("mixamorigHips.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new THREE.VectorKeyframeTrack("mixamorigHips.scale", [0, 1], [1, 1, 1, 1, 1, 1]),
    ]);
    const out = stabilizeClipForMixer(clip, {
      root,
      bindHip: { x: 0, y: 1, z: 0 },
      keepRootPosition: true,
      lockHorizontalRoot: (c, b) => {
        for (const t of c.tracks) {
          if (!t.name.endsWith(".position")) continue;
          for (let i = 0; i < t.values.length; i += 3) {
            t.values[i] = b.x;
            t.values[i + 2] = b.z;
          }
        }
      },
    });
    expect(out.tracks.some((t) => t.name.includes("Foot.position"))).toBe(false);
    expect(out.tracks.some((t) => t.name.includes(".scale"))).toBe(false);
    const hipPos = out.tracks.find((t) => t.name === "mixamorigHips.position");
    expect(hipPos).toBeTruthy();
    // X/Z locked to bind (0), Y bob kept relative
    expect(hipPos!.values[0]).toBe(0);
    expect(hipPos!.values[2]).toBe(0);
  });
});

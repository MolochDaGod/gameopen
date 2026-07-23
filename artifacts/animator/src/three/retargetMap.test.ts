import { describe, it, expect } from "vitest";
import {
  CANONICAL_SUFFIXES,
  canonicalSuffix,
  buildRetargetNameMap,
  sourceBoneName,
  SOURCE_HIP,
} from "./retargetMap";

/**
 * Racalvin's real 24-joint skin (parsed straight from `public/models/racalvin.glb`).
 * 22 canonical bones plus the two un-mappable head leaves.
 */
const RACALVIN_JOINTS = [
  "Hips",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
  "Spine02",
  "Spine01",
  "Spine",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "neck",
  "Head",
  "head_end",
  "headfront",
];

describe("canonicalSuffix", () => {
  it("passes clean Mixamo suffixes straight through", () => {
    expect(canonicalSuffix("Hips")).toBe("Hips");
    expect(canonicalSuffix("LeftToeBase")).toBe("LeftToeBase");
    expect(canonicalSuffix("RightForeArm")).toBe("RightForeArm");
  });

  it("folds the spine/neck spelling variants", () => {
    expect(canonicalSuffix("Spine")).toBe("Spine");
    expect(canonicalSuffix("Spine01")).toBe("Spine1");
    expect(canonicalSuffix("Spine02")).toBe("Spine2");
    expect(canonicalSuffix("Spine11")).toBe("Spine1");
    expect(canonicalSuffix("Spine21")).toBe("Spine2");
    expect(canonicalSuffix("neck")).toBe("Neck");
    expect(canonicalSuffix("Neck2")).toBe("Neck");
    expect(canonicalSuffix("Head1")).toBe("Head");
    expect(canonicalSuffix("Hips1")).toBe("Hips");
  });

  it("strips a mixamorig prefix (colon or not)", () => {
    expect(canonicalSuffix("mixamorigHips")).toBe("Hips");
    expect(canonicalSuffix("mixamorig:LeftHand")).toBe("LeftHand");
  });

  it("returns null for leaf / container bones with no library role", () => {
    expect(canonicalSuffix("head_end")).toBeNull();
    expect(canonicalSuffix("headfront")).toBeNull();
    expect(canonicalSuffix("Armature")).toBeNull();
    expect(canonicalSuffix("HeadTop_End")).toBeNull();
    expect(canonicalSuffix("Root")).toBeNull();
    expect(canonicalSuffix("R_hand_container")).toBeNull();
    expect(canonicalSuffix("L_shield_container")).toBeNull();
  });

  it("maps grudge6 Bip001 bones (spaces or underscores) onto Mixamo suffixes", () => {
    expect(canonicalSuffix("Bip001 Pelvis")).toBe("Hips");
    expect(canonicalSuffix("Bip001_Pelvis")).toBe("Hips");
    expect(canonicalSuffix("Bip001 Spine")).toBe("Spine");
    expect(canonicalSuffix("Bip001 Spine1")).toBe("Spine1");
    expect(canonicalSuffix("Bip001 Spine2")).toBe("Spine2");
    expect(canonicalSuffix("Bip001 Neck")).toBe("Neck");
    expect(canonicalSuffix("Bip001 Head")).toBe("Head");
    // Hands — critical for weapon skill clips
    expect(canonicalSuffix("Bip001 R Hand")).toBe("RightHand");
    expect(canonicalSuffix("Bip001_R_Hand")).toBe("RightHand");
    expect(canonicalSuffix("Bip001 L Hand")).toBe("LeftHand");
    expect(canonicalSuffix("Bip001_L_Hand")).toBe("LeftHand");
    // Arms / legs
    expect(canonicalSuffix("Bip001 R UpperArm")).toBe("RightArm");
    expect(canonicalSuffix("Bip001_R_UpperArm")).toBe("RightArm");
    expect(canonicalSuffix("Bip001 L Forearm")).toBe("LeftForeArm");
    expect(canonicalSuffix("Bip001 R Thigh")).toBe("RightUpLeg");
    expect(canonicalSuffix("Bip001 L Calf")).toBe("LeftLeg");
    expect(canonicalSuffix("Bip001 R Foot")).toBe("RightFoot");
    expect(canonicalSuffix("Bip001 L Toe0")).toBe("LeftToeBase");
  });
});

const GRUDGE6_BIP001_JOINTS = [
  "Bip001",
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Spine1",
  "Bip001 Spine2",
  "Bip001 Neck",
  "Bip001 Head",
  "Bip001 L Clavicle",
  "Bip001 L UpperArm",
  "Bip001 L Forearm",
  "Bip001 L Hand",
  "Bip001 R Clavicle",
  "Bip001 R UpperArm",
  "Bip001 R Forearm",
  "Bip001 R Hand",
  "Bip001 L Thigh",
  "Bip001 L Calf",
  "Bip001 L Foot",
  "Bip001 L Toe0",
  "Bip001 R Thigh",
  "Bip001 R Calf",
  "Bip001 R Foot",
  "Bip001 R Toe0",
  "R_hand_container",
  "L_hand_container",
];

describe("buildRetargetNameMap", () => {
  it("maps grudge6 Bip001 hands + body to mixamorig sources (containers skipped)", () => {
    const map = buildRetargetNameMap(GRUDGE6_BIP001_JOINTS);
    expect(map.hip).toBe(SOURCE_HIP);
    expect(map.names["Bip001 Pelvis"] || map.names["Bip001"]).toBeDefined();
    expect(map.names["Bip001 R Hand"]).toBe("mixamorigRightHand");
    expect(map.names["Bip001 L Hand"]).toBe("mixamorigLeftHand");
    expect(map.names["Bip001 R UpperArm"]).toBe("mixamorigRightArm");
    expect(map.names["R_hand_container"]).toBeUndefined();
    expect(map.matched).toContain("RightHand");
    expect(map.matched).toContain("LeftHand");
    expect(map.matched.length).toBeGreaterThanOrEqual(18);
  });

  it("maps every canonical bone of the Racalvin rig to its mixamorig source", () => {
    const map = buildRetargetNameMap(RACALVIN_JOINTS);
    expect(map.hip).toBe(SOURCE_HIP);
    expect(map.names["Hips"]).toBe("mixamorigHips");
    expect(map.names["Spine"]).toBe("mixamorigSpine");
    expect(map.names["Spine01"]).toBe("mixamorigSpine1");
    expect(map.names["Spine02"]).toBe("mixamorigSpine2");
    expect(map.names["neck"]).toBe("mixamorigNeck");
    expect(map.names["Head"]).toBe("mixamorigHead");
    expect(map.names["LeftToeBase"]).toBe("mixamorigLeftToeBase");
    expect(map.names["RightForeArm"]).toBe("mixamorigRightForeArm");
  });

  it("does not map the un-mappable head leaves", () => {
    const map = buildRetargetNameMap(RACALVIN_JOINTS);
    expect(map.names["head_end"]).toBeUndefined();
    expect(map.names["headfront"]).toBeUndefined();
  });

  it("fully covers a 22-canonical-bone rig (nothing missing)", () => {
    const map = buildRetargetNameMap(RACALVIN_JOINTS);
    expect(map.missing).toEqual([]);
    expect(map.matched.length).toBe(CANONICAL_SUFFIXES.length);
    // One source bone per canonical suffix, all `mixamorig*`.
    expect(Object.keys(map.names).length).toBe(CANONICAL_SUFFIXES.length);
    for (const v of Object.values(map.names)) expect(v.startsWith("mixamorig")).toBe(true);
  });

  it("reports missing canonical bones for a partial rig", () => {
    const map = buildRetargetNameMap(["Hips", "Spine", "Head"]);
    expect(map.matched.sort()).toEqual(["Head", "Hips", "Spine"]);
    expect(map.missing).toContain("LeftHand");
    expect(map.missing).toContain("RightFoot");
  });

  it("lets an explicit alias override the canonical reduction", () => {
    // A rig whose chest bone is spelled in a way canonicalSuffix can't infer.
    const map = buildRetargetNameMap(["Hips", "Chest"], { Chest: "Spine2" });
    expect(map.names["Chest"]).toBe(sourceBoneName("Spine2"));
  });

  it("gives an already-claimed suffix to the first bone only", () => {
    // Both `neck` and `Neck` reduce to Neck; only the first wins.
    const map = buildRetargetNameMap(["neck", "Neck"]);
    expect(map.names["neck"]).toBe("mixamorigNeck");
    expect(map.names["Neck"]).toBeUndefined();
  });
});

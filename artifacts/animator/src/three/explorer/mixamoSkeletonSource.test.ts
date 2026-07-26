import { describe, expect, it } from "vitest";
import { createProceduralMixamoSkeleton } from "./mixamoSkeletonSource";

describe("createProceduralMixamoSkeleton", () => {
  it("builds Mixamo bone names required by VoxelCharacter", () => {
    const root = createProceduralMixamoSkeleton();
    const names = new Set<string>();
    root.traverse((o) => {
      if ((o as { isBone?: boolean }).isBone) names.add(o.name);
    });
    for (const n of [
      "mixamorigHips",
      "mixamorigSpine1",
      "mixamorigNeck",
      "mixamorigHead",
      "mixamorigLeftArm",
      "mixamorigRightArm",
      "mixamorigLeftHand",
      "mixamorigRightHand",
      "mixamorigLeftUpLeg",
      "mixamorigRightUpLeg",
      "mixamorigLeftFoot",
      "mixamorigRightFoot",
    ]) {
      expect(names.has(n), `missing ${n}`).toBe(true);
    }
    expect(root.userData.proceduralMixamo).toBe(true);
  });
});

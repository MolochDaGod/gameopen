import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { findArmChain } from "./armIk";

function bone(name: string, parent?: THREE.Bone): THREE.Bone {
  const b = new THREE.Bone();
  b.name = name;
  parent?.add(b);
  return b;
}

describe("findArmChain", () => {
  it("resolves Bip001 L UpperArm → Forearm → Hand and skips containers", () => {
    const root = new THREE.Group();
    const up = bone("Bip001 L UpperArm");
    const mid = bone("Bip001 L Forearm", up);
    bone("Bip001 L Hand", mid);
    bone("R_hand_container", mid);
    root.add(up);
    const chain = findArmChain(root, "L");
    expect(chain?.upper.name).toBe("Bip001 L UpperArm");
    expect(chain?.lower.name).toBe("Bip001 L Forearm");
    expect(chain?.foot.name).toBe("Bip001 L Hand");
  });
});

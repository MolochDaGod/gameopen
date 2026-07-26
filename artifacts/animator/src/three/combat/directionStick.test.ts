import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  DirectionStick,
  sampleCombatDirection,
  meleeImpactZone,
  barrelSpawn,
} from "./directionStick";

describe("directionStick", () => {
  it("sticks forward across noisy aim samples", () => {
    const stick = new DirectionStick();
    stick.update(new THREE.Vector3(0, 0, 1), null, 0);
    const a = stick.forward.clone();
    stick.update(new THREE.Vector3(0.05, 0, 1).normalize(), null, 1 / 60);
    const b = stick.forward.clone();
    expect(b.dot(a)).toBeGreaterThan(0.98);
  });

  it("samples tip-biased impact and barrel near tip", () => {
    const grip = new THREE.Vector3(0, 1, 0);
    const tip = new THREE.Vector3(0, 1, 1.2);
    const sample = sampleCombatDirection({
      bodyPos: new THREE.Vector3(0, 0, 0),
      aimDir: new THREE.Vector3(0, 0, 1),
      tipWorld: tip,
      gripWorld: grip,
      dt: 0,
    });
    expect(sample.muzzle.z).toBeGreaterThan(0.5);
    expect(sample.impactCenter.z).toBeGreaterThan(0.5);
    expect(sample.impactCenter.z).toBeLessThan(tip.z + 0.01);
    const barrel = barrelSpawn(sample, 0.1);
    expect(barrel.origin.z).toBeGreaterThan(sample.muzzle.z - 0.01);
  });

  it("2h zone is wider than polearm at same reach", () => {
    const sample = sampleCombatDirection({
      bodyPos: new THREE.Vector3(),
      aimDir: new THREE.Vector3(0, 0, 1),
      tipWorld: new THREE.Vector3(0, 1, 1.5),
      gripWorld: new THREE.Vector3(0, 1, 0),
      dt: 0,
    });
    const z2h = meleeImpactZone({ sample, reach: 2.2, stage: 2, group: "melee-2h" });
    const zPole = meleeImpactZone({ sample, reach: 2.2, stage: 2, group: "polearm" });
    expect(z2h.radius).toBeGreaterThan(zPole.radius);
  });
});

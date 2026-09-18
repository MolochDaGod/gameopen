import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  bodyLocalMove,
  tpsMoveBasis,
  tpsMoveBasisFromYaw,
  wishFromWasd,
} from "@workspace/grudge-physics";

describe("tpsMoveBasis — orbit behind a +Z-facing hero", () => {
  it("W walks +Z (into the scene) and D walks screen-right (−X)", () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    cam.position.set(0, 1.7, -5);
    cam.lookAt(0, 1.7, 0);
    cam.updateMatrixWorld(true);

    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    tpsMoveBasis(cam, fwd, right);

    expect(fwd.z).toBeGreaterThan(0.9);
    expect(right.x).toBeLessThan(-0.9);

    const wish = new THREE.Vector3();
    wishFromWasd(fwd, right, 0, 1, wish);
    expect(wish.z).toBeGreaterThan(0.9);

    wishFromWasd(fwd, right, 1, 0, wish);
    expect(wish.x).toBeLessThan(-0.9);

    wishFromWasd(fwd, right, -1, 0, wish);
    expect(wish.x).toBeGreaterThan(0.9);
  });
});

describe("tpsMoveBasisFromYaw", () => {
  it("yaw 0 → +Z forward, −X right", () => {
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    tpsMoveBasisFromYaw(0, fwd, right);
    expect(fwd.z).toBeCloseTo(1);
    expect(right.x).toBeCloseTo(-1);
  });
});

describe("bodyLocalMove laterality", () => {
  it("world +Z on yaw 0 is local forward", () => {
    const fwd = bodyLocalMove(0, 1, 0);
    expect(fwd.z).toBeCloseTo(1);
    expect(Math.abs(fwd.x)).toBeLessThan(1e-6);
  });
});

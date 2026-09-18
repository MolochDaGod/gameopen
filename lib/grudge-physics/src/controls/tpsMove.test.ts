import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  bodyLocalMove,
  tpsMoveBasis,
  tpsMoveBasisFromYaw,
  wishFromWasd,
} from "./tpsMove";

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
    expect(Math.abs(fwd.x)).toBeLessThan(0.1);
    expect(right.x).toBeLessThan(-0.9);

    const wish = new THREE.Vector3();
    wishFromWasd(fwd, right, 0, 1, wish);
    expect(wish.z).toBeGreaterThan(0.9);

    wishFromWasd(fwd, right, 1, 0, wish);
    expect(wish.x).toBeLessThan(-0.9);

    wishFromWasd(fwd, right, -1, 0, wish);
    expect(wish.x).toBeGreaterThan(0.9);
  });

  it("getWorldDirection updates the matrix so lookAt is visible", () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    cam.position.set(0, 1.7, -5);
    cam.lookAt(0, 1.7, 0);
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    tpsMoveBasis(cam, fwd, right);
    expect(fwd.z).toBeGreaterThan(0.9);
    expect(right.x).toBeLessThan(-0.9);
  });
});

describe("tpsMoveBasisFromYaw", () => {
  it("yaw 0 → +Z forward, −X right (same as orbit behind)", () => {
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    tpsMoveBasisFromYaw(0, fwd, right);
    expect(fwd.z).toBeCloseTo(1);
    expect(right.x).toBeCloseTo(-1);
  });
});

describe("bodyLocalMove laterality", () => {
  it("+Z wish on yaw 0 is local forward, +X wish is local left (screen-left = +X when looking +Z)", () => {
    const fwd = bodyLocalMove(0, 1, 0);
    expect(fwd.z).toBeCloseTo(1);
    expect(fwd.x).toBeCloseTo(0);
    const left = bodyLocalMove(1, 0, 0);
    expect(left.x).toBeCloseTo(1);
  });
});

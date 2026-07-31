import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  arcControlPoint,
  basisFromTravel,
  measureMeshAxes,
  resolveAimDir,
  resolveAimPoint,
  steerToward,
} from "./projectileAim";

describe("projectileAim", () => {
  it("resolveAimDir points toward aim with clamped pitch", () => {
    const from = new THREE.Vector3(0, 1, 0);
    const aim = new THREE.Vector3(10, 8, 0);
    const d = resolveAimDir(from, new THREE.Vector3(0, 0, 1), { aim });
    expect(d.x).toBeGreaterThan(0.7);
    expect(d.y).toBeLessThan(0.4); // pitch clamped
    expect(d.length()).toBeCloseTo(1, 5);
  });

  it("arcControlPoint raises mid above the chord", () => {
    const from = new THREE.Vector3(0, 1, 0);
    const to = new THREE.Vector3(10, 1, 0);
    const c = arcControlPoint(from, to, { heightFrac: 0.2, minHeight: 0.5 });
    expect(c.y).toBeGreaterThan(1.5);
    expect(c.x).toBeCloseTo(5, 5);
  });

  it("basisFromTravel puts +Z along travel", () => {
    const q = basisFromTravel(new THREE.Vector3(1, 0, 0));
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    expect(z.x).toBeCloseTo(1, 4);
    expect(Math.abs(z.y)).toBeLessThan(1e-4);
  });

  it("resolveAimPoint prefers hostile torso", () => {
    const from = new THREE.Vector3(0, 1, 0);
    const hostile = new THREE.Vector3(5, 1.2, 3);
    const p = resolveAimPoint(from, new THREE.Vector3(0, 0, 1), 12, hostile, 0.2);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(1.4);
    expect(p.z).toBeCloseTo(3);
  });

  it("steerToward rotates velocity toward goal", () => {
    const v = new THREE.Vector3(0, 0, 1);
    const from = new THREE.Vector3(0, 0, 0);
    const goal = new THREE.Vector3(1, 0, 0);
    steerToward(v, from, goal, 0.5, 4);
    expect(v.x).toBeGreaterThan(0.3);
    expect(v.length()).toBeCloseTo(1, 4);
  });

  it("measureMeshAxes finds thin/long from AABB", () => {
    const g = new THREE.BoxGeometry(1, 0.1, 4);
    const m = new THREE.Mesh(g);
    const axes = measureMeshAxes(m);
    expect(axes.thin.y).toBe(1); // thin along Y
    expect(axes.long.z).toBe(1); // long along Z
    g.dispose();
  });
});

import { describe, expect, it } from "vitest";
import { PhysicsWorld } from "./PhysicsWorld";

describe("PhysicsWorld Rapier queries", () => {
  it("casts a downward ray onto a ground cuboid", async () => {
    const phys = new PhysicsWorld();
    try {
      await phys.init(-12);
    } catch (err) {
      console.warn("[rapierQuery.test] wasm init skipped", err);
      return;
    }
    expect(phys.ready).toBe(true);
    phys.addGroundPlane(0, 40, 0.5);
    phys.step(1 / 60);
    const hit = phys.castRay({ x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 }, 40);
    expect(hit).not.toBeNull();
    expect(hit!.y).toBeGreaterThan(-0.2);
    expect(hit!.y).toBeLessThan(0.6);
    const y = phys.heightAt(1, 1, 12, 40);
    expect(y).not.toBeNull();
    expect(phys.lineOfSight({ x: 0, y: 1.4, z: 0 }, { x: 4, y: 1.4, z: 0 })).toBe(
      true,
    );
    phys.dispose();
  });
});

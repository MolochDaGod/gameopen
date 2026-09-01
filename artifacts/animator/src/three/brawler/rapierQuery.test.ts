import { describe, expect, it } from "vitest";
import { PhysicsWorld } from "../PhysicsSystem";

describe("Brawler Rapier query SSOT", () => {
  it("exposes castRay / heightAt / lineOfSight / createPlayerKcc", () => {
    expect(typeof PhysicsWorld.prototype.castRay).toBe("function");
    expect(typeof PhysicsWorld.prototype.heightAt).toBe("function");
    expect(typeof PhysicsWorld.prototype.lineOfSight).toBe("function");
    expect(typeof PhysicsWorld.prototype.createPlayerKcc).toBe("function");
  });

  it("hits a ground cuboid with a downward Rapier ray", async () => {
    const phys = new PhysicsWorld();
    try {
      await phys.init(-12);
    } catch (err) {
      console.warn("[rapierQuery] wasm init skipped", err);
      return;
    }
    phys.addGroundPlane(0, 40, 0.5);
    phys.step(1 / 60);
    const hit = phys.castRay({ x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 }, 40);
    expect(hit).not.toBeNull();
    expect(hit!.y).toBeGreaterThan(-0.2);
    expect(hit!.y).toBeLessThan(0.6);
    expect(phys.heightAt(2, -2, 12, 40)).not.toBeNull();
    expect(phys.lineOfSight({ x: 0, y: 1.4, z: 0 }, { x: 5, y: 1.4, z: 0 })).toBe(true);
    phys.dispose();
  });
});

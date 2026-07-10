import { describe, it, expect } from "vitest";
import {
  mimicAttackPose,
  mimicIdlePose,
  mimicWalkPose,
  acidArcPoint,
  telegraphBlink,
  chooseMimicAttack,
  mimicAttackDuration,
  MIMIC_ATTACKS,
  type Vec3,
} from "./mimicMoves";

describe("mimicMoves", () => {
  it("attack poses settle to ~0 at phase 0 and 1", () => {
    for (const name of ["melee", "acid"] as const) {
      for (const phase of [0, 1]) {
        const p = mimicAttackPose(name, phase);
        expect(Math.abs(p.pitch)).toBeLessThan(0.02);
        expect(Math.abs(p.lift)).toBeLessThan(0.02);
        expect(Math.abs(p.lunge)).toBeLessThan(0.02);
        expect(Math.abs(p.mouth)).toBeLessThan(0.02);
      }
    }
  });

  it("melee lunges forward mid-swing; acid rears back during its charge", () => {
    expect(mimicAttackPose("melee", 0.7).lunge).toBeGreaterThan(0.3);
    expect(mimicAttackPose("acid", 0.4).pitch).toBeGreaterThan(0.1);
  });

  it("acid attack is slower (longer) than melee", () => {
    expect(mimicAttackDuration("acid")).toBeGreaterThan(mimicAttackDuration("melee"));
    expect(MIMIC_ATTACKS.melee.speed).toBeGreaterThan(MIMIC_ATTACKS.acid.speed);
    expect(MIMIC_ATTACKS.melee.mmLunge).toBe(30);
    expect(MIMIC_ATTACKS.acid.aoeRadius).toBe(3);
  });

  it("chooseMimicAttack range-gates melee vs acid", () => {
    expect(chooseMimicAttack(1.5)).toBe("melee");
    expect(chooseMimicAttack(8)).toBe("acid");
  });

  it("acid arc hits both endpoints and peaks above the midpoint", () => {
    const from: Vec3 = { x: 0, y: 1, z: 0 };
    const to: Vec3 = { x: 6, y: 1, z: 2 };
    const out: Vec3 = { x: 0, y: 0, z: 0 };
    acidArcPoint(from, to, 3, 0, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(1);
    expect(out.z).toBeCloseTo(0);
    acidArcPoint(from, to, 3, 1, out);
    expect(out.x).toBeCloseTo(6);
    expect(out.y).toBeCloseTo(1);
    expect(out.z).toBeCloseTo(2);
    acidArcPoint(from, to, 3, 0.5, out);
    expect(out.y).toBeGreaterThan(2); // arced above the flat endpoints
  });

  it("telegraphBlink stays within 0..1", () => {
    for (let t = 0; t <= 1.01; t += 0.1) {
      const v = telegraphBlink(t, 1, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("idle/walk poses stay bounded", () => {
    for (let t = 0; t < 3; t += 0.25) {
      expect(Math.abs(mimicIdlePose(t).lift)).toBeLessThan(0.1);
      expect(Math.abs(mimicWalkPose(t).sway)).toBeLessThanOrEqual(0.12 + 1e-6);
    }
  });
});

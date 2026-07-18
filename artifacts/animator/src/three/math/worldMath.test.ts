import { describe, expect, it } from "vitest";
import {
  MM_TO_M,
  TIMING,
  ANGLE,
  mmToMeters,
  latticeMeters,
  WORLD_MATH_META,
} from "./worldMath";
import { resolveDefense } from "./defenseMath";
import { inMeleeArc, lightStrikeArc, mmDisplacement } from "./combatGeometry";
import { boltFromSkill, projectileDamageMul, stepProjectile, createProjectile } from "./projectileMath";
import { resolveImpact } from "./impactMath";

describe("worldMath lattice SSOT", () => {
  it("MM scale is 1 cm", () => {
    expect(MM_TO_M).toBe(0.01);
    expect(mmToMeters(100)).toBeCloseTo(1, 5);
  });

  it("timing is 3:1:2 lattice multiples", () => {
    expect(TIMING.windup / TIMING.u).toBeCloseTo(3, 5);
    expect(TIMING.active / TIMING.u).toBeCloseTo(1, 5);
    expect(TIMING.recovery / TIMING.u).toBeCloseTo(2, 5);
    expect(TIMING.attackTotal).toBeCloseTo(TIMING.u * 6, 5);
  });

  it("lattice cells map to world metres", () => {
    expect(latticeMeters(1)).toBeCloseTo(0.55, 5);
    expect(latticeMeters(2)).toBeCloseTo(1.1, 5);
  });

  it("meta points at ASOD source", () => {
    expect(WORLD_MATH_META.sourceGlb).toContain("another_shape_of_data");
  });
});

describe("defense directional cones", () => {
  const defPos = { x: 0, z: 0 };
  const defYaw = 0; // +Z

  it("perfect parry face-on", () => {
    const r = resolveDefense({
      defenderYaw: defYaw,
      defenderPos: defPos,
      attackerPos: { x: 0, z: 2 }, // in front
      defenseAge: 0.05,
      mode: "parry",
      attackForce: 2,
    });
    expect(r.kind).toBe("perfectParry");
    expect(r.damageMul).toBe(0);
  });

  it("block fails from behind", () => {
    const r = resolveDefense({
      defenderYaw: defYaw,
      defenderPos: defPos,
      attackerPos: { x: 0, z: -2 },
      defenseAge: 0.2,
      mode: "block",
      attackForce: 1,
    });
    expect(r.kind).toBe("none");
    expect(r.wrongDirection).toBe(true);
  });

  it("dodge i-frame negates", () => {
    const r = resolveDefense({
      defenderYaw: defYaw,
      defenderPos: defPos,
      attackerPos: { x: 1, z: 1 },
      defenseAge: 0.15,
      mode: "dodge",
      attackForce: 1,
    });
    expect(["dodge", "dodgePunish"]).toContain(r.kind);
    expect(r.damageMul).toBe(0);
  });
});

describe("geometry + projectiles + impact", () => {
  it("melee arc hits front target", () => {
    const arc = lightStrikeArc({ x: 0, z: 0 }, 0);
    expect(inMeleeArc(arc, { x: 0, z: 0.9 })).toBe(true);
    expect(inMeleeArc(arc, { x: 0, z: -0.9 })).toBe(false);
  });

  it("MM displacement forward", () => {
    const d = mmDisplacement(0, 100);
    expect(d.meters).toBeCloseTo(1, 5);
    expect(d.dz).toBeCloseTo(1, 5);
  });

  it("projectile falloff", () => {
    expect(projectileDamageMul(0, 10)).toBe(1);
    expect(projectileDamageMul(10, 10)).toBeCloseTo(0.35, 2);
  });

  it("bolt steps forward", () => {
    const spec = boltFromSkill({ x: 0, z: 0 }, 0, 80, 20);
    let p = createProjectile(spec);
    p = stepProjectile(p, 0.1);
    expect(p.z).toBeGreaterThan(0);
    expect(p.alive).toBe(true);
  });

  it("impact applies backstab mul", () => {
    // Attacker behind defender (def faces +Z), attacker faces +Z into their back
    const hit = resolveImpact({
      attackerPos: { x: 0, z: -1 },
      attackerYaw: 0,
      defenderPos: { x: 0, z: 0 },
      defenderYaw: 0,
      baseDamage: 100,
      force: 2,
      maxRange: 4,
    });
    expect(hit.backstab).toBe(true);
    expect(hit.damage).toBeGreaterThan(100);
  });

  it("block half angle is 45°", () => {
    expect(ANGLE.blockHalfDeg).toBe(45);
  });
});

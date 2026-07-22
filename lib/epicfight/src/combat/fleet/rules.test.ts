import { describe, expect, it } from "vitest";
import {
  planDodge,
  resolveSlideContact,
  slideAttackPayload,
  planFailedParryStamina,
  slashVariantForStage,
  canAffordPhysical,
} from "./rules.js";
import { FLEET_DODGE, FLEET_SLIDE } from "./constants.js";

describe("planDodge", () => {
  it("floors distance under 15% stamina", () => {
    const p = planDodge(10, 120); // ~8%
    expect(p.short).toBe(true);
    expect(p.distance).toBe(FLEET_DODGE.minDistance);
    expect(p.cost).toBeCloseTo(10, 5); // all remaining < 40% of 120
  });

  it("max distance at full stamina and costs 40%", () => {
    const p = planDodge(120, 120);
    expect(p.short).toBe(false);
    expect(p.distance).toBeCloseTo(FLEET_DODGE.maxDistance, 5);
    expect(p.cost).toBeCloseTo(48, 5);
  });

  it("scales mid-band", () => {
    const p = planDodge(60, 120); // 50%
    expect(p.distance).toBeGreaterThan(FLEET_DODGE.minDistance);
    expect(p.distance).toBeLessThan(FLEET_DODGE.maxDistance);
  });
});

describe("resolveSlideContact", () => {
  it("blocks stop the slider", () => {
    const v = resolveSlideContact("block");
    expect(v.kind).toBe("blocked");
    if (v.kind === "blocked") {
      expect(v.stunAttackerSec).toBe(FLEET_SLIDE.blockStunSec);
      expect(v.damage).toBe(0);
    }
  });

  it("breaks parry into knockdown", () => {
    const v = resolveSlideContact("parry");
    expect(v.kind).toBe("parryBreak");
    if (v.kind === "parryBreak") expect(v.knockdown).toBe(true);
  });

  it("trips otherwise unparryable", () => {
    const v = resolveSlideContact("idle");
    expect(v.kind).toBe("trip");
    expect(slideAttackPayload().unparryable).toBe(true);
  });
});

describe("parry fail + slash stage", () => {
  it("failed parry plans 2s recover", () => {
    const p = planFailedParryStamina();
    expect(p.recoverSec).toBe(2);
    expect(p.debt).toBeGreaterThan(0);
    expect(p.ratePerSec).toBeCloseTo(p.debt / 2, 5);
  });

  it("slash variants by stage", () => {
    expect(slashVariantForStage(0)).toBe("slashblue");
    expect(slashVariantForStage(1)).toBe("slashpurple");
    expect(slashVariantForStage(2, { finisher: true })).toBe("slashyellow");
  });

  it("canAffordPhysical gate", () => {
    expect(canAffordPhysical(20, 16)).toBe(true);
    expect(canAffordPhysical(2, 16)).toBe(false);
  });
});

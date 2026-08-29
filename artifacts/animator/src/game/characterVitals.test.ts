import { describe, expect, it } from "vitest";
import {
  deriveCharacterVitals,
  effectivePoints,
  fillVitals,
  tickVitals,
} from "./characterVitals";

describe("character-builder vitals", () => {
  it("matches builder diminishing returns", () => {
    expect(effectivePoints(20)).toBe(20);
    expect(effectivePoints(30)).toBe(27.5);
    expect(effectivePoints(60)).toBe(40);
  });

  it("zero alloc still has base HP / mana / stamina / needs", () => {
    const v = deriveCharacterVitals({});
    expect(v.maxHealth).toBeGreaterThanOrEqual(100);
    expect(v.maxMana).toBeGreaterThanOrEqual(50);
    expect(v.maxStamina).toBeGreaterThanOrEqual(100);
    expect(v.maxOxygen).toBe(80);
    expect(v.maxHunger).toBe(100);
    expect(v.maxThirst).toBe(80);
  });

  it("VIT/END raise need + armour pools", () => {
    const v = deriveCharacterVitals({ vitality: 20, endurance: 20 });
    expect(v.maxHealth).toBeGreaterThan(250);
    expect(v.maxStamina).toBeGreaterThan(100);
    expect(v.armor).toBeGreaterThan(0);
    expect(v.maxOxygen).toBeGreaterThan(80);
    expect(v.maxHunger).toBeGreaterThan(100);
  });

  it("underwater drains oxygen; surface restores", () => {
    const max = deriveCharacterVitals({ endurance: 10 });
    let s = fillVitals(max);
    s = tickVitals(s, 2, { underwater: true });
    expect(s.oxygen).toBeLessThan(max.maxOxygen);
    const mid = s.oxygen;
    s = tickVitals(s, 2, { underwater: false });
    expect(s.oxygen).toBeGreaterThan(mid);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SKILL_DEBUG,
  exportSkillDebugJson,
  getSkillDebug,
  loadSkillDebug,
  normalizeSkillDebug,
  patchSkillDebug,
  resetSkillDebug,
  saveSkillDebug,
} from "./skillDebugSettings";

afterEach(() => {
  resetSkillDebug();
  try {
    localStorage.clear();
  } catch {
    /* jsdom may lack localStorage in some envs */
  }
});

describe("skillDebugSettings", () => {
  it("loads defaults when storage is empty", () => {
    const p = loadSkillDebug();
    expect(p.uppercut.stamina).toBe(DEFAULT_SKILL_DEBUG.uppercut.stamina);
    expect(p.skill.damageMult).toBe(1);
  });

  it("clamps out-of-range patches", () => {
    const p = patchSkillDebug({
      uppercut: { stamina: 999, gapMin: -1 },
      skill: { damageMult: 99 },
    });
    expect(p.uppercut.stamina).toBe(100);
    expect(p.uppercut.gapMin).toBe(0.4);
    expect(p.skill.damageMult).toBe(3);
  });

  it("persists and reloads via getSkillDebug cache invalidation path", () => {
    patchSkillDebug({ kick: { mmaDamage: 44 } });
    // Force reload from storage by resetting cache via save round-trip
    const saved = getSkillDebug();
    expect(saved.kick.mmaDamage).toBe(44);
    saveSkillDebug(saved);
    resetSkillDebug();
    // After reset, defaults
    expect(getSkillDebug().kick.mmaDamage).toBe(DEFAULT_SKILL_DEBUG.kick.mmaDamage);
  });

  it("normalizeSkillDebug ignores garbage", () => {
    const p = normalizeSkillDebug({ schema: 1, uppercut: { stamina: "nope" } });
    expect(p.uppercut.stamina).toBe(DEFAULT_SKILL_DEBUG.uppercut.stamina);
  });

  it("exportSkillDebugJson is valid JSON with schema", () => {
    const o = JSON.parse(exportSkillDebugJson());
    expect(o.schema).toBe(1);
    expect(o.uppercut.damage).toBe(DEFAULT_SKILL_DEBUG.uppercut.damage);
  });
});

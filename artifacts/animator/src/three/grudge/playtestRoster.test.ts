import { describe, expect, it } from "vitest";
import {
  GRUDGE6_PLAYTEST_ROSTER,
  GRUDGE6_RACE_DEFAULTS,
  grudge6PlaytestByRace,
  isGrudge6PlaytestId,
} from "./playtestRoster";
import { RACE_IDS } from "./raceAssets";
import { PRESET_IDS } from "./gearPresets";

describe("grudge6 playtest roster", () => {
  it("lists every race × preset (6 × 5 = 30)", () => {
    expect(GRUDGE6_PLAYTEST_ROSTER).toHaveLength(RACE_IDS.length * PRESET_IDS.length);
    expect(GRUDGE6_PLAYTEST_ROSTER).toHaveLength(30);
  });

  it("uses grudge:race:preset ids", () => {
    for (const e of GRUDGE6_PLAYTEST_ROSTER) {
      expect(isGrudge6PlaytestId(e.id)).toBe(true);
      expect(e.id).toMatch(/^grudge:[a-z-]+:(mage|knight|ranger|warrior|unarmed)$/);
    }
  });

  it("has one default per race", () => {
    expect(GRUDGE6_RACE_DEFAULTS).toHaveLength(RACE_IDS.length);
    const races = new Set(GRUDGE6_RACE_DEFAULTS.map((e) => e.raceId));
    expect(races.size).toBe(RACE_IDS.length);
  });

  it("groups by race with full presets", () => {
    const groups = grudge6PlaytestByRace();
    expect(groups).toHaveLength(6);
    for (const g of groups) {
      expect(g.entries).toHaveLength(5);
    }
  });
});

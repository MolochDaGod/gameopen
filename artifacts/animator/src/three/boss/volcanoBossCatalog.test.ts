import { describe, expect, it } from "vitest";
import {
  GHAST_FIRE,
  HELLMAW_WORLD_BOSS_SPAWN,
  MANTIS_ABILITIES,
  MANTIS_CLIPS,
  MANTIS_ULTIMATE,
  SHADOW_FLAME_MANTIS,
  unitAllowedOn,
  VOLCANO_GHAST,
} from "./volcanoBossCatalog";
import { listHellmawDeployReport } from "../world/worldMeshDeploy";

describe("volcanoBossCatalog", () => {
  it("maps all mantis clips from source GLB", () => {
    expect(MANTIS_CLIPS.shadowCall).toBe("Shadow Call");
    expect(MANTIS_CLIPS.nuclearSlice).toBe("Nuclear Slice");
    expect(MANTIS_ABILITIES.some((a) => a.id === "shadowCall")).toBe(true);
  });

  it("sizes relative to 1.8 m human (not 100×)", () => {
    expect(SHADOW_FLAME_MANTIS.heightM).toBeGreaterThan(1.8);
    expect(SHADOW_FLAME_MANTIS.heightM).toBeLessThan(6);
    expect(VOLCANO_GHAST.heightM).toBeGreaterThan(1.5);
    expect(VOLCANO_GHAST.heightM).toBeLessThan(4);
  });

  it("allows hellmaw sector s and volcanic / boss event", () => {
    expect(unitAllowedOn(SHADOW_FLAME_MANTIS, { sectorId: "s" })).toBe(true);
    expect(unitAllowedOn(SHADOW_FLAME_MANTIS, { archetype: "volcanic" })).toBe(true);
    expect(unitAllowedOn(SHADOW_FLAME_MANTIS, { archetype: "boss" })).toBe(true);
    expect(unitAllowedOn(SHADOW_FLAME_MANTIS, { eventTags: ["boss_event"] })).toBe(true);
    expect(unitAllowedOn(SHADOW_FLAME_MANTIS, { archetype: "home" })).toBe(false);
  });

  it("hellmaw pin is sector s", () => {
    expect(HELLMAW_WORLD_BOSS_SPAWN.sectorId).toBe("s");
    expect(HELLMAW_WORLD_BOSS_SPAWN.sectorName).toContain("Hellmaw");
  });

  it("ultimate uses dual meteor orbit + 1m knockback zone", () => {
    expect(MANTIS_ULTIMATE.meteorDurationSec).toBeGreaterThan(2);
    expect(MANTIS_ULTIMATE.pointBlankM).toBe(1);
    const ult = MANTIS_ABILITIES.find((a) => a.id === "nuclearSlice");
    expect(ult?.active).toBeGreaterThanOrEqual(2.4);
  });

  it("ghast fireball cast 1.5s then 2s cone", () => {
    expect(GHAST_FIRE.castSec).toBe(1.5);
    expect(GHAST_FIRE.coneSec).toBe(2);
  });

  it("world mesh deploy nodes validate", () => {
    const report = listHellmawDeployReport();
    expect(report.length).toBeGreaterThanOrEqual(3);
    expect(report.every((r) => r.ok)).toBe(true);
  });
});

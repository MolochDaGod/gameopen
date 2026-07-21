import { describe, expect, it } from "vitest";
import {
  HELLMAW_WORLD_BOSS_SPAWN,
  MANTIS_ABILITIES,
  MANTIS_CLIPS,
  SHADOW_FLAME_MANTIS,
  unitAllowedOn,
  VOLCANO_GHAST,
} from "./volcanoBossCatalog";

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
});

import { describe, expect, it } from "vitest";
import { MAP_REGISTRY, getMapRegistryEntry, MAP_STACK_SERVICES } from "./mapRegistry";

describe("mapRegistry", () => {
  it("lists forest mountains and arena", () => {
    expect(getMapRegistryEntry("forest-mountains")?.kind).toBe("harvest");
    expect(getMapRegistryEntry("arena")?.defaultMode).toBe("build");
    expect(getMapRegistryEntry("shipwreck-island")?.layers).toContain("climb");
  });

  it("toon-ready maps flag presentation", () => {
    const toonMaps = MAP_REGISTRY.filter((m) => m.toonStyle);
    expect(toonMaps.length).toBeGreaterThanOrEqual(4);
  });

  it("documents stack services", () => {
    expect(MAP_STACK_SERVICES.physics).toMatch(/Rapier/);
    expect(MAP_STACK_SERVICES.definitions).toMatch(/info\.grudge-studio/);
  });
});

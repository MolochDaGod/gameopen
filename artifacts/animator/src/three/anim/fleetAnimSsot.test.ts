import { describe, expect, it } from "vitest";
import {
  bip001BakedUrlCandidates,
  bip001PackForWeapon,
  fleetAnimContractSummary,
  grudge6RaceGlbUrl,
  grudge6RaceMeshCandidates,
  isForbiddenPrimaryUrl,
  resolveFleetAnimLane,
} from "./fleetAnimSsot";

describe("fleetAnimSsot", () => {
  it("maps danger/open to bip001 and explorer to mixamo", () => {
    expect(resolveFleetAnimLane("danger")).toBe("bip001-baked");
    expect(resolveFleetAnimLane("open-play")).toBe("bip001-baked");
    expect(resolveFleetAnimLane("controller")).toBe("bip001-baked");
    expect(resolveFleetAnimLane("explorer")).toBe("mixamo-explorer");
  });

  it("race GLB is R2 grudge6 races not arena", () => {
    const url = grudge6RaceGlbUrl("western-kingdoms");
    expect(url).toContain("assets.grudge-studio.com/models/grudge6/races/WK_Characters.glb");
    expect(isForbiddenPrimaryUrl(url)).toBe(false);
    expect(isForbiddenPrimaryUrl("https://x/cdn/assets/characters/human/WK.glb")).toBe(true);
  });

  it("mesh candidates put R2 first", () => {
    const c = grudge6RaceMeshCandidates("orcs");
    expect(c[0]).toContain("ORC_Characters.glb");
    expect(c[0]).toContain("assets.grudge-studio.com");
  });

  it("baked urls prefer anims/baked then prod", () => {
    const c = bip001BakedUrlCandidates("sword_shield/idle");
    expect(c.some((u) => u.includes("/anims/baked/sword_shield/idle.json"))).toBe(true);
    expect(c.some((u) => u.includes("prod/anims"))).toBe(true);
  });

  it("weapon pack map", () => {
    expect(bip001PackForWeapon("bow")).toBe("longbow");
    expect(bip001PackForWeapon("sword_shield")).toBe("sword_shield");
  });

  it("contract summary is non-empty", () => {
    expect(fleetAnimContractSummary()).toMatch(/bip001-baked/);
  });
});

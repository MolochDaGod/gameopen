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

  it("race GLB is Toon RTS pack not arena/FBX/races bake", () => {
    const url = grudge6RaceGlbUrl("western-kingdoms");
    expect(url).toContain(
      "assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/human.glb",
    );
    expect(url).not.toMatch(/\.fbx/i);
    expect(isForbiddenPrimaryUrl(url)).toBe(false);
    expect(isForbiddenPrimaryUrl("https://x/cdn/assets/characters/human/WK.glb")).toBe(true);
  });

  it("mesh candidates put Toon RTS R2 first", () => {
    const c = grudge6RaceMeshCandidates("orcs");
    expect(c[0]).toContain("toon-rts-characters/glb/characters/orc.glb");
    expect(c[0]).toContain("assets.grudge-studio.com");
  });

  it("baked urls are JSON under /anims/baked only (no prod/anims GLB)", () => {
    const c = bip001BakedUrlCandidates("sword_shield/idle");
    expect(c.some((u) => u.includes("/anims/baked/sword_shield/idle.json"))).toBe(true);
    expect(c.some((u) => u.includes("open.grudge-studio.com/anims/baked"))).toBe(true);
    expect(c.some((u) => /prod\/anims\/.+\.glb/i.test(u))).toBe(false);
    expect(c.some((u) => u.includes("assets.grudge-studio.com/anims/baked"))).toBe(true);
    expect(c.every((u) => u.endsWith(".json"))).toBe(true);
  });

  it("weapon pack map", () => {
    expect(bip001PackForWeapon("bow")).toBe("longbow");
    expect(bip001PackForWeapon("sword_shield")).toBe("sword_shield");
  });

  it("contract summary is non-empty", () => {
    expect(fleetAnimContractSummary()).toMatch(/bip001-baked/);
  });
});

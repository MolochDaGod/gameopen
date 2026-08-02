import { describe, expect, it } from "vitest";
import {
  DRC_DEFAULT_AVATAR_ID,
  DRC_SURFACE_MATRIX,
  WARLORDS_ERA_ASSET_SSOT,
  WARLORDS_ERA_FLEET,
  drcSpecForMode,
  isBip001CombatMode,
  warlordsFleetByStatus,
} from "./drcSurfaceContract";

describe("drcSurfaceContract", () => {
  it("lists core combat modes as bip001 + studio controller", () => {
    for (const mode of ["danger", "play", "brawl", "survival", "mimic"] as const) {
      expect(isBip001CombatMode(mode), mode).toBe(true);
      const s = drcSpecForMode(mode);
      expect(s?.character).toBe("grudge6-runtime");
      expect(s?.usesStudioController).toBe(true);
    }
  });

  it("default avatar is grudge6 not explorer", () => {
    expect(DRC_DEFAULT_AVATAR_ID.startsWith("grudge:")).toBe(true);
    expect(DRC_DEFAULT_AVATAR_ID).not.toContain("explorer");
  });

  it("matrix has unique modes", () => {
    const modes = DRC_SURFACE_MATRIX.map((s) => s.mode);
    expect(new Set(modes).size).toBe(modes.length);
  });

  it("library has no combat controller", () => {
    expect(drcSpecForMode("doors")?.usesStudioController).toBe(false);
  });
});

describe("Warlords-era fleet DRC + grudge6", () => {
  it("asset SSOT points at R2 kits + Open baked anims", () => {
    expect(WARLORDS_ERA_ASSET_SSOT.meshCdn).toContain("assets.grudge-studio.com");
    expect(WARLORDS_ERA_ASSET_SSOT.raceKit("WK")).toContain("models/grudge6/races/WK_Characters.glb");
    expect(WARLORDS_ERA_ASSET_SSOT.animsBaked).toContain("open.grudge-studio.com/anims/baked");
    expect(WARLORDS_ERA_ASSET_SSOT.forbidden.join(" ")).toMatch(/Mixamo|sword and shield run|Explorer/i);
  });

  it("core Warlords combat hosts are DRC-green grudge6 + bip001", () => {
    const green = warlordsFleetByStatus("drc-green");
    expect(green.map((h) => h.id)).toEqual(
      expect.arrayContaining([
        "open-danger",
        "multiverse",
        "grudge-arena",
        "warlord-genesis",
        "hero-command",
        "warlords-client",
      ]),
    );
    for (const h of green) {
      expect(h.mesh).toMatch(/grudge6/);
      expect(h.anim).toMatch(/bip001|via-client/);
    }
  });

  it("pirate-islands is in-game-only Warlords (not GRUDOX/Explorer)", () => {
    const p = WARLORDS_ERA_FLEET.find((h) => h.id === "pirate-islands");
    expect(p?.status).toBe("in-game-only");
    expect(p?.host).toContain("map=pirate-islands");
    expect(p?.notes).toMatch(/not GRUDOX|not Explorer/i);
  });

  it("Warlord Genesis uses grudge6 + bip001 Open packs", () => {
    const g = WARLORDS_ERA_FLEET.find((h) => h.id === "warlord-genesis");
    expect(g?.status).toBe("drc-green");
    expect(g?.anim).toBe("bip001-open");
    expect(g?.mesh).toMatch(/grudge6/);
  });
});

import { describe, expect, it } from "vitest";
import {
  getWeaponLiveDef,
  liveAnimPackForWeapon,
  liveBakeRelsForWeapon,
  weaponLiveSummary,
  listMappedWeaponIds,
  sharedTraversalRoles,
} from "./weaponLivePacks";

describe("weaponLivePacks", () => {
  it("maps core weapons to packs", () => {
    expect(liveAnimPackForWeapon("sword")).toBe("sword_shield");
    expect(liveAnimPackForWeapon("spear")).toBe("polearm");
    expect(liveAnimPackForWeapon("greatsword")).toBe("twohand");
    expect(liveAnimPackForWeapon("bow")).toBe("longbow");
    expect(liveAnimPackForWeapon("crossbow")).toBe("crossbow");
    expect(liveAnimPackForWeapon("rifle")).toBe("rifle");
    expect(liveAnimPackForWeapon("none")).toBe("unarmed");
  });

  it("inherits javelin from spear", () => {
    const j = getWeaponLiveDef("javelin");
    const s = getWeaponLiveDef("spear");
    expect(j.animPack).toBe(s.animPack);
    expect(Object.keys(j.liveRoles).length).toBeGreaterThan(0);
  });

  it("lists bake rels including traversal for spear", () => {
    const rels = liveBakeRelsForWeapon("spear");
    expect(rels.some((r) => r.role === "idle" && r.bakeRel.includes("polearm"))).toBe(
      true,
    );
    expect(rels.some((r) => r.role === "jump")).toBe(true);
    expect(rels.some((r) => r.role === "attack")).toBe(true);
  });

  it("greatsword has incomplete fallbacks to polearm", () => {
    const def = getWeaponLiveDef("greatsword");
    expect(def.fallbackPack).toBe("polearm");
    expect(def.liveWhenIncomplete?.attack).toMatch(/polearm/);
    const rels = liveBakeRelsForWeapon("greatsword");
    expect(rels.some((r) => !r.preferred && r.bakeRel.includes("polearm"))).toBe(true);
  });

  it("summary covers many weapons", () => {
    const rows = weaponLiveSummary();
    expect(rows.length).toBeGreaterThan(10);
    expect(listMappedWeaponIds()).toContain("crossbow");
  });

  it("shared traversal roles exist", () => {
    const t = sharedTraversalRoles();
    expect(t.jump).toBeTruthy();
    expect(t.dodge).toBeTruthy();
  });

  it("dagger/mace inherit sword incomplete fallbacks", () => {
    const d = getWeaponLiveDef("dagger");
    expect(d.animPack).toBe("sword_shield");
    expect(d.liveWhenIncomplete?.attack).toMatch(/polearm/);
    const m = getWeaponLiveDef("mace");
    expect(m.liveWhenIncomplete?.idle).toMatch(/polearm/);
  });

  it("crossbow incomplete fallbacks stay playable without longbow idle", () => {
    const def = getWeaponLiveDef("crossbow");
    expect(def.liveWhenIncomplete?.idle).toMatch(/polearm/);
    expect(def.liveWhenIncomplete?.attack).toMatch(/polearm/);
    expect(def.liveWhenIncomplete?.walk).toMatch(/longbow/);
  });

  it("rifle incomplete attack uses polearm (not missing unarmed punch)", () => {
    const def = getWeaponLiveDef("rifle");
    expect(def.liveWhenIncomplete?.attack).toBe("polearm/attack");
    expect(liveAnimPackForWeapon("hunter-rifle")).toBe("rifle");
    expect(liveAnimPackForWeapon("shotgun")).toBe("rifle");
  });
});

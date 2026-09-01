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
    expect(liveAnimPackForWeapon("greatsword")).toBe("twohand"); // clips = samurai
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

  it("greatsword uses samurai bake with dual_wield incomplete fallbacks", () => {
    const def = getWeaponLiveDef("greatsword");
    expect(def.animPack).toBe("twohand");
    expect(def.fallbackPack).toBe("samurai");
    expect(def.liveRoles?.attack).toMatch(/greatsword_samurai|gs_samurai/);
    expect(def.liveWhenIncomplete?.attack).toMatch(/dual_wield/);
    expect(String(def.liveWhenIncomplete?.attack || "")).not.toMatch(/2h_melee/);
    const rels = liveBakeRelsForWeapon("greatsword");
    expect(rels.some((r) => r.preferred && r.bakeRel.includes("samurai"))).toBe(true);
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

  it("dagger/mace inherit sword incomplete fallbacks (samurai SSOT)", () => {
    const d = getWeaponLiveDef("dagger");
    expect(d.animPack).toBe("sword_shield");
    expect(d.liveRoles?.run).not.toBe("sword_shield/sword and shield run");
    expect(d.liveWhenIncomplete?.attack).toMatch(/dual_wield|samurai|polearm/);
    const m = getWeaponLiveDef("mace");
    expect(m.liveWhenIncomplete?.idle).toMatch(/dual_wield|samurai|polearm|idle/);
  });

  it("crossbow incomplete fallbacks stay playable without longbow idle", () => {
    const def = getWeaponLiveDef("crossbow");
    expect(def.liveWhenIncomplete?.idle).toMatch(/polearm/);
    expect(def.liveWhenIncomplete?.attack).toMatch(/polearm/);
    expect(def.liveWhenIncomplete?.walk).toMatch(/longbow/);
  });

  it("rifle incomplete attack uses rifle bake (not missing unarmed punch)", () => {
    const def = getWeaponLiveDef("rifle");
    expect(def.liveWhenIncomplete?.attack).toMatch(/rifle|longbow|polearm/);
    expect(String(def.liveWhenIncomplete?.attack || "")).not.toMatch(/unarmed\/punch/);
    expect(liveAnimPackForWeapon("hunter-rifle")).toBe("rifle");
    expect(liveAnimPackForWeapon("shotgun")).toBe("rifle");
  });
});

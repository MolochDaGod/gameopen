import { describe, expect, it } from "vitest";
import { defaultHudConfig } from "./hudConfig";
import { layoutFromHydraPack, type HydraPack } from "./uiPackApply";

describe("layoutFromHydraPack", () => {
  it("maps player-frame + hotbar comps onto HUD panels", () => {
    const pack: HydraPack = {
      id: "player-grass",
      comps: [
        { id: "pf1", type: "player-frame", x: 24, y: 900, w: 300, h: 110 },
        { id: "hb1", type: "hotbar", x: 700, y: 980, w: 520, h: 64 },
      ],
    };
    const base = defaultHudConfig();
    const { moved, panels } = layoutFromHydraPack(pack, base);
    expect(moved).toContain("vitals");
    expect(moved).toContain("tightbar");
    expect(panels.vitals.dx).not.toBe(0);
    expect(panels.tightbar.hidden).toBe(false);
  });

  it("no-ops on empty pack", () => {
    const r = layoutFromHydraPack({ id: "x", comps: [] }, defaultHudConfig());
    expect(r.moved).toEqual([]);
  });
});

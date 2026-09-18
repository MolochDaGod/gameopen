import { describe, expect, it } from "vitest";
import {
  HUD_CELL_H,
  HUD_CELL_W,
  HUD_DESIGN,
  HUD_VIEWS,
  PANEL_HYDRA,
  fitHudCanvas,
  gridBox,
  viewByHydra,
  viewRect,
  viewScreenRect,
  viewsForLayout,
} from "./viewGrid";

describe("HUD view grid", () => {
  it("is a 12×12 1920×1080 HYDRA canvas (160×90 cells)", () => {
    expect(HUD_DESIGN).toEqual({ w: 1920, h: 1080, cols: 12, rows: 12 });
    expect(HUD_CELL_W).toBe(160);
    expect(HUD_CELL_H).toBe(90);
  });

  it("letterboxes into a 1280×720 viewport", () => {
    const fit = fitHudCanvas(1280, 720);
    expect(fit.s).toBeCloseTo(1280 / 1920);
    expect(fit.x).toBeCloseTo(0);
    expect(fit.y).toBeCloseTo(0);
    expect(fit.w).toBeCloseTo(1280);
  });

  it("maps hotbar-2row and every HudPanelId to a hydra type", () => {
    expect(viewByHydra("hotbar-2row")?.id).toBe("hotbar");
    expect(PANEL_HYDRA.reticle).toBe("crosshair");
    expect(PANEL_HYDRA.vitals).toBe("player-frame");
  });

  it("places the hotbar in the bottom-center cells", () => {
    const hot = viewByHydra("hotbar-2row")!;
    const g = gridBox(hot);
    expect(g.y).toBeGreaterThanOrEqual(9 * HUD_CELL_H);
    expect(viewRect(hot).w).toBeGreaterThan(300);
  });

  it("scales a view into screen space", () => {
    const fit = fitHudCanvas(1920, 1080);
    const xhair = viewByHydra("crosshair")!;
    const r = viewScreenRect(xhair, fit);
    expect(r.x + r.w / 2).toBeGreaterThan(900);
    expect(r.x + r.w / 2).toBeLessThan(1020);
  });

  it("tight layout includes orbs; classic does not require them", () => {
    const tight = viewsForLayout("tight").map((v) => v.id);
    const classic = viewsForLayout("classic").map((v) => v.id);
    expect(tight).toContain("health-orb");
    expect(classic).not.toContain("health-orb");
    expect(HUD_VIEWS.every((v) => v.col >= 1 && v.col + v.colSpan - 1 <= 12)).toBe(true);
  });
});

/**
 * 2D HUD view grid — AI + layout SSOT.
 *
 * Design canvas is HYDRA **1920×1080** (ui.grudge-studio.com). Scale with
 * letterbox `min(vw/1920, vh/1080)` — Unity Canvas Scaler / Unreal UMG
 * "scale with screen size", not a second HUD.
 *
 * CSS 2D: +X right, +Y down. Play 3D stays +Z forward / +X right.
 *
 * Existing chrome (`Hud.tsx`, TightBar, Craftpix) keeps CSS anchors.
 * This module names **views** so agents place UI / HUD / icons without guessing.
 */
import type { HudLayoutId, HudPanelId } from "./hudConfig";

export const HUD_DESIGN = {
  w: 1920,
  h: 1080,
  cols: 12,
  rows: 12,
} as const;

export const HUD_CELL_W = HUD_DESIGN.w / HUD_DESIGN.cols; // 160
export const HUD_CELL_H = HUD_DESIGN.h / HUD_DESIGN.rows; // 90

export type HudAnchor = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";

export type HydraType =
  | "minimap"
  | "healthbar"
  | "manabar"
  | "portrait"
  | "chat-window"
  | "weapon-selector"
  | "xp-bar"
  | "player-frame"
  | "target-frame"
  | "health-orb"
  | "mana-orb"
  | "action-orb"
  | "hotbar-2row"
  | "interaction-prompt"
  | "objectives"
  | "crosshair"
  | "alert-banner"
  | "dialogue-box"
  | "skill-tree";

export type HudViewRole = "hud" | "icon" | "chrome" | "modal";

export interface HudViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudView {
  id: string;
  hydra: HydraType;
  /** Existing editor panel, or null if chrome-only. */
  panel: HudPanelId | null;
  layouts: HudLayoutId[] | "all";
  anchor: HudAnchor;
  /** 1-based grid cell. */
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** HYDRA pixel box when it differs from the grid cell (classic combat outline). */
  box?: HudViewBox;
  z: number;
  role: HudViewRole;
  note: string;
}

export const PANEL_HYDRA: Record<HudPanelId, HydraType> = {
  vitals: "player-frame",
  actionbar: "hotbar-2row",
  tightbar: "hotbar-2row",
  stats: "objectives",
  enemy: "target-frame",
  status: "alert-banner",
  reticle: "crosshair",
  mech: "action-orb",
  classbar: "weapon-selector",
};

/** Combat dual-bar + tight-bar views (HYDRA types from CraftPix skill). */
export const HUD_VIEWS: readonly HudView[] = [
  {
    id: "alert",
    hydra: "alert-banner",
    panel: "status",
    layouts: "all",
    anchor: "n",
    col: 4,
    row: 1,
    colSpan: 5,
    rowSpan: 1,
    box: { x: 608, y: 80, w: 600, h: 52 },
    z: 40,
    role: "chrome",
    note: "Top-center alerts / mode chip",
  },
  {
    id: "minimap",
    hydra: "minimap",
    panel: null,
    layouts: "all",
    anchor: "ne",
    col: 11,
    row: 1,
    colSpan: 2,
    rowSpan: 3,
    box: { x: 1456, y: 0, w: 224, h: 224 },
    z: 20,
    role: "hud",
    note: "TR minimap (ArenaMinimapHud)",
  },
  {
    id: "target",
    hydra: "target-frame",
    panel: "enemy",
    layouts: "all",
    anchor: "ne",
    col: 10,
    row: 4,
    colSpan: 3,
    rowSpan: 1,
    box: { x: 1296, y: 272, w: 224, h: 64 },
    z: 22,
    role: "hud",
    note: "Locked hostile / ally frame",
  },
  {
    id: "objectives",
    hydra: "objectives",
    panel: "stats",
    layouts: "all",
    anchor: "e",
    col: 11,
    row: 5,
    colSpan: 2,
    rowSpan: 2,
    box: { x: 1456, y: 400, w: 220, h: 100 },
    z: 18,
    role: "hud",
    note: "Quest / combat readout",
  },
  {
    id: "player",
    hydra: "player-frame",
    panel: "vitals",
    layouts: "all",
    anchor: "sw",
    col: 1,
    row: 8,
    colSpan: 3,
    rowSpan: 2,
    box: { x: 256, y: 288, w: 220, h: 56 },
    z: 24,
    role: "hud",
    note: "Self portrait + HP/SP (UnitFrame / vitals)",
  },
  {
    id: "portrait",
    hydra: "portrait",
    panel: "vitals",
    layouts: ["classic"],
    anchor: "sw",
    col: 5,
    row: 9,
    colSpan: 1,
    rowSpan: 1,
    box: { x: 720, y: 736, w: 112, h: 96 },
    z: 25,
    role: "icon",
    note: "Classic Craftpix plate left of hotbar",
  },
  {
    id: "weapon",
    hydra: "weapon-selector",
    panel: "classbar",
    layouts: "all",
    anchor: "s",
    col: 5,
    row: 9,
    colSpan: 3,
    rowSpan: 1,
    box: { x: 832, y: 768, w: 304, h: 48 },
    z: 23,
    role: "hud",
    note: "Class / weapon strip above hotbar",
  },
  {
    id: "health-orb",
    hydra: "health-orb",
    panel: "tightbar",
    layouts: ["tight"],
    anchor: "s",
    col: 3,
    row: 10,
    colSpan: 1,
    rowSpan: 2,
    box: { x: 672, y: 832, w: 112, h: 128 },
    z: 26,
    role: "hud",
    note: "TightBar HP globe",
  },
  {
    id: "mana-orb",
    hydra: "mana-orb",
    panel: "tightbar",
    layouts: ["tight"],
    anchor: "s",
    col: 9,
    row: 10,
    colSpan: 1,
    rowSpan: 2,
    box: { x: 1184, y: 832, w: 128, h: 128 },
    z: 26,
    role: "hud",
    note: "TightBar stamina globe",
  },
  {
    id: "hotbar",
    hydra: "hotbar-2row",
    panel: "actionbar",
    layouts: "all",
    anchor: "s",
    col: 5,
    row: 10,
    colSpan: 4,
    rowSpan: 2,
    box: { x: 800, y: 832, w: 384, h: 130 },
    z: 28,
    role: "hud",
    note: "Primary 6+6 / 5+5 skill cluster",
  },
  {
    id: "xp",
    hydra: "xp-bar",
    panel: "actionbar",
    layouts: ["classic"],
    anchor: "s",
    col: 5,
    row: 12,
    colSpan: 4,
    rowSpan: 1,
    box: { x: 864, y: 960, w: 280, h: 13 },
    z: 27,
    role: "hud",
    note: "XP strip under hotbar",
  },
  {
    id: "action-orb",
    hydra: "action-orb",
    panel: "mech",
    layouts: "all",
    anchor: "se",
    col: 8,
    row: 9,
    colSpan: 1,
    rowSpan: 1,
    box: { x: 1136, y: 752, w: 80, h: 80 },
    z: 26,
    role: "icon",
    note: "AP / special / mech slam",
  },
  {
    id: "chat",
    hydra: "chat-window",
    panel: null,
    layouts: "all",
    anchor: "sw",
    col: 2,
    row: 9,
    colSpan: 2,
    rowSpan: 2,
    box: { x: 352, y: 784, w: 280, h: 170 },
    z: 16,
    role: "chrome",
    note: "Chat / harvest dialogue sits here",
  },
  {
    id: "dialogue",
    hydra: "dialogue-box",
    panel: null,
    layouts: "all",
    anchor: "sw",
    col: 2,
    row: 8,
    colSpan: 4,
    rowSpan: 2,
    box: { x: 160, y: 624, w: 640, h: 180 },
    z: 35,
    role: "modal",
    note: "Harvest / NPC talk (harvest outline)",
  },
  {
    id: "crosshair",
    hydra: "crosshair",
    panel: "reticle",
    layouts: "all",
    anchor: "c",
    col: 6,
    row: 6,
    colSpan: 1,
    rowSpan: 1,
    box: { x: 940, y: 520, w: 40, h: 40 },
    z: 10,
    role: "icon",
    note: "Center reticle — pointer-events none",
  },
  {
    id: "skill-tree",
    hydra: "skill-tree",
    panel: "classbar",
    layouts: "all",
    anchor: "e",
    col: 10,
    row: 8,
    colSpan: 2,
    rowSpan: 3,
    box: { x: 1392, y: 704, w: 288, h: 256 },
    z: 36,
    role: "modal",
    note: "Class / talent modal",
  },
  {
    id: "prompt",
    hydra: "interaction-prompt",
    panel: null,
    layouts: "all",
    anchor: "s",
    col: 5,
    row: 8,
    colSpan: 3,
    rowSpan: 1,
    z: 30,
    role: "chrome",
    note: "F to interact / Kenney talk button",
  },
];

export function viewUsesLayout(view: HudView, layout: HudLayoutId): boolean {
  return view.layouts === "all" || view.layouts.includes(layout);
}

export function viewsForLayout(layout: HudLayoutId): HudView[] {
  return HUD_VIEWS.filter((v) => viewUsesLayout(v, layout));
}

export function viewById(id: string): HudView | undefined {
  return HUD_VIEWS.find((v) => v.id === id);
}

export function viewByHydra(hydra: HydraType, layout: HudLayoutId = "tight"): HudView | undefined {
  return HUD_VIEWS.find((v) => v.hydra === hydra && viewUsesLayout(v, layout));
}

export function gridBox(view: Pick<HudView, "col" | "row" | "colSpan" | "rowSpan">): HudViewBox {
  return {
    x: (view.col - 1) * HUD_CELL_W,
    y: (view.row - 1) * HUD_CELL_H,
    w: view.colSpan * HUD_CELL_W,
    h: view.rowSpan * HUD_CELL_H,
  };
}

export function viewRect(view: HudView): HudViewBox {
  return view.box ?? gridBox(view);
}

export interface HudCanvasFit {
  s: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Letterbox the 1920×1080 design into the viewport. */
export function fitHudCanvas(vw: number, vh: number): HudCanvasFit {
  const s = Math.min(vw / HUD_DESIGN.w, vh / HUD_DESIGN.h);
  const w = HUD_DESIGN.w * s;
  const h = HUD_DESIGN.h * s;
  return { s, x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

export function viewScreenRect(view: HudView, fit: HudCanvasFit): HudViewBox {
  const r = viewRect(view);
  return {
    x: fit.x + r.x * fit.s,
    y: fit.y + r.y * fit.s,
    w: r.w * fit.s,
    h: r.h * fit.s,
  };
}

/** CSS for a new widget that should sit in a named view. */
export function viewStyle(view: HudView, fit: HudCanvasFit): {
  position: "absolute";
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
} {
  const r = viewScreenRect(view, fit);
  return {
    position: "absolute",
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    zIndex: view.z,
  };
}

export interface HudViewContract {
  version: string;
  design: typeof HUD_DESIGN;
  cell: { w: number; h: number };
  scale: string;
  laterality2d: string;
  play3d: string;
  hydraHost: string;
  panels: typeof PANEL_HYDRA;
  views: readonly HudView[];
}

export const HUD_VIEW_CONTRACT: HudViewContract = {
  version: "1.0.0",
  design: HUD_DESIGN,
  cell: { w: HUD_CELL_W, h: HUD_CELL_H },
  scale: "letterbox min(vw/1920, vh/1080) — same as HYDRA / Unity Canvas Scaler",
  laterality2d: "+X right, +Y down (CSS)",
  play3d: "+Z art-forward, +X right (Controller / laterality box)",
  hydraHost: "https://ui.grudge-studio.com",
  panels: PANEL_HYDRA,
  views: HUD_VIEWS,
};

export function shouldShowHudGrid(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("hudgrid") && q.get("hudgrid") !== "0") return true;
    if (window.localStorage.getItem("dangerroom:hudgrid") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

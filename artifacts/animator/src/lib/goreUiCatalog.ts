/**
 * 2D Gore UI pack — organized layers for sprites, damage popups, combat HUD.
 *
 * Source: ummorpgdev/assets/voxelhandoff/2D Gore UI (1).zip
 * Local: public/ui/gore/{frames,buttons,gauges}/
 * CDN:  assets.grudge-studio.com/ui/gore/...
 *
 * Not a replacement for GoreImpact2D billboards (slash/effect icons).
 * This pack = **UI chrome**: bars, buttons, decorative frames for layering.
 *
 * @see docs/ZONES_INAPP_PLAY.md · three/fx/goreImpact2d.ts
 */

import { FLEET } from "./fleet";

const CDN = `${FLEET.assets.replace(/\/$/, "")}/ui/gore`;
const LOCAL = "/ui/gore";

/** Prefer same-origin public in SPA; CDN for absolute / GRUDOX. */
export function goreUiUrl(rel: string, opts?: { cdn?: boolean }): string {
  const path = rel.replace(/^\//, "");
  if (opts?.cdn) return `${CDN}/${path}`;
  return `${LOCAL}/${path}`;
}

export const GORE_UI_VERSION = "1.0.0";

/** Decorative frames (popup / panel borders). */
export const GORE_UI_FRAMES = {
  backbone: "frames/backbone.png",
  rib: "frames/rib.png",
} as const;

/** Button skins: idle + pressed. */
export const GORE_UI_BUTTONS = {
  backbone: { idle: "buttons/backbone.png", pressed: "buttons/backbone_pressed.png" },
  flesh: { idle: "buttons/flesh.png", pressed: "buttons/flesh_pressed.png" },
  zombie: { idle: "buttons/zombie.png", pressed: "buttons/zombie_pressed.png" },
} as const;

/**
 * Gauge shells + fills for HP / resource bars.
 * Layer empty under fill; clip fill width by % HP.
 */
export const GORE_UI_GAUGES = {
  /** Empty gore track variants (pick by random or tier). */
  empty: [
    "gauges/gore01_empty.png",
    "gauges/gore02_empty.png",
    "gauges/gore03_empty.png",
    "gauges/gore_thick_empty.png",
    "gauges/gore_thin_empty.png",
  ],
  fleshFull: ["gauges/flesh_thick_full.png", "gauges/flesh_thin_full.png"],
  fleshRotten: "gauges/fleshrotten_full.png",
  stomach: { empty: "gauges/stomach_empty.png", full: "gauges/stomach_full.png" },
  zombieSkin: {
    thickFull: "gauges/zombieskin_thick_full.png",
    thickHalf: "gauges/zombieskin_thick_half.png",
    thinFull: "gauges/zombieskin_thin_full.png",
    thinHalf: "gauges/zombieskin_thin_half.png",
    rottenThick: "gauges/zombieskinrotten_thick_full.png",
    rottenThin: "gauges/zombieskinrotten_thin_full.png",
  },
} as const;

export type GoreUiTheme = "flesh" | "zombie" | "backbone" | "gore";

/** CSS custom properties for theming combat HUD / floats. */
export function goreUiCssVars(theme: GoreUiTheme = "gore"): Record<string, string> {
  const frame =
    theme === "backbone"
      ? goreUiUrl(GORE_UI_FRAMES.backbone)
      : goreUiUrl(GORE_UI_FRAMES.rib);
  const btn =
    theme === "zombie"
      ? goreUiUrl(GORE_UI_BUTTONS.zombie.idle)
      : theme === "flesh"
        ? goreUiUrl(GORE_UI_BUTTONS.flesh.idle)
        : goreUiUrl(GORE_UI_BUTTONS.backbone.idle);
  const barEmpty = goreUiUrl(GORE_UI_GAUGES.empty[0]!);
  const barFull =
    theme === "zombie"
      ? goreUiUrl(GORE_UI_GAUGES.zombieSkin.thickFull)
      : goreUiUrl(GORE_UI_GAUGES.fleshFull[0]!);
  return {
    "--gxo-gore-frame": `url(${frame})`,
    "--gxo-gore-button": `url(${btn})`,
    "--gxo-gore-bar-empty": `url(${barEmpty})`,
    "--gxo-gore-bar-full": `url(${barFull})`,
  };
}

/** Apply theme CSS vars onto a root element (e.g. .gxo-root). */
export function applyGoreUiTheme(
  el: HTMLElement | null,
  theme: GoreUiTheme = "gore",
): void {
  if (!el) return;
  const vars = goreUiCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
  el.dataset.goreTheme = theme;
}

/**
 * Layer roles for 2D combat feedback stack (bottom → top):
 * 1. World billboard gore (GoreImpact2D slash sprites)
 * 2. CSS2D blood flash (.gxo-blood)
 * 3. CSS2D damage number (.gxo-float)
 * 4. Optional frame chrome (.gxo-float-gore with rib/backbone bg)
 * 5. HUD gauges (unit frames) using empty + fill
 */
export const GORE_LAYER_STACK = [
  "world_billboard_impact",
  "css2d_blood",
  "css2d_damage_number",
  "popup_frame_chrome",
  "hud_gauge",
] as const;

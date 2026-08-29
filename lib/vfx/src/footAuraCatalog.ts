/**
 * CraftPix "Magic Buff Effects Pack for Top-Down Games" — aura catalog.
 *
 * Source zip: craftpix-net-207889-magic-buff-effects-pack-for-top-down-games
 * Preview: https://img.craftpix.net/2026/07/Magic-Buff-Effects-Pack-for-Top-Down-Games2.webp
 * License: https://craftpix.net/file-licenses/
 *
 * Runtime frames live under:
 *   {base}/vfx/craftpix-magic-buff/{Folder}/PNG/*_Frame_NN.png
 * Icons:
 *   {base}/vfx/craftpix-magic-buff/Icons/PNG/Icons_*.png
 *
 * Frames are 640×800 top-down compositions (ground ring + painted upright FX).
 * See FootAuraSystem for ground / billboard / hybrid orientation.
 */

export type FootAuraId =
  | "strength"
  | "debuff"
  | "immunity"
  | "life"
  | "mana"
  | "revival";

export type FootAuraKind = "buff" | "debuff" | "heal" | "utility";

export interface FootAuraDef {
  id: FootAuraId;
  /** UI / alert label */
  label: string;
  kind: FootAuraKind;
  /** Folder name under craftpix-magic-buff/ (underscores) */
  folder: string;
  /** Frame file stem prefix before `_Frame_NN.png` */
  framePrefix: string;
  frameCount: number;
  /** Icon file under Icons/PNG/ */
  iconFile: string;
  /** Default loop fps for the sheet */
  fps: number;
  /** Default world diameter in metres (SI; human ~1.8 m) */
  diameterM: number;
  /** Soft tint multiply (white keeps craftpix colors) */
  tint?: string;
}

/** SSOT catalog — six craftpix effects + icon paths for HUD alerts. */
export const FOOT_AURA_DEFS: Record<FootAuraId, FootAuraDef> = {
  strength: {
    id: "strength",
    label: "Strength",
    kind: "buff",
    folder: "Strength_Buff",
    framePrefix: "Strength_Buff",
    frameCount: 12,
    iconFile: "Icons_Strength_Buff.png",
    fps: 12,
    diameterM: 1.6,
    tint: "#ffe566",
  },
  debuff: {
    id: "debuff",
    label: "Debuff",
    kind: "debuff",
    folder: "Debuff",
    framePrefix: "Debuff",
    frameCount: 16,
    iconFile: "Icons_Debuff.png",
    fps: 12,
    diameterM: 1.55,
    tint: "#c44dff",
  },
  immunity: {
    id: "immunity",
    label: "Immunity",
    kind: "buff",
    folder: "Immunity",
    framePrefix: "Immunity",
    frameCount: 16,
    iconFile: "Icons_Immunity.png",
    fps: 12,
    diameterM: 1.65,
    tint: "#66e0ff",
  },
  life: {
    id: "life",
    label: "Life Recovery",
    kind: "heal",
    folder: "Life_Recovery",
    framePrefix: "Life_Recovery",
    frameCount: 12,
    iconFile: "Icons_Life_Recovery.png",
    fps: 10,
    diameterM: 1.5,
    tint: "#66ff88",
  },
  mana: {
    id: "mana",
    label: "Mana Recovery",
    kind: "heal",
    folder: "Mana_Recovery",
    framePrefix: "Mana_Recovery",
    frameCount: 12,
    iconFile: "Icons_Mana_Recovery.png",
    fps: 10,
    diameterM: 1.5,
    tint: "#6699ff",
  },
  revival: {
    id: "revival",
    label: "Revival",
    kind: "utility",
    folder: "Revival",
    framePrefix: "Revival",
    frameCount: 16,
    iconFile: "Icons_Revival.png",
    fps: 12,
    diameterM: 1.7,
    tint: "#ffeeaa",
  },
};

export const ALL_FOOT_AURA_IDS = Object.keys(FOOT_AURA_DEFS) as FootAuraId[];

/** URL helpers relative to app public / CDN base (no trailing slash). */
export function footAuraFrameUrl(
  base: string,
  id: FootAuraId,
  frameIndex1: number,
): string {
  const d = FOOT_AURA_DEFS[id];
  const nn = String(frameIndex1).padStart(2, "0");
  const root = base.replace(/\/$/, "");
  return `${root}/vfx/craftpix-magic-buff/${d.folder}/PNG/${d.framePrefix}_Frame_${nn}.png`;
}

export function footAuraIconUrl(base: string, id: FootAuraId): string {
  const d = FOOT_AURA_DEFS[id];
  const root = base.replace(/\/$/, "");
  return `${root}/vfx/craftpix-magic-buff/Icons/PNG/${d.iconFile}`;
}

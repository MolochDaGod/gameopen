/**
 * Production ice-bow slash projectile variants.
 *
 * Names are stable production ids: slashred / slashblue / slashpurple / slashyellow.
 * Each uses the shared stylized_ice_bow (or per-variant GLB when baked) with a
 * flame-aura-class patterned energy shader (core/mid/edge + procedural flow).
 */

import type { AuraPattern } from "./auraShaders";

/** Stable production variant ids (do not rename — skill binds + CDN keys). */
export type SlashVariantId = "slashred" | "slashblue" | "slashpurple" | "slashyellow";

export type SlashVariantDef = {
  id: SlashVariantId;
  /** Display label */
  label: string;
  /** Hot core (white-hot / pale) */
  core: number;
  /** Mid body color */
  mid: number;
  /** Edge / trail color */
  edge: number;
  /** Dark falloff */
  dark: number;
  /** Aura shell pattern (same family as body fireAura shells) */
  pattern: AuraPattern;
  /**
   * Production GLB path — shipped as models/vfx/slash/{id}.glb
   * (named slashred / slashblue / slashpurple / slashyellow assets).
   */
  modelPath: string;
  /** Shared source mesh fallback if a named file is missing. */
  fallbackModelPath: string;
  /** Tags for skill / element mapping */
  tags: string[];
};

/** Canonical production catalog — four colored Getsuga / slash-wave projectiles. */
export const SLASH_VARIANTS: Record<SlashVariantId, SlashVariantDef> = {
  slashred: {
    id: "slashred",
    label: "Slash Red",
    core: 0xfff1c0,
    mid: 0xff5a20,
    edge: 0xff2208,
    dark: 0x4a0800,
    pattern: "fireRise",
    modelPath: "models/vfx/slash/slashred.glb",
    fallbackModelPath: "models/vfx/stylized_ice_bow.glb",
    tags: ["fire", "physical", "finisher", "heavy"],
  },
  slashblue: {
    id: "slashblue",
    label: "Slash Blue",
    core: 0xf0fbff,
    mid: 0x4aa8ff,
    edge: 0x1a6ad8,
    dark: 0x061830,
    pattern: "iceSwirl",
    modelPath: "models/vfx/slash/slashblue.glb",
    fallbackModelPath: "models/vfx/stylized_ice_bow.glb",
    tags: ["ice", "frost", "getsuga", "mid"],
  },
  slashpurple: {
    id: "slashpurple",
    label: "Slash Purple",
    core: 0xf5e8ff,
    mid: 0xb070ff,
    edge: 0x6a20c8,
    dark: 0x1a0830,
    pattern: "arcanePulse",
    modelPath: "models/vfx/slash/slashpurple.glb",
    fallbackModelPath: "models/vfx/stylized_ice_bow.glb",
    tags: ["arcane", "shadow", "dark", "magic"],
  },
  slashyellow: {
    id: "slashyellow",
    label: "Slash Yellow",
    core: 0xffffff,
    mid: 0xffe08a,
    edge: 0xffb020,
    dark: 0x3a2800,
    pattern: "holyShimmer",
    modelPath: "models/vfx/slash/slashyellow.glb",
    fallbackModelPath: "models/vfx/stylized_ice_bow.glb",
    tags: ["holy", "lightning", "light", "finisher"],
  },
};

export const SLASH_VARIANT_IDS = Object.keys(SLASH_VARIANTS) as SlashVariantId[];

export function slashVariant(id: SlashVariantId | string | undefined | null): SlashVariantDef {
  if (id && id in SLASH_VARIANTS) return SLASH_VARIANTS[id as SlashVariantId];
  return SLASH_VARIANTS.slashblue;
}

/**
 * Map an authored hex color to the nearest production slash variant.
 * Prefer explicit `variant` on profiles; this is the fallback.
 */
export function slashVariantForColor(color: number): SlashVariantId {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  let best: SlashVariantId = "slashblue";
  let bestD = Infinity;
  for (const id of SLASH_VARIANT_IDS) {
    const mid = SLASH_VARIANTS[id].mid;
    const tr = ((mid >> 16) & 255) / 255;
    const tg = ((mid >> 8) & 255) / 255;
    const tb = (mid & 255) / 255;
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Melee stage → default production variant (deterministic, never random). */
export function slashVariantForStage(
  stage: number,
  opts?: { finisher?: boolean; kind?: string },
): SlashVariantId {
  if (opts?.finisher || opts?.kind === "finisher") return "slashyellow";
  if (opts?.kind === "heavy" || stage >= 2) return "slashred";
  if (stage <= 0) return "slashblue";
  return "slashpurple";
}

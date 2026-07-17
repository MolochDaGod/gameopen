/**
 * Player activity modes — Combat vs Harvest vs Build.
 *
 * **Q** cycles mode. **X** is always dodge (combat i-frames).
 * Radial wheel (hold Tab) offers mode-specific options.
 */

export type PlayerActivityMode = "combat" | "harvest" | "build";

export interface RadialOption {
  id: string;
  label: string;
  /** Short glyph for the wedge */
  glyph: string;
  /** Optional key hint shown under the label */
  hint?: string;
  /** Accent color for the wedge */
  color: string;
}

export const MODE_ORDER: PlayerActivityMode[] = ["combat", "harvest", "build"];

export const MODE_LABEL: Record<PlayerActivityMode, string> = {
  combat: "COMBAT",
  harvest: "HARVEST",
  build: "BUILD",
};

export const MODE_COLOR: Record<PlayerActivityMode, string> = {
  combat: "#ff7a7a",
  harvest: "#7ee7a8",
  build: "#7fb0ff",
};

export const MODE_BLURB: Record<PlayerActivityMode, string> = {
  // Keys match hud/quickActions.ts SSOT (Q mode, C parry, X dodge).
  combat: "Fight · skills · C parry · X dodge · Q cycle mode",
  harvest: "Gather · mine · chop · farm · fish · P production",
  build: "Place · walls · stations · demolish · P production",
};

/** Radial wedges per activity mode. */
export const RADIAL_BY_MODE: Record<PlayerActivityMode, RadialOption[]> = {
  combat: [
    { id: "attack", label: "Attack", glyph: "⚔", hint: "LMB", color: "#ff9a7a" },
    { id: "block", label: "Block", glyph: "🛡", hint: "RMB", color: "#7fd0ff" },
    { id: "dodge", label: "Dodge", glyph: "↷", hint: "X", color: "#9fe8ff" },
    { id: "parry", label: "Parry", glyph: "✦", hint: "C", color: "#ffe08a" },
    { id: "heavy", label: "Heavy", glyph: "💥", hint: "R", color: "#ffb24d" },
    { id: "kick", label: "Kick", glyph: "🦵", hint: "V", color: "#c8a0ff" },
    { id: "potion", label: "Potion", glyph: "⚗", hint: "J", color: "#7ee7a8" },
    { id: "skill", label: "Skill", glyph: "✦", hint: "F", color: "#b98cff" },
  ],
  harvest: [
    { id: "gather", label: "Gather", glyph: "🌿", hint: "LMB", color: "#7ee7a8" },
    { id: "skin", label: "Skin", glyph: "🥩", hint: "E", color: "#e8a070" },
    { id: "mine", label: "Mine", glyph: "⛏", hint: "LMB", color: "#a0b0c8" },
    { id: "chop", label: "Chop", glyph: "🪓", hint: "LMB", color: "#c98a3d" },
    { id: "dig", label: "Dig", glyph: "🪣", hint: "LMB", color: "#c4a070" },
    { id: "forage", label: "Forage", glyph: "🫐", hint: "LMB", color: "#90d070" },
    { id: "fish", label: "Fish", glyph: "🎣", color: "#70c0e0" },
    { id: "farm", label: "Farm", glyph: "🌾", color: "#d0d060" },
  ],
  build: [
    { id: "place", label: "Place", glyph: "▣", hint: "LMB", color: "#7fb0ff" },
    { id: "wall", label: "Wall", glyph: "▤", color: "#88a0d0" },
    { id: "floor", label: "Floor", glyph: "▥", color: "#6a90c0" },
    { id: "ramp", label: "Ramp", glyph: "◢", color: "#a0c0ff" },
    { id: "door", label: "Door", glyph: "⌂", color: "#c0d0ff" },
    { id: "station", label: "Station", glyph: "🏭", color: "#ffd28a" },
    { id: "paint", label: "Paint", glyph: "🎨", color: "#c4a0ff" },
    { id: "demolish", label: "Demolish", glyph: "🗑", hint: "RMB", color: "#ff7a7a" },
  ],
};

export function nextMode(cur: PlayerActivityMode): PlayerActivityMode {
  const i = MODE_ORDER.indexOf(cur);
  return MODE_ORDER[(i + 1) % MODE_ORDER.length]!;
}

export function prevMode(cur: PlayerActivityMode): PlayerActivityMode {
  const i = MODE_ORDER.indexOf(cur);
  return MODE_ORDER[(i - 1 + MODE_ORDER.length) % MODE_ORDER.length]!;
}

/** Default tool selected when entering a mode. */
export function defaultToolForMode(mode: PlayerActivityMode): string {
  return RADIAL_BY_MODE[mode][0]!.id;
}

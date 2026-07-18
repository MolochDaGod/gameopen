/**
 * Player activity modes — Combat vs Harvest vs Build.
 *
 * **Combat mode is NOT a separate character system.** It is the Danger Room
 * combat stack already on {@link Studio}: Controller locomotion, soft lock,
 * RMB sticky focus (`setLockTarget`), arsenal skills, grudge6/Character anims
 * (`setLocomotion` + `playRoleOnce`), Targets AI, VFX/SFX. Harvest/build only
 * rebind LMB/RMB tools; they must not fork combat.
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

/** Local public icons (real UI pack assets) for mode banner. */
export const MODE_ICON: Record<PlayerActivityMode, string> = {
  combat: "/icons/combat-pad.png",
  harvest: "/icons/harvest.png",
  build: "/icons/build.png",
};

/** Craftpix frame used behind the centre mode banner. */
export const MODE_BANNER_FRAME = "/ui/craftpix/part3/ab2_shurtcut_frame.png";

export const MODE_BLURB: Record<PlayerActivityMode, string> = {
  // Keys match hud/quickActions.ts SSOT. Combat = full Danger Room stack.
  combat:
    "DR combat · Q mode · Shift+Q arms · soft LMB · RMB focus · X roll · C parry · E guard · F/1–4 skills",
  harvest:
    "Shoulder TPS · LMB select node · RMB walk+swing · tools gather/chop/mine/skin · P production",
  build: "Shoulder TPS · place · walls · stations · towers · traps · P production",
};

/** Radial wedges per activity mode. */
export const RADIAL_BY_MODE: Record<PlayerActivityMode, RadialOption[]> = {
  combat: [
    { id: "attack", label: "Attack", glyph: "⚔", hint: "LMB+", color: "#ff9a7a" },
    { id: "block", label: "Guard", glyph: "🛡", hint: "E", color: "#7fd0ff" },
    { id: "dodge", label: "Roll", glyph: "↷", hint: "X", color: "#9fe8ff" },
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
    { id: "place", label: "Flag", glyph: "⚑", hint: "LMB", color: "#e8c547" },
    { id: "wall", label: "Wall", glyph: "▤", color: "#88a0d0" },
    { id: "barracks", label: "Barracks", glyph: "⚔", color: "#8899bb" },
    { id: "archery", label: "Archery", glyph: "🏹", color: "#6a9a70" },
    { id: "door", label: "Door", glyph: "⌂", color: "#c0d0ff" },
    { id: "gate", label: "Gate", glyph: "⛩", color: "#a0b8e0" },
    { id: "tower", label: "Tower", glyph: "🗼", color: "#708090" },
    { id: "trap", label: "Trap", glyph: "⚠", color: "#e07070" },
    { id: "bench", label: "Bench", glyph: "🪑", color: "#c4a060" },
    { id: "station", label: "Forge", glyph: "🏭", color: "#ffd28a" },
    { id: "farm_plot", label: "Farm", glyph: "🌾", color: "#6a8a40" },
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

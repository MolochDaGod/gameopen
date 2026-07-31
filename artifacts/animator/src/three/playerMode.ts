/**
 * Player activity modes — Combat vs Harvest vs Build.
 *
 * **Combat mode is NOT a separate character system.** It is the Danger Room
 * combat stack already on {@link Studio}: Controller locomotion, soft lock,
 * RMB sticky focus (`setLockTarget`), arsenal skills, grudge6/Character anims
 * (`setLocomotion` + `playRoleOnce`), Targets AI, VFX/SFX. Harvest/build only
 * rebind LMB/RMB tools; they must not fork combat.
 *
 * Input SSOT (production):
 *   · **Hold Q** → mode radial (↑ combat · ↓ harvest); tap Q cycles combat↔harvest
 *   · **Hold R** (harvest) → tool radial (all harvest tools); combat R = heavy
 *   · **Hold Tab** → mode-options radial (combat actions / build placeables)
 *   · **J / H / V** → bag utility slots (consumables · deployables · mounts)
 *   · **X** always dodge (combat i-frames)
 */

export type PlayerActivityMode = "combat" | "harvest" | "build";

/** Which radial wheel is open (Hud + Studio). */
export type RadialKind = "none" | "mode" | "tool" | "options";

export interface RadialOption {
  id: string;
  label: string;
  /** Short glyph for the wedge */
  glyph: string;
  /** Optional key hint shown under the label */
  hint?: string;
  /** Accent color for the wedge */
  color: string;
  /** Optional icon URL (CDN / local) for HUD slots */
  iconUrl?: string;
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
    "Hold Q mode · J/H/V bag · soft LMB · RMB focus · X roll · C parry · E guard · F/1–4",
  harvest:
    "Hold Q mode · Hold R tools · LMB node · tool skills 2–5 · J/H/V use · bag craft",
  build: "Hold Q mode · Tab placeables · LMB place · J/H/V deploy · bag · P production",
};

/**
 * Hold-Q mode switch radial.
 * Screen layout: top wedge = Combat, bottom wedge = Harvest (mouse up/down).
 * Two wedges keep the axis clean (fleet parity with other deployments).
 */
export const MODE_SWITCH_RADIAL: RadialOption[] = [
  { id: "mode_combat", label: "Combat", glyph: "⚔", hint: "↑", color: "#ff7a7a" },
  { id: "mode_harvest", label: "Harvest", glyph: "🌿", hint: "↓", color: "#7ee7a8" },
];

/** Radial wedges per activity mode (Tab options / harvest tools list). */
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

/**
 * Harvest left HUD: slot 1 = equipped tool; slots 2–5 = that tool's task skills.
 * Keys 1–4 fire skill indices 0–3 while the tool is equipped.
 */
const skill = (
  id: string,
  label: string,
  glyph: string,
  color: string,
  hint?: string,
): RadialOption => ({ id, label, glyph, color, hint });

export const HARVEST_TOOL_SKILLS: Record<string, RadialOption[]> = {
  gather: [
    skill("gather_quick", "Quick Pick", "✋", "#7ee7a8", "1"),
    skill("gather_bundle", "Bundle", "🧺", "#90d070", "2"),
    skill("gather_rare", "Seek Rare", "💎", "#c0e090", "3"),
    skill("gather_area", "Sweep", "◎", "#a0d888", "4"),
  ],
  skin: [
    skill("skin_clean", "Clean Cut", "🔪", "#e8a070", "1"),
    skill("skin_hide", "Prime Hide", "🦌", "#d09060", "2"),
    skill("skin_meat", "Butcher", "🥩", "#c87850", "3"),
    skill("skin_trophy", "Trophy", "🏆", "#e8c070", "4"),
  ],
  mine: [
    skill("mine_strike", "Strike", "⛏", "#a0b0c8", "1"),
    skill("mine_vein", "Follow Vein", "⛓", "#8898b0", "2"),
    skill("mine_blast", "Crack", "💥", "#c0a888", "3"),
    skill("mine_survey", "Survey", "📡", "#90a8c8", "4"),
  ],
  chop: [
    skill("chop_swing", "Swing", "🪓", "#c98a3d", "1"),
    skill("chop_fell", "Fell", "🌲", "#a07030", "2"),
    skill("chop_split", "Split", "🪵", "#b88848", "3"),
    skill("chop_clear", "Clear", "✂", "#d0a060", "4"),
  ],
  dig: [
    skill("dig_scoop", "Scoop", "🪣", "#c4a070", "1"),
    skill("dig_trench", "Trench", "〰", "#a88858", "2"),
    skill("dig_clay", "Clay Bed", "🧱", "#b09070", "3"),
    skill("dig_bury", "Bury", "⬇", "#908060", "4"),
  ],
  forage: [
    skill("forage_pick", "Pick", "🫐", "#90d070", "1"),
    skill("forage_herb", "Herbs", "☘", "#70c060", "2"),
    skill("forage_mushroom", "Fungi", "🍄", "#c09070", "3"),
    skill("forage_track", "Track", "👣", "#a0c080", "4"),
  ],
  fish: [
    skill("fish_cast", "Cast", "🎣", "#70c0e0", "1"),
    skill("fish_lure", "Lure", "✦", "#60b0d0", "2"),
    skill("fish_net", "Net", "🕸", "#80c8e8", "3"),
    skill("fish_deep", "Deep", "🌊", "#5080b0", "4"),
  ],
  farm: [
    skill("farm_till", "Till", "🌾", "#d0d060", "1"),
    skill("farm_plant", "Plant", "🌱", "#90c050", "2"),
    skill("farm_water", "Water", "💧", "#70b0e0", "3"),
    skill("farm_harvest", "Reap", "✂", "#e0c060", "4"),
  ],
};

/** Tool skills for the equipped harvest tool (slots 2–5). */
export function toolSkillsFor(toolId: string): RadialOption[] {
  const id = String(toolId || "gather").toLowerCase();
  if (HARVEST_TOOL_SKILLS[id]) return HARVEST_TOOL_SKILLS[id]!;
  // Alias common Studio / forest tool ids
  if (id === "axe" || id === "wood" || id === "hatchet") return HARVEST_TOOL_SKILLS.chop!;
  if (id === "pick" || id === "pickaxe" || id === "ore") return HARVEST_TOOL_SKILLS.mine!;
  if (id === "knife" || id === "skinning") return HARVEST_TOOL_SKILLS.skin!;
  if (id === "sickle" || id === "herb") return HARVEST_TOOL_SKILLS.forage!;
  if (id === "rod" || id === "fishing") return HARVEST_TOOL_SKILLS.fish!;
  if (id === "hoe") return HARVEST_TOOL_SKILLS.farm!;
  return HARVEST_TOOL_SKILLS.gather!;
}

/** Resolve mode id from mode-radial selection (`mode_combat` → combat). */
export function modeFromRadialId(id: string): PlayerActivityMode | null {
  if (id === "mode_combat" || id === "combat") return "combat";
  if (id === "mode_harvest" || id === "harvest") return "harvest";
  if (id === "mode_build" || id === "build") return "build";
  return null;
}

/** Combat ↔ harvest only (build via Tab options / explicit set). */
export function nextCombatHarvest(cur: PlayerActivityMode): PlayerActivityMode {
  if (cur === "combat") return "harvest";
  return "combat";
}

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

/** Options list for a radial kind. */
export function radialOptionsFor(
  kind: RadialKind,
  mode: PlayerActivityMode,
): RadialOption[] {
  if (kind === "mode") return MODE_SWITCH_RADIAL;
  if (kind === "tool") return RADIAL_BY_MODE.harvest;
  if (kind === "options") return RADIAL_BY_MODE[mode];
  return [];
}

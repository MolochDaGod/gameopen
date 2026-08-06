/**
 * Danger Room / Open combat hotkey SSOT for help overlay + HUD chips.
 * Keep in sync with App.tsx panel keys and Studio.handleKey combat keys.
 */

export type HotkeyGroupId =
  | "move"
  | "combat"
  | "mode"
  | "camera"
  | "panels"
  | "vfx"
  | "utility";

export type HotkeyEntry = {
  /** Display key(s), e.g. "WASD", "Shift+1–5" */
  keys: string;
  /** Short action label */
  action: string;
  /** Optional longer tip */
  tip?: string;
  /** Only show in these modes; omit = always */
  modes?: Array<"danger" | "play" | "combat" | "harvest">;
};

export type HotkeyGroup = {
  id: HotkeyGroupId;
  title: string;
  entries: HotkeyEntry[];
};

/** Full keyboard map for F1 help overlay. */
export const HOTKEY_GROUPS: readonly HotkeyGroup[] = [
  {
    id: "move",
    title: "Move",
    entries: [
      { keys: "WASD", action: "Move", tip: "Camera-relative" },
      { keys: "Space", action: "Jump", tip: "Double-jump when unlocked" },
      { keys: "Shift", action: "Sprint", tip: "Faster run (not roll)" },
      { keys: "X", action: "Roll / dodge", tip: "Shared locomotion rolls" },
      { keys: "Ctrl", action: "Crouch (when wired)" },
    ],
  },
  {
    id: "combat",
    title: "Combat",
    entries: [
      { keys: "LMB", action: "Attack / select", tip: "Combo in hard focus" },
      { keys: "RMB", action: "Focus lock", tip: "Toggle hard / soft target" },
      { keys: "1–4", action: "Weapon skills", tip: "Signature slots" },
      { keys: "F", action: "Weapon skill F", tip: "Primary weapon ability" },
      { keys: "R", action: "Heavy / skyfall", tip: "Combat only (harvest: tools)" },
      { keys: "C", action: "Parry", tip: "In pointer-lock" },
      { keys: "E", action: "Guard / block", tip: "Forcefield in combat" },
      { keys: "Tab", action: "Cycle enemy", tip: "Hold = radial · Shift = ally" },
      { keys: "V", action: "Kick / utility", tip: "Combat kick · bag mount when bound" },
    ],
  },
  {
    id: "mode",
    title: "Mode & harvest",
    entries: [
      { keys: "Hold Q", action: "Mode radial", tip: "↑ combat · ↓ harvest" },
      { keys: "Tap Q", action: "Toggle combat ↔ harvest" },
      { keys: "Shift+Q", action: "Swap main ↔ side arm", modes: ["combat"] },
      { keys: "Hold R", action: "Tool radial", modes: ["harvest"] },
      { keys: "P", action: "Production UI", tip: "Craft / maps / trees" },
      { keys: "B", action: "Camp claim flag", tip: "Alt+B is VFX — not this" },
    ],
  },
  {
    id: "camera",
    title: "Camera & mouse",
    entries: [
      { keys: "F8 / \\", action: "Free mouse", tip: "UI without pointer lock" },
      { keys: "F9 / '", action: "Re-lock aim", tip: "Close panels first" },
      { keys: "Esc", action: "Close overlays", tip: "Then unlock mouse" },
      { keys: "F1 / ?", action: "This help", tip: "Toggle hotkey guide" },
    ],
  },
  {
    id: "panels",
    title: "Panels (Danger)",
    entries: [
      { keys: "I", action: "Equipment / sheet" },
      { keys: "K", action: "Weapon skill trees" },
      { keys: "`", action: "Admin / Master AI" },
      { keys: "E", action: "Editor panel", tip: "Only when mouse free" },
      { keys: "C", action: "Clips panel", tip: "Only when mouse free" },
      { keys: "J / H", action: "Bag consumable / deploy" },
    ],
  },
  {
    id: "vfx",
    title: "VFX sandbox (Alt+)",
    entries: [
      { keys: "Alt+V", action: "Ice serpent" },
      { keys: "Alt+B", action: "Moon beam" },
      { keys: "Alt+F", action: "Frost wave" },
      { keys: "Alt+G", action: "Fire aura" },
      { keys: "Alt+T", action: "Earth surge" },
      { keys: "Alt+C", action: "Fireball" },
      { keys: "Alt+Space", action: "Getsuga slash" },
    ],
  },
  {
    id: "utility",
    title: "Class & UI",
    entries: [
      { keys: "Shift+1–5", action: "Class skills", tip: "Top skill bar" },
      { keys: "M", action: "Map / minimap (when wired)" },
      { keys: "Enter", action: "Chat focus (when open)" },
    ],
  },
] as const;

/** Compact chips under HUD (always short). */
export const HUD_KEY_CHIPS: readonly { key: string; label: string }[] = [
  { key: "Q", label: "Mode" },
  { key: "RMB", label: "Focus" },
  { key: "LMB", label: "Atk" },
  { key: "X", label: "Roll" },
  { key: "C", label: "Parry" },
  { key: "E", label: "Guard" },
  { key: "1–4", label: "Skills" },
  { key: "F1", label: "Help" },
];

/** One-line footer (must stay short for classic bar). */
export const COMBAT_KEY_LEGEND_V2 =
  "Q mode · RMB focus · LMB atk · X roll · C parry · E guard · F/1–4 · F8 free mouse · F1 help";

/** Harvest mode chips. */
export const HARVEST_KEY_CHIPS: readonly { key: string; label: string }[] = [
  { key: "Q", label: "Mode" },
  { key: "Hold R", label: "Tools" },
  { key: "LMB", label: "Use" },
  { key: "P", label: "Prod" },
  { key: "B", label: "Camp" },
  { key: "J/H/V", label: "Bag" },
  { key: "F1", label: "Help" },
];

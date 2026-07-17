// Bindable quick actions for the HUD combat cluster's 6+6 side wings.
// Pure data so it is unit-testable without a DOM and safe to import from
// hudConfig / Hud.tsx / playerMode legends.
//
// Keybind SSOT (Danger Room / Open combat):
//   Q = activity mode cycle (not parry)
//   C = parry · X = dodge · RMB = block · R = heavy · F / 1–4 skills · J heal · H bomb · V kick

import type { IconName } from "../three/icons";

/** Everything a combat-wing slot can be bound to. */
export type QuickActionId =
  | "primary"
  | "fskill"
  | "sig1"
  | "sig2"
  | "sig3"
  | "sig4"
  | "heavy"
  | "parry"
  | "block"
  | "dodge"
  | "kick"
  | "bomb"
  | "heal"
  | "mode";

export type QuickActionKind = "action" | "skill" | "item" | "meta";

export interface QuickAction {
  id: QuickActionId;
  /** Friendly name shown under the slot (skills may override with live data). */
  label: string;
  /** Framed RPG icon name (see three/icons.ts). */
  icon: IconName;
  /** Input key/button label, e.g. "LMB", "F", "C". */
  key: string;
  kind: QuickActionKind;
}

/**
 * Canonical action catalog — keys MUST match Studio.handleKey + Hud wings.
 * Do not re-hardcode keys in Hud.tsx or mode blurbs without updating this file.
 */
export const QUICK_ACTIONS: Record<QuickActionId, QuickAction> = {
  primary: { id: "primary", label: "Attack", icon: "attack", key: "LMB", kind: "action" },
  fskill: { id: "fskill", label: "Weapon Skill", icon: "skill-vfx-lab", key: "F", kind: "skill" },
  sig1: { id: "sig1", label: "Signature 1", icon: "scout", key: "1", kind: "skill" },
  sig2: { id: "sig2", label: "Signature 2", icon: "ambush", key: "2", kind: "skill" },
  sig3: { id: "sig3", label: "Signature 3", icon: "siege", key: "3", kind: "skill" },
  sig4: { id: "sig4", label: "Signature 4", icon: "skill-vfx-lab", key: "4", kind: "skill" },
  heavy: { id: "heavy", label: "Heavy / Skyfall", icon: "charge", key: "R", kind: "action" },
  parry: { id: "parry", label: "Parry", icon: "rally", key: "C", kind: "action" },
  block: { id: "block", label: "Block", icon: "guard", key: "RMB", kind: "action" },
  dodge: { id: "dodge", label: "Dodge", icon: "retreat", key: "X", kind: "action" },
  kick: { id: "kick", label: "Kick", icon: "attack", key: "V", kind: "action" },
  bomb: { id: "bomb", label: "Bomb", icon: "siege", key: "H", kind: "item" },
  heal: { id: "heal", label: "Heal Tonic", icon: "rest", key: "J", kind: "item" },
  mode: { id: "mode", label: "Mode Cycle", icon: "skill-vfx-lab", key: "Q", kind: "meta" },
};

export const QUICK_ACTION_IDS = Object.keys(QUICK_ACTIONS) as QuickActionId[];

export function isQuickActionId(v: unknown): v is QuickActionId {
  return typeof v === "string" && v in QUICK_ACTIONS;
}

/** 6 slots per side wing. */
export const QUICK_SLOTS_PER_SIDE = 6;
/** Total quick-menu slots (left wing + right wing). */
export const QUICK_SLOT_COUNT = QUICK_SLOTS_PER_SIDE * 2;

/** A slot binding: a quick action id, or null for an empty slot. */
export type QuickSlots = (QuickActionId | null)[];

/**
 * Default 6+6 loadout (threejs-rapier tight HUD):
 *   Left  = offense + skills (LMB F 1 2 3 4)
 *   Right = defense + utility (X C R V J H)
 */
export function defaultQuickSlots(): QuickSlots {
  return [
    // Left wing (grid fill order: row-major 2×3)
    "primary",
    "fskill",
    "sig1",
    "sig2",
    "sig3",
    "sig4",
    // Right wing
    "dodge",
    "parry",
    "heavy",
    "kick",
    "heal",
    "bomb",
  ];
}

export function leftWingSlots(slots: QuickSlots = defaultQuickSlots()): QuickSlots {
  return slots.slice(0, QUICK_SLOTS_PER_SIDE);
}

export function rightWingSlots(slots: QuickSlots = defaultQuickSlots()): QuickSlots {
  return slots.slice(QUICK_SLOTS_PER_SIDE, QUICK_SLOT_COUNT);
}

/**
 * Clamp a (possibly hostile) persisted quick-slot list: unknown ids become
 * empty slots, and the list is padded/truncated to exactly QUICK_SLOT_COUNT.
 */
export function clampQuickSlots(raw: unknown): QuickSlots {
  if (!Array.isArray(raw)) return defaultQuickSlots();
  const out: QuickSlots = [];
  for (let i = 0; i < QUICK_SLOT_COUNT; i++) {
    const v = raw[i];
    out.push(isQuickActionId(v) ? v : null);
  }
  return out;
}

/** Short footer legend used by Hud / mode chip (always matches Studio keys). */
export const COMBAT_KEY_LEGEND =
  "Q mode · X dodge · C parry · RMB block · R heavy · F/1–4 skills · hold Tab radial · P production";

export const COMBAT_KEY_CHIPS: readonly string[] = [
  "Q: Mode",
  "RMB: Block",
  "X: Roll",
  "C: Parry",
  "R: Heavy",
  "H: Bomb",
  "J: Heal",
];

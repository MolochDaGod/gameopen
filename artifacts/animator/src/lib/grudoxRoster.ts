/**
 * Characters GRUDOX 4-slot roster bridge.
 *
 * charactersgrudox campfire lobby persists up to 4 heroes under
 * `animator.lobby.roster.v1` (and namespaced `.u.<grudgeId>` when signed in).
 * Genesis / Open handoff must surface those slots — not a 6-race free pick.
 *
 * Slot shape matches Fantasy-Scene-Creator charactersgrudox
 * `three/lobby/characterRoster.ts` (MAX_SLOTS = 4).
 */

import type { GrudgeCharacter } from "./grudgeAuth";

export const GRUDOX_MAX_SLOTS = 4;

export type GrudoxSavedCharacter = {
  uuid: string;
  slot: number;
  name: string;
  /** Base form id: explorer, race-human, grudge-western-kingdoms-knight, … */
  baseId: string;
  createdAt?: number;
};

const STORAGE_KEY = "animator.lobby.roster.v1";

/**
 * Map charactersgrudox baseId → Warlord Genesis PrefabRaceId
 * (human | barbarian | dwarf | elf | orc | undead).
 */
export function baseIdToRaceKey(baseId: string | null | undefined): string {
  const b = (baseId || "").toLowerCase().replace(/_/g, "-");
  if (!b || b === "explorer" || b === "led-monk" || b === "archmage") return "human";
  if (b.includes("orc")) return "orc";
  if (b.includes("undead") || b === "ud") return "undead";
  if (b.includes("barb")) return "barbarian";
  if (b.includes("dwarf") || b.includes("dwf")) return "dwarf";
  // Prefab uses "elf" (not high_elf)
  if (b.includes("elf")) return "elf";
  if (b.includes("human") || b.includes("kingdom") || b.includes("western") || b === "wk") {
    return "human";
  }
  if (b.startsWith("race-")) {
    const rest = b.slice(5);
    if (rest === "high-elf" || rest === "highelf") return "elf";
    return rest || "human";
  }
  return "human";
}

/** Alias kept for Open UI cards that still label High Elf. */
export function raceKeyToLabel(raceKey: string): string {
  if (raceKey === "elf" || raceKey === "high_elf") return "High Elf";
  const labels: Record<string, string> = {
    human: "Human",
    orc: "Orc",
    undead: "Undead",
    barbarian: "Barbarian",
    dwarf: "Dwarf",
  };
  return labels[raceKey] || "Hero";
}

/** Map baseId → Animator character catalog id (for Danger Room / Studio). */
export function baseIdToAnimatorId(baseId: string | null | undefined): string {
  const b = (baseId || "").toLowerCase();
  if (!b) return "explorer";
  if (b.startsWith("grudge-")) return b;
  if (b.startsWith("race-")) return b;
  if (b === "human") return "race-human";
  if (b === "orc") return "race-orc";
  if (b === "dwarf") return "race-dwarf";
  if (b.includes("elf")) return "race-high-elf";
  if (b.includes("barb")) return "race-barbarian";
  if (b.includes("undead")) return "race-undead";
  if (b === "explorer" || b === "grudge") return "explorer";
  return b;
}

function readRosterFromKey(key: string): GrudoxSavedCharacter[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: GrudoxSavedCharacter[] = [];
    for (const item of parsed) {
      const c = item as Partial<GrudoxSavedCharacter>;
      if (!c || typeof c.baseId !== "string") continue;
      const slot = typeof c.slot === "number" ? c.slot : out.length;
      if (slot < 0 || slot >= GRUDOX_MAX_SLOTS) continue;
      const uuid =
        typeof c.uuid === "string" && c.uuid
          ? c.uuid
          : `grudox-slot-${slot}-${c.baseId}`;
      out.push({
        uuid,
        slot,
        name: typeof c.name === "string" && c.name ? c.name : "Adventurer",
        baseId: c.baseId,
        createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
      });
    }
    return out.sort((a, b) => a.slot - b.slot).slice(0, GRUDOX_MAX_SLOTS);
  } catch {
    return [];
  }
}

/**
 * Load the 4-slot charactersgrudox roster for this browser.
 * Prefers account-namespaced key when grudge_id is known.
 */
export function loadGrudoxRosterSlots(): GrudoxSavedCharacter[] {
  if (typeof localStorage === "undefined") return [];
  let grudgeId = "";
  try {
    grudgeId =
      localStorage.getItem("grudge_id") ||
      localStorage.getItem("grudge_account_id") ||
      "";
  } catch {
    /* */
  }
  if (grudgeId) {
    const scoped = readRosterFromKey(`${STORAGE_KEY}.u.${grudgeId}`);
    if (scoped.length) return scoped;
  }
  return readRosterFromKey(STORAGE_KEY);
}

/** Convert a grudox slot into a GameSession / fleet character row. */
export function grudoxSlotToGrudgeCharacter(s: GrudoxSavedCharacter): GrudgeCharacter {
  const raceKey = baseIdToRaceKey(s.baseId);
  const raceIdMap: Record<string, string> = {
    human: "human",
    orc: "orc",
    undead: "undead",
    barbarian: "barbarian",
    dwarf: "dwarf",
    high_elf: "high_elf",
  };
  return {
    id: s.uuid,
    name: s.name,
    raceId: raceIdMap[raceKey] || "human",
    classId: s.baseId.includes("mage")
      ? "mage"
      : s.baseId.includes("ranger")
        ? "ranger"
        : s.baseId.includes("knight")
          ? "knight"
          : "warrior",
    level: 1,
    config: {
      baseId: s.baseId,
      slot: s.slot,
      source: "charactersgrudox",
      raceKey,
    },
  };
}

/** Up to 4 GrudgeCharacter rows from charactersgrudox slots. */
export function loadGrudoxCharacters(): GrudgeCharacter[] {
  return loadGrudoxRosterSlots().map(grudoxSlotToGrudgeCharacter);
}

/** Display meta for Genesis picker cards. */
export type GenesisHeroOption = {
  id: string;
  name: string;
  baseId: string;
  raceKey: string;
  raceLabel: string;
  slot: number;
  source: "grudox" | "fleet";
};

const RACE_LABEL: Record<string, string> = {
  human: "Human",
  orc: "Orc",
  undead: "Undead",
  barbarian: "Barbarian",
  dwarf: "Dwarf",
  elf: "High Elf",
  high_elf: "High Elf",
};

/** Read handoff baseId/name left by charactersgrudox query capture. */
function handoffMeta(): { id: string | null; baseId: string | null; name: string | null } {
  try {
    return {
      id:
        sessionStorage.getItem("grudge.open.selectedCharacterId") ||
        localStorage.getItem("grudge.open.selectedCharacterId") ||
        localStorage.getItem("grudge.activeCharId"),
      baseId:
        sessionStorage.getItem("grudge.open.baseId") ||
        localStorage.getItem("animator.activeCharacterId"),
      name: sessionStorage.getItem("grudge.open.characterName"),
    };
  } catch {
    return { id: null, baseId: null, name: null };
  }
}

/**
 * Build the Genesis hero picker list (max 4).
 * Prefers charactersgrudox slots; fills remaining from fleet roster + URL handoff.
 */
export function buildGenesisHeroOptions(
  fleet: GrudgeCharacter[],
  preferredId?: string | null,
): GenesisHeroOption[] {
  const slots = loadGrudoxRosterSlots();
  const options: GenesisHeroOption[] = [];
  const seen = new Set<string>();
  const handoff = handoffMeta();

  for (const s of slots) {
    if (options.length >= GRUDOX_MAX_SLOTS) break;
    const raceKey = baseIdToRaceKey(s.baseId);
    options.push({
      id: s.uuid,
      name: s.name,
      baseId: s.baseId,
      raceKey,
      raceLabel: RACE_LABEL[raceKey] || "Human",
      slot: s.slot,
      source: "grudox",
    });
    seen.add(s.uuid);
  }

  // URL/session handoff character (cross-origin from charactersgrudox when roster not shared)
  if (handoff.id && !seen.has(handoff.id) && options.length < GRUDOX_MAX_SLOTS) {
    const baseId = handoff.baseId || "explorer";
    const raceKey = baseIdToRaceKey(baseId);
    options.unshift({
      id: handoff.id,
      name: handoff.name || "Hero",
      baseId,
      raceKey,
      raceLabel: RACE_LABEL[raceKey] || "Human",
      slot: 0,
      source: "grudox",
    });
    seen.add(handoff.id);
  }

  for (const c of fleet) {
    if (options.length >= GRUDOX_MAX_SLOTS) break;
    if (seen.has(c.id)) continue;
    const baseId =
      (typeof c.config?.baseId === "string" && c.config.baseId) ||
      (c.raceId ? `race-${c.raceId}` : "explorer");
    const raceKey = baseIdToRaceKey(baseId) || baseIdToRaceKey(c.raceId);
    options.push({
      id: c.id,
      name: c.name,
      baseId,
      raceKey,
      raceLabel: RACE_LABEL[raceKey] || c.raceId || "Hero",
      slot: options.length,
      source: "fleet",
    });
    seen.add(c.id);
  }

  // Guarantee at least one playable option (fresh install / empty roster)
  if (options.length === 0) {
    options.push({
      id: "default-explorer",
      name: "Explorer",
      baseId: "explorer",
      raceKey: "human",
      raceLabel: "Human",
      slot: 0,
      source: "grudox",
    });
  }

  // Prefer preferredId first in display selection (caller handles select)
  void preferredId;
  return options.slice(0, GRUDOX_MAX_SLOTS);
}

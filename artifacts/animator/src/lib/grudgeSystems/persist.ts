/**
 * Persist grudge systems sheet (attrs, class, mastery XP) per character.
 * Local cache always; Railway bag when signed in (saveData.open.bags.grudgeSystems).
 */

import type { AttrMap } from "./statsEngine";
import { defaultAttrs } from "./statsEngine";
import { gameSession } from "../../game/GameSession";
import { saveCharacterGameBag } from "../characterLoadout";

export const SYSTEMS_BAG_KEY = "grudgeSystems";
const LS_PREFIX = "open.grudgeSystems.v1.";

export type GrudgeSystemsState = {
  attrs: AttrMap;
  level: number;
  classId: string | null;
  masteryXp: Record<string, number>;
  /** Skill nodes unlocked (class/weapon) — ids only for now */
  unlocked: string[];
};

export function defaultSystemsState(): GrudgeSystemsState {
  return {
    attrs: defaultAttrs(),
    level: 1,
    classId: null,
    masteryXp: {},
    unlocked: [],
  };
}

function lsKey(characterId: string): string {
  return `${LS_PREFIX}${characterId || "guest"}`;
}

export function loadSystemsState(characterId: string): GrudgeSystemsState {
  const base = defaultSystemsState();
  try {
    const raw = localStorage.getItem(lsKey(characterId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GrudgeSystemsState>;
      return {
        ...base,
        ...parsed,
        attrs: { ...base.attrs, ...(parsed.attrs || {}) },
        masteryXp: { ...(parsed.masteryXp || {}) },
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      };
    }
  } catch {
    /* ignore */
  }

  // Try Railway character saveData bag
  try {
    const ch = gameSession.selectedCharacter();
    const bag = (ch as { saveData?: { open?: { bags?: Record<string, unknown> } } } | null)
      ?.saveData?.open?.bags?.[SYSTEMS_BAG_KEY] as Partial<GrudgeSystemsState> | undefined;
    if (bag && typeof bag === "object") {
      return {
        ...base,
        ...bag,
        attrs: { ...base.attrs, ...(bag.attrs || {}) },
        masteryXp: { ...(bag.masteryXp || {}) },
        unlocked: Array.isArray(bag.unlocked) ? bag.unlocked : [],
      };
    }
  } catch {
    /* ignore */
  }

  return base;
}

export function saveSystemsStateLocal(characterId: string, state: GrudgeSystemsState): void {
  try {
    localStorage.setItem(lsKey(characterId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

/** Debounced Railway write via character loadout bag. */
let _timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSystemsStateSave(
  characterId: string,
  state: GrudgeSystemsState,
): void {
  saveSystemsStateLocal(characterId, state);
  if (!characterId || characterId === "guest" || characterId === "explorer") return;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    _timer = null;
    const ch = gameSession.selectedCharacter();
    void saveCharacterGameBag(characterId, ch, SYSTEMS_BAG_KEY, {
      ...state,
    });
  }, 600);
}

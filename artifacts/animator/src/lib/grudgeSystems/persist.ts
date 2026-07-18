/**
 * Persist grudge systems sheet (attrs, class, mastery XP, skill points) per character.
 * Local cache always; Railway bag when signed in (saveData.open.bags.grudgeSystems).
 */

import type { AttrMap } from "./statsEngine";
import { defaultAttrs } from "./statsEngine";
import { gameSession } from "../../game/GameSession";
import { saveCharacterGameBag } from "../characterLoadout";
import {
  type CharacterSkillProgress,
  defaultSkillProgress,
  ensureProgressSynced,
  grantPointsForLevel,
  mergeLegacyUnlocks,
  normalizeSkillProgress,
} from "./characterSkillProgress";
import { loadMirroredSkillProgress, setActiveSkillProgress } from "./skillProgressBridge";

export const SYSTEMS_BAG_KEY = "grudgeSystems";
const LS_PREFIX = "open.grudgeSystems.v1.";

export type GrudgeSystemsState = {
  attrs: AttrMap;
  level: number;
  classId: string | null;
  masteryXp: Record<string, number>;
  /**
   * Flat unlocked node ids (kept in sync with skillProgress.unlocked for
   * combat/HUD readers that only know the array).
   */
  unlocked: string[];
  /** Per-domain skill points, grants, effects — account character SSOT. */
  skillProgress: CharacterSkillProgress;
};

export function defaultSystemsState(): GrudgeSystemsState {
  const skillProgress = grantPointsForLevel(defaultSkillProgress(), 1);
  return {
    attrs: defaultAttrs(),
    level: 1,
    classId: null,
    masteryXp: {},
    unlocked: skillProgress.unlocked.slice(),
    skillProgress,
  };
}

function lsKey(characterId: string): string {
  return `${LS_PREFIX}${characterId || "guest"}`;
}

function hydrateSkillProgress(
  characterId: string,
  level: number,
  unlocked: string[],
  rawProgress: Partial<CharacterSkillProgress> | undefined,
): CharacterSkillProgress {
  let sp =
    rawProgress && typeof rawProgress === "object"
      ? normalizeSkillProgress(rawProgress)
      : loadMirroredSkillProgress(characterId) || defaultSkillProgress();

  // Legacy: systems.unlocked or harvest global list without skillProgress
  if ((!rawProgress || !Array.isArray(rawProgress.unlocked)) && unlocked.length) {
    sp = mergeLegacyUnlocks(sp, unlocked);
  } else if (Array.isArray(rawProgress?.unlocked) && unlocked.length) {
    sp = mergeLegacyUnlocks(sp, unlocked);
  }

  sp = ensureProgressSynced(sp, level);
  // Keep unlocked array authoritative if progress had fewer (old saves)
  if (unlocked.length > sp.unlocked.length) {
    sp = mergeLegacyUnlocks(sp, unlocked);
    sp = ensureProgressSynced(sp, level);
  }
  return sp;
}

function finishState(
  characterId: string,
  partial: Partial<GrudgeSystemsState> & {
    skillProgress?: Partial<CharacterSkillProgress>;
  },
): GrudgeSystemsState {
  const base = defaultSystemsState();
  const level = Math.max(1, Math.floor(Number(partial.level) || base.level));
  const unlocked = Array.isArray(partial.unlocked) ? partial.unlocked : [];
  const skillProgress = hydrateSkillProgress(
    characterId,
    level,
    unlocked,
    partial.skillProgress as Partial<CharacterSkillProgress> | undefined,
  );
  const state: GrudgeSystemsState = {
    attrs: { ...base.attrs, ...(partial.attrs || {}) },
    level,
    classId: partial.classId ?? base.classId,
    masteryXp: { ...(partial.masteryXp || {}) },
    unlocked: skillProgress.unlocked.slice(),
    skillProgress,
  };
  setActiveSkillProgress(characterId, skillProgress);
  return state;
}

export function loadSystemsState(characterId: string): GrudgeSystemsState {
  try {
    const raw = localStorage.getItem(lsKey(characterId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GrudgeSystemsState>;
      return finishState(characterId, parsed);
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
      return finishState(characterId, bag);
    }
  } catch {
    /* ignore */
  }

  return finishState(characterId, defaultSystemsState());
}

export function saveSystemsStateLocal(characterId: string, state: GrudgeSystemsState): void {
  // Keep flat unlocked mirrored
  const skillProgress = normalizeSkillProgress(state.skillProgress);
  skillProgress.unlocked = Array.isArray(state.unlocked)
    ? [...new Set([...skillProgress.unlocked, ...state.unlocked])]
    : skillProgress.unlocked;
  const payload: GrudgeSystemsState = {
    ...state,
    unlocked: skillProgress.unlocked.slice(),
    skillProgress,
  };
  try {
    localStorage.setItem(lsKey(characterId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
  setActiveSkillProgress(characterId, skillProgress);
}

/** Debounced Railway write via character loadout bag. */
let _timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSystemsStateSave(
  characterId: string,
  state: GrudgeSystemsState,
): void {
  // Sync unlocked ↔ skillProgress before persist
  const skillProgress = normalizeSkillProgress(state.skillProgress);
  if (Array.isArray(state.unlocked)) {
    for (const id of state.unlocked) {
      if (!skillProgress.unlocked.includes(id)) skillProgress.unlocked.push(id);
    }
  }
  const synced: GrudgeSystemsState = {
    ...state,
    unlocked: skillProgress.unlocked.slice(),
    skillProgress,
  };
  saveSystemsStateLocal(characterId, synced);
  if (!characterId || characterId === "guest" || characterId === "explorer") return;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    _timer = null;
    const ch = gameSession.selectedCharacter();
    void saveCharacterGameBag(characterId, ch, SYSTEMS_BAG_KEY, {
      ...synced,
    });
  }, 600);
}

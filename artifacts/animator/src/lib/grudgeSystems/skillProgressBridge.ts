/**
 * Active-character bridge so combat/HUD code can read unlocks + effects
 * without threading characterId through every call site.
 *
 * GrudgeSystemsPanel / HarvestProductionUI set the active progress on open;
 * loadSkillUnlocks() prefers this over legacy global localStorage.
 */

import type { CharacterSkillProgress, SkillEffects } from "./characterSkillProgress";
import { defaultSkillProgress, emptyEffects, normalizeSkillProgress } from "./characterSkillProgress";

let _characterId = "guest";
let _progress: CharacterSkillProgress = defaultSkillProgress();
let _listeners = new Set<(p: CharacterSkillProgress, characterId: string) => void>();

export function getActiveSkillCharacterId(): string {
  return _characterId;
}

export function getActiveSkillProgress(): CharacterSkillProgress {
  return _progress;
}

export function getActiveSkillEffects(): SkillEffects {
  return _progress.effects || emptyEffects();
}

export function getActiveUnlocked(): string[] {
  return _progress.unlocked.slice();
}

/** Bind UI/systems state for the selected account character. */
export function setActiveSkillProgress(
  characterId: string,
  progress: CharacterSkillProgress,
): void {
  _characterId = characterId || "guest";
  _progress = normalizeSkillProgress(progress);
  for (const fn of _listeners) {
    try {
      fn(_progress, _characterId);
    } catch {
      /* listener */
    }
  }
  // Mirror to legacy key so older readers still see something
  try {
    localStorage.setItem("harvest:skillUnlocks:v1", JSON.stringify(_progress.unlocked));
    localStorage.setItem(
      `open.skillProgress.v1.${_characterId}`,
      JSON.stringify(_progress),
    );
  } catch {
    /* quota */
  }
}

export function subscribeSkillProgress(
  fn: (p: CharacterSkillProgress, characterId: string) => void,
): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

/** Load last mirrored progress for a character (before systems bag hydrates). */
export function loadMirroredSkillProgress(characterId: string): CharacterSkillProgress | null {
  try {
    const raw = localStorage.getItem(`open.skillProgress.v1.${characterId || "guest"}`);
    if (!raw) return null;
    return normalizeSkillProgress(JSON.parse(raw) as Partial<CharacterSkillProgress>);
  } catch {
    return null;
  }
}

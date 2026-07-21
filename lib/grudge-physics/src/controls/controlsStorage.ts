/**
 * Shared control-settings persistence key for the entire Open fleet SPA.
 *
 * Every native mode (Danger, Play, Brawler, Survival, Genesis playtest) MUST
 * read/write through this module so changing mouse sensitivity on /danger
 * applies on /brawl and map play without a second storage silo.
 *
 * Migration: prefer `grudge:controls`; fall back to legacy `dangerroom:controls`.
 */

export const CONTROLS_STORAGE_KEY = "grudge:controls";
/** @deprecated legacy Danger Room key — read for one release, then write to CONTROLS_STORAGE_KEY */
export const CONTROLS_STORAGE_KEY_LEGACY = "dangerroom:controls";
export const CONTROLS_SCHEMA = 1;

/** Read raw JSON string from localStorage (browser only). */
export function readControlsRaw(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return (
      localStorage.getItem(CONTROLS_STORAGE_KEY) ??
      localStorage.getItem(CONTROLS_STORAGE_KEY_LEGACY)
    );
  } catch {
    return null;
  }
}

/** Persist raw JSON under the canonical key (and clear legacy duplicate). */
export function writeControlsRaw(json: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CONTROLS_STORAGE_KEY, json);
    localStorage.removeItem(CONTROLS_STORAGE_KEY_LEGACY);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Recently played library titles — localStorage, Steam-style recents shelf.
 */

import type { AppMode } from "./openRoutes";

const KEY = "grudge.open.recentLibrary";
const MAX = 12;

export type RecentEntry = {
  mode: AppMode;
  at: number;
};

function read(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecentEntry =>
          !!e &&
          typeof e === "object" &&
          typeof (e as RecentEntry).mode === "string" &&
          typeof (e as RecentEntry).at === "number",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(entries: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* private mode / quota */
  }
}

/** Record a launch; moves mode to front. Ignores hub modes. */
export function recordRecentPlay(mode: AppMode): void {
  if (mode === "doors" || mode === "play") return;
  const now = Date.now();
  const next = [{ mode, at: now }, ...read().filter((e) => e.mode !== mode)].slice(0, MAX);
  write(next);
}

export function getRecentPlays(): RecentEntry[] {
  return read();
}

export function clearRecentPlays(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Human relative time for recents list. */
export function formatRecentAt(at: number): string {
  const secs = Math.max(1, Math.round((Date.now() - at) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(at).toLocaleDateString();
}

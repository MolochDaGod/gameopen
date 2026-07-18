import { asset } from "../assets";

/** Public-facing name of the resident DJ's flagship station. */
export const DJ_STATION_NAME = "CPT RAC Station";

/** One song on a local station. `file` is under the artifact `public/`. */
export interface DjTrack {
  file: string;
  title: string;
}

/**
 * Full CPT RAC / Racalvin set — primary app soundtrack.
 * Files live in `public/audio/dj/`.
 */
export const DJ_TRACKS: readonly DjTrack[] = [
  { file: "audio/dj/rac-the-king.mp3", title: "Rac The King" },
  { file: "audio/dj/racalvin-the-pirate-the-king.mp3", title: "Racalvin The Pirate, The King" },
  { file: "audio/dj/pirate-kings-reign.mp3", title: "Pirate King's Reign" },
  { file: "audio/dj/pirates-trap-anthem.mp3", title: "Pirate's Trap Anthem" },
  { file: "audio/dj/warlords-horns.mp3", title: "Warlord's Horns" },
  { file: "audio/dj/ironworks-bounty.mp3", title: "Ironworks Bounty" },
  { file: "audio/dj/ra-of-the-sea-remix.mp3", title: "Ra Of The Sea (Remix)" },
  { file: "audio/dj/malord.mp3", title: "Malord" },
  { file: "audio/dj/lives-of-the-young-kingpins.mp3", title: "Lives of the Young Kingpins" },
  { file: "audio/dj/let-it-cook.mp3", title: "Let It Cook" },
  { file: "audio/dj/e-to-e-to-e-remix.mp3", title: "E to E to E (Remix)" },
  { file: "audio/dj/the-last-cello-of-the-siege.mp3", title: "The Last Cello of the Siege" },
  { file: "audio/dj/death-of-monty-remix.mp3", title: "Death of Monty (Remix)" },
  { file: "audio/dj/gravity-down.mp3", title: "加速境界 (Gravity Down)" },
] as const;

/** Rac / pirate anthems only — shorter combat-friendly set. */
export const DJ_ANTHEMS: readonly DjTrack[] = [
  { file: "audio/dj/rac-the-king.mp3", title: "Rac The King" },
  { file: "audio/dj/racalvin-the-pirate-the-king.mp3", title: "Racalvin The Pirate, The King" },
  { file: "audio/dj/pirate-kings-reign.mp3", title: "Pirate King's Reign" },
  { file: "audio/dj/pirates-trap-anthem.mp3", title: "Pirate's Trap Anthem" },
  { file: "audio/dj/let-it-cook.mp3", title: "Let It Cook" },
] as const;

/** Warlords / siege energy. */
export const DJ_WARLORDS: readonly DjTrack[] = [
  { file: "audio/dj/warlords-horns.mp3", title: "Warlord's Horns" },
  { file: "audio/dj/ironworks-bounty.mp3", title: "Ironworks Bounty" },
  { file: "audio/dj/malord.mp3", title: "Malord" },
  { file: "audio/dj/lives-of-the-young-kingpins.mp3", title: "Lives of the Young Kingpins" },
  { file: "audio/dj/the-last-cello-of-the-siege.mp3", title: "The Last Cello of the Siege" },
] as const;

/** Remix / experimental side set. */
export const DJ_REMIXES: readonly DjTrack[] = [
  { file: "audio/dj/ra-of-the-sea-remix.mp3", title: "Ra Of The Sea (Remix)" },
  { file: "audio/dj/e-to-e-to-e-remix.mp3", title: "E to E to E (Remix)" },
  { file: "audio/dj/death-of-monty-remix.mp3", title: "Death of Monty (Remix)" },
  { file: "audio/dj/gravity-down.mp3", title: "加速境界 (Gravity Down)" },
] as const;

export type LocalPlaylistId = "full" | "anthems" | "warlords" | "remixes";

const LOCAL: Record<LocalPlaylistId, readonly DjTrack[]> = {
  full: DJ_TRACKS,
  anthems: DJ_ANTHEMS,
  warlords: DJ_WARLORDS,
  remixes: DJ_REMIXES,
};

export function localPlaylistTracks(id: LocalPlaylistId = "full"): readonly DjTrack[] {
  return LOCAL[id] ?? DJ_TRACKS;
}

export function localPlaylistUrls(id: LocalPlaylistId = "full"): string[] {
  return localPlaylistTracks(id).map((t) => asset(t.file));
}

export function localPlaylistTitles(id: LocalPlaylistId = "full"): string[] {
  return localPlaylistTracks(id).map((t) => t.title);
}

/** Resolve the full station tracks to base-path-aware URLs (via `asset()`). */
export function djStationUrls(): string[] {
  return localPlaylistUrls("full");
}

/** Track titles, index-aligned with {@link djStationUrls}. */
export function djStationTitles(): string[] {
  return localPlaylistTitles("full");
}

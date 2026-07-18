import {
  DJ_STATION_NAME,
  djStationUrls,
  djStationTitles,
  localPlaylistUrls,
  localPlaylistTitles,
  type LocalPlaylistId,
} from "./djPlaylist";
import { musicStation } from "./musicStation";

/**
 * Selectable music stations for the whole Open app.
 *
 * Local (bundled MP3 under public/audio/dj/):
 *  - cpt-rac — full CPT RAC / Racalvin set (default, app-wide)
 *  - rac-anthems / warlords / remixes — curated subsets of the same library
 *
 * Streamed (Audius, free/legal, no key):
 *  - lo-fi / ambient / classical / jazz / electronic / hip-hop / rock
 */
export interface RadioStationDef {
  id: string;
  name: string;
  /** Audius genre filter, or null for a local bundled playlist. */
  genre: string | null;
  /** Local playlist key when genre is null. */
  local?: LocalPlaylistId;
  /** Short user-facing description (tooltip). */
  hint: string;
}

export const RADIO_STATIONS: readonly RadioStationDef[] = [
  {
    id: "cpt-rac",
    name: DJ_STATION_NAME,
    genre: null,
    local: "full",
    hint: "Racalvin's full set — pirate trap anthems (default app music)",
  },
  {
    id: "rac-anthems",
    name: "RAC Anthems",
    genre: null,
    local: "anthems",
    hint: "Rac / pirate title tracks only",
  },
  {
    id: "warlords-set",
    name: "Warlords Set",
    genre: null,
    local: "warlords",
    hint: "Horns, ironworks, siege energy",
  },
  {
    id: "remixes",
    name: "RAC Remixes",
    genre: null,
    local: "remixes",
    hint: "Remix + experimental cuts",
  },
  { id: "lofi", name: "Lo-Fi Beats", genre: "Lo-Fi", hint: "Chill instrumental — free from Audius" },
  { id: "ambient", name: "Ambient Drift", genre: "Ambient", hint: "Atmospheric — free from Audius" },
  { id: "classical", name: "Classical & Score", genre: "Classical", hint: "Orchestral & piano — free from Audius" },
  { id: "jazz", name: "Jazz Lounge", genre: "Jazz", hint: "Jazz — free from Audius" },
  { id: "electronic", name: "Electronic", genre: "Electronic", hint: "Electronic — free from Audius" },
  { id: "hiphop", name: "Hip-Hop", genre: "Hip-Hop/Rap", hint: "Hip-hop & rap — free from Audius" },
  { id: "rock", name: "Rock", genre: "Rock", hint: "Rock — free from Audius" },
] as const;

const STATION_KEY = "dangerroom:radiostation";
const APP_NAME = "grudge-animator";
const STATION_SIZE = 20;

/** Load the persisted station choice (defaults to full CPT RAC). */
export function loadStationId(): string {
  try {
    const id = localStorage.getItem(STATION_KEY);
    if (id && RADIO_STATIONS.some((s) => s.id === id)) return id;
  } catch {
    /* storage unavailable */
  }
  return "cpt-rac";
}

export function saveStationId(id: string): void {
  try {
    localStorage.setItem(STATION_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

export interface StationPlaylist {
  urls: string[];
  titles: string[];
}

const cache = new Map<string, StationPlaylist>();

interface AudiusTrack {
  id: string;
  title: string;
  duration?: number;
  is_streamable?: boolean;
  user?: { name?: string };
}

async function audiusHost(): Promise<string> {
  const res = await fetch("https://api.audius.co");
  if (!res.ok) throw new Error(`audius host lookup failed: ${res.status}`);
  const body = (await res.json()) as { data?: string[] };
  const host = body.data?.[0];
  if (!host) throw new Error("audius host lookup returned no hosts");
  return host;
}

async function fetchAudiusPlaylist(genre: string): Promise<StationPlaylist> {
  const host = await audiusHost();
  const url = `${host}/v1/tracks/trending?genre=${encodeURIComponent(genre)}&time=week&app_name=${APP_NAME}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audius trending failed: ${res.status}`);
  const body = (await res.json()) as { data?: AudiusTrack[] };
  const tracks = (body.data ?? [])
    .filter(
      (t) =>
        t.is_streamable !== false &&
        typeof t.duration === "number" &&
        t.duration >= 60 &&
        t.duration <= 600,
    )
    .slice(0, STATION_SIZE);
  if (tracks.length === 0) throw new Error(`audius returned no playable ${genre} tracks`);
  return {
    urls: tracks.map((t) => `${host}/v1/tracks/${t.id}/stream?app_name=${APP_NAME}`),
    titles: tracks.map((t) => (t.user?.name ? `${t.title} — ${t.user.name}` : t.title)),
  };
}

function localList(def: RadioStationDef): StationPlaylist {
  const key = def.local ?? "full";
  return { urls: localPlaylistUrls(key), titles: localPlaylistTitles(key) };
}

/**
 * Resolve a station's playlist (local instantly; Audius via cache/fetch).
 */
export async function stationPlaylist(id: string): Promise<StationPlaylist> {
  const def = RADIO_STATIONS.find((s) => s.id === id) ?? RADIO_STATIONS[0]!;
  if (!def.genre) return localList(def);
  const hit = cache.get(def.id);
  if (hit) return hit;
  const list = await fetchAudiusPlaylist(def.genre);
  cache.set(def.id, list);
  return list;
}

/**
 * Apply the currently selected station to musicStation (or any sink).
 * Local stations are sync; Audius fetches async with CPT RAC fallback.
 */
export function assertStation(apply: (urls: string[], titles: string[]) => void): void {
  const def = RADIO_STATIONS.find((s) => s.id === loadStationId()) ?? RADIO_STATIONS[0]!;
  musicStation.setStationName(def.name);
  if (!def.genre) {
    const list = localList(def);
    apply(list.urls, list.titles);
    return;
  }
  const hit = cache.get(def.id);
  if (hit) {
    apply(hit.urls, hit.titles);
    return;
  }
  void stationPlaylist(def.id)
    .then((list) => apply(list.urls, list.titles))
    .catch(() => {
      musicStation.setStationName(DJ_STATION_NAME);
      apply(djStationUrls(), djStationTitles());
    });
}

/** Boot default CPT RAC (or last-saved station) into the global musicStation. */
export function bootAppMusic(): void {
  assertStation((urls, titles) => musicStation.setPlaylist(urls, titles));
}

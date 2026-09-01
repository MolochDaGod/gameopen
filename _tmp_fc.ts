/**
 * Fleet characters ΓÇö multi-era roster from Builder Postgres.
 *
 * Realms (Mine-Loader) uses era policy from `characterEras.ts`:
 *   - Display union of warlords + voxel (+ nexus) heroes (4-slot scenes)
 *   - Independent games (Flare, etc.) never hit this module
 *
 * Guests always get local Explorer so play never lacks a body.
 * 401 ΓåÆ soft-fail to cache + Explorer (never hard-crash the lobby).
 */
import {
  fleetApiFetch,
  getSelectedCharacterId,
  setSelectedCharacterId,
  loadGrudgeSession,
} from "./grudgeAuth";
import {
  APP_CHARACTER_SYSTEM,
  APP_ROSTER_FETCH_ERAS,
  BUILDER_API_BASES,
  characterListPathsForEra,
  getSelectedCharacterIdForEra,
  setSelectedCharacterIdForEra,
  type FleetEraId,
} from "./characterEras";
import {
  GUEST_EXPLORER_ID,
  guestExplorerCharacter,
} from "./playerAvatarResolve";

const REALMS_NS = "realms";

export type FleetCharacter = {
  id: string;
  name: string;
  raceId?: string;
  classId?: string;
  level?: number;
  /** Production mesh path (CDN-relative or absolute) ΓÇö grudge6 / Foundry */
  model3d?: string;
  gameEra?: string;
  factionId?: string;
  config?: Record<string, unknown>;
  saveData?: Record<string, unknown>;
  /** Open danger-room loadout blob when present */
  openLoadout?: Record<string, unknown>;
  /** Slot index 0ΓÇô3 when server provides it */
  slotIndex?: number;
};

export type FleetRosterResult = {
  characters: FleetCharacter[];
  /** Last HTTP status seen (401 = need sign-in / expired token) */
  status: "ok" | "unauthorized" | "error" | "guest";
  /** Eras that returned at least one row */
  erasLoaded: string[];
  fromCache: boolean;
};

export { GUEST_EXPLORER_ID, guestExplorerCharacter };

export function mapCharacter(c: Record<string, unknown>): FleetCharacter | null {
  const id = String(c.id || c.uuid || c.characterId || "");
  if (!id) return null;
  const config =
    (c.config as Record<string, unknown>) ||
    (c.characterConfig as Record<string, unknown>) ||
    undefined;
  const saveData =
    (c.saveData as Record<string, unknown>) ||
    (c.save_data as Record<string, unknown>) ||
    undefined;
  const openBag =
    saveData && typeof saveData.open === "object"
      ? (saveData.open as Record<string, unknown>)
      : undefined;
  const slotRaw = c.slotIndex ?? c.slot_index ?? c.slot ?? c.slotNumber;
  const slotIndex =
    typeof slotRaw === "number"
      ? slotRaw
      : typeof slotRaw === "string" && /^\d+$/.test(slotRaw)
        ? Number(slotRaw)
        : undefined;
  return {
    id,
    name: String(c.name || c.displayName || "Hero"),
    raceId: c.raceId
      ? String(c.raceId)
      : c.race
        ? String(c.race)
        : c.race_id
          ? String(c.race_id)
          : config?.raceId
            ? String(config.raceId)
            : undefined,
    classId: c.classId
      ? String(c.classId)
      : c.class
        ? String(c.class)
        : c.class_id
          ? String(c.class_id)
          : config?.classId
            ? String(config.classId)
            : undefined,
    level: typeof c.level === "number" ? c.level : undefined,
    model3d: c.model3d
      ? String(c.model3d)
      : c.model_3d
        ? String(c.model_3d)
        : config?.model3d
          ? String(config.model3d)
          : undefined,
    gameEra: c.gameEra
      ? String(c.gameEra)
      : c.game_era
        ? String(c.game_era)
        : undefined,
    factionId: c.factionId
      ? String(c.factionId)
      : c.faction_id
        ? String(c.faction_id)
        : undefined,
    config,
    saveData,
    openLoadout: openBag,
    slotIndex:
      slotIndex != null && slotIndex >= 0 && slotIndex < 4 ? slotIndex : undefined,
  };
}

const ROSTER_CACHE_KEY = "grudge_realms_fleet_roster_v2";

function readRosterCache(): FleetCharacter[] {
  try {
    const raw = localStorage.getItem(ROSTER_CACHE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .map((c) => mapCharacter(c as Record<string, unknown>))
      .filter((c): c is FleetCharacter => !!c);
  } catch {
    return [];
  }
}

function writeRosterCache(roster: FleetCharacter[]) {
  try {
    localStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify(roster));
  } catch {
    /* private mode */
  }
}

function parseCharacterList(data: unknown): FleetCharacter[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { characters?: unknown })?.characters)
      ? (data as { characters: unknown[] }).characters
      : Array.isArray((data as { results?: unknown })?.results)
        ? (data as { results: unknown[] }).results
        : Array.isArray((data as { data?: unknown })?.data)
          ? (data as { data: unknown[] }).data
          : [];
  return list
    .map((c) => mapCharacter(c as Record<string, unknown>))
    .filter((c): c is FleetCharacter => !!c);
}

/**
 * GET one era roster. Tries same-origin rewrite then absolute Builder base.
 * Returns null list + status for soft handling.
 */
async function fetchEraCharacters(
  era: FleetEraId,
): Promise<{ list: FleetCharacter[]; unauthorized: boolean; ok: boolean }> {
  let unauthorized = false;
  for (const base of BUILDER_API_BASES) {
    for (const path of characterListPathsForEra(era)) {
      const url = base ? `${base}${path}` : path;
      try {
        const r = await fleetApiFetch(url, { method: "GET" });
        if (r.status === 401 || r.status === 403) {
          unauthorized = true;
          continue;
        }
        if (!r.ok) continue;
        const data = await r.json();
        const list = parseCharacterList(data);
        // Tag era if server omitted gameEra
        const tagged = list.map((c) =>
          c.gameEra ? c : { ...c, gameEra: era },
        );
        return { list: tagged, unauthorized: false, ok: true };
      } catch {
        /* try next path / base */
      }
    }
  }
  return { list: [], unauthorized, ok: false };
}

/**
 * Merge multi-era rosters by character id (first era wins for preference order).
 * Caps at 4 for the app's primary 4-slot scene unless `unlimited`.
 */
export function mergeEraRosters(
  batches: FleetCharacter[][],
  opts?: { maxSlots?: number },
): FleetCharacter[] {
  const seen = new Set<string>();
  const out: FleetCharacter[] = [];
  for (const batch of batches) {
    for (const c of batch) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (opts?.maxSlots != null && out.length >= opts.maxSlots) return out;
    }
  }
  return out;
}

/**
 * List heroes for the signed-in Grudge account across configured fleet eras.
 * Soft-fails on 401 (expired / missing JWT) ΓåÆ cache or empty.
 */
export async function fetchFleetCharactersDetailed(): Promise<FleetRosterResult> {
  if (!loadGrudgeSession()?.sessionToken) {
    return {
      characters: [],
      status: "guest",
      erasLoaded: [],
      fromCache: false,
    };
  }

  const eras = APP_ROSTER_FETCH_ERAS;
  const batches: FleetCharacter[][] = [];
  const erasLoaded: string[] = [];
  let anyUnauthorized = false;
  let anyOk = false;

  await Promise.all(
    eras.map(async (era) => {
      const r = await fetchEraCharacters(era);
      if (r.unauthorized) anyUnauthorized = true;
      if (r.ok) anyOk = true;
      if (r.list.length) {
        batches.push(r.list);
        erasLoaded.push(era);
      }
    }),
  );

  // Also try unscoped list (some Builder builds ignore era filter when empty)
  if (!batches.length) {
    try {
      for (const base of BUILDER_API_BASES) {
        const url = base ? `${base}/api/characters` : "/api/characters";
        const r = await fleetApiFetch(url, { method: "GET" });
        if (r.status === 401 || r.status === 403) {
          anyUnauthorized = true;
          break;
        }
        if (!r.ok) continue;
        const list = parseCharacterList(await r.json());
        if (list.length) {
          batches.push(list);
          erasLoaded.push("all");
          anyOk = true;
          break;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (batches.length) {
    const merged = mergeEraRosters(batches, { maxSlots: 12 });
    // 4-slot primary scene uses first 4; full list kept for pickers
    writeRosterCache(merged);
    return {
      characters: merged,
      status: "ok",
      erasLoaded,
      fromCache: false,
    };
  }

  const cached = readRosterCache();
  if (cached.length) {
    return {
      characters: cached,
      status: anyUnauthorized ? "unauthorized" : "error",
      erasLoaded: [],
      fromCache: true,
    };
  }

  return {
    characters: [],
    status: anyUnauthorized ? "unauthorized" : anyOk ? "ok" : "error",
    erasLoaded: [],
    fromCache: false,
  };
}

/**
 * List heroes (characters only) ΓÇö preferred for call sites that ignore status.
 */
export async function fetchFleetCharacters(): Promise<FleetCharacter[]> {
  const r = await fetchFleetCharactersDetailed();
  return r.characters;
}

/**
 * Resolve selection: URL/storage ΓåÆ roster hero ΓåÆ guest Explorer.
 * Always returns a playable character so maps/boss/rooms never spawn empty.
 */
export function pickActiveCharacter(
  roster: FleetCharacter[],
  preferredId?: string | null,
  guestName = "Explorer",
): FleetCharacter {
  const eraPref = getSelectedCharacterIdForEra(APP_CHARACTER_SYSTEM);
  const want =
    preferredId || eraPref || getSelectedCharacterId();
  if (want && want !== GUEST_EXPLORER_ID) {
    const hit = roster.find((c) => c.id === want);
    if (hit) {
      setSelectedCharacterId(hit.id);
      setSelectedCharacterIdForEra(APP_CHARACTER_SYSTEM, hit.id);
      return hit;
    }
  }
  if (roster.length) {
    setSelectedCharacterId(roster[0]!.id);
    setSelectedCharacterIdForEra(APP_CHARACTER_SYSTEM, roster[0]!.id);
    return roster[0]!;
  }
  setSelectedCharacterId(GUEST_EXPLORER_ID);
  setSelectedCharacterIdForEra(APP_CHARACTER_SYSTEM, GUEST_EXPLORER_ID);
  return guestExplorerCharacter(guestName);
}

/**
 * Pad roster to 4 visual slots for the era 4-slot scene.
 * Uses slotIndex when present; otherwise fill order.
 */
export function fourSlotRoster(
  roster: FleetCharacter[],
): (FleetCharacter | null)[] {
  const slots: (FleetCharacter | null)[] = [null, null, null, null];
  const placed = new Set<string>();
  for (const c of roster) {
    if (c.slotIndex != null && c.slotIndex >= 0 && c.slotIndex < 4 && !slots[c.slotIndex]) {
      slots[c.slotIndex] = c;
      placed.add(c.id);
    }
  }
  let i = 0;
  for (const c of roster) {
    if (placed.has(c.id)) continue;
    while (i < 4 && slots[i]) i++;
    if (i >= 4) break;
    slots[i] = c;
    placed.add(c.id);
    i++;
  }
  return slots;
}

/** Read Realms bag from character.saveData without touching Open/Warlords keys. */
export function realmsBagFromCharacter(
  ch: FleetCharacter | null | undefined,
): Record<string, unknown> {
  if (!ch?.saveData) return {};
  const bag = ch.saveData[REALMS_NS];
  return bag && typeof bag === "object" ? (bag as Record<string, unknown>) : {};
}

/**
 * Merge Realms progress into Builder character saveData (namespaced).
 * Does not replace Open's `saveData.open` or Warlords profession progress.
 */
export async function saveRealmsCharacterBag(
  characterId: string,
  ch: FleetCharacter | null | undefined,
  bagPatch: Record<string, unknown>,
): Promise<boolean> {
  if (!characterId || !loadGrudgeSession()?.sessionToken) return false;
  const prev = realmsBagFromCharacter(ch);
  const nextBag = { ...prev, ...bagPatch, updatedAt: Date.now() };
  const saveData = { ...(ch?.saveData || {}), [REALMS_NS]: nextBag };
  try {
    const r = await fleetApiFetch(
      `/api/characters/${encodeURIComponent(characterId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveData }),
      },
    );
    if (r.ok) return true;
    const r2 = await fleetApiFetch(
      `/api/characters/${encodeURIComponent(characterId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveData }),
      },
    );
    return r2.ok;
  } catch {
    return false;
  }
}

/** Human-readable reason when roster is empty for UI. */
export function rosterEmptyHint(
  result: FleetRosterResult | null,
  signedIn: boolean,
): string {
  if (!signedIn) {
    return "Sign in with Grudge ID to load your 4-slot heroes from Foundry / Warlords.";
  }
  if (result?.status === "unauthorized") {
    return "Session expired (401). Sign in again ΓÇö heroes stay on Builder Postgres, not this device alone.";
  }
  if (result?.fromCache) {
    return "Using cached roster (Builder unreachable). Play continues with last known heroes.";
  }
  return "No heroes yet. Create up to 4 at Character Studio (Foundry), then refresh.";
}

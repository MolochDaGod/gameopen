/**
 * Account shared state — Railway Postgres SSOT via same-origin /api/*.
 *
 * Scope (grudge-production-wiring):
 *   Account  → /api/account, /api/account/resources  (bag, profile, GBUX-ish)
 *   Character → /api/characters?era=warlords         (roster, per-char progress)
 *
 * Never store account bag only in localStorage.
 */

import { apiFetch } from "./grudgeAuth";

export type FleetAccountProfile = {
  id?: string;
  grudgeId?: string;
  userId?: string;
  displayName?: string | null;
  homeIslandId?: string | null;
  gbux?: number;
  credits?: number;
  raw: Record<string, unknown>;
};

export type ResourceMap = Record<string, number>;

const HANDOFF_FROM_KEY = "grudge.open.handoffFrom";
const HANDOFF_OPEN_KEY = "grudge.open.handoffOpen";

/** Capture open=1&from=charactersgrudox (and peers) before URL scrub. */
export function captureAccountHandoffFlags(
  qs: URLSearchParams | { get: (k: string) => string | null },
): void {
  try {
    const from = qs.get("from") || qs.get("source") || "";
    const open = qs.get("open") || "";
    if (from) sessionStorage.setItem(HANDOFF_FROM_KEY, from);
    if (open === "1" || open === "true") sessionStorage.setItem(HANDOFF_OPEN_KEY, "1");
  } catch {
    /* */
  }
}

export function getHandoffFrom(): string | null {
  try {
    return sessionStorage.getItem(HANDOFF_FROM_KEY);
  } catch {
    return null;
  }
}

export function isOpenHandoff(): boolean {
  try {
    return sessionStorage.getItem(HANDOFF_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearHandoffFlags(): void {
  try {
    sessionStorage.removeItem(HANDOFF_FROM_KEY);
    sessionStorage.removeItem(HANDOFF_OPEN_KEY);
  } catch {
    /* */
  }
}

/** GET /api/account — profile row for the JWT account. */
export async function fetchAccountProfile(): Promise<FleetAccountProfile | null> {
  try {
    const r = await apiFetch("/api/account", { method: "GET" });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    const gbuxRaw = data.gbux ?? data.gbuxBalance ?? data.credits ?? data.softCurrency;
    return {
      id: data.id != null ? String(data.id) : undefined,
      grudgeId: data.grudgeId != null ? String(data.grudgeId) : data.grudge_id != null ? String(data.grudge_id) : undefined,
      userId: data.userId != null ? String(data.userId) : undefined,
      displayName:
        data.displayName != null
          ? String(data.displayName)
          : data.display_name != null
            ? String(data.display_name)
            : null,
      homeIslandId:
        data.homeIslandId != null
          ? String(data.homeIslandId)
          : data.home_island_id != null
            ? String(data.home_island_id)
            : null,
      gbux: typeof gbuxRaw === "number" ? gbuxRaw : gbuxRaw != null ? Number(gbuxRaw) || undefined : undefined,
      credits: typeof data.credits === "number" ? data.credits : undefined,
      raw: data,
    };
  } catch {
    return null;
  }
}

/** GET /api/account/resources — shared bag across all characters. */
export async function fetchAccountBag(): Promise<ResourceMap> {
  try {
    const r = await apiFetch("/api/account/resources", { method: "GET" });
    if (!r.ok) return {};
    const data = (await r.json()) as { resources?: ResourceMap };
    return data.resources && typeof data.resources === "object" ? data.resources : {};
  } catch {
    return {};
  }
}

export type CreateCharacterInput = {
  name: string;
  raceId: string;
  classId?: string;
  /** Catalog id e.g. race-human for Open mesh resolver */
  catalogId?: string;
  gameEra?: "warlords" | "nexus" | "armada";
};

/**
 * POST Railway /api/characters — create Warlords-era fleet character.
 * Body fields dual-written for schema variants (raceId vs race, gameEra vs era).
 */
export async function createFleetCharacter(
  input: CreateCharacterInput,
): Promise<{ ok: true; id: string; raw: Record<string, unknown> } | { ok: false; error: string }> {
  const name = input.name.trim() || "Hero";
  const raceId = normalizeRaceId(input.raceId);
  const classId = input.classId || "warrior";
  const era = input.gameEra || "warlords";

  const bodies: Record<string, unknown>[] = [
    {
      name,
      raceId,
      classId,
      gameEra: era,
      era,
      prefabId: input.catalogId,
      config: { catalogId: input.catalogId, source: "gameopen-account", from: "charactersgrudox" },
    },
    {
      name,
      race: raceId,
      class: classId,
      game_era: era,
      era,
    },
  ];

  for (const body of bodies) {
    try {
      const r = await apiFetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        if (r.status === 401) return { ok: false, error: "Sign in required (401)" };
        // try next body shape
        if (r.status === 400 || r.status === 422) continue;
        return { ok: false, error: `Create failed (${r.status}) ${errText.slice(0, 120)}` };
      }
      const data = (await r.json()) as Record<string, unknown>;
      const id = String(
        data.id ||
          data.uuid ||
          data.characterId ||
          (data.character as { id?: string } | undefined)?.id ||
          "",
      );
      if (!id) return { ok: false, error: "Create returned no character id" };
      return { ok: true, id, raw: data };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error creating character",
      };
    }
  }
  return { ok: false, error: "Character create rejected by API (check race/class schema)" };
}

function normalizeRaceId(raw: string): string {
  const s = raw.replace(/^race-/, "").toLowerCase().replace(/_/g, "-");
  if (s === "high-elf" || s === "highelf") return "elf";
  if (s === "high-elves") return "elf";
  if (s === "western-kingdoms" || s === "wk") return "human";
  if (s === "barbarians") return "barbarian";
  if (s === "dwarves") return "dwarf";
  if (s === "orcs") return "orc";
  return s || "human";
}

/** Deep-link to Character Studio for full GCS create (era=warlords). */
export function characterStudioCreateUrl(opts?: {
  token?: string | null;
  returnTo?: string;
}): string {
  const u = new URL("https://character.grudge-studio.com/");
  u.searchParams.set("era", "warlords");
  u.searchParams.set("from", "gameopen");
  u.searchParams.set("open", "1");
  if (opts?.returnTo) u.searchParams.set("redirect_uri", opts.returnTo);
  if (opts?.token) {
    u.searchParams.set("sso_token", opts.token);
    u.searchParams.set("grudge_token", opts.token);
  }
  return u.toString();
}

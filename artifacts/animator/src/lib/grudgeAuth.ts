/**
 * Grudge Studio identity bridge — links gameopen to fleet accounts.
 *
 * Priority:
 *  1. Grudge ID SSO token (id.grudge-studio.com / ?sso_token= / #sso_token / session)
 *  2. Clerk session (optional, when VITE_CLERK_PUBLISHABLE_KEY is set)
 *  3. Unsigned play (no guest JWT — product login is Grudge ID only)
 *
 * Characters SSOT: GrudgeBuilder Railway via same-origin /api/characters
 * (Vercel rewrite → grudge-api-production).
 *
 * Handoff contract (must match docs/GRUDGE_AUTH_CONNECT.md + ID_SSO_PRODUCTION.md):
 *  - Prefer **sso_token** / **token** (full session JWT) over **grudge_token** (short launch)
 *  - Read query AND hash (auth-page dual-writes both)
 *  - Bridge launch token via /api/auth/session/exchange when only grudge_token present
 *  - Store under fleet keys + grudge.open.token
 */

import { FLEET, FLEET_TOKEN_KEYS, apiUrl, buildGrudgeLoginUrl } from "./fleet";

const TOKEN_KEY = "grudge.open.token";
const ACCOUNT_KEY = "grudge.open.account";
/** Persist account across browser restarts (stay logged in). */
const ACCOUNT_KEY_PERSIST = "grudge.open.account.persist";

export type GrudgeAccount = {
  grudgeId: string;
  displayName?: string;
  source: "grudge-id" | "clerk" | "guest";
};

export type GrudgeCharacter = {
  id: string;
  name: string;
  raceId?: string;
  classId?: string;
  level?: number;
  /**
   * Railway `game_era` / `gameEra` — warlords | voxel | nexus | armada.
   * Account shares login + bag across eras; roster is **per era** (4 slots each).
   */
  gameEra?: string;
  /** Foundry / 4-slot index 0–3 when present. */
  slotIndex?: number;
  /**
   * Railway `characters.avatar_url` — preferred 2D portrait when set
   * (studio / AI / custom). See `characterPortrait.ts`.
   */
  avatarUrl?: string | null;
  /**
   * Railway `characters.model_3d` — modular 3D / pipeline (grudge6, vrm, voxel…).
   */
  model3d?: Record<string, unknown> | null;
  config?: Record<string, unknown>;
  saveData?: Record<string, unknown>;
  equipment?: Record<string, unknown> | null;
};

/** Production fleet eras on Railway Postgres (4 slots each). */
export const FLEET_CHARACTER_ERAS = [
  "warlords",
  "voxel",
  "nexus",
  "armada",
] as const;
export type FleetCharacterEra = (typeof FLEET_CHARACTER_ERAS)[number];

function paramFromSearchOrHash(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get(name);
    if (q) return q;
    if (url.hash && url.hash.length > 1) {
      const hp = new URLSearchParams(url.hash.replace(/^#/, ""));
      return hp.get(name);
    }
  } catch {
    /* */
  }
  return null;
}

function cleanHandoffParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const keys = [
      "grudge_token",
      "launch_token",
      "sso_token",
      "token",
      "access_token",
      "grudge_id",
      "grudgeId",
      "username",
      "grudge_username",
      "provider",
      "error",
      "characterId",
      "character_id",
      // keep `open` / `from` out of scrub until handoff flags captured (sync capture above)
      "open",
      "from",
      "source",
    ];
    for (const k of keys) url.searchParams.delete(k);
    if (url.hash && url.hash.length > 1) {
      const hp = new URLSearchParams(url.hash.replace(/^#/, ""));
      let changed = false;
      for (const k of keys) {
        if (hp.has(k)) {
          hp.delete(k);
          changed = true;
        }
      }
      if (changed) url.hash = hp.toString() || "";
    }
    const q = url.searchParams.toString();
    window.history.replaceState({}, "", url.pathname + (q ? `?${q}` : "") + (url.hash || ""));
  } catch {
    /* */
  }
}

/**
 * Open session JWT — same key order as productionSystemsPattern.readProductionAuthToken.
 * Prefer importing that for new AI/REST callers; keep this for auth bootstrap callers.
 */
export function getStoredToken(): string | null {
  try {
    // session first (tab-scoped SSO handoff), then local (persist)
    const openSess = sessionStorage.getItem(TOKEN_KEY);
    if (openSess) return openSess;
    for (const k of FLEET_TOKEN_KEYS) {
      const t = sessionStorage.getItem(k);
      if (t) return t;
    }
    const openLocal = localStorage.getItem(TOKEN_KEY);
    if (openLocal) return openLocal;
    for (const k of FLEET_TOKEN_KEYS) {
      const t = localStorage.getItem(k);
      if (t) return t;
    }
  } catch {
    /* */
  }
  return null;
}

export function setStoredToken(token: string | null, persist = true): void {
  try {
    if (!token) {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      for (const k of FLEET_TOKEN_KEYS) {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      }
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    if (persist) {
      localStorage.setItem(TOKEN_KEY, token);
      for (const k of FLEET_TOKEN_KEYS) localStorage.setItem(k, token);
    }
  } catch {
    /* private mode */
  }
}

export function getStoredAccount(): GrudgeAccount | null {
  try {
    const raw =
      sessionStorage.getItem(ACCOUNT_KEY) || localStorage.getItem(ACCOUNT_KEY_PERSIST);
    return raw ? (JSON.parse(raw) as GrudgeAccount) : null;
  } catch {
    return null;
  }
}

export function setStoredAccount(account: GrudgeAccount | null): void {
  try {
    if (!account) {
      sessionStorage.removeItem(ACCOUNT_KEY);
      localStorage.removeItem(ACCOUNT_KEY_PERSIST);
      return;
    }
    const json = JSON.stringify(account);
    sessionStorage.setItem(ACCOUNT_KEY, json);
    // Persist so refresh / new tab stays logged in with token in localStorage
    localStorage.setItem(ACCOUNT_KEY_PERSIST, json);
  } catch {
    /* */
  }
}

/** True if JWT is missing or past exp (with 60s skew). Non-JWTs treated as valid. */
export function isTokenExpired(token: string | null, skewSec = 60): boolean {
  if (!token) return true;
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 >= payload.exp - skewSec;
  } catch {
    return false;
  }
}

/**
 * Capture fleet SSO handoff from query + hash.
 * CRITICAL: prefer full session JWT (sso_token) over short launch (grudge_token).
 */
export function captureAuthCallbackFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  // Persist open/from flags for Account hub (charactersgrudox return) before scrub
  try {
    const qs = new URLSearchParams(window.location.search);
    if (window.location.hash?.length > 1) {
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      for (const [k, v] of hp.entries()) if (!qs.has(k)) qs.set(k, v);
    }
    const from = qs.get("from") || qs.get("source") || "";
    const open = qs.get("open") || "";
    if (from) sessionStorage.setItem("grudge.open.handoffFrom", from);
    if (open === "1" || open === "true") sessionStorage.setItem("grudge.open.handoffOpen", "1");
  } catch {
    /* */
  }

  const sso =
    paramFromSearchOrHash("sso_token") ||
    paramFromSearchOrHash("token") ||
    paramFromSearchOrHash("access_token");
  const launch =
    paramFromSearchOrHash("grudge_token") || paramFromSearchOrHash("launch_token");
  const grudgeId =
    paramFromSearchOrHash("grudge_id") || paramFromSearchOrHash("grudgeId") || "";
  const username =
    paramFromSearchOrHash("username") || paramFromSearchOrHash("grudge_username") || "";
  // Active character handoff from id hub, charactersgrudox, or other fleet apps
  const characterId =
    paramFromSearchOrHash("characterId") || paramFromSearchOrHash("character_id") || "";
  const baseId = paramFromSearchOrHash("baseId") || "";
  const characterName = paramFromSearchOrHash("characterName") || "";

  // Capture characterId even when tokens already stored (return from GCS)
  if (characterId) {
    try {
      sessionStorage.setItem("grudge.open.selectedCharacterId", characterId);
      localStorage.setItem("grudge.open.selectedCharacterId", characterId);
      localStorage.setItem("grudge_active_character", characterId);
      localStorage.setItem("grudge.activeCharId", characterId);
    } catch {
      /* */
    }
  }
  if (baseId) {
    try {
      sessionStorage.setItem("grudge.open.baseId", baseId);
      localStorage.setItem("animator.activeCharacterId", baseId);
    } catch {
      /* */
    }
  }
  if (characterName) {
    try {
      sessionStorage.setItem("grudge.open.characterName", characterName);
    } catch {
      /* */
    }
  }

  if (!sso && !launch) return getStoredToken();

  // Prefer long-lived session token for Bearer API calls
  if (sso && sso.length > 20) {
    setStoredToken(sso, true);
    if (grudgeId) {
      try {
        localStorage.setItem("grudge_id", grudgeId);
        localStorage.setItem("grudge_account_id", grudgeId);
        if (username) localStorage.setItem("grudge_username", username);
      } catch {
        /* */
      }
      setStoredAccount({
        grudgeId,
        displayName: username || undefined,
        source: "grudge-id",
      });
    }
    if (characterId) {
      try {
        sessionStorage.setItem("grudge.open.selectedCharacterId", characterId);
        localStorage.setItem("grudge.open.selectedCharacterId", characterId);
      } catch {
        /* */
      }
    }
    cleanHandoffParamsFromUrl();
    // Bridge launch in background if present (optional)
    if (launch) void bridgeLaunchToken(launch).catch(() => undefined);
    return sso;
  }

  if (launch) {
    if (characterId) {
      try {
        sessionStorage.setItem("grudge.open.selectedCharacterId", characterId);
        localStorage.setItem("grudge.open.selectedCharacterId", characterId);
      } catch {
        /* */
      }
    }
    cleanHandoffParamsFromUrl();
    // Synchronous path: store launch briefly; initFleetAuth will await bridge
    setStoredToken(launch, true);
    return launch;
  }

  return null;
}

/** Circuit-breaker for session exchange — prevents 429 storms (9× retries × N callers). */
let _exchangeInflight: Promise<string | null> | null = null;
let _exchangeCooldownUntil = 0;
let _exchangeFailedToken: string | null = null;

/** Exchange short launch JWT for full session JWT. */
export async function bridgeLaunchToken(launchToken: string): Promise<string | null> {
  if (!launchToken || !String(launchToken).trim()) return null;

  // Cooldown after 429 / hard fail — do not hammer Railway / id hub.
  if (Date.now() < _exchangeCooldownUntil) {
    if (_exchangeFailedToken === launchToken) return null;
  }
  if (_exchangeInflight) return _exchangeInflight;

  _exchangeInflight = (async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://open.grudge-studio.com";
    // One body shape — id hub accepts token|launchToken|grudge_token aliases.
    const body = JSON.stringify({
      token: launchToken,
      launchToken,
      grudge_token: launchToken,
      audience: origin,
      origin,
    });
    // Auth SSOT: id.grudge-studio.com (via same-origin rewrite → id, then absolute id).
    // Never apex grudge-studio.com; Railway is implementation behind the id-gateway only.
    const urls = [
      apiUrl("/api/auth/session/exchange"),
      `${FLEET.auth.replace(/\/$/, "")}/api/auth/session/exchange`,
      `${FLEET.auth.replace(/\/$/, "")}/api/auth/grudge-bridge`,
    ];

    let hit429 = false;
    for (const url of urls) {
      try {
        const cross =
          url.startsWith("http") &&
          typeof window !== "undefined" &&
          !url.startsWith(window.location.origin);
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body,
          // Cookie SSO on id hub; Bearer response is SSOT
          credentials: /id\.grudge-studio\.com/i.test(url) ? "include" : cross ? "omit" : "include",
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 429) {
          hit429 = true;
          break; // stop all further exchange attempts this session
        }
        if (r.status === 400 || r.status === 401 || r.status === 403) {
          // Bad/expired launch token — don't thrash other hosts
          _exchangeFailedToken = launchToken;
          _exchangeCooldownUntil = Date.now() + 60_000;
          return null;
        }
        if (!r.ok) continue;
        const data = (await r.json()) as Record<string, unknown>;
        const t = String(
          data.sessionToken || data.token || data.access_token || data.sso_token || "",
        );
        if (!t) continue;
        setStoredToken(t, true);
        _exchangeFailedToken = null;
        const gid = String(
          data.grudgeId ||
            data.grudge_id ||
            (data.user as { grudgeId?: string } | undefined)?.grudgeId ||
            "",
        );
        const uname = String(
          data.username ||
            (data.user as { username?: string; displayName?: string } | undefined)?.displayName ||
            (data.user as { username?: string } | undefined)?.username ||
            "",
        );
        if (gid) {
          try {
            localStorage.setItem("grudge_id", gid);
            localStorage.setItem("grudge_account_id", gid);
            if (uname) localStorage.setItem("grudge_username", uname);
          } catch {
            /* */
          }
          setStoredAccount({
            grudgeId: gid,
            displayName: uname || undefined,
            source: "grudge-id",
          });
        }
        return t;
      } catch {
        /* try next url */
      }
    }
    if (hit429) {
      // 2 minutes cool-off — browser multi-tab / multi-module storms
      _exchangeCooldownUntil = Date.now() + 120_000;
      _exchangeFailedToken = launchToken;
      console.warn(
        "[grudgeAuth] session/exchange rate-limited (429) — cooldown 120s; guest play continues",
      );
    } else {
      _exchangeCooldownUntil = Date.now() + 30_000;
      _exchangeFailedToken = launchToken;
    }
    return null;
  })();

  try {
    return await _exchangeInflight;
  } finally {
    _exchangeInflight = null;
  }
}

/**
 * Navigate to Grudge ID login.
 *
 * SMART: first checks if a valid token + account are already in storage.
 * If so, skips the redirect entirely — the user is already authenticated.
 * Pass `force = true` to redirect even when a session exists (e.g. "switch account").
 */
export async function loginWithGrudgeId(force = false): Promise<void> {
  if (!force) {
    const token = getStoredToken();
    const cached = getStoredAccount();
    if (token && cached) {
      // Already logged in — silently revalidate but don't redirect.
      void fetchFleetAccount(false);
      return;
    }
  }
  // Brand return open.grudge-studio.com (not gameopen.vercel.app after 307)
  window.location.href = buildGrudgeLoginUrl(undefined, { force: true, app: "gameopen" });
}

export function logoutGrudge(): void {
  setStoredToken(null);
  setStoredAccount(null);
  // Clear cached wallet so next login re-provisions fresh.
  try {
    void import("./walletService").then(({ clearCachedWallet }) => clearCachedWallet());
  } catch {
    /* */
  }
  try {
    localStorage.removeItem("grudge_id");
    localStorage.removeItem("grudge_account_id");
    localStorage.removeItem("grudge_username");
    // Selected character is account-scoped — clear so next login doesn't flash stale hero
    sessionStorage.removeItem("grudge.open.selectedCharacterId");
    localStorage.removeItem("grudge.open.selectedCharacterId");
    sessionStorage.removeItem("grudge.open.wallet");
    localStorage.removeItem("grudge.open.wallet");
  } catch {
    /* */
  }
  // Drop in-memory fleet roster without full page reload
  try {
    void import("../game/GameSession").then(({ gameSession }) => {
      gameSession.clearAuthSession();
    });
  } catch {
    /* */
  }
}

async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = getStoredToken();
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  // Do NOT add custom headers like x-grudge-id — they trigger a CORS preflight
  // and Railway grudge-api-production does not allow them in Access-Control-Allow-Headers.
  // The Bearer token already carries identity.
  if (extra) {
    const e = extra as Record<string, string>;
    for (const [k, v] of Object.entries(e)) if (v != null) h[k] = v;
  }
  return h;
}

/** Authenticated fetch helper for character saves and fleet APIs. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders(init.headers as HeadersInit);
  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
}

function isFleetCookieHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "grudge-studio.com" || h.endsWith(".grudge-studio.com");
}

/**
 * Silent fleet re-entry via id hub cookie (Domain=.grudge-studio.com).
 * Skip on localhost — that cookie is never sent, and a 401 probe is noise.
 * On 401/403 stop (FLEET_AUTH_WIRING — no host storms).
 */
export async function claimFleetSession(): Promise<string | null> {
  if (!isFleetCookieHost()) return null;
  const urls = [
    apiUrl("/api/auth/session/claim"),
    `${FLEET.auth.replace(/\/$/, "")}/api/auth/session/claim`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 401 || r.status === 403) return null;
      if (!r.ok) continue;
      const data = (await r.json()) as Record<string, unknown>;
      const t = String(
        data.sessionToken || data.token || data.sso_token || data.access_token || "",
      );
      if (!t) continue;
      setStoredToken(t, true);
      const gid = String(
        data.grudgeId ||
          data.grudge_id ||
          (data.user as { grudgeId?: string } | undefined)?.grudgeId ||
          "",
      );
      const uname = String(
        data.username ||
          data.displayName ||
          (data.user as { username?: string } | undefined)?.username ||
          "",
      );
      if (gid) {
        try {
          localStorage.setItem("grudge_id", gid);
          localStorage.setItem("grudge_account_id", gid);
          if (uname) localStorage.setItem("grudge_username", uname);
        } catch {
          /* */
        }
        setStoredAccount({
          grudgeId: gid,
          displayName: uname || undefined,
          source: "grudge-id",
        });
      }
      return t;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Resolve account from the fleet API.
 *
 * TOKEN-FIRST: cached token+account → return immediately, background-revalidate.
 * No token: try silent claim on id hub (cookie SSO) on fleet hosts only.
 * Falls through to bridge launch tokens and multi-endpoint probing when needed.
 */
export async function fetchFleetAccount(
  force = false,
): Promise<GrudgeAccount | null> {
  let token = getStoredToken();
  if (!token) {
    // One silent claim — restores session after tab reopen on *.grudge-studio.com
    token = (await claimFleetSession()) || null;
    if (!token) return getStoredAccount();
  }

  // Fast path: token + cached account → return instantly, revalidate in background.
  const cached = getStoredAccount();
  if (cached && !force) {
    void _revalidateAccountBackground(token);
    return cached;
  }

  // Slow path: no cache or forced refresh → hit the API.
  return _revalidateAccountBackground(token);
}

/** Internal: verify token against fleet endpoints, update cache. */
async function _revalidateAccountBackground(
  token: string,
): Promise<GrudgeAccount | null> {
  // Try same-origin proxy first (avoids CORS), then ID hub directly.
  // /api/auth/me is the identity probe (401 when guest = expected).
  // Do NOT call /api/account/me — Railway has no such route (404 spam).
  const endpoints = [
    apiUrl("/api/auth/me"),
    `${FLEET.auth}/api/auth/me`,
  ];

  let bridgedOnce = false;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: await authHeaders(),
        credentials: "include",
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 401 && token && !bridgedOnce) {
        // Short launch JWT — bridge to full session **once** (never per-endpoint loop).
        bridgedOnce = true;
        const bridged = await bridgeLaunchToken(token);
        if (bridged) {
          token = bridged;
          // Retry same-origin me only with new token
          continue;
        }
        // Dead / expired launch token — clear so lobby can mint a silent guest
        setStoredToken(null);
        return null;
      }
      if (r.status === 401) {
        setStoredToken(null);
        return null;
      }
      if (!r.ok) continue;
      const data = (await r.json()) as Record<string, unknown>;
      const grudgeId = String(
        data.grudgeId || data.grudge_id || data.id || data.sub || "",
      );
      if (grudgeId) {
        const account: GrudgeAccount = {
          grudgeId,
          displayName: String(data.displayName || data.name || data.username || ""),
          source: "grudge-id",
        };
        setStoredAccount(account);
        return account;
      }
    } catch {
      /* try next */
    }
  }
  // Stale cache only if we still hold a token that might work offline
  if (!getStoredToken()) return null;
  return getStoredAccount();
}

function mapApiCharacter(
  c: Record<string, unknown>,
  eraHint?: string,
): GrudgeCharacter | null {
  const id = String(c.id || c.uuid || c.characterId || "");
  if (!id) return null;
  const avatarUrl =
    (typeof c.avatarUrl === "string" && c.avatarUrl) ||
    (typeof c.avatar_url === "string" && c.avatar_url) ||
    null;
  const model3d =
    (c.model3d as Record<string, unknown>) ||
    (c.model_3d as Record<string, unknown>) ||
    null;
  const rawEra =
    c.gameEra ||
    c.game_era ||
    c.era ||
    (c.config as { gameEra?: string; era?: string } | undefined)?.gameEra ||
    (c.config as { era?: string } | undefined)?.era ||
    eraHint;
  const gameEra = rawEra ? String(rawEra).toLowerCase() : eraHint;
  const slotRaw = c.slotIndex ?? c.slot_index ?? c.slot;
  const slotIndex =
    typeof slotRaw === "number" && Number.isFinite(slotRaw)
      ? Math.max(0, Math.min(3, Math.trunc(slotRaw)))
      : undefined;
  const config = (c.config as Record<string, unknown>) || undefined;
  return {
    id,
    name: String(c.name || c.displayName || "Hero"),
    raceId: c.raceId
      ? String(c.raceId)
      : c.race
        ? String(c.race)
        : c.race_id
          ? String(c.race_id)
          : undefined,
    classId: c.classId
      ? String(c.classId)
      : c.class
        ? String(c.class)
        : c.class_id
          ? String(c.class_id)
          : undefined,
    level: typeof c.level === "number" ? c.level : undefined,
    gameEra,
    slotIndex,
    avatarUrl,
    model3d,
    config: config
      ? { ...config, gameEra: config.gameEra || gameEra }
      : gameEra
        ? { gameEra }
        : undefined,
    saveData:
      (c.saveData as Record<string, unknown>) ||
      (c.save_data as Record<string, unknown>) ||
      undefined,
    equipment: (c.equipment as Record<string, unknown>) || null,
  };
}

/**
 * List characters for the signed-in Grudge account (Railway Postgres SSOT).
 * Fetches **all production eras** (warlords + voxel + nexus + armada) and merges.
 * Account bag/wallet are shared; playable roster stays per-era (4 slots each).
 */
export async function fetchCharacters(opts?: {
  eras?: readonly string[];
}): Promise<GrudgeCharacter[]> {
  // No JWT → skip network (avoids lobby 401/403 red noise for pure guests pre-boot)
  if (!getStoredToken()) return [];

  const eras = opts?.eras?.length
    ? [...opts.eras]
    : [...FLEET_CHARACTER_ERAS];

  const byId = new Map<string, GrudgeCharacter>();
  let authDead = false;

  for (const era of eras) {
    if (authDead) break;
    const paths = [
      `/api/characters?era=${encodeURIComponent(era)}`,
      `/api/characters?gameEra=${encodeURIComponent(era)}`,
    ];
    for (const path of paths) {
      try {
        const r = await apiFetch(path, { method: "GET" });
        if (r.status === 401 || r.status === 403) {
          const token = getStoredToken();
          if (token && !isTokenExpired(token)) {
            const bridged = await bridgeLaunchToken(token);
            if (bridged) {
              // Retry this path once with bridged session
              continue;
            }
          }
          setStoredToken(null);
          authDead = true;
          break;
        }
        if (!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.characters)
            ? data.characters
            : Array.isArray(data?.results)
              ? data.results
              : [];
        for (const raw of list) {
          const mapped = mapApiCharacter(
            raw as Record<string, unknown>,
            era,
          );
          if (!mapped) continue;
          // Prefer first era hit; keep era tag
          if (!byId.has(mapped.id)) byId.set(mapped.id, mapped);
        }
        // Successful era fetch — don't need alternate path for same era
        break;
      } catch {
        /* try next path */
      }
    }
  }

  return Array.from(byId.values());
}

/**
 * Guest JWT mint is closed (Railway 403). Product login is Grudge ID only.
 * Kept as a named export so callers compile; does not hit the network.
 */
export async function ensureGuestSession(): Promise<GrudgeAccount | null> {
  return null;
}

/** Boot hook — call once from App root. */
export async function initFleetAuth(): Promise<{
  account: GrudgeAccount | null;
  characters: GrudgeCharacter[];
}> {
  // Read before capture (capture strips query/hash)
  const hadSso = !!(
    paramFromSearchOrHash("sso_token") ||
    paramFromSearchOrHash("token") ||
    paramFromSearchOrHash("access_token")
  );
  const launchOnly =
    !hadSso &&
    !!(paramFromSearchOrHash("grudge_token") || paramFromSearchOrHash("launch_token"));
  const launch =
    paramFromSearchOrHash("grudge_token") || paramFromSearchOrHash("launch_token") || "";

  captureAuthCallbackFromUrl();

  // Bridge launch JWT → session JWT before account fetch (avoids second redirect).
  if (launchOnly && launch) {
    await bridgeLaunchToken(launch);
  } else {
    // Stored token may still be a short launch JWT from a prior visit — refresh.
    const t = getStoredToken();
    if (t && (isTokenExpired(t) || t.length < 80)) {
      await bridgeLaunchToken(t);
    }
  }

  // TOKEN-FIRST: cached account returns instantly; API hit is background-only.
  let account = await fetchFleetAccount();
  // If we have a token but no account cache, force revalidate once.
  if (!account && getStoredToken()) {
    account = await fetchFleetAccount(true);
  }

  // Dead JWT left in storage (401 on /me, failed exchange) → clear. Do not mint guest.
  if (!account && getStoredToken()) {
    const again = await fetchFleetAccount(true);
    if (!again) {
      setStoredToken(null);
      setStoredAccount(null);
    } else {
      account = again;
    }
  }

  let characters: GrudgeCharacter[] = [];
  if (account || getStoredToken()) {
    characters = await fetchCharacters();
    if (!characters.length && getStoredToken()) {
      account = (await fetchFleetAccount(true)) || account;
      characters = await fetchCharacters();
    }
    // Auto-create a Warlords shelf hero only when that era is empty
    // (voxel/nexus/armada heroes must not look like “no roster”).
    const hasWarlords = characters.some((c) => {
      const e = String(c.gameEra || c.config?.gameEra || c.config?.era || "").toLowerCase();
      return !e || e === "warlords";
    });
    if (!hasWarlords && getStoredToken()) {
      try {
        const { createFleetCharacter } = await import("./accountShared");
        const name = account?.displayName || "Guest Adventurer";
        const created = await createFleetCharacter({
          name,
          raceId: "western-kingdoms",
          classId: "warrior",
          catalogId: "race-western-kingdoms",
          gameEra: "warlords",
        });
        if (created.ok) {
          characters = await fetchCharacters();
          if (!characters.length) {
            characters = [
              {
                id: created.id,
                name,
                raceId: "western-kingdoms",
                classId: "warrior",
                level: 1,
              },
            ];
          }
          try {
            sessionStorage.setItem("grudge.open.selectedCharacterId", created.id);
            localStorage.setItem("grudge.open.selectedCharacterId", created.id);
          } catch {
            /* */
          }
        }
      } catch (err) {
        console.warn("[gameopen] auto-create Warlords character failed", err);
      }
    }
  }

  // AUTO-PROVISION WALLET: every logged-in account gets a Crossmint custodial
  // Solana wallet scoped to its grudgeId. Runs in background so it never
  // blocks the UI. Canonical truth = Railway Postgres `wallets` table.
  // Guests skip wallet (no Crossmint for temp ids).
  if (account && account.source !== "guest") {
    // Dynamic import keeps walletService out of the critical-path bundle.
    void import("./walletService").then(({ ensureWallet }) => {
      void ensureWallet();
    });
  }

  return { account, characters };
}

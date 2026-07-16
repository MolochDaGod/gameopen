/**
 * Grudge Studio identity bridge — links gameopen to fleet accounts.
 *
 * Priority:
 *  1. Grudge ID SSO token (id.grudge-studio.com / ?sso_token= / #sso_token / session)
 *  2. Clerk session (optional, when VITE_CLERK_PUBLISHABLE_KEY is set)
 *  3. Guest play (local roster only)
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

export function getStoredToken(): string | null {
  try {
    const open = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (open) return open;
    for (const k of FLEET_TOKEN_KEYS) {
      const t = localStorage.getItem(k) || sessionStorage.getItem(k);
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

/** Exchange short launch JWT for full session JWT. */
export async function bridgeLaunchToken(launchToken: string): Promise<string | null> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://open.grudge-studio.com";
  // Railway exchange expects token + audience (400 without body fields).
  const bodies = [
    JSON.stringify({ token: launchToken, audience: origin }),
    JSON.stringify({ launchToken, audience: origin }),
    JSON.stringify({ grudge_token: launchToken, audience: origin }),
  ];
  // Only probe endpoints that exist in production.
  // `/api/auth/grudge-bridge` 404s on id.grudge-studio.com and Railway — do not hit it.
  const urls = [
    // Builder Railway (works in production — 400 without body, not 404)
    `${FLEET.gameData}/api/auth/session/exchange`,
    // Same-origin rewrites (Open → id or Railway)
    apiUrl("/api/auth/session/exchange"),
    `${FLEET.auth}/api/auth/session/exchange`,
  ];
  for (const url of urls) {
    for (const body of bodies) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body,
          credentials: "include",
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) continue;
        const data = (await r.json()) as Record<string, unknown>;
        const t = String(
          data.sessionToken || data.token || data.access_token || data.sso_token || "",
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
        /* try next body/url */
      }
    }
  }
  return null;
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
  // Force full login UI with dual return params (never drop gameopen origin)
  window.location.href = buildGrudgeLoginUrl(
    `${window.location.origin}${window.location.pathname}`,
    { force: true, app: "gameopen" },
  );
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

/**
 * Resolve account from the fleet API.
 *
 * TOKEN-FIRST: cached token+account → return immediately, background-revalidate.
 * Falls through to bridge launch tokens and multi-endpoint probing when needed.
 */
export async function fetchFleetAccount(
  force = false,
): Promise<GrudgeAccount | null> {
  let token = getStoredToken();
  if (!token) return getStoredAccount(); // guest

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

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: await authHeaders(),
        credentials: "include",
        signal: AbortSignal.timeout(6000),
      });
      if (r.status === 401 && token) {
        // Short launch JWT — bridge to full session once.
        const bridged = await bridgeLaunchToken(token);
        if (bridged) { token = bridged; continue; }
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
  // Return stale cache rather than forcing logout.
  return getStoredAccount();
}

/** List characters for the signed-in Grudge account (Warlords / fleet SSOT). */
export async function fetchCharacters(): Promise<GrudgeCharacter[]> {
  const paths = [
    // Warlords era is the fleet character roster used across Open / Realms / Island
    "/api/characters?era=warlords",
    "/api/characters",
  ];
  for (const path of paths) {
    try {
      const r = await apiFetch(path, { method: "GET" });
      if (r.status === 401) {
        const token = getStoredToken();
        if (token && !isTokenExpired(token)) {
          // Try bridge once in case this is still a launch JWT
          const bridged = await bridgeLaunchToken(token);
          if (bridged) continue;
        }
        return [];
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
      const mapped = list
        .map((c: Record<string, unknown>) => {
          const avatarUrl =
            (typeof c.avatarUrl === "string" && c.avatarUrl) ||
            (typeof c.avatar_url === "string" && c.avatar_url) ||
            null;
          const model3d =
            (c.model3d as Record<string, unknown>) ||
            (c.model_3d as Record<string, unknown>) ||
            null;
          return {
            id: String(c.id || c.uuid || c.characterId || ""),
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
            avatarUrl,
            model3d,
            config: (c.config as Record<string, unknown>) || undefined,
            saveData:
              (c.saveData as Record<string, unknown>) ||
              (c.save_data as Record<string, unknown>) ||
              undefined,
            equipment:
              (c.equipment as Record<string, unknown>) ||
              null,
          };
        })
        .filter((c: GrudgeCharacter) => c.id);
      if (mapped.length || path.endsWith("/characters")) return mapped;
    } catch {
      /* try next path */
    }
  }
  return [];
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
  const characters = account || getStoredToken() ? await fetchCharacters() : [];

  // AUTO-PROVISION WALLET: every logged-in account gets a Crossmint custodial
  // Solana wallet scoped to its grudgeId. Runs in background so it never
  // blocks the UI. Canonical truth = Railway Postgres `wallets` table.
  if (account) {
    // Dynamic import keeps walletService out of the critical-path bundle.
    void import("./walletService").then(({ ensureWallet }) => {
      void ensureWallet();
    });
  }

  return { account, characters };
}

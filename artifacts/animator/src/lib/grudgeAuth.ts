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
  config?: Record<string, unknown>;
  saveData?: Record<string, unknown>;
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
    const raw = sessionStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as GrudgeAccount) : null;
  } catch {
    return null;
  }
}

export function setStoredAccount(account: GrudgeAccount | null): void {
  try {
    if (!account) sessionStorage.removeItem(ACCOUNT_KEY);
    else sessionStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    /* */
  }
}

/**
 * Capture fleet SSO handoff from query + hash.
 * CRITICAL: prefer full session JWT (sso_token) over short launch (grudge_token).
 */
export function captureAuthCallbackFromUrl(): string | null {
  if (typeof window === "undefined") return null;

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

  if (!sso && !launch) return getStoredToken();

  // Prefer long-lived session token for Bearer API calls
  if (sso && sso.length > 20) {
    setStoredToken(sso, true);
    if (grudgeId) {
      try {
        localStorage.setItem("grudge_id", grudgeId);
        localStorage.setItem("grudge_account_id", grudgeId);
      } catch {
        /* */
      }
      setStoredAccount({
        grudgeId,
        displayName: username || undefined,
        source: "grudge-id",
      });
    }
    cleanHandoffParamsFromUrl();
    // Bridge launch in background if present (optional)
    if (launch) void bridgeLaunchToken(launch).catch(() => undefined);
    return sso;
  }

  if (launch) {
    cleanHandoffParamsFromUrl();
    // Synchronous path: store launch briefly; initFleetAuth will await bridge
    setStoredToken(launch, true);
    return launch;
  }

  return null;
}

/** Exchange short launch JWT for full session JWT. */
export async function bridgeLaunchToken(launchToken: string): Promise<string | null> {
  const body = JSON.stringify({
    token: launchToken,
    audience: typeof window !== "undefined" ? window.location.origin : "https://gameopen.vercel.app",
  });
  const urls = [
    apiUrl("/api/auth/session/exchange"),
    apiUrl("/api/auth/grudge-bridge"),
    `${FLEET.auth}/api/auth/session/exchange`,
    `${FLEET.auth}/api/auth/grudge-bridge`,
    `${FLEET.gameData}/api/auth/session/exchange`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        credentials: url.startsWith("http") && !url.includes("id.grudge-studio") ? "omit" : "include",
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const data = (await r.json()) as Record<string, unknown>;
      const t = String(data.sessionToken || data.token || "");
      if (!t) continue;
      setStoredToken(t, true);
      const gid = String(
        data.grudgeId ||
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
  try {
    localStorage.removeItem("grudge_id");
    localStorage.removeItem("grudge_account_id");
    localStorage.removeItem("grudge_username");
  } catch {
    /* */
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const token = getStoredToken();
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  // Do NOT add custom headers like x-grudge-id — they trigger a CORS preflight
  // and Railway grudge-api-production does not allow them in Access-Control-Allow-Headers.
  // The Bearer token already carries identity.
  return h;
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
  const endpoints = [
    apiUrl("/api/auth/me"),
    `${FLEET.auth}/api/auth/me`,
    apiUrl("/api/account/me"),
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
  try {
    const r = await fetch(apiUrl("/api/characters"), {
      headers: await authHeaders(),
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.characters)
        ? data.characters
        : Array.isArray(data?.results)
          ? data.results
          : [];
    return list
      .map((c: Record<string, unknown>) => ({
        id: String(c.id || c.uuid || c.characterId || ""),
        name: String(c.name || c.displayName || "Hero"),
        raceId: c.raceId ? String(c.raceId) : c.race ? String(c.race) : undefined,
        classId: c.classId ? String(c.classId) : c.class ? String(c.class) : undefined,
        level: typeof c.level === "number" ? c.level : undefined,
        config: (c.config as Record<string, unknown>) || undefined,
        saveData:
          (c.saveData as Record<string, unknown>) ||
          (c.save_data as Record<string, unknown>) ||
          undefined,
      }))
      .filter((c: GrudgeCharacter) => c.id);
  } catch {
    return [];
  }
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
  }

  // TOKEN-FIRST: cached account returns instantly; API hit is background-only.
  const account = await fetchFleetAccount();
  const characters = account ? await fetchCharacters() : [];
  return { account, characters };
}

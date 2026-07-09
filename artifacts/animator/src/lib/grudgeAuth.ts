/**
 * Grudge Studio identity bridge — links gameopen to fleet accounts.
 *
 * Priority:
 *  1. Grudge ID SSO token (id.grudge-studio.com / ?grudge_token= / session)
 *  2. Clerk session (optional, when VITE_CLERK_PUBLISHABLE_KEY is set)
 *  3. Guest play (local roster only)
 *
 * Characters SSOT: GrudgeBuilder Railway via same-origin /api/characters
 * (Vercel rewrite → grudge-api-production).
 */

import { FLEET, apiUrl, buildGrudgeLoginUrl } from "./fleet";

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

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null, persist = true): void {
  try {
    if (!token) {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    if (persist) localStorage.setItem(TOKEN_KEY, token);
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

/** Capture ?grudge_token= / ?sso_token= from fleet SSO return. */
export function captureAuthCallbackFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const token =
    url.searchParams.get("grudge_token") ||
    url.searchParams.get("sso_token") ||
    url.searchParams.get("token");
  if (!token) return null;
  setStoredToken(token, true);
  url.searchParams.delete("grudge_token");
  url.searchParams.delete("sso_token");
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  return token;
}

export function loginWithGrudgeId(): void {
  window.location.href = buildGrudgeLoginUrl(
    window.location.origin + window.location.pathname,
  );
}

export function logoutGrudge(): void {
  setStoredToken(null);
  setStoredAccount(null);
}

async function authHeaders(): Promise<HeadersInit> {
  const token = getStoredToken();
  const h: Record<string, string> = { Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  const acct = getStoredAccount();
  if (acct?.grudgeId) h["x-grudge-id"] = acct.grudgeId;
  return h;
}

/** Resolve account via fleet /api/auth/me or GrudgeBuilder account. */
export async function fetchFleetAccount(): Promise<GrudgeAccount | null> {
  const token = getStoredToken();
  if (!token) return getStoredAccount();

  const endpoints = [
    apiUrl("/api/auth/me"),
    apiUrl("/api/account/me"),
    `${FLEET.gameData}/api/auth/me`,
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: await authHeaders(),
        credentials: "include",
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const data = (await r.json()) as Record<string, unknown>;
      const grudgeId = String(
        data.grudgeId || data.grudge_id || data.id || data.sub || "",
      );
      if (!grudgeId) continue;
      const account: GrudgeAccount = {
        grudgeId,
        displayName: String(data.displayName || data.name || data.username || ""),
        source: "grudge-id",
      };
      setStoredAccount(account);
      return account;
    } catch {
      /* try next */
    }
  }
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
    return list.map((c: Record<string, unknown>) => ({
      id: String(c.id || c.uuid || c.characterId || ""),
      name: String(c.name || c.displayName || "Hero"),
      raceId: c.raceId ? String(c.raceId) : c.race ? String(c.race) : undefined,
      classId: c.classId ? String(c.classId) : c.class ? String(c.class) : undefined,
      level: typeof c.level === "number" ? c.level : undefined,
      config: (c.config as Record<string, unknown>) || undefined,
      saveData: (c.saveData as Record<string, unknown>) || (c.save_data as Record<string, unknown>) || undefined,
    })).filter((c: GrudgeCharacter) => c.id);
  } catch {
    return [];
  }
}

/** Boot hook — call once from App root. */
export async function initFleetAuth(): Promise<{
  account: GrudgeAccount | null;
  characters: GrudgeCharacter[];
}> {
  captureAuthCallbackFromUrl();
  const account = await fetchFleetAccount();
  const characters = account ? await fetchCharacters() : [];
  return { account, characters };
}

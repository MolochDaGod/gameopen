/**
 * Grudge Studio fleet endpoints — same-origin first, absolute fallbacks second.
 * Prefer relative /api/* so Vercel rewrites keep cookies + skip CORS preflight.
 *
 * Auth contract: docs/GRUDGE_AUTH_CONNECT.md (GrudgeBuilder)
 * Login must dual-write redirect_uri + redirect + return so id-gateway never drops return.
 */

export const FLEET = {
  auth: "https://id.grudge-studio.com",
  assets: "https://assets.grudge-studio.com",
  gameopenPrefix: "gameopen",
  objectStore: "https://objectstore.grudge-studio.com/api/v1",
  gameData: "https://grudge-api-production-0d46.up.railway.app",
  ai: "https://ai.grudge-studio.com",
} as const;

/** Fleet JWT storage keys — write all, read any (matches grudge-game-bootstrap). */
export const FLEET_TOKEN_KEYS = [
  "grudge_auth_token",
  "grudge_session_token",
  "grudge.token",
  "sso_token",
  "grudge_token",
] as const;

/** Build a URL under the app BASE_URL for public/ files. */
export function publicUrl(rel: string): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const path = rel.replace(/^\//, "");
  return `${base}${path}`;
}

/**
 * Prefer R2 CDN for heavy assets when VITE_USE_R2=true and not on localhost.
 * Falls back to same-origin public/ (Vercel static).
 */
export function assetUrl(rel: string): string {
  const path = rel.replace(/^\//, "");
  const useR2 = import.meta.env.VITE_USE_R2 === "true";
  const isLocal =
    typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1");

  if (useR2 && !isLocal) {
    const cdn =
      import.meta.env.VITE_ASSET_BASE_URL ||
      `${FLEET.assets}/${FLEET.gameopenPrefix}`;
    return `${cdn.replace(/\/$/, "")}/${path}`;
  }
  return publicUrl(path);
}

/** Same-origin API path (Vercel → Railway). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.startsWith("/api")) return p;
  return `/api${p}`;
}

/**
 * Canonical Grudge ID login URL.
 * Dual-writes every return alias the gateway / auth-page accept so handoff
 * always returns to THIS origin (e.g. https://gameopen.vercel.app/).
 */
export function buildGrudgeLoginUrl(returnTo?: string, opts?: { force?: boolean; app?: string }): string {
  const redirect =
    returnTo ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search || ""}`.replace(
          /[?&](grudge_token|sso_token|token|launch_token)=[^&]*/g,
          "",
        )
      : "https://gameopen.vercel.app/");
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://gameopen.vercel.app";
  const q = new URLSearchParams({
    redirect_uri: redirect,
    redirect,
    return: redirect,
    return_to: redirect,
    origin,
    app: opts?.app || "gameopen",
  });
  const base = FLEET.auth.replace(/\/$/, "");
  if (opts?.force) {
    return `${base}/login?${q.toString()}`;
  }
  // sso-check: silent re-entry when studio cookie exists, else → /login with dual return
  return `${base}/auth/sso-check?${q.toString()}`;
}

/**
 * Resolve a path under the ObjectStore definitions CDN.
 * Use for weapon/item/recipe/skill definition JSON — never for character state.
 * Example: contentUrl("master-items.json") → https://objectstore.../api/v1/master-items.json
 */
export function contentUrl(path: string): string {
  const base =
    (import.meta.env.VITE_OBJECTSTORE_URL as string) ||
    FLEET.objectStore;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

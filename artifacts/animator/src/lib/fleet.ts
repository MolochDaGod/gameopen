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
 * Same-origin public/ first (Vercel static). Absolute R2 only with
 * VITE_ASSET_FORCE_R2=true — VITE_USE_R2 alone caused mass 404s when the
 * gameopen R2 prefix was incomplete.
 *
 * For GLB/FBX/texture **loads**, use `three/assets` `loadGltfFirst` /
 * `assetCandidates` (fleet multi-host). This helper is for <img src> / posters.
 */
export function assetUrl(rel: string): string {
  const path = rel.replace(/^\//, "");
  if (import.meta.env.VITE_ASSET_FORCE_R2 === "true") {
    // Prefer R2 **root** (weapons, icons, textures) — not incomplete /gameopen
    const cdn =
      import.meta.env.VITE_ASSET_BASE_URL ||
      FLEET.assets;
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
/**
 * Canonical Grudge ID login URL for Open.
 * Always lands on /login (id.grudge-studio.com/auth/sso-check is 404 in production).
 * Dual-writes every return alias so the gateway never drops the Open origin.
 * Default return: current location, or https://open.grudge-studio.com/
 */
export function buildGrudgeLoginUrl(returnTo?: string, opts?: { force?: boolean; app?: string }): string {
  const defaultOrigin = "https://open.grudge-studio.com";
  const redirect =
    returnTo ||
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search || ""}`.replace(
          /[?&](grudge_token|sso_token|token|launch_token|characterId|character_id)=[^&]*/g,
          "",
        )
      : `${defaultOrigin}/`);
  const origin =
    typeof window !== "undefined" ? window.location.origin : defaultOrigin;
  const q = new URLSearchParams({
    redirect_uri: redirect,
    redirect,
    return: redirect,
    return_to: redirect,
    origin,
    app: opts?.app || "gameopen",
  });
  // Always /login — silent sso-check is not available on id-gateway (404).
  return `${FLEET.auth.replace(/\/$/, "")}/login?${q.toString()}`;
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

/**
 * Grudge Studio fleet endpoints — same-origin first, absolute fallbacks second.
 * Prefer relative /api/* so Vercel rewrites keep cookies + skip CORS preflight.
 */

export const FLEET = {
  auth: "https://id.grudge-studio.com",
  assets: "https://assets.grudge-studio.com",
  gameopenPrefix: "gameopen",
  objectStore: "https://objectstore.grudge-studio.com/api/v1",
  gameData: "https://grudge-api-production-0d46.up.railway.app",
  ai: "https://ai.grudge-studio.com",
} as const;

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

/** Grudge ID login redirect (fleet SSO). */
export function buildGrudgeLoginUrl(returnTo?: string): string {
  const redirect =
    returnTo ||
    (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "");
  const q = new URLSearchParams({ redirect_uri: redirect });
  return `${FLEET.auth}/login?${q.toString()}`;
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

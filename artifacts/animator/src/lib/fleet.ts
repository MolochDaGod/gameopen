/**
 * Grudge Studio fleet endpoints — same-origin first, absolute fallbacks second.
 * Prefer relative /api/* so Vercel rewrites keep cookies + skip CORS preflight.
 *
 * Auth contract: docs/GRUDGE_AUTH_CONNECT.md (GrudgeBuilder)
 * Login must dual-write redirect_uri + redirect + return so id-gateway never drops return.
 */

export const FLEET = {
  auth: "https://id.grudge-studio.com",
  /** Binary CDN — R2 grudge-assets via r2-cdn Worker. */
  assets: "https://assets.grudge-studio.com",
  gameopenPrefix: "gameopen",
  /**
   * Definitions / catalogs SSOT (probed 2026-07).
   * Prefer this over objectstore host — public objectstore /api/v1 catalogs 404.
   */
  definitions: "https://info.grudge-studio.com/api/v1",
  /**
   * @deprecated Alias of {@link definitions} for older callers named objectStore.
   * Do not point at objectstore.grudge-studio.com for catalogs until that host is fixed.
   */
  objectStore: "https://info.grudge-studio.com/api/v1",
  /** Legacy definitions hostname (often 404 for catalogs — fallback only). */
  objectStoreLegacy: "https://objectstore.grudge-studio.com/api/v1",
  /** Player state — Railway Postgres (never D1, never localStorage SSOT). */
  gameData: "https://grudge-api-production-0d46.up.railway.app",
  /**
   * AI hub Worker (grudge-ai-hub) — ONE TRUTH.
   * Health: GET /health · chat: POST /v1/chat · roles: /v1/agents/:role/chat
   * Override: VITE_AI_URL · client helpers: lib/engineStack.ts · ai/aiGateway.ts
   */
  ai: "https://ai.grudge-studio.com",
  /** Mine-Loader world API (1 replica). */
  mineLoaderApi: "https://mine-loader-api-production.up.railway.app",
  arena: "https://grudge-arena.grudge-studio.com",
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

/** Brand Open launcher — never pin login return to gameopen.vercel.app / previews. */
export const OPEN_BRAND = "https://open.grudge-studio.com";

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Production return URL for Open. Maps vercel/preview hosts → open.grudge-studio.com.
 * Keeps path + non-auth query; strips token handoff params.
 */
export function openReturnUrl(pathAndQuery?: string): string {
  const strip =
    /[?&](grudge_token|sso_token|token|launch_token|access_token|characterId|character_id|provider)=[^&]*/gi;
  if (typeof window === "undefined") {
    return pathAndQuery
      ? `${OPEN_BRAND}${pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`}`
      : `${OPEN_BRAND}/`;
  }
  const h = window.location.hostname || "";
  if (isLocalDevHost(h)) {
    const raw = pathAndQuery
      ? `${window.location.origin}${pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`}`
      : `${window.location.origin}${window.location.pathname}${window.location.search || ""}`;
    return raw.replace(strip, "").replace(/\?&/, "?").replace(/[?&]$/, "") || window.location.origin + "/";
  }
  // Preview / alias → brand domain, preserve path
  const path =
    pathAndQuery ||
    `${window.location.pathname}${window.location.search || ""}`;
  const cleaned = path.replace(strip, "").replace(/\?&/, "?").replace(/[?&]$/, "") || "/";
  return `${OPEN_BRAND}${cleaned.startsWith("/") ? cleaned : `/${cleaned}`}`;
}

/**
 * Canonical Grudge ID login URL for Open.
 * Always lands on /login; dual-writes every return alias; production return is brand Open.
 */
export function buildGrudgeLoginUrl(returnTo?: string, opts?: { force?: boolean; app?: string }): string {
  const redirect = returnTo || openReturnUrl();
  const origin = OPEN_BRAND;
  const q = new URLSearchParams({
    redirect_uri: redirect,
    redirect,
    return: redirect,
    returnTo: redirect,
    return_to: redirect,
    origin,
    app: opts?.app || "gameopen",
  });
  return `${FLEET.auth.replace(/\/$/, "")}/login?${q.toString()}`;
}

/**
 * Resolve a path under the **definitions** catalog host (info.grudge-studio.com).
 * Use for weapon/item/recipe/skill JSON — never for character state.
 * Example: contentUrl("master-items.json") → https://info…/api/v1/master-items.json
 *
 * For multi-host resilience use `contentCandidates` / `fetchCatalogJson` from
 * `./fleetSsot` (preferred).
 */
export function contentUrl(path: string): string {
  const base =
    (import.meta.env.VITE_OBJECTSTORE_URL as string) ||
    FLEET.definitions ||
    FLEET.objectStore;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

// Prefer importing resilient catalog helpers from `./fleetSsot` (not re-exported
// here — avoids circular import with fleetSsot → fleet).

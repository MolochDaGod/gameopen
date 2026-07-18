/**
 * Shared asset URL resolution for Node + browser Warlords hosts.
 *
 * Order:
 *  1. Explicit absolute URL (http/https/data/blob)
 *  2. CDN base (assets.grudge-studio.com / VITE_ASSET_BASE_URL)
 *  3. Same-origin / public path (`/anim/...`, `/models/...`)
 *  4. Catalog logical id → path map (optional)
 */

export interface AssetResolveOptions {
  /** CDN origin, no trailing slash. */
  cdnBase?: string;
  /** App origin or empty for relative. */
  origin?: string;
  /** Logical id → relative path map. */
  catalog?: Record<string, string>;
  /**
   * When true, paths without leading slash get `/` prefix
   * (browser public root). Default true.
   */
  publicRoot?: boolean;
}

const DEFAULT_CDN =
  (typeof process !== "undefined" &&
    (process.env?.VITE_ASSET_BASE_URL || process.env?.ASSET_BASE_URL)) ||
  "https://assets.grudge-studio.com";

/** Strip trailing slashes. */
export function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** True for absolute / data URLs. */
export function isAbsoluteAssetUrl(url: string): boolean {
  return /^(https?:|data:|blob:|file:)/i.test(url);
}

/**
 * Resolve a fleet asset path or logical id to a fetchable URL.
 *
 * @example
 * resolveAssetUrl("anim/sword/slash.fbx")
 * // → https://assets.grudge-studio.com/anim/sword/slash.fbx  (if cdn)
 * // or /anim/sword/slash.fbx on same-origin Open
 */
export function resolveAssetUrl(
  pathOrId: string,
  opts: AssetResolveOptions = {},
): string {
  if (!pathOrId) return "";
  if (isAbsoluteAssetUrl(pathOrId)) return pathOrId;

  const catalog = opts.catalog;
  let rel = catalog?.[pathOrId] ?? pathOrId;
  rel = rel.replace(/^\/+/, "");

  const cdn = opts.cdnBase != null ? trimSlash(opts.cdnBase) : "";
  if (cdn) {
    return `${cdn}/${rel}`;
  }

  const origin = opts.origin != null ? trimSlash(opts.origin) : "";
  const withSlash = opts.publicRoot === false ? rel : `/${rel}`;
  return origin ? `${origin}${withSlash}` : withSlash;
}

/**
 * Prefer same-origin for Open deploys, CDN as fallback.
 * Browser hosts: pass `origin: window.location.origin` and leave cdn as fallback.
 */
export function resolveAssetUrlPreferLocal(
  pathOrId: string,
  opts: AssetResolveOptions & { preferLocal?: boolean } = {},
): string {
  if (opts.preferLocal !== false) {
    const local = resolveAssetUrl(pathOrId, {
      ...opts,
      cdnBase: "",
    });
    return local;
  }
  return resolveAssetUrl(pathOrId, {
    cdnBase: opts.cdnBase ?? DEFAULT_CDN,
    ...opts,
  });
}

/** Standard public path prefixes used by Open + fleet. */
export const ASSET_PREFIX = {
  anim: "anim",
  models: "models",
  icons: "icons",
  audio: "audio",
  content: "content",
  grudge: "models/grudge",
  weapons: "models/weapons",
} as const;

export function animPath(rel: string): string {
  return `${ASSET_PREFIX.anim}/${rel.replace(/^anim\//, "")}`;
}

export function modelPath(rel: string): string {
  return `${ASSET_PREFIX.models}/${rel.replace(/^models\//, "")}`;
}

/**
 * Node-friendly env reader for asset base (build scripts / workers).
 */
export function assetBaseFromEnv(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? process.env
    : {},
): string {
  return trimSlash(
    env.VITE_ASSET_BASE_URL ||
      env.ASSET_BASE_URL ||
      env.GRUDGE_CDN ||
      DEFAULT_CDN,
  );
}

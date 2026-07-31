/**
 * ObjectStore icon / material path helpers for inventory + UI.
 * Soft CDN resolve — never throws if hosts are offline.
 */

const CDN = "https://assets.grudge-studio.com";
const MATERIALS_PREFIX = "game-assets/icons/materials";

/** Map material slug → CDN-relative icon path. */
export function materialIconPath(slug: string): string {
  const s = String(slug || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${MATERIALS_PREFIX}/${s || "unknown"}.png`;
}

/**
 * Resolve an icon path or key to an absolute (or same-origin) URL.
 * Sync — prefer fleet CDN for pack paths.
 */
export function resolveIconUrl(pathOrKey: string): string {
  if (!pathOrKey) return "";
  if (/^([a-z]+:)?\/\//i.test(pathOrKey) || pathOrKey.startsWith("data:")) return pathOrKey;
  const key = pathOrKey.replace(/^\//, "");
  if (key.startsWith("icons/") || key.startsWith("game-assets/")) return `${CDN}/${key}`;
  if (key.includes("/")) return `${CDN}/${key}`;
  return `${CDN}/icons/${key}.png`;
}

export function objectStoreAssetUrl(key: string): string {
  if (!key) return "";
  if (/^https?:\/\//i.test(key)) return key;
  return `${CDN}/${key.replace(/^\//, "")}`;
}

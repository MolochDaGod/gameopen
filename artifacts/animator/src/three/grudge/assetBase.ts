// Configurable asset base for the vendored Grudge character-kit.
//
// Fleet resolution: prefer multi-host {@link resolveAssetCandidates} from
// fleetAssetResolver (same-origin → Open → R2 root). Single-base URLs remain
// for simple cases; loaders should use candidates + loadFbxFirst / loadTextureFirst.
//
// Override at build time with `VITE_ASSET_BASE`, or at runtime via `setAssetBase()`.

import {
  FLEET_ASSET_HOSTS,
  resolveAssetCandidates,
  resolveAssetUrl as fleetResolveAssetUrl,
} from "../fleetAssetResolver";

const DEFAULT_ASSET_BASE = FLEET_ASSET_HOSTS.r2;

function initialBase(): string {
  const env = (import.meta.env?.VITE_ASSET_BASE as string | undefined) ?? "";
  return (env || DEFAULT_ASSET_BASE).replace(/\/+$/, "");
}

let assetBase = initialBase();

// Set the absolute origin (or origin+path prefix) that serves `/assets/*` and
// `/anims/*`. Trailing slashes are trimmed so callers can pass either form.
export function setAssetBase(base: string | undefined | null): void {
  assetBase = (base ?? "").replace(/\/+$/, "");
}

// The currently configured asset base.
export function getAssetBase(): string {
  return assetBase;
}

// Resolve a root-relative asset path. When using the default R2 base, still
// return R2 absolute URL for simple <img> cases; loaders must use candidates.
export function resolveAssetUrl(path: string): string {
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  // Prefer fleet same-origin first for Open SPA; R2 paths still work via candidates.
  if (!assetBase || assetBase === DEFAULT_ASSET_BASE) {
    return fleetResolveAssetUrl(path.replace(/^\//, ""));
  }
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${assetBase}${rel}`;
}

/** Multi-host candidates for grudge kit paths (/assets, /anims, textures). */
export function resolveGrudgeAssetCandidates(path: string): string[] {
  const clean = path.replace(/^\//, "");
  const urls = resolveAssetCandidates(clean);
  // Also try configured base if it is non-default (staging).
  if (assetBase && assetBase !== DEFAULT_ASSET_BASE) {
    urls.unshift(`${assetBase}/${clean}`);
  }
  return [...new Set(urls)];
}

// Build a loud, actionable Error for a failed asset fetch/load.
export function assetLoadError(url: string, cause?: unknown): Error {
  const base = assetBase || "(root-relative — same origin)";
  const hint =
    "These files (/assets/*, /anims/*, textures/grudge6/*) resolve via fleet hosts " +
    `(R2 ${DEFAULT_ASSET_BASE}, open.grudge-studio.com, same-origin). Override via setAssetBase() / VITE_ASSET_BASE.`;
  const err = new Error(`[grudge-kit] failed to load asset: ${url} (assetBase=${base}). ${hint}`);
  if (cause !== undefined) (err as { cause?: unknown }).cause = cause;
  return err;
}

// Probe whether the fleet R2 host is reachable.
export async function probeAssetHost(
  signal?: AbortSignal,
): Promise<{ ok: boolean; url: string; status?: number; error?: string }> {
  const url = `${DEFAULT_ASSET_BASE}/anims/baked/locomotion/walking.json`;
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", signal });
    return { ok: res.ok, url, status: res.status };
  } catch (err) {
    return { ok: false, url, error: err instanceof Error ? err.message : String(err) };
  }
}

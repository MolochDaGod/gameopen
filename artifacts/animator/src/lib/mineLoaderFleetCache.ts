/**
 * Mine-Loader / fleet deploy-epoch cache control for Open (gameopen).
 *
 * Mirrors Mine-Loader `fleetCache.ts`:
 *  - Read GET /api/ssot (or Railway) → version.worldFleet + assetCatalog
 *  - Optional world_deploy_stamp from Realms SPA
 *  - Store epoch; append ?v= to CDN asset URLs via fleetAssetResolver
 *
 * Docs: Mine-Loader docs/WORLD_CACHE_AND_DEPLOY.md
 */

import { MINE_LOADER_API, MINE_LOADER_VERCEL, MINE_LOADER_EDGE } from "../auth/mineLoaderConfig";

export const OPEN_FLEET_EPOCH_KEY = "grudge_fleet_deploy_epoch";

let assetCacheEpoch = "";

export function getAssetCacheEpoch(): string {
  return assetCacheEpoch;
}

export function setAssetCacheEpoch(epoch: string): void {
  assetCacheEpoch = (epoch || "").trim();
  try {
    if (assetCacheEpoch) {
      localStorage.setItem(OPEN_FLEET_EPOCH_KEY, assetCacheEpoch);
    } else {
      localStorage.removeItem(OPEN_FLEET_EPOCH_KEY);
    }
  } catch {
    /* private mode */
  }
}

export function restoreAssetCacheEpochFromStorage(): string {
  try {
    const v = localStorage.getItem(OPEN_FLEET_EPOCH_KEY) || "";
    if (v) assetCacheEpoch = v;
  } catch {
    /* ignore */
  }
  return assetCacheEpoch;
}

/** Append deploy epoch so re-uploaded same-path CDN GLBs are not sticky. */
export function withAssetCacheBust(url: string): string {
  if (!assetCacheEpoch || !url || url.startsWith("data:")) return url;
  if (/[?&]v=/.test(url)) return url;
  // Only bust absolute CDN/fleet hosts (not same-origin hashed Vite chunks)
  if (!/^https?:\/\//i.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(assetCacheEpoch)}`;
}

export function clearOpenAssetRuntimeCache(): void {
  try {
    // THREE.Cache if present
    void import("three").then((m) => {
      try {
        m.Cache?.clear?.();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

type SsotBody = {
  version?: { worldFleet?: string; assetCatalog?: string };
};

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Boot-time: restore epoch, honor ?clearCache=, sync from Mine-Loader SSOT + stamp.
 */
export async function bootstrapMineLoaderFleetCache(): Promise<{
  epoch: string;
  changed: boolean;
}> {
  restoreAssetCacheEpochFromStorage();
  const prev = assetCacheEpoch;

  try {
    const q = new URLSearchParams(globalThis.location?.search || "");
    const flag = q.get("clearCache");
    if (flag === "1" || flag === "true" || flag === "all") {
      clearOpenAssetRuntimeCache();
    }
  } catch {
    /* non-browser */
  }

  const ssotUrls = [
    "/api/ssot", // Open rewrite if present
    `${MINE_LOADER_API}/api/ssot`,
    `${MINE_LOADER_EDGE}/api/ssot`,
    `${MINE_LOADER_VERCEL}/api/ssot`,
  ];

  let worldFleet = "";
  let assetCatalog = "";
  for (const u of ssotUrls) {
    const body = (await fetchJson(u)) as SsotBody | null;
    if (body?.version) {
      worldFleet = (body.version.worldFleet || "").trim();
      assetCatalog = (body.version.assetCatalog || "").trim();
      if (worldFleet || assetCatalog) break;
    }
  }

  // Prefer content-hash stamp when published on Realms SPA / CDN
  const stampUrls = [
    `${MINE_LOADER_VERCEL}/assets/islands/world_deploy_stamp.json`,
    `${MINE_LOADER_EDGE}/assets/islands/world_deploy_stamp.json`,
    "https://assets.grudge-studio.com/models/islands/world-fleet/world_deploy_stamp.json",
  ];
  let stampVersion = "";
  for (const u of stampUrls) {
    const stamp = (await fetchJson(u)) as { version?: string; contentHash?: string } | null;
    if (stamp?.version) {
      stampVersion = stamp.version;
      break;
    }
    if (stamp?.contentHash) {
      stampVersion = stamp.contentHash;
      break;
    }
  }

  const epoch = stampVersion || worldFleet || assetCatalog || prev;
  const changed = !!epoch && epoch !== prev;
  if (epoch) setAssetCacheEpoch(epoch);
  if (changed) clearOpenAssetRuntimeCache();

  if (changed || flagClear()) {
    console.info("[fleet-cache] epoch", epoch, changed ? "(updated)" : "");
  }

  return { epoch: assetCacheEpoch, changed };
}

function flagClear(): boolean {
  try {
    const q = new URLSearchParams(globalThis.location?.search || "");
    const flag = q.get("clearCache");
    return flag === "1" || flag === "true" || flag === "all";
  } catch {
    return false;
  }
}

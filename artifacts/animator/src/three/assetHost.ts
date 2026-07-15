/**
 * Central asset-host resolution for public media (models, anim, icons, rooms).
 *
 * **Default same-origin** for open.grudge-studio.com — the SPA ships files under
 * Vite `public/`. Do NOT point simple `assetUrl` at incomplete R2
 * (`assets.grudge-studio.com/gameopen`) or absolute lab CDN URLs (CORS).
 *
 * For **runtime loads** (GLB/FBX/textures), use `three/assets` `loadGltfFirst` /
 * `assetCandidates` which walk R2 root + Open + aliases.
 *
 * Opt-in absolute CDN only: `VITE_ASSET_FORCE_R2=true` + `VITE_ASSET_BASE_URL`
 * (prefer R2 root, not `/gameopen`).
 */

import { FLEET_ASSET_HOSTS, resolveAssetUrl as fleetResolve } from "./fleetAssetResolver";

const forceR2 = import.meta.env.VITE_ASSET_FORCE_R2 === "true";
const configured = forceR2
  ? (import.meta.env.VITE_ASSET_BASE_URL?.trim() || FLEET_ASSET_HOSTS.r2)
  : "";

/** Effective asset host (no trailing slash). Empty → Vite BASE_URL (same-origin). */
export const ASSET_BASE: string = (
  configured && configured.length > 0 ? configured : import.meta.env.BASE_URL || "/"
).replace(/\/+$/, "");

/** Resolve a public asset path (e.g. `"models/y.glb"`) to a full URL. */
export function assetUrl(path: string): string {
  const rel = path.replace(/^\/+/, "");
  if (forceR2 && configured) {
    return `${configured.replace(/\/+$/, "")}/${rel}`;
  }
  return fleetResolve(rel);
}

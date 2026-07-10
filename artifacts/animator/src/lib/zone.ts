/**
 * GRUDOX shared game-zone endpoints.
 *
 * The GRUDOX zone (source of truth: Voxel-Forge-Core) is deployed as the Railway
 * room server `voxgrudge-grudox-room-production`, hosting the authoritative
 * multiplayer rooms `/api/space | /api/carrier | /api/brawl`. gameopen connects
 * its native co-op surfaces (e.g. Ruins Brawler) straight to those rooms.
 *
 * This is a DIFFERENT backend from gameopen's own api-server
 * (`VITE_GAME_SERVER_URL`), which still hosts the Danger Room relay `/api/danger`
 * — GRUDOX has no `/api/danger`, so the two URLs must not be conflated.
 */

/** Default GRUDOX zone backend (Railway room server). */
export const DEFAULT_ZONE_SERVER_URL =
  "wss://voxgrudge-grudox-room-production.up.railway.app";

/**
 * Resolve the configured GRUDOX zone server base URL.
 *
 * Reads `VITE_ZONE_SERVER_URL` when set (accepting either an `http(s)://` or
 * `ws(s)://` base), else falls back to the live Railway room server. The
 * returned value is normalized to a `ws(s)://` origin with no trailing slash so
 * a room sub-path can be appended directly.
 */
export function zoneServerBase(): string {
  const configured = import.meta.env.VITE_ZONE_SERVER_URL?.trim();
  const base = (configured || DEFAULT_ZONE_SERVER_URL).replace(/\/+$/, "");
  return base.replace(/^http(s?):\/\//i, (_m, s: string) => `ws${s}://`);
}

/** Build the full WebSocket URL for a GRUDOX zone room sub-path (e.g. `/api/brawl`). */
export function zoneWsUrl(wsPath: string): string {
  const path = wsPath.startsWith("/") ? wsPath : `/${wsPath}`;
  return `${zoneServerBase()}${path}`;
}

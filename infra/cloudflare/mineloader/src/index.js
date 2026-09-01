/**
 * mineloader.grudge-studio.com — Mine-Loader play / map / multiplayer edge
 *
 * Production play host for:
 *  - Multiplayer Realms (lobby + room worlds, Railway 1-replica authority)
 *  - Self-hosted / deployed maps (scene + blockEdits promote path)
 *  - Harvest mode — Minecraft-like gather/build (mode=harvest)
 *  - DRC combat mode — Danger-Room-style combat with account explorer avatar
 *    (mode=drc | mode=combat)
 *
 * Origin: mine-loader.vercel.app (static SPA; vercel.json rewrites /api/*)
 *   · /api/auth/*        → id.grudge-studio.com
 *   · /api/characters*   → Railway grudge-api (account explorer avatars)
 *   · /api/* (worlds…)   → mine-loader-api Railway (1 replica)
 *
 * Alias edge (same SPA): mine.grudge-studio.com (separate Worker `mine-loader-edge`)
 *
 * Never Replit. Never treat this host as player bag SSOT (bag stays grudge-api).
 */
const DEFAULT_ORIGIN = "mine-loader.vercel.app";

export default {
  /**
   * @param {Request} request
   * @param {{ ORIGIN_HOST?: string, MINE_ORIGIN_HOST?: string }} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const originHost =
      (env && (env.ORIGIN_HOST || env.MINE_ORIGIN_HOST)) || DEFAULT_ORIGIN;
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = originHost;
    url.port = "";

    // Preserve method/body/headers; CF derives Host/SNI from URL hostname.
    // WebSocket upgrades for world rooms terminate on Railway via SPA /api proxy.
    const res = await fetch(new Request(url.toString(), request));

    // Label play edge for debugging (does not affect CORS on Vercel origin).
    const headers = new Headers(res.headers);
    headers.set("X-Grudge-Edge", "mineloader.grudge-studio.com");
    headers.set("X-Grudge-App", "mine-loader");
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  },
};

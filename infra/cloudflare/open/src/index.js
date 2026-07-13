/**
 * open.grudge-studio.com edge proxy
 *
 * Route ownership (do NOT invent substitutes):
 *  - /arcade/*  → grudox.grudge-studio.com  (Voxel Arcade: racer=Voxel Velocity, etc.)
 *  - everything else → gameopen.vercel.app (Grudge Open hub / Danger Room / brawl native)
 *
 * Deploy:  cd infra/cloudflare/open && wrangler deploy
 */
const GAMEOPEN_HOST = "gameopen.vercel.app";
/** Canonical GRUDOX fleet shell — owns Voxel Arcade cabinets (racer, zombie, …). */
const GRUDOX_HOST = "grudox.grudge-studio.com";

/**
 * Paths that belong to GRUDOX Voxel Arcade, not gameopen.
 * Matching is prefix on pathname (leading slash).
 */
function isGrudoxArcadePath(pathname) {
  const p = pathname || "/";
  return (
    p === "/arcade" ||
    p.startsWith("/arcade/") ||
    // arcade static assets when loaded under open host via absolute /arcade/assets
    p.startsWith("/arcade")
  );
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.port = "";

    if (isGrudoxArcadePath(url.pathname)) {
      // Real Voxel Velocity / Voxel Arcade cabinets — never reimplement as Danger Room.
      url.hostname = GRUDOX_HOST;
    } else {
      url.hostname = GAMEOPEN_HOST;
    }

    // Forward method/body/headers. Workers derive Host/SNI from URL hostname.
    return fetch(new Request(url, request));
  },
};

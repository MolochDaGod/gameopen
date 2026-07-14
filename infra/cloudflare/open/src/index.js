/**
 * open.grudge-studio.com edge proxy → gameopen.vercel.app
 *
 * Transparently forwards every request (path, query, method, body, headers) to
 * the gameopen Vercel deployment, so the browser sees a single stable origin
 * (open.grudge-studio.com). Vercel then applies its own rewrites
 * (`/api/*` → grudge-api, `/auth/*` → id.grudge-studio.com, SPA fallback), so
 * the whole app — including same-origin auth cookies — works under the subdomain.
 *
 * Stateless + reversible: no caching or rewriting of the body; deleting the
 * Worker detaches the subdomain.
 */
const ORIGIN_HOST = "gameopen.vercel.app";

export default {
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = ORIGIN_HOST;
    url.port = "";

    // Forward method/body/headers to the origin URL. The Workers runtime derives
    // the outbound Host/SNI from the URL hostname (gameopen.vercel.app), so we do
    // NOT set Host manually (that's a managed header and misroutes if forced).
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

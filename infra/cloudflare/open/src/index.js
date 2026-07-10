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
    return fetch(new Request(url, request));
  },
};

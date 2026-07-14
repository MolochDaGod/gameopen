/**
 * mineloader.grudge-studio.com → self-hosted Mine-Loader SPA (Vercel)
 *
 * Replaces production use of mine-loader.replit.app.
 * Origin hostname is the Vercel project for Voxel Realms / Mine-Loader SPA.
 * Override with env ORIGIN_HOST when binding secrets in wrangler.
 *
 * Also forwards /api/* to the same origin so the SPA's same-origin API
 * (blocks, worlds, lobby, WS upgrade if Vercel+Worker allow) stays under
 * mineloader.grudge-studio.com. Long-lived WS for worlds should terminate
 * on Railway if needed — point SPA env to wss://…railway… when scaling.
 */
const DEFAULT_ORIGIN = "mineloader.vercel.app";

export default {
  /**
   * @param {Request} request
   * @param {{ ORIGIN_HOST?: string }} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const originHost = (env && env.ORIGIN_HOST) || DEFAULT_ORIGIN;
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = originHost;
    url.port = "";

    return fetch(new Request(url, request));
  },
};

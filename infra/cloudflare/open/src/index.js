/**
 * open.grudge-studio.com edge proxy
 *
 * Route ownership:
 *  - /api/danger (WebSocket upgrade) → gameopen Railway (Danger Room multiplayer)
 *  - /arcade/*  → grudox.grudge-studio.com  (Voxel Arcade: racer, zombie, z-brawl…)
 *  - everything else → gameopen.vercel.app (Open hub / Danger / brawl / zones)
 *
 * Why /api/danger is special: Vercel rewrites proxy HTTP but cannot upgrade
 * WebSockets. Browsers that hit same-origin wss://open…/api/danger would hang
 * unless the edge Worker upgrades directly to Railway gameopen.
 *
 * Arcade responses strip X-Frame-Options so Open can embed Voxel Arcade
 * in-app (same browser origin open.grudge-studio.com/arcade/…).
 *
 * Deploy:  cd infra/cloudflare/open && npx wrangler deploy
 */
const GAMEOPEN_HOST = "gameopen.vercel.app";
const GRUDOX_HOST = "grudox.grudge-studio.com";
/** Danger Room + Open API process (HTTP + /api/danger WS). */
const GAMEOPEN_API_ORIGIN = "https://gameopen-production.up.railway.app";

function isGrudoxArcadePath(pathname) {
  const p = pathname || "/";
  return p === "/arcade" || p.startsWith("/arcade/");
}

function isDangerWsPath(pathname) {
  return pathname === "/api/danger" || pathname === "/api/danger/";
}

/**
 * Headers that block Open from framing proxied GRUDOX arcade under the open host.
 */
function stripFrameBlockers(headers) {
  const out = new Headers(headers);
  out.delete("X-Frame-Options");
  out.delete("x-frame-options");
  // Drop CSP frame-ancestors / frame-src that would re-block embedding
  const csp = out.get("Content-Security-Policy") || out.get("content-security-policy");
  if (csp) {
    const cleaned = csp
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && !/^frame-ancestors\b/i.test(d) && !/^frame-src\b/i.test(d))
      .join("; ");
    if (cleaned) {
      out.set("Content-Security-Policy", cleaned);
    } else {
      out.delete("Content-Security-Policy");
      out.delete("content-security-policy");
    }
  }
  return out;
}

/**
 * Proxy a WebSocket upgrade to Railway. Cloudflare Workers can forward upgrades
 * when the request Upgrade header is present; do not re-wrap 101 responses.
 */
async function proxyDangerUpgrade(request) {
  const url = new URL(request.url);
  const upstream = new URL(GAMEOPEN_API_ORIGIN);
  upstream.pathname = "/api/danger";
  upstream.search = url.search;

  // Preserve Upgrade / Connection / Sec-WebSocket-* headers as-is.
  return fetch(new Request(upstream.toString(), request));
}

export default {
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.port = "";

    // Danger Room multiplayer: upgrade straight to Railway (not Vercel).
    const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
    if (isDangerWsPath(url.pathname) && upgrade === "websocket") {
      return proxyDangerUpgrade(request);
    }

    // Optional: HTTP health for the danger path → Railway (diagnostics).
    if (isDangerWsPath(url.pathname) && request.method === "GET") {
      return fetch(`${GAMEOPEN_API_ORIGIN}/api/healthz`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    }

    const arcade = isGrudoxArcadePath(url.pathname);
    url.hostname = arcade ? GRUDOX_HOST : GAMEOPEN_HOST;

    const upstream = await fetch(new Request(url.toString(), request));

    if (!arcade) return upstream;

    // Re-wrap so Open can iframe /arcade/* on the same origin.
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: stripFrameBlockers(upstream.headers),
    });
  },
};

/**
 * open.grudge-studio.com edge proxy
 *
 * Route ownership:
 *  - /arcade/*  → grudox.grudge-studio.com  (Voxel Arcade: racer, zombie, z-brawl…)
 *  - everything else → gameopen.vercel.app (Open hub / Danger / brawl / zones)
 *
 * Arcade responses strip X-Frame-Options so Open can embed Voxel Arcade
 * in-app (same browser origin open.grudge-studio.com/arcade/…).
 *
 * Deploy:  cd infra/cloudflare/open && npx wrangler deploy
 */
const GAMEOPEN_HOST = "gameopen.vercel.app";
const GRUDOX_HOST = "grudox.grudge-studio.com";

function isGrudoxArcadePath(pathname) {
  const p = pathname || "/";
  return p === "/arcade" || p.startsWith("/arcade/");
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

export default {
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.port = "";

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

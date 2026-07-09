import { Router, type Request, type Response } from "express";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

/**
 * Thin fleet proxy for ObjectStore + auth session exchange.
 * Keeps browser same-origin and avoids CORS preflight noise.
 */
const router = Router();

async function proxyTo(
  base: string,
  pathPrefix: string,
  req: Request,
  res: Response,
) {
  const rest = req.path.replace(new RegExp(`^${pathPrefix}`), "") || "";
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = `${base.replace(/\/$/, "")}${rest}${qs}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  for (const h of ["authorization", "cookie", "content-type", "x-grudge-id"]) {
    const v = req.header(h);
    if (v) headers[h === "authorization" ? "Authorization" : h] = v;
  }

  try {
    const init: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(12_000),
    };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
      init.body = JSON.stringify(req.body);
    }
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(text);
  } catch (err) {
    logger.error({ err, target }, "fleet proxy failed");
    res.status(502).json({ error: "fleet_upstream_unavailable", target });
  }
}

router.all("/objectstore/*path", (req, res) =>
  proxyTo(config.objectStoreUrl.replace(/\/api\/v1$/, ""), "/objectstore", req, res),
);

router.get("/fleet/config", (_req, res) => {
  res.json({
    game: "gameopen",
    title: "Grudge Open",
    services: {
      auth: config.grudgeIdUrl,
      gameData: config.grudgeBuilderApi,
      assets: config.assetsCdn,
      objectStore: config.objectStoreUrl,
      gameopenPrefix: config.gameopenAssetPrefix,
    },
    races: [
      "human",
      "orc",
      "undead",
      "barbarian",
      "dwarf",
      "high_elf",
    ].map((id) => ({
      id,
      glb: `models/races/${id}.glb`,
      cdn: `${config.assetsCdn}/${config.gameopenAssetPrefix}/models/races/${id}.glb`,
    })),
  });
});

export default router;

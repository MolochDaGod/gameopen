import { Router, type Request, type Response } from "express";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

/**
 * Proxy character CRUD to GrudgeBuilder Railway (fleet SSOT).
 * Same-origin /api/characters/* from the Vercel SPA.
 */
const router = Router();

async function proxy(req: Request, res: Response) {
  const suffix = req.path === "/" ? "" : req.path;
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = `${config.grudgeBuilderApi}/api/characters${suffix}${qs}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const auth = req.header("authorization");
  if (auth) headers.Authorization = auth;
  const cookie = req.header("cookie");
  if (cookie) headers.Cookie = cookie;
  const contentType = req.header("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  const grudgeId = req.header("x-grudge-id");
  if (grudgeId) headers["x-grudge-id"] = grudgeId;

  try {
    const init: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(15_000),
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
    logger.error({ err, target }, "characters proxy failed");
    res.status(502).json({
      error: "characters_upstream_unavailable",
      message: "Grudge character API is unreachable",
      target: config.grudgeBuilderApi,
    });
  }
}

router.all("/", proxy);
router.all("/*", proxy);

export default router;

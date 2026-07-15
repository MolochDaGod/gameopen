import { Router, type IRouter, type Request, type Response } from "express";

/**
 * Proxy / seed for the Voxel Realms block catalog (Codex).
 *
 * Live SSOT: https://mine-loader.vercel.app/api/blocks
 * UI:        https://mine-loader.vercel.app/#/defs
 *
 * Clients should call same-origin `/api/blocks` so CORS never blocks the catalog
 * for open.grudge-studio.com, GRUDOX, and local dev.
 */

const UPSTREAM =
  process.env.VOXEL_BLOCKS_URL || "https://mine-loader.vercel.app/api/blocks";

const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; body: string } | null = null;

const router: IRouter = Router();

router.get("/blocks", async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_MS) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("X-Voxel-Catalog", "cache");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.status(200).send(cached.body);
    }

    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      return res.status(502).json({
        error: "upstream_blocks_failed",
        status: upstream.status,
        upstream: UPSTREAM,
      });
    }
    const body = await upstream.text();
    cached = { at: now, body };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Voxel-Catalog", "live");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).send(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({
      error: "upstream_blocks_error",
      message,
      upstream: UPSTREAM,
    });
  }
});

export default router;

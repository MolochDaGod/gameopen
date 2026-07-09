import { Router } from "express";
import { config } from "../lib/config.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Serve catalog of gameopen assets for tools / ObjectStore bridging. */
router.get("/assets/catalog", (_req, res) => {
  const candidates = [
    join(__dirname, "../../../client/public/asset-manifest.json"),
    join(process.cwd(), "client/public/asset-manifest.json"),
    join(process.cwd(), "asset-manifest.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, "utf8"));
      res.setHeader("Cache-Control", "public, max-age=120");
      res.json({
        ...data,
        cdnBase: `${config.assetsCdn}/${config.gameopenAssetPrefix}`,
      });
      return;
    }
  }
  res.json({
    version: 1,
    count: 0,
    assets: [],
    cdnBase: `${config.assetsCdn}/${config.gameopenAssetPrefix}`,
    note: "Run pnpm assets:manifest after copying public assets",
  });
});

/** Redirect heavy binaries to R2 when available. */
router.get("/assets/cdn/*path", (req, res) => {
  const rel = String(req.params.path || req.params[0] || "").replace(/^\//, "");
  const url = `${config.assetsCdn}/${config.gameopenAssetPrefix}/${rel}`;
  res.redirect(302, url);
});

export default router;

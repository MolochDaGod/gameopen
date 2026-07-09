/**
 * Weapon / skill / item content catalog — SSOT under repo `content/`.
 */
import { Router } from "express";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(__dirname, "../../../content");

function loadCollection(name: string): unknown[] {
  const dir = join(contentRoot, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

function loadOne(name: string, id: string): unknown | null {
  const file = join(contentRoot, name, `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

const router = Router();

router.get("/content", (_req, res) => {
  res.json({
    service: "gameopen-content",
    endpoints: {
      weapons: "/api/content/weapons",
      skills: "/api/content/skills",
      items: "/api/content/items",
      armor: "/api/content/armor",
      readiness: "/api/content/readiness",
    },
  });
});

router.get("/content/weapons", (_req, res) => {
  const weapons = loadCollection("weapons");
  res.json({ count: weapons.length, weapons });
});

router.get("/content/weapons/:id", (req, res) => {
  const row = loadOne("weapons", req.params.id);
  if (!row) return res.status(404).json({ error: "weapon not found" });
  res.json(row);
});

router.get("/content/skills", (_req, res) => {
  const skills = loadCollection("skills");
  res.json({ count: skills.length, skills });
});

router.get("/content/skills/:id", (req, res) => {
  const row = loadOne("skills", req.params.id);
  if (!row) return res.status(404).json({ error: "skill not found" });
  res.json(row);
});

router.get("/content/items", (_req, res) => {
  const items = loadCollection("items");
  res.json({ count: items.length, items });
});

router.get("/content/armor", (_req, res) => {
  const armor = loadCollection("armor");
  res.json({ count: armor.length, armor });
});

router.get("/content/readiness", (_req, res) => {
  const file = join(contentRoot, "manifests", "readiness.json");
  if (!existsSync(file)) {
    return res.json({ version: 0, note: "run pnpm content:index", weapons: [], skills: [] });
  }
  res.json(JSON.parse(readFileSync(file, "utf8")));
});

router.get("/content/scenes", (_req, res) => {
  const file = join(contentRoot, "scenes", "index.json");
  if (!existsSync(file)) {
    return res.json({ version: 0, note: "run pnpm scenes:build", scenes: [] });
  }
  res.json(JSON.parse(readFileSync(file, "utf8")));
});

router.get("/content/scenes/:key", (req, res) => {
  const key = req.params.key.replace(/\.gfscene\.json$/, "");
  const file = join(contentRoot, "scenes", `${key}.gfscene.json`);
  if (!existsSync(file)) {
    return res.status(404).json({ error: "scene not found", key });
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(JSON.parse(readFileSync(file, "utf8")));
});

export default router;

/**
 * Shared helpers for gameopen content/ catalog (weapons, skills, items, armor).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "..");
export const CONTENT_ROOT = join(REPO_ROOT, "content");

export function contentPath(...parts) {
  return join(CONTENT_ROOT, ...parts);
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f))
    .sort();
}

export function loadCollection(name) {
  const dir = contentPath(name);
  return listJsonFiles(dir).map((p) => ({
    path: p,
    data: readJson(p),
  }));
}

/** Repo-relative path under client public or lib/assets (authoring paths). */
export function assetExists(relPath) {
  if (!relPath) return false;
  const clean = relPath.replace(/^\/+/, "");
  const candidates = [
    join(REPO_ROOT, "client", "public", clean),
    join(REPO_ROOT, "lib", "assets", clean),
    join(REPO_ROOT, "lib", "assets", "models", clean.replace(/^models\//, "")),
    join(REPO_ROOT, clean),
  ];
  return candidates.some((p) => existsSync(p));
}

const STATUS_OK = new Set(["ready", "placeholder"]);

export function layerScore(status) {
  if (status === "ready") return 1;
  if (status === "placeholder") return 0.5;
  return 0;
}

export function weaponReadinessPct(w) {
  const r = w.readiness || {};
  const keys = ["data", "mesh", "combat", "present"];
  const sum = keys.reduce((s, k) => s + layerScore(r[k]), 0);
  return Math.round((sum / keys.length) * 100);
}

export function skillReadinessPct(sk) {
  const r = sk.readiness || {};
  const keys = ["data", "anim", "vfx", "icon"];
  const sum = keys.reduce((s, k) => s + layerScore(r[k]), 0);
  return Math.round((sum / keys.length) * 100);
}

export function evaluateWeapon(entry, skillsById) {
  const w = entry.data;
  const issues = [];
  const r = { ...(w.readiness || {}) };

  if (!w.id?.startsWith("wpn_")) issues.push("id must start with wpn_");
  if (!w.itemId) issues.push("missing itemId");
  if (!w.family) issues.push("missing family");
  if (!Array.isArray(w.skills) || w.skills.length === 0) issues.push("no skills[]");

  // Live mesh check
  const meshPath = w.mesh?.path;
  if (meshPath && assetExists(meshPath)) {
    if (r.mesh === "missing") r.mesh = "ready";
  } else if (meshPath && r.mesh === "ready") {
    issues.push(`mesh marked ready but file missing: ${meshPath}`);
  }

  // Skills linked
  for (const sid of w.skills || []) {
    if (!skillsById.has(sid)) issues.push(`missing skill file: ${sid}`);
  }

  const pct = weaponReadinessPct({ ...w, readiness: r });
  const shipBlocked =
    w.ship === true &&
    ["data", "mesh", "combat", "present"].some((k) => !STATUS_OK.has(r[k]));

  return {
    id: w.id,
    family: w.family,
    ship: Boolean(w.ship),
    readiness: r,
    pct,
    issues,
    shipBlocked,
    skills: w.skills || [],
  };
}

export function evaluateSkill(entry) {
  const sk = entry.data;
  const issues = [];
  const r = { ...(sk.readiness || {}) };

  if (!sk.id) issues.push("missing id");
  if (!sk.animKey) issues.push("missing animKey");
  if (!sk.vfx) issues.push("missing vfx");
  if (!sk.hitWindows?.length) issues.push("no hitWindows");

  const animPath = sk.anim?.path;
  if (animPath && assetExists(animPath)) {
    if (r.anim === "missing") r.anim = "ready";
  } else if (animPath && sk.anim?.status === "ready" && !assetExists(animPath)) {
    issues.push(`anim marked ready but file missing: ${animPath}`);
    r.anim = "missing";
  }

  const pct = skillReadinessPct({ ...sk, readiness: r });
  return { id: sk.id, family: sk.weaponFamily, readiness: r, pct, issues };
}

export function loadCatalog() {
  const weapons = loadCollection("weapons");
  const skills = loadCollection("skills");
  const items = loadCollection("items");
  const armor = loadCollection("armor");
  const skillsById = new Map(skills.map((s) => [s.data.id, s]));
  return { weapons, skills, items, armor, skillsById };
}

export function rebuildManifests() {
  const cat = loadCatalog();
  const weaponsIndex = cat.weapons.map((w) => ({
    id: w.data.id,
    itemId: w.data.itemId,
    family: w.data.family,
    skills: w.data.skills,
    ship: Boolean(w.data.ship),
  }));
  const skillsIndex = cat.skills.map((s) => ({
    id: s.data.id,
    weaponFamily: s.data.weaponFamily,
    hotbarSlot: s.data.hotbarSlot,
    animKey: s.data.animKey,
  }));

  const weaponReports = cat.weapons.map((w) =>
    evaluateWeapon(w, cat.skillsById),
  );
  const skillReports = cat.skills.map(evaluateSkill);

  const readiness = {
    version: 1,
    generatedAt: new Date().toISOString(),
    weapons: weaponReports,
    skills: skillReports,
    summary: {
      weapons: weaponsIndex.length,
      skills: skillsIndex.length,
      items: cat.items.length,
      armor: cat.armor.length,
      shipBlocked: weaponReports.filter((r) => r.shipBlocked).length,
      avgWeaponPct:
        weaponReports.length === 0
          ? 0
          : Math.round(
              weaponReports.reduce((s, r) => s + r.pct, 0) / weaponReports.length,
            ),
    },
  };

  writeJson(contentPath("manifests", "weapons.index.json"), {
    version: 1,
    count: weaponsIndex.length,
    weapons: weaponsIndex,
  });
  writeJson(contentPath("manifests", "skills.index.json"), {
    version: 1,
    count: skillsIndex.length,
    skills: skillsIndex,
  });
  writeJson(contentPath("manifests", "items.index.json"), {
    version: 1,
    count: cat.items.length,
    items: cat.items.map((i) => ({
      id: i.data.id,
      kind: i.data.kind,
      name: i.data.name,
    })),
  });
  writeJson(contentPath("manifests", "readiness.json"), readiness);
  return readiness;
}

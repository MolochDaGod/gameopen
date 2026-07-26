/**
 * Animation integrity + weapon-live-pack verification.
 *
 * Best practices:
 *  - SHA-256 of every shipped baked JSON (content-addressable readiness)
 *  - Optional SHA of Mixamo FBX author sources (when present on disk)
 *  - Per-weapon map: which bake rels are LIVE when that weapon is equipped
 *  - Reject HTML fake-200 and banned loco paths
 *
 * Usage:
 *   node scripts/verify-anim-integrity.mjs
 *   node scripts/verify-anim-integrity.mjs --write
 *   node scripts/verify-anim-integrity.mjs --strict
 *   node scripts/verify-anim-integrity.mjs --base https://open.grudge-studio.com
 *   node scripts/verify-anim-integrity.mjs --weapon greatsword
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const STRICT = args.includes("--strict");
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : null;
const weaponIdx = args.indexOf("--weapon");
const WEAPON_FILTER = weaponIdx >= 0 ? String(args[weaponIdx + 1] || "").toLowerCase() : null;

const BAKED_DIR = path.join(root, "artifacts/animator/public/anims/baked");
const MIXAMO_DIR = path.join(root, "artifacts/animator/public/anim");
const WEAPON_MAP = path.join(root, "content/anims/weapon-live-packs.json");
const OUT_INTEGRITY = path.join(root, "content/manifests/anims.integrity.json");
const OUT_WEAPON_LIVE = path.join(root, "content/manifests/weapon-live-anims.json");

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function walkFiles(dir, extFilter) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (!extFilter || extFilter.test(ent.name)) out.push(p);
    }
  }
  return out;
}

function resolveWeaponEntry(map, weaponId) {
  const w = map.weapons[weaponId];
  if (!w) return null;
  if (w.inheritsFrom && map.weapons[w.inheritsFrom]) {
    const parent = resolveWeaponEntry(map, w.inheritsFrom);
    return {
      ...parent,
      ...w,
      liveRoles: { ...(parent?.liveRoles || {}), ...(w.liveRoles || {}) },
      liveWhenIncomplete: w.liveWhenIncomplete || parent?.liveWhenIncomplete,
      mixamoSources: w.mixamoSources || parent?.mixamoSources || [],
      skillSlots: w.skillSlots || parent?.skillSlots || [],
      animPack: w.animPack || parent?.animPack,
      fallbackPack: w.fallbackPack !== undefined ? w.fallbackPack : parent?.fallbackPack,
      label: w.label || parent?.label,
    };
  }
  return w;
}

function lookupBaked(bakedIndex, rel) {
  if (!rel) return null;
  const key = String(rel).replace(/\\/g, "/");
  return bakedIndex.get(key) || bakedIndex.get(key + ".json") || null;
}

/**
 * Resolve which bake rel is LIVE for each role when this weapon is equipped.
 * Priority:
 *   1. liveRoles[role] if baked
 *   2. liveWhenIncomplete[role] if baked
 *   3. Convention: {fallbackPack}/{role} if baked (best-practice safety net)
 *   4. Shared loco aliases for walk/run (magic walk, torch run) if role is loco
 */
function roleRelsForWeapon(entry, bakedIndex) {
  const required = ["idle", "walk", "run", "attack"];
  const roles = { ...(entry.liveRoles || {}) };
  const incomplete = entry.liveWhenIncomplete || {};
  const live = {};
  const missing = [];

  // Shared last-resort loco that is always present in current bake set
  const LOCO_ALIASES = {
    walk: ["magic/Standing Walk Forward", "polearm/walk"],
    run: [
      "uploads_2026_06/locomotion/torch run forward",
      "sword_shield/sword and shield run",
      "polearm/run",
      "magic/Standing Run Forward",
    ],
    idle: ["polearm/idle", "unarmed/fight_idle"],
    attack: ["polearm/attack"],
  };

  for (const role of Object.keys(roles)) {
    const rel = roles[role];
    const primary = lookupBaked(bakedIndex, rel);
    if (primary) {
      live[role] = { bakeRel: rel.replace(/\\/g, "/"), status: "ready", sha256: primary.sha256 };
      continue;
    }
    // Explicit incomplete map
    if (incomplete[role] && typeof incomplete[role] === "string") {
      const fb = incomplete[role];
      const fbEntry = lookupBaked(bakedIndex, fb);
      if (fbEntry) {
        live[role] = {
          bakeRel: fb.replace(/\\/g, "/"),
          status: "fallback",
          fromPack: entry.fallbackPack || "fallback",
          sha256: fbEntry.sha256,
        };
        continue;
      }
    }
    // Convention: fallbackPack/role
    if (entry.fallbackPack) {
      const conv = `${entry.fallbackPack}/${role}`;
      const convEntry = lookupBaked(bakedIndex, conv);
      if (convEntry) {
        live[role] = {
          bakeRel: conv,
          status: "fallback",
          fromPack: entry.fallbackPack,
          via: "fallbackPack-convention",
          sha256: convEntry.sha256,
        };
        continue;
      }
    }
    // Last-resort aliases for required loco/attack
    let resolved = false;
    for (const alias of LOCO_ALIASES[role] || []) {
      const a = lookupBaked(bakedIndex, alias);
      if (a) {
        live[role] = {
          bakeRel: alias,
          status: "fallback",
          via: "shared-alias",
          sha256: a.sha256,
        };
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      missing.push({
        role,
        bakeRel: String(rel).replace(/\\/g, "/"),
        fallback: incomplete[role] || null,
      });
    }
  }

  // Ensure required roles exist even if not listed in liveRoles
  for (const role of required) {
    if (live[role]) continue;
    if (incomplete[role] && typeof incomplete[role] === "string") {
      const fbEntry = lookupBaked(bakedIndex, incomplete[role]);
      if (fbEntry) {
        live[role] = {
          bakeRel: incomplete[role].replace(/\\/g, "/"),
          status: "fallback",
          sha256: fbEntry.sha256,
        };
        continue;
      }
    }
    if (entry.fallbackPack) {
      const conv = `${entry.fallbackPack}/${role}`;
      const convEntry = lookupBaked(bakedIndex, conv);
      if (convEntry) {
        live[role] = {
          bakeRel: conv,
          status: "fallback",
          via: "fallbackPack-convention",
          sha256: convEntry.sha256,
        };
        continue;
      }
    }
    for (const alias of LOCO_ALIASES[role] || []) {
      const a = lookupBaked(bakedIndex, alias);
      if (a) {
        live[role] = { bakeRel: alias, status: "fallback", via: "shared-alias", sha256: a.sha256 };
        break;
      }
    }
    if (!live[role] && !missing.some((m) => m.role === role)) {
      missing.push({ role, bakeRel: (roles[role] || `${entry.animPack}/${role}`) });
    }
  }

  // Drop missing entries that we subsequently filled
  const stillMissing = missing.filter((m) => !live[m.role]);
  return { live, missing: stillMissing };
}

async function remoteShaProbe(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(12000),
    });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return { ok: false, detail: "HTML" };
    // Full GET for small JSON integrity when local missing
    if (res.ok || res.status === 206) {
      const full = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!full.ok) return { ok: false, status: full.status };
      const buf = Buffer.from(await full.arrayBuffer());
      // Magic: JSON starts with { or [
      const head = buf.slice(0, 1).toString();
      if (head !== "{" && head !== "[") return { ok: false, detail: "not-json" };
      return { ok: true, sha256: sha256Buffer(buf), bytes: buf.length };
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

// ── 1. Hash all local baked JSON ────────────────────────────────────────────
console.log("\n=== Anim integrity (SHA-256) ===\n");

const bakedFiles = walkFiles(BAKED_DIR, /\.json$/i);
const bakedIndex = new Map(); // rel without .json → { path, sha256, bytes }
const bakedManifest = [];

for (const fp of bakedFiles) {
  const relFull = path.relative(BAKED_DIR, fp).replace(/\\/g, "/");
  if (relFull.endsWith("manifest.json")) continue;
  const sha = sha256File(fp);
  const st = fs.statSync(fp);
  const bakeRel = relFull.replace(/\.json$/i, "");
  const entry = {
    bakeRel,
    file: `anims/baked/${relFull}`,
    sha256: sha,
    bytes: st.size,
    mtimeMs: st.mtimeMs,
  };
  bakedIndex.set(bakeRel, entry);
  bakedIndex.set(relFull, entry);
  bakedManifest.push(entry);
}
bakedManifest.sort((a, b) => a.bakeRel.localeCompare(b.bakeRel));
console.log(`Baked JSON: ${bakedManifest.length} files under public/anims/baked`);

// ── 2. Hash Mixamo FBX when present (author sources) ────────────────────────
const mixamoFiles = walkFiles(MIXAMO_DIR, /\.(fbx|glb)$/i);
const mixamoManifest = [];
for (const fp of mixamoFiles) {
  const rel = path.relative(path.join(root, "artifacts/animator/public"), fp).replace(/\\/g, "/");
  const sha = sha256File(fp);
  const st = fs.statSync(fp);
  mixamoManifest.push({
    sourceRel: rel,
    sha256: sha,
    bytes: st.size,
    mtimeMs: st.mtimeMs,
  });
}
mixamoManifest.sort((a, b) => a.sourceRel.localeCompare(b.sourceRel));
console.log(`Mixamo/source: ${mixamoManifest.length} files under public/anim (0 expected on slim CI without assets)`);

// ── 3. Weapon → live pack matrix ────────────────────────────────────────────
if (!fs.existsSync(WEAPON_MAP)) {
  console.error("Missing", WEAPON_MAP);
  process.exit(1);
}
const weaponMap = JSON.parse(fs.readFileSync(WEAPON_MAP, "utf8"));
const banned = new Set([
  "locomotion/running",
  "uploads_2026_06/locomotion/running",
  "uploads/locomotion/Quick_Roll_To_Run",
]);

const weaponReport = {};
let weaponsOk = 0;
let weaponsDegraded = 0;
let weaponsFail = 0;

const weaponIds = Object.keys(weaponMap.weapons || {}).filter(
  (id) => !WEAPON_FILTER || id === WEAPON_FILTER,
);

for (const id of weaponIds) {
  const entry = resolveWeaponEntry(weaponMap, id);
  if (!entry) continue;
  const { live, missing } = roleRelsForWeapon(entry, bakedIndex);
  // Ban check
  for (const [role, info] of Object.entries(live)) {
    if (banned.has(info.bakeRel)) {
      missing.push({ role, bakeRel: info.bakeRel, banned: true });
      delete live[role];
    }
  }
  const required = weaponMap.roleContract?.required || ["idle", "walk", "run", "attack"];
  const hasRequired = required.every((r) => live[r]);
  const usingFallback = Object.values(live).some((v) => v.status === "fallback");
  let status = "ready";
  if (!hasRequired) status = "incomplete";
  else if (usingFallback) status = "degraded";

  if (status === "ready") weaponsOk++;
  else if (status === "degraded") weaponsDegraded++;
  else weaponsFail++;

  // Mixamo author-source integrity for this weapon's declared paths
  const mixamoForWeapon = [];
  for (const src of entry.mixamoSources || []) {
    const norm = String(src).replace(/\\/g, "/").replace(/^\//, "");
    const hit = mixamoManifest.find((m) => m.sourceRel === norm || m.sourceRel.endsWith("/" + norm));
    if (hit) {
      mixamoForWeapon.push({ sourceRel: hit.sourceRel, sha256: hit.sha256, bytes: hit.bytes, status: "present" });
    } else {
      mixamoForWeapon.push({ sourceRel: norm, sha256: null, status: "absent-local" });
    }
  }

  weaponReport[id] = {
    label: entry.label || id,
    animPack: entry.animPack,
    fallbackPack: entry.fallbackPack ?? null,
    status,
    liveRoles: live,
    missingRoles: missing,
    skillSlots: entry.skillSlots || [],
    mixamoSources: entry.mixamoSources || [],
    mixamoIntegrity: mixamoForWeapon,
  };

  const icon = status === "ready" ? "OK" : status === "degraded" ? "DEG" : "MISS";
  console.log(
    `[${icon}] weapon=${id.padEnd(14)} pack=${String(entry.animPack).padEnd(14)} ` +
      `live=${Object.keys(live).length} missing=${missing.length}`,
  );
  if (WEAPON_FILTER) {
    for (const [role, info] of Object.entries(live)) {
      console.log(`       ${role}: ${info.bakeRel} (${info.status}) sha=${(info.sha256 || "").slice(0, 12)}…`);
    }
    for (const m of missing) {
      console.log(`       MISSING ${m.role}: ${m.bakeRel}${m.fallback ? ` fb=${m.fallback}` : ""}`);
    }
  }
}

// Shared traversal
const trav = weaponMap.sharedTraversal?.roles || {};
const travLive = {};
for (const [role, rel] of Object.entries(trav)) {
  const e = bakedIndex.get(rel);
  travLive[role] = e
    ? { bakeRel: rel, status: "ready", sha256: e.sha256 }
    : { bakeRel: rel, status: "missing" };
}
console.log(
  `\nTraversal: ${Object.values(travLive).filter((v) => v.status === "ready").length}/${Object.keys(travLive).length} ready`,
);

// Optional remote probe
if (BASE) {
  console.log(`\nRemote probe base=${BASE}`);
  const sample = bakedManifest.slice(0, 5);
  for (const b of sample) {
    const url = `${BASE.replace(/\/$/, "")}/${b.file}`;
    const r = await remoteShaProbe(url);
    const match = r.ok && r.sha256 === b.sha256;
    console.log(
      `  [${match ? "MATCH" : r.ok ? "DRIFT" : "MISS"}] ${b.bakeRel} local=${b.sha256.slice(0, 10)} remote=${(r.sha256 || "").slice(0, 10) || r.detail || r.status}`,
    );
  }
}

// ── Write manifests ─────────────────────────────────────────────────────────
// Mixamo sources referenced by any weapon (content-addressable gate for bake inputs)
const declaredMixamo = new Map();
for (const id of Object.keys(weaponMap.weapons || {})) {
  const entry = resolveWeaponEntry(weaponMap, id);
  for (const src of entry?.mixamoSources || []) {
    const norm = String(src).replace(/\\/g, "/");
    if (!declaredMixamo.has(norm)) declaredMixamo.set(norm, []);
    declaredMixamo.get(norm).push(id);
  }
}
const declaredMixamoReport = [];
let mixamoPresent = 0;
let mixamoAbsent = 0;
for (const [src, usedBy] of [...declaredMixamo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const hit = mixamoManifest.find((m) => m.sourceRel === src || m.sourceRel.endsWith("/" + src));
  if (hit) {
    mixamoPresent++;
    declaredMixamoReport.push({ sourceRel: hit.sourceRel, sha256: hit.sha256, bytes: hit.bytes, status: "present", usedBy });
  } else {
    mixamoAbsent++;
    declaredMixamoReport.push({ sourceRel: src, sha256: null, status: "absent-local", usedBy });
  }
}
console.log(
  `\nDeclared Mixamo skills: ${declaredMixamo.size} paths · ${mixamoPresent} present (SHA) · ${mixamoAbsent} absent-local`,
);

const integrityDoc = {
  version: 1,
  generatedAt: new Date().toISOString(),
  algorithm: "sha256",
  bakedRoot: "artifacts/animator/public/anims/baked",
  mixamoRoot: "artifacts/animator/public/anim",
  baked: bakedManifest,
  mixamoSources: mixamoManifest,
  mixamoDeclaredByWeapons: declaredMixamoReport,
  bannedBakeRels: [...banned],
  summary: {
    bakedCount: bakedManifest.length,
    mixamoCount: mixamoManifest.length,
    mixamoDeclared: declaredMixamo.size,
    mixamoDeclaredPresent: mixamoPresent,
    mixamoDeclaredAbsent: mixamoAbsent,
    weaponsReady: weaponsOk,
    weaponsDegraded: weaponsDegraded,
    weaponsIncomplete: weaponsFail,
  },
};

const weaponLiveDoc = {
  version: 1,
  generatedAt: new Date().toISOString(),
  policy: weaponMap.policy,
  sharedTraversal: { ...weaponMap.sharedTraversal, live: travLive },
  roleContract: weaponMap.roleContract,
  weapons: weaponReport,
  summary: integrityDoc.summary,
};

if (WRITE) {
  fs.mkdirSync(path.dirname(OUT_INTEGRITY), { recursive: true });
  fs.writeFileSync(OUT_INTEGRITY, JSON.stringify(integrityDoc, null, 2) + "\n");
  fs.writeFileSync(OUT_WEAPON_LIVE, JSON.stringify(weaponLiveDoc, null, 2) + "\n");
  console.log(`\nWrote ${path.relative(root, OUT_INTEGRITY)}`);
  console.log(`Wrote ${path.relative(root, OUT_WEAPON_LIVE)}`);
}

console.log(
  `\nWeapons: ${weaponsOk} ready · ${weaponsDegraded} degraded (fallback live) · ${weaponsFail} incomplete`,
);
console.log(`Baked files hashed: ${bakedManifest.length}\n`);

if (STRICT && weaponsFail > 0) process.exit(1);
process.exit(0);

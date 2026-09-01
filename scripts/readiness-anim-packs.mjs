/**
 * Probe REAL grudge6 ANIM_PACK_CLIPS paths (not invent idle.json names).
 * Also probes Explorer Mixamo skeleton source + Layer-A base pack.
 *
 * Exit 1 if --strict and any primary (idle/walk/run/attack) for a critical pack is dead.
 *
 *   node scripts/readiness-anim-packs.mjs
 *   node scripts/readiness-anim-packs.mjs --base https://open.grudge-studio.com --strict
 *   node scripts/readiness-anim-packs.mjs --cdn-only
 */
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || "https://open.grudge-studio.com";
const STRICT = args.includes("--strict");
const CDN_ONLY = args.includes("--cdn-only");
const CDN = "https://assets.grudge-studio.com";
const ARENA = "https://grudge-arena.grudge-studio.com";

/**
 * Mirrors ANIM_PACK_CLIPS primaries in anims.ts (must stay in sync).
 * Paths are relative to anims/baked/ without .json.
 */
const PACK_PRIMARIES = {
  unarmed: {
    idle: "unarmed/fight_idle",
    walk: "magic/Standing Walk Forward",
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "unarmed/punching",
  },
  magic: {
    idle: "magic/standing idle",
    walk: "magic/Standing Walk Forward",
    run: "magic/Standing Run Forward",
    attack: "magic/standing 1h cast spell 01",
  },
  sword_shield: {
    idle: "sword_shield/sword and shield idle",
    walk: "magic/Standing Walk Forward",
    run: "sword_shield/sword and shield run",
    attack: "sword_shield/sword and shield attack",
  },
  longbow: {
    idle: "longbow/standing idle 01",
    walk: "longbow/standing walk forward",
    run: "longbow/standing run forward",
    attack: "longbow/standing aim recoil",
  },
  polearm: {
    idle: "polearm/idle",
    walk: "magic/Standing Walk Forward",
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "polearm/attack",
  },
  twohand_hammer: {
    idle: "twohand_hammer/idle",
    walk: "twohand_hammer/walk",
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "twohand_hammer/attack",
  },
  dual_wield: {
    idle: "dual_wield/idle",
    walk: "magic/Standing Walk Forward",
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "dual_wield/attack",
  },
  crossbow: {
    idle: "longbow/standing idle 01",
    walk: "longbow/standing walk forward",
    run: "longbow/standing run forward",
    attack: "longbow/standing aim recoil",
  },
  rifle: {
    idle: "rifle/rifle-aiming-idle",
    walk: "rifle/walking",
    run: "rifle/rifle-run",
    attack: "rifle/firing-rifle",
  },
  samurai: {
    idle: "greatsword_samurai/gs_samurai_idle",
    walk: "greatsword_samurai/gs_samurai_walk",
    run: "greatsword_samurai/gs_samurai_run",
    attack: "greatsword_samurai/gs_samurai_combo_a",
  },
};

const EXPLORER_PATHS = [
  "anim/animations/bow/unarmed-idle-01.fbx",
  "anim/base/animated-base-character.glb",
  "anim/sword/sword-and-shield-idle.fbx",
];

async function headOk(url) {
  try {
    let res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-64" },
        signal: AbortSignal.timeout(15000),
      });
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return { ok: false, status: res.status, detail: "HTML not asset" };
    return {
      ok: res.status === 200 || res.status === 206,
      status: res.status,
      detail: ct || "ok",
    };
  } catch (e) {
    return { ok: false, status: 0, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function probeClip(rel) {
  const path = `anims/baked/${rel}.json`;
  const hosts = CDN_ONLY
    ? [CDN]
    : [BASE.replace(/\/$/, ""), CDN, ARENA];
  const results = [];
  for (const h of hosts) {
    const url = `${h}/${path}`;
    const r = await headOk(url);
    results.push({ host: h.replace(/^https?:\/\//, ""), ...r });
    if (r.ok) return { ok: true, results, winner: h };
  }
  return { ok: false, results };
}

console.log(`\n=== Anim pack readiness (real ANIM_PACK_CLIPS paths) · base=${BASE} ===\n`);

let packMiss = 0;
let roleMiss = 0;
const packSummary = [];

for (const [pack, roles] of Object.entries(PACK_PRIMARIES)) {
  let deadRoles = [];
  for (const [role, rel] of Object.entries(roles)) {
    const p = await probeClip(rel);
    if (!p.ok) {
      roleMiss++;
      deadRoles.push(role);
      const det = p.results.map((r) => `${r.host}=${r.status}`).join(" · ");
      console.log(`[MISS] ${pack}.${role}  ${rel}.json\n       ${det}`);
    } else {
      console.log(`[OK]   ${pack}.${role}  via ${p.winner?.replace(/^https?:\/\//, "")}`);
    }
  }
  if (deadRoles.length) {
    packMiss++;
    packSummary.push({ pack, deadRoles, status: "DEGRADED" });
  } else {
    packSummary.push({ pack, deadRoles: [], status: "OK" });
  }
}

console.log(`\n=== Explorer Mixamo / Layer-A ===\n`);
let explorerMiss = 0;
for (const rel of EXPLORER_PATHS) {
  const url = `${BASE.replace(/\/$/, "")}/${rel}`;
  const r = await headOk(url);
  if (!r.ok) {
    explorerMiss++;
    console.log(`[MISS] ${rel}  status=${r.status} ${r.detail}`);
  } else {
    console.log(`[OK]   ${rel}`);
  }
}

console.log(`\n=== Summary ===`);
console.log(
  `Packs fully OK: ${packSummary.filter((p) => p.status === "OK").length}/${packSummary.length}`,
);
console.log(`Dead primary roles: ${roleMiss}`);
console.log(`Explorer misses: ${explorerMiss}`);
for (const p of packSummary.filter((x) => x.status !== "OK")) {
  console.log(`  DEGRADED ${p.pack}: missing ${p.deadRoles.join(",")}`);
}

// Critical packs that must never ship broken for knights / default heroes
const CRITICAL = ["sword_shield", "magic", "unarmed", "longbow", "polearm"];
const criticalDead = packSummary.filter(
  (p) => CRITICAL.includes(p.pack) && p.deadRoles.some((r) => ["idle", "run", "attack"].includes(r)),
);

console.log(
  `\nCritical primary (idle/run/attack) dead packs: ${criticalDead.map((p) => p.pack).join(", ") || "none"}`,
);

if (STRICT && (criticalDead.length > 0 || explorerMiss > 0)) {
  console.error("\nSTRICT fail — fix CDN/arena or pack paths before deploy.\n");
  process.exit(1);
}
process.exit(0);

/**
 * Open production deploy gate — refuse ship if fleet SSOTs are dead.
 * Does not invent hosts; only probes existing SSOT URLs.
 *
 *   npm run deploy:gate
 *   npm run deploy:prod  (includes gate + inventory tests + smoke)
 *
 * Layers:
 *   1. SPA + R2 combat assets (Danger Room)
 *   2. Player API (Postgres) — health, uuid, ledger rewrites
 *   3. Definitions (info) + optional fleet shells
 */
const CHECKS = [
  // —— SPA ——
  {
    name: "Open SPA",
    url: "https://open.grudge-studio.com/",
    rejectHtml: false,
  },
  // —— R2 combat / grudge6 ——
  {
    name: "R2 grudge6 WK kit",
    url: "https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.glb",
    rejectHtml: true,
  },
  {
    name: "R2 race atlas",
    url: "https://assets.grudge-studio.com/textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
    rejectHtml: true,
  },
  {
    name: "Open baked CANONICAL run",
    url: "https://open.grudge-studio.com/anims/baked/locomotion/run_forward.json",
    optional: false,
    rejectHtml: true,
  },
  {
    name: "Open baked samurai 1H run (DRC sword primary)",
    url: "https://open.grudge-studio.com/anims/baked/greatsword_samurai/gs_samurai_run_sword.json",
    rejectHtml: true,
  },
  {
    name: "Pirate lobby mesh (opening+tutorial)",
    url: "https://assets.grudge-studio.com/models/lobby/pirate-islands/scene.glb",
    rejectHtml: true,
  },
  // —— Player API (Railway Postgres via Open rewrites) ——
  // Characters / bag / ledger / uuid live here — NEVER D1.
  {
    name: "grudge-api health (via Open rewrite)",
    url: "https://open.grudge-studio.com/api/health",
    expectJson: true,
    rejectHtml: true,
  },
  {
    name: "UUID system test (via Open rewrite)",
    url: "https://open.grudge-studio.com/api/uuid/test",
    expectJson: true,
    rejectHtml: true,
  },
  {
    name: "Ledger search (via Open rewrite)",
    url: "https://open.grudge-studio.com/api/ledger/search",
    expectJson: true,
    rejectHtml: true,
  },
  {
    name: "Characters era filter unauth (401/403 OK)",
    url: "https://open.grudge-studio.com/api/characters?era=warlords",
    allowStatuses: [401, 403, 200],
    rejectHtml: true,
  },
  // —— Asset INDEX (D1 via asset-registry rewrite) ——
  // Binaries stay on R2; this must return JSON index rows, not SPA HTML.
  {
    name: "D1 asset-registry (Open rewrite → api.grudge-studio.com/assets)",
    url: "https://open.grudge-studio.com/api/asset-registry?limit=3",
    expectJson: true,
    rejectHtml: true,
  },
  {
    name: "D1 assets edge (api.grudge-studio.com)",
    url: "https://api.grudge-studio.com/assets?limit=1",
    expectJson: true,
    rejectHtml: true,
    optional: true,
  },
  // —— Definitions (ObjectStore / info) ——
  {
    name: "info master-weaponSkills",
    url: "https://info.grudge-studio.com/api/v1/master-weaponSkills.json",
    rejectHtml: true,
    optional: true,
  },
  {
    name: "ui.grudge-studio.com",
    url: "https://ui.grudge-studio.com/",
    rejectHtml: false,
  },
  // —— Fleet shells ——
  {
    name: "Warlords client",
    url: "https://client.grudge-studio.com/home",
    rejectHtml: false,
  },
  {
    name: "Multiverse SPA",
    url: "https://grudge-multiverse.vercel.app/",
    rejectHtml: false,
    optional: true,
  },
  {
    name: "Grudge Arena SPA",
    url: "https://grudge-arena.grudge-studio.com/",
    rejectHtml: false,
    optional: true,
  },
  {
    name: "Hero Command RTS",
    url: "https://play.grudge-studio.com/",
    rejectHtml: false,
    optional: true,
  },
  {
    name: "Mine-Loader edge",
    url: "https://mine.grudge-studio.com/",
    rejectHtml: false,
    optional: true,
  },
];

async function probe(c) {
  try {
    const method = c.expectJson || c.allowStatuses ? "GET" : "HEAD";
    const res = await fetch(c.url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let bodyStart = "";
    if (method === "GET") {
      const text = await res.text();
      bodyStart = text.slice(0, 160);
    }

    if (c.allowStatuses?.length) {
      const okStatus = c.allowStatuses.includes(res.status);
      if (!okStatus) {
        return { ...c, ok: false, status: res.status, ct, err: "unexpected status" };
      }
      if (c.rejectHtml && (ct.includes("text/html") || bodyStart.includes("<!DOCTYPE"))) {
        return { ...c, ok: false, status: res.status, ct, err: "html masquerade" };
      }
      return { ...c, ok: true, status: res.status, ct };
    }

    if (!res.ok) return { ...c, ok: false, status: res.status, ct, err: "not ok" };
    if (c.rejectHtml && ct.includes("text/html")) {
      return { ...c, ok: false, status: res.status, ct, err: "html masquerade" };
    }
    if (c.expectJson) {
      const looksJson =
        ct.includes("json") ||
        bodyStart.trim().startsWith("{") ||
        bodyStart.trim().startsWith("[");
      if (!looksJson) {
        return { ...c, ok: false, status: res.status, ct, err: "expected JSON" };
      }
    }
    return { ...c, ok: true, status: res.status, ct };
  } catch (e) {
    return { ...c, ok: false, err: e?.message || String(e) };
  }
}

async function main() {
  console.log("[open-deploy-gate] fleet SSOT probes…");
  let failed = 0;
  for (const c of CHECKS) {
    let r = await probe(c);
    // Soft fallback for run_forward if only on assets CDN
    if (!r.ok && c.name.includes("CANONICAL run")) {
      r = await probe({
        ...c,
        url: "https://assets.grudge-studio.com/prod/anims/locomotion/run_forward.json",
      });
    }
    if (r.ok) console.log("  OK ", r.status, r.name);
    else if (c.optional) console.warn("  WARN", r.name, r.err || r.status);
    else {
      failed++;
      console.error("  FAIL", r.name, r.err || r.status, r.ct || "");
    }
  }
  if (failed) {
    console.error(`[open-deploy-gate] ${failed} critical — REFUSING deploy`);
    process.exit(1);
  }
  console.log(
    "[open-deploy-gate] PASS — SPA + R2 + player API (uuid/ledger) + D1 index + fleet",
  );
  process.exit(0);
}

main();

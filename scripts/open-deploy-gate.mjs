/**
 * Open production deploy gate — refuse ship if fleet SSOTs are dead.
 * Does not invent hosts; only probes existing SSOT URLs.
 *
 *   npm run deploy:gate
 *   npm run deploy:prod  (includes gate)
 */
const CHECKS = [
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
    // may 404 until first deploy after bake — try assets prod too
    optional: false,
    rejectHtml: true,
  },
  {
    name: "Open SPA",
    url: "https://open.grudge-studio.com/",
    rejectHtml: false,
  },
  {
    name: "ui.grudge-studio.com",
    url: "https://ui.grudge-studio.com/",
    rejectHtml: false,
  },
];

async function probe(c) {
  try {
    const res = await fetch(c.url, { method: "HEAD", redirect: "follow" });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return { ...c, ok: false, status: res.status, ct, err: "not ok" };
    if (c.rejectHtml && ct.includes("text/html")) {
      return { ...c, ok: false, status: res.status, ct, err: "html masquerade" };
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
  console.log("[open-deploy-gate] PASS — use open.grudge-studio.com + R2 only");
  process.exit(0);
}

main();

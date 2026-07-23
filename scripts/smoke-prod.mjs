/**
 * Production smoke probes for Grudge Open / annihilate-demo.
 *
 * Usage:
 *   node scripts/smoke-prod.mjs
 *   node scripts/smoke-prod.mjs --base https://open.grudge-studio.com
 *   node scripts/smoke-prod.mjs --base https://grudge-studio.com
 *
 * Exit 0 only if all critical checks pass.
 */
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || process.env.SMOKE_BASE || "https://open.grudge-studio.com";
const CDN = "https://assets.grudge-studio.com";

const results = [];

async function probe(name, url, opts = {}) {
  const critical = opts.critical !== false;
  const expect = opts.expect || "ok"; // ok | html | jsonish | any
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      redirect: "follow",
      headers: opts.headers || { Accept: "*/*" },
      signal: AbortSignal.timeout(opts.timeoutMs || 20000),
    });
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const status = res.status;
    let bodyStart = "";
    if (expect === "html" || expect === "jsonish" || opts.sample) {
      const text = await res.text();
      bodyStart = text.slice(0, 200);
    } else {
      // drain
      await res.arrayBuffer().catch(() => null);
    }

    let ok = status >= 200 && status < 400;
    let detail = `${status} ${ct || "no-ct"}`;

    if (expect === "html") {
      const isHtml = ct.includes("text/html") || bodyStart.includes("<!DOCTYPE") || bodyStart.includes("<html");
      ok = ok && isHtml;
      if (!isHtml) detail += " (expected HTML SPA)";
    }
    if (expect === "jsonish") {
      // API must NOT be SPA index.html
      const isSpa = bodyStart.includes("<!DOCTYPE html") || bodyStart.includes('<div id="root"');
      const looksJson =
        ct.includes("json") || bodyStart.trim().startsWith("{") || bodyStart.trim().startsWith("[");
      // 401/403 with empty body is OK for unauthenticated characters
      ok = status === 200 || status === 401 || status === 403 || status === 204;
      if (isSpa) {
        ok = false;
        detail += " (got SPA HTML — rewrite broken)";
      } else if (status === 200 && !looksJson && bodyStart.length > 0) {
        detail += " (non-json body ok if empty/text)";
      }
    }
    if (expect === "asset") {
      ok = status === 200;
      if (ct.includes("text/html")) {
        ok = false;
        detail += " (HTML fake asset)";
      }
    }

    results.push({ name, url, ok, critical, detail });
    const mark = ok ? "PASS" : critical ? "FAIL" : "WARN";
    console.log(`[${mark}] ${name}: ${detail}\n       ${url}`);
    return ok;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, url, ok: false, critical, detail: msg });
    console.log(`[${critical ? "FAIL" : "WARN"}] ${name}: ${msg}\n       ${url}`);
    return false;
  }
}

console.log(`\n=== Grudge Open smoke · base=${BASE} ===\n`);

// SPA shells
await probe("open-home", `${BASE}/`, { expect: "html" });
await probe("danger", `${BASE}/danger`, { expect: "html" });
await probe("annihilate-demo", `${BASE}/annihilate-demo`, { expect: "html" });
await probe(
  "annihilate-hero",
  `${BASE}/annihilate-demo?hero=elf_worge`,
  { expect: "html" },
);

// Same-origin API (must not return SPA HTML)
await probe("api-characters", `${BASE}/api/characters`, {
  expect: "jsonish",
  sample: true,
});
await probe("api-health", `${BASE}/api/health`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});
await probe("api-healthz", `${BASE}/api/healthz`, {
  expect: "jsonish",
  sample: true,
  critical: false,
});

// CDN grudge6 kits (production meshes)
await probe("cdn-elf-kit", `${CDN}/models/grudge6/races/ELF_Characters.fbx`, {
  expect: "asset",
  critical: false,
});
await probe("cdn-wk-kit", `${CDN}/models/grudge6/races/WK_Characters.fbx`, {
  expect: "asset",
  critical: false,
});
await probe(
  "cdn-elf-atlas",
  `${CDN}/textures/grudge6/elves/ELF_HighElves_Texture.webp`,
  { expect: "asset", critical: false },
);

// Optional portal host when BASE is open.*
if (!BASE.includes("grudge-studio.com") || BASE.includes("open.")) {
  await probe(
    "portal-annihilate",
    "https://grudge-studio.com/annihilate-demo?hero=elf_worge",
    { expect: "html", critical: false },
  );
}

const failed = results.filter((r) => !r.ok && r.critical);
const warned = results.filter((r) => !r.ok && !r.critical);

console.log("\n=== Summary ===");
console.log(
  `passed ${results.filter((r) => r.ok).length}/${results.length} · critical fails ${failed.length} · warns ${warned.length}`,
);

if (failed.length) {
  console.error("\nCritical failures:");
  for (const f of failed) console.error(` - ${f.name}: ${f.detail}`);
  process.exit(1);
}

console.log("\nSmoke OK (critical path green).\n");
process.exit(0);

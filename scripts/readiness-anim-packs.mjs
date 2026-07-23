/**
 * Probe same-origin and CDN baked anim pack paths used by grudge6.
 * Exit 1 if critical packs are missing when --strict.
 *
 *   node scripts/readiness-anim-packs.mjs
 *   node scripts/readiness-anim-packs.mjs --base https://open.grudge-studio.com --strict
 */
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || "https://open.grudge-studio.com";
const STRICT = args.includes("--strict");
const CDN = "https://assets.grudge-studio.com";

/** Relative paths under /anims/baked (common fleet packs). */
const PACK_RELS = [
  "sword_shield/idle.json",
  "sword_shield/walk.json",
  "sword_shield/run.json",
  "sword_shield/attack.json",
  "longbow/idle.json",
  "longbow/attack.json",
  "magic/idle.json",
  "magic/attack.json",
  "unarmed/idle.json",
  "unarmed/walk.json",
  "unarmed/attack.json",
  "polearm/idle.json",
  "polearm/attack.json",
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
    if (ct.includes("text/html")) return { ok: false, status: res.status, detail: "HTML not JSON" };
    return { ok: res.status === 200 || res.status === 206, status: res.status, detail: ct };
  } catch (e) {
    return { ok: false, status: 0, detail: e instanceof Error ? e.message : String(e) };
  }
}

console.log(`\n=== Anim pack readiness · base=${BASE} ===\n`);

let miss = 0;
for (const rel of PACK_RELS) {
  const same = `${BASE.replace(/\/$/, "")}/anims/baked/${rel}`;
  const cdn = `${CDN}/anims/baked/${rel}`;
  const a = await headOk(same);
  const b = await headOk(cdn);
  const ok = a.ok || b.ok;
  if (!ok) miss++;
  console.log(
    `[${ok ? "OK" : "MISS"}] ${rel}\n       same-origin ${a.status} · cdn ${b.status}`,
  );
}

console.log(`\n${PACK_RELS.length - miss}/${PACK_RELS.length} packs reachable on same-origin or CDN\n`);
if (STRICT && miss > 0) process.exit(1);
process.exit(0);

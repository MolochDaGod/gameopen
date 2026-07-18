/**
 * Upload ALL local production GLBs under public/models to R2 + write UUID/metadata manifest.
 *
 * r2Key = models/... path (fleet CDN key, no gameopen/ prefix)
 * grudgeUuid = deterministic sha1("grudge-asset:" + r2Key)
 *
 * Env: CLOUDFLARE_ACCOUNT_ID|R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 *   node scripts/upload-production-glbs-r2.mjs
 *   node scripts/upload-production-glbs-r2.mjs --dry-run
 *   node scripts/upload-production-glbs-r2.mjs --only worlds,nature,grudge6
 *   node scripts/upload-production-glbs-r2.mjs --max-mb 40
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { grudgeUuidFromR2Key, cdnUrl } from "./lib/assetUuid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const onlyIdx = process.argv.indexOf("--only");
const only =
  onlyIdx >= 0
    ? process.argv[onlyIdx + 1].split(",").map((s) => s.trim()).filter(Boolean)
    : null;
const maxMbIdx = process.argv.indexOf("--max-mb");
const maxMb = maxMbIdx >= 0 ? Number(process.argv[maxMbIdx + 1]) : 80;

const publicModels = path.join(root, "artifacts/animator/public/models");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || "grudge-assets";

if (!accountId || !accessKey || !secretKey) {
  console.error("[upload-production-glbs] Missing R2 credentials");
  if (!dryRun) process.exit(1);
}

let S3Client, PutObjectCommand, HeadObjectCommand;
if (!dryRun) {
  ({ S3Client, PutObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3"));
}

const client = !dryRun
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    })
  : null;

function walkGlbs(dir, base) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkGlbs(full, base));
    else if (ent.name.toLowerCase().endsWith(".glb")) {
      const rel = path.relative(base, full).replace(/\\/g, "/");
      out.push({ full, r2Key: `models/${rel}` });
    }
  }
  return out;
}

function categoryOf(r2Key) {
  if (r2Key.includes("/worlds/")) return "world_terrain";
  if (r2Key.includes("/nature/")) return "nature";
  if (r2Key.includes("/packs/")) return "world_pack";
  if (r2Key.includes("/grudge6/")) return "character_kit";
  if (r2Key.includes("/grudge/")) return "character";
  if (r2Key.includes("/weapons/")) return "weapon";
  if (r2Key.includes("/vfx/")) return "vfx";
  if (r2Key.includes("/props/")) return "prop";
  if (r2Key.includes("/creatures/") || r2Key.includes("/enemies/")) return "creature";
  if (r2Key.includes("/armor/")) return "armor";
  if (r2Key.includes("dungeon") || r2Key.includes("arena") || r2Key.includes("agama"))
    return "map";
  return "model";
}

function md5hex(buf) {
  return createHash("md5").update(buf).digest("hex");
}

let files = walkGlbs(publicModels, publicModels);
if (only?.length) {
  files = files.filter((f) => only.some((o) => f.r2Key.includes(`/${o}/`) || f.r2Key.includes(`/${o}.`)));
}

const maxBytes = maxMb * 1024 * 1024;
files = files.filter((f) => {
  const sz = fs.statSync(f.full).size;
  if (sz > maxBytes) {
    console.warn(`[skip-size] ${f.r2Key} ${(sz / 1e6).toFixed(1)}MB > ${maxMb}MB`);
    return false;
  }
  return true;
});

console.log(`[upload-production-glbs] ${files.length} GLBs → r2://${bucket}/models/... dry=${dryRun}`);

const manifest = [];
let ok = 0,
  skip = 0,
  fail = 0;

for (const f of files) {
  const body = fs.readFileSync(f.full);
  const hash = md5hex(body);
  const grudgeUuid = grudgeUuidFromR2Key(f.r2Key);
  const cat = categoryOf(f.r2Key);
  const entry = {
    r2Key: f.r2Key,
    grudgeUuid,
    category: cat,
    bytes: body.length,
    md5: hash,
    cdnUrl: cdnUrl(f.r2Key),
    contentType: "model/gltf-binary",
  };

  if (dryRun || !client) {
    entry.status = "dry_run";
    ok++;
    manifest.push(entry);
    if (ok <= 5 || ok % 25 === 0) console.log(`[dry] ${f.r2Key} uuid=${grudgeUuid}`);
    continue;
  }

  try {
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: f.r2Key }),
      );
      if (head.Metadata?.["source-hash"] === hash) {
        entry.status = "skipped";
        skip++;
        manifest.push(entry);
        continue;
      }
    } catch {
      /* upload */
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: f.r2Key,
        Body: body,
        ContentType: "model/gltf-binary",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: {
          "source-hash": hash,
          "grudge-uuid": grudgeUuid,
          category: cat,
          "source-set": "gameopen-production-glbs",
        },
      }),
    );
    entry.status = "uploaded";
    ok++;
    if (ok % 10 === 0) console.log(`[ok ${ok}] ${f.r2Key}`);
    manifest.push(entry);
  } catch (err) {
    entry.status = "fail";
    entry.error = String(err.message || err);
    fail++;
    console.error(`[fail] ${f.r2Key}`, err.message || err);
    manifest.push(entry);
  }
}

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "production-glbs-r2-manifest.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      bucket,
      dryRun: !!dryRun,
      ok,
      skip,
      fail,
      count: manifest.length,
      assets: manifest,
    },
    null,
    2,
  ),
);

// D1 SQL for all uploaded/skipped
function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}
const stmts = manifest.map((r) => {
  const now = new Date().toISOString();
  return (
    `INSERT INTO asset_registry (grudge_uuid, r2_key, category, name, cdn_url, content_type, byte_size, source_hash, metadata_json, updated_at) VALUES (` +
    `'${esc(r.grudgeUuid)}', '${esc(r.r2Key)}', '${esc(r.category)}', '${esc(path.basename(r.r2Key))}', ` +
    `'${esc(r.cdnUrl)}', 'model/gltf-binary', ${Number(r.bytes) || "NULL"}, ` +
    `${r.md5 ? `'${esc(r.md5)}'` : "NULL"}, ` +
    `'${esc(JSON.stringify({ sourceSet: "gameopen-production-glbs", status: r.status }))}', '${now}'` +
    `) ON CONFLICT(r2_key) DO UPDATE SET ` +
    `grudge_uuid=excluded.grudge_uuid, category=excluded.category, name=excluded.name, ` +
    `cdn_url=excluded.cdn_url, content_type=excluded.content_type, ` +
    `byte_size=COALESCE(excluded.byte_size, asset_registry.byte_size), ` +
    `source_hash=COALESCE(excluded.source_hash, asset_registry.source_hash), ` +
    `metadata_json=excluded.metadata_json, updated_at=excluded.updated_at;`
  );
});
const sqlPath = path.join(outDir, "production-glbs-d1-seed.sql");
// Split into chunks of 80 for wrangler comfort
const chunkSize = 80;
const sqlParts = [];
for (let i = 0; i < stmts.length; i += chunkSize) {
  sqlParts.push(stmts.slice(i, i + chunkSize).join("\n"));
}
fs.writeFileSync(
  sqlPath,
  `-- production GLBs D1 seed · ${manifest.length} rows · ${new Date().toISOString()}\n` +
    stmts.join("\n") +
    "\n",
);
// Also write chunk files
sqlParts.forEach((part, i) => {
  fs.writeFileSync(path.join(outDir, `production-glbs-d1-seed-part${i + 1}.sql`), part + "\n");
});

console.log(
  `\n[upload-production-glbs] ok=${ok} skip=${skip} fail=${fail}\n` +
    `  manifest → ${outPath}\n` +
    `  D1 SQL   → ${sqlPath} (${sqlParts.length} part file(s))\n` +
    `  Apply: npx wrangler d1 execute grudge-assets-db --remote --file=reports/production-glbs-d1-seed-part1.sql`,
);

if (fail > 0) process.exit(1);

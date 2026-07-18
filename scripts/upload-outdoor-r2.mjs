/**
 * Upload outdoor terrain + nature GLBs to Cloudflare R2 (grudge-assets).
 *
 * Best practice:
 *  - r2Key = public path (models/worlds/sailtest.glb) — NO gameopen/ prefix
 *  - Idempotent: skip when local md5 matches ETag
 *  - Multipart not required for <50MB typical island GLBs
 *  - Binaries stay OUT of git; only this script + catalog live in repo
 *
 * Env:
 *   CLOUDFLARE_ACCOUNT_ID or R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET (default grudge-assets)
 *
 * Usage:
 *   node scripts/upload-outdoor-r2.mjs
 *   node scripts/upload-outdoor-r2.mjs --dry-run
 *   node scripts/upload-outdoor-r2.mjs --src artifacts/animator/public
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { grudgeUuidFromR2Key, cdnUrl } from "./lib/assetUuid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const srcIdx = process.argv.indexOf("--src");
const publicDir = path.resolve(
  root,
  srcIdx >= 0 ? process.argv[srcIdx + 1] : "artifacts/animator/public",
);

const catalogPath = path.join(root, "content/worlds/outdoor-asset-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || catalog.bucket || "grudge-assets";

if (!accountId || !accessKey || !secretKey) {
  console.error(
    "[upload-outdoor-r2] Missing R2 credentials.\n" +
      "  Set CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY\n" +
      "  Dry-run still lists local files + target keys:\n" +
      "    node scripts/upload-outdoor-r2.mjs --dry-run",
  );
  if (!dryRun) process.exit(1);
}

let S3Client, PutObjectCommand, HeadObjectCommand;
if (!dryRun && accountId && accessKey && secretKey) {
  try {
    ({ S3Client, PutObjectCommand, HeadObjectCommand } = await import(
      "@aws-sdk/client-s3"
    ));
  } catch {
    console.error("Install @aws-sdk/client-s3 (root or global) to upload.");
    process.exit(1);
  }
}

const client =
  !dryRun && S3Client
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      })
    : null;

function md5hex(buf) {
  return createHash("md5").update(buf).digest("hex");
}

function findLocal(r2Key) {
  const rel = r2Key.replace(/^\/+/, "");
  const candidates = [
    path.join(publicDir, rel),
    path.join(root, "client/public", rel),
    path.join(root, "artifacts/animator/public", rel),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

const manifest = [];
let ok = 0;
let skip = 0;
let miss = 0;
let fail = 0;

for (const asset of catalog.assets) {
  const r2Key = asset.r2Key;
  const grudgeUuid = grudgeUuidFromR2Key(r2Key);
  const local = findLocal(r2Key);
  const entry = {
    id: asset.id,
    r2Key,
    grudgeUuid,
    category: asset.category,
    role: asset.role,
    cdnUrl: cdnUrl(r2Key, catalog.cdn),
    localPath: local,
  };

  if (!local) {
    console.warn(`[miss] ${r2Key} — not under ${publicDir} (upload from bake machine later)`);
    miss++;
    entry.status = "missing_local";
    manifest.push(entry);
    continue;
  }

  const body = fs.readFileSync(local);
  const hash = md5hex(body);
  entry.bytes = body.length;
  entry.md5 = hash;

  if (dryRun || !client) {
    console.log(`[dry] would upload ${local} → r2://${bucket}/${r2Key} (${body.length} B) uuid=${grudgeUuid}`);
    entry.status = "dry_run";
    ok++;
    manifest.push(entry);
    continue;
  }

  try {
    // Idempotent skip
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: r2Key }),
      );
      const etag = (head.ETag || "").replace(/"/g, "");
      if (etag && (etag === hash || etag === body.toString("hex") /* unlikely */)) {
        console.log(`[skip] ${r2Key} (etag match)`);
        skip++;
        entry.status = "skipped";
        manifest.push(entry);
        continue;
      }
      // Some R2 etags are multipart-style — compare content-length + custom metadata
      if (head.Metadata?.["source-hash"] === hash) {
        console.log(`[skip] ${r2Key} (source-hash match)`);
        skip++;
        entry.status = "skipped";
        manifest.push(entry);
        continue;
      }
    } catch {
      /* not present — upload */
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: body,
        ContentType: asset.contentType || "model/gltf-binary",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: {
          "source-hash": hash,
          "grudge-uuid": grudgeUuid,
          category: asset.category || "world",
          "source-set": "gameopen-outdoor",
        },
      }),
    );
    console.log(`[ok] ${r2Key} → ${entry.cdnUrl}`);
    ok++;
    entry.status = "uploaded";
    manifest.push(entry);
  } catch (err) {
    console.error(`[fail] ${r2Key}`, err.message || err);
    fail++;
    entry.status = "fail";
    entry.error = String(err.message || err);
    manifest.push(entry);
  }
}

const outDir = path.join(root, "reports");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "outdoor-r2-manifest.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      bucket,
      dryRun: dryRun || !client,
      ok,
      skip,
      miss,
      fail,
      assets: manifest,
    },
    null,
    2,
  ),
);

console.log(
  `\n[upload-outdoor-r2] ok=${ok} skip=${skip} miss=${miss} fail=${fail}\n  manifest → ${outPath}\n  next: node scripts/seed-outdoor-d1.mjs`,
);

if (fail > 0) process.exit(1);

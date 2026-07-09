/**
 * Upload client/public heavy assets to Cloudflare R2 under prefix gameopen/.
 * Requires env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *
 * Uses AWS S3 API compatible endpoint.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../client/public");

const accountId = process.env.R2_ACCOUNT_ID;
const accessKey = process.env.R2_ACCESS_KEY_ID;
const secretKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || "grudge-assets";
const prefix = (process.env.R2_PREFIX || "gameopen").replace(/\/$/, "");

if (!accountId || !accessKey || !secretKey) {
  console.error(
    "Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.\n" +
      "Set them in .env then re-run: pnpm assets:upload-r2\n" +
      "Until then, Vercel serves assets from client/public.",
  );
  process.exit(0);
}

// Dynamic import of AWS SDK if installed
let S3Client, PutObjectCommand;
try {
  ({ S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3"));
} catch {
  console.error("Install @aws-sdk/client-s3 in root or server to upload.");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

function walk(dir, base = dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

const HEAVY = new Set(["glb", "fbx", "png", "jpg", "jpeg", "bin", "gltf"]);
const files = walk(publicDir).filter((f) => {
  const ext = path.extname(f).slice(1).toLowerCase();
  return HEAVY.has(ext) && !f.endsWith(".br") && !f.endsWith(".gz");
});

let ok = 0;
let fail = 0;
for (const rel of files) {
  const key = `${prefix}/${rel}`;
  const body = fs.readFileSync(path.join(publicDir, rel));
  const ext = path.extname(rel).slice(1).toLowerCase();
  const types = {
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    fbx: "application/octet-stream",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    bin: "application/octet-stream",
  };
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: types[ext] || "application/octet-stream",
        CacheControl: "public, max-age=604800, immutable",
      }),
    );
    ok++;
    if (ok % 20 === 0) console.log(`uploaded ${ok}/${files.length}`);
  } catch (e) {
    fail++;
    console.error("fail", key, e.message);
  }
}

console.log(`R2 upload done: ok=${ok} fail=${fail} prefix=${prefix}/`);
console.log(`Public base: https://assets.grudge-studio.com/${prefix}/`);

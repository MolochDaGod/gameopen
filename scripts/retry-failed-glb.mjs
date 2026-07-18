/** Retry a single GLB upload to R2. Usage: node scripts/retry-failed-glb.mjs models/props/dying-torch.glb */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { grudgeUuidFromR2Key, cdnUrl } from "./lib/assetUuid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const r2Key = (process.argv[2] || "models/props/dying-torch.glb").replace(/^\/+/, "");
const local = path.join(root, "artifacts/animator/public", r2Key);
if (!fs.existsSync(local)) {
  console.error("missing local", local);
  process.exit(1);
}
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const body = fs.readFileSync(local);
const hash = createHash("md5").update(body).digest("hex");
const uuid = grudgeUuidFromR2Key(r2Key);
await client.send(
  new PutObjectCommand({
    Bucket: process.env.R2_BUCKET || "grudge-assets",
    Key: r2Key,
    Body: body,
    ContentType: "model/gltf-binary",
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: {
      "source-hash": hash,
      "grudge-uuid": uuid,
      category: "prop",
      "source-set": "gameopen-production-glbs",
    },
  }),
);
console.log("ok", r2Key, uuid, body.length, cdnUrl(r2Key));

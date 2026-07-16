/**
 * Generate public/asset-manifest.json with kind + purpose classification.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../artifacts/animator/public");

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

const EXT_KIND = {
  glb: "model",
  gltf: "model",
  fbx: "animation",
  png: "texture",
  jpg: "texture",
  jpeg: "texture",
  webp: "texture",
  svg: "icon",
  bin: "bin",
  css: "code",
  js: "code",
  html: "page",
  json: "data",
  txt: "text",
};

async function main() {
  let classifyAsset = (rel) => ({ purpose: "unknown" });
  try {
    ({ classifyAsset } = await import("./asset-pipeline/lib/purpose.mjs"));
  } catch {
    /* optional */
  }

  const files = walk(publicDir).filter(
    (f) => !f.endsWith(".br") && !f.endsWith(".gz") && f !== "asset-manifest.json",
  );

  const assets = files.map((rel) => {
    const ext = path.extname(rel).slice(1).toLowerCase();
    const full = path.join(publicDir, rel);
    const st = fs.statSync(full);
    const hash = crypto.createHash("sha1").update(rel).digest("hex").slice(0, 12);
    const purpose = classifyAsset(rel).purpose;
    return {
      id: `GO-${hash}`,
      path: `/${rel}`,
      rel,
      kind: EXT_KIND[ext] || "other",
      purpose,
      ext,
      bytes: st.size,
      category: rel.split("/").slice(0, -1).join("/") || "root",
    };
  });

  const byKind = {};
  const byPurpose = {};
  for (const a of assets) {
    byKind[a.kind] = (byKind[a.kind] || 0) + 1;
    byPurpose[a.purpose] = (byPurpose[a.purpose] || 0) + 1;
  }

  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    game: "gameopen",
    count: assets.length,
    byKind,
    byPurpose,
    totalBytes: assets.reduce((s, a) => s + a.bytes, 0),
    assets,
  };

  const out = path.join(publicDir, "asset-manifest.json");
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log(
    `[generate-asset-manifest] ${manifest.count} assets, ${(manifest.totalBytes / 1e6).toFixed(1)} MB → ${out}`,
  );
  console.log("byKind", byKind);
  console.log("byPurpose", byPurpose);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../client/public");

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
  svg: "icon",
  bin: "bin",
  css: "code",
  js: "code",
  html: "page",
  json: "data",
  txt: "text",
};

const files = walk(publicDir).filter(
  (f) => !f.endsWith(".br") && !f.endsWith(".gz") && f !== "asset-manifest.json",
);

const assets = files.map((rel) => {
  const ext = path.extname(rel).slice(1).toLowerCase();
  const full = path.join(publicDir, rel);
  const st = fs.statSync(full);
  const hash = crypto.createHash("sha1").update(rel).digest("hex").slice(0, 12);
  return {
    id: `GO-${hash}`,
    path: `/${rel}`,
    rel,
    kind: EXT_KIND[ext] || "other",
    ext,
    bytes: st.size,
    category: rel.split("/").slice(0, -1).join("/") || "root",
  };
});

const byKind = {};
for (const a of assets) {
  byKind[a.kind] = (byKind[a.kind] || 0) + 1;
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  game: "gameopen",
  count: assets.length,
  byKind,
  totalBytes: assets.reduce((s, a) => s + a.bytes, 0),
  assets,
};

const out = path.join(publicDir, "asset-manifest.json");
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(
  `[generate-asset-manifest] ${manifest.count} assets, ${(manifest.totalBytes / 1e6).toFixed(1)} MB → ${out}`,
);
console.log(byKind);

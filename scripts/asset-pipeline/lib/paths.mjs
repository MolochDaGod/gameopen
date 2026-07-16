/**
 * Resolve grudge-convert + common roots.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GAMEOPEN_ROOT = path.resolve(__dirname, "../../..");
export const ANIMATOR_PUBLIC = path.join(GAMEOPEN_ROOT, "artifacts/animator/public");
export const PIPELINE_OUT = path.join(GAMEOPEN_ROOT, "dist/production-assets");

const CONVERT_CANDIDATES = [
  path.resolve(GAMEOPEN_ROOT, "../ObjectStore/tools/grudge-convert/bin/grudge-convert.mjs"),
  path.resolve("F:/GitHub/ObjectStore/tools/grudge-convert/bin/grudge-convert.mjs"),
  path.resolve("D:/GitHub/ObjectStore/tools/grudge-convert/bin/grudge-convert.mjs"),
  process.env.GRUDGE_CONVERT || "",
].filter(Boolean);

export function findGrudgeConvert() {
  for (const p of CONVERT_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

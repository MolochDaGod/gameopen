/**
 * Stage Draco + Basis WASM from the installed `three` package into
 * artifacts/animator/public so GLTFLoader uses same-origin files.
 *
 * Order: npm install (animator) → this script → vite build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const anim = path.join(root, "artifacts/animator");
const threeLibs = path.join(anim, "node_modules/three/examples/jsm/libs");

function copyDir(src, dest, files) {
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const name of files) {
    const from = path.join(src, name);
    if (!fs.existsSync(from)) {
      console.warn("[stage-three-loaders] missing", from);
      continue;
    }
    fs.copyFileSync(from, path.join(dest, name));
    n++;
  }
  return n;
}

if (!fs.existsSync(threeLibs)) {
  console.error("[stage-three-loaders] three not installed at", threeLibs);
  process.exit(1);
}

const dracoSrc = path.join(threeLibs, "draco/gltf");
const dracoDest = path.join(anim, "public/draco");
const basisSrc = path.join(threeLibs, "basis");
const basisDest = path.join(anim, "public/basis");

const dracoN = copyDir(dracoSrc, dracoDest, [
  "draco_decoder.js",
  "draco_decoder.wasm",
  "draco_wasm_wrapper.js",
]);
const basisN = copyDir(basisSrc, basisDest, [
  "basis_transcoder.js",
  "basis_transcoder.wasm",
]);

if (dracoN < 3 || basisN < 2) {
  console.error("[stage-three-loaders] incomplete copy draco=", dracoN, "basis=", basisN);
  process.exit(1);
}

console.log("[stage-three-loaders] draco", dracoN, "→", dracoDest);
console.log("[stage-three-loaders] basis", basisN, "→", basisDest);

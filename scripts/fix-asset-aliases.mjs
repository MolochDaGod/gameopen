/**
 * Create path aliases so the minified client finds animations/props
 * at both historical short paths and the full anim/animations/* tree.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../artifacts/animator/public");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function linkOrCopy(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) return true;
  ensureDir(path.dirname(dest));
  try {
    fs.copyFileSync(src, dest);
    return true;
  } catch {
    return false;
  }
}

const strikerMap = [
  ["Flip_Kick.fbx", "flip_kick.fbx"],
  ["Back_Flip_To_Uppercut.fbx", "backflip.fbx"],
  ["Falling_To_Roll.fbx", "roll.fbx"],
  ["fight-idle.fbx", "fight-idle.fbx"],
  ["kicking.fbx", "kicking.fbx"],
  ["strike-down.fbx", "strike-down.fbx"],
  ["vampiric-bite.fbx", "vampiric-bite.fbx"],
];

const animRoot = path.join(publicDir, "anim");
const packRoot = path.join(animRoot, "animations");

// /anim/striker/* → /anim/animations/striker/*
const strikerSrc = path.join(packRoot, "striker");
const strikerDst = path.join(animRoot, "striker");
ensureDir(strikerDst);
for (const [from, to] of strikerMap) {
  linkOrCopy(path.join(strikerSrc, from), path.join(strikerDst, to));
  // also lowercase-safe
  linkOrCopy(path.join(strikerSrc, from), path.join(strikerDst, from.toLowerCase()));
}

// Flat pirate FBX names at / (and /models/pirate/) already present — also under /models/pirate/
const pirateDir = path.join(publicDir, "models", "pirate");
if (fs.existsSync(pirateDir)) {
  for (const f of fs.readdirSync(pirateDir)) {
    if (f.endsWith(".fbx")) {
      linkOrCopy(path.join(pirateDir, f), path.join(publicDir, f));
    }
  }
}

// Enemy / barrel bare names (bundle sometimes omits folder)
const bare = [
  ["models/enemies/voxel-zombies/voxel-zombie-1.glb", "voxel-zombie-1.glb"],
  ["models/enemies/voxel-zombies/voxel-zombie-2.glb", "voxel-zombie-2.glb"],
  ["models/enemies/voxel-zombies/voxel-zombie-3.glb", "voxel-zombie-3.glb"],
  ["models/destructibles/barrel-01.glb", "barrel-01.glb"],
  ["models/destructibles/barrel-02.glb", "barrel-02.glb"],
  ["models/destructibles/barrel-04.glb", "barrel-04.glb"],
  ["models/destructibles/barrel-05.glb", "barrel-05.glb"],
  ["models/destructibles/barrel-06.glb", "barrel-06.glb"],
  ["models/destructibles/barrel-07.glb", "barrel-07.glb"],
];
for (const [rel, bareName] of bare) {
  linkOrCopy(path.join(publicDir, rel), path.join(publicDir, bareName));
}

// Convenience: /anim/<pack>/ mirrors /anim/animations/<pack>/
if (fs.existsSync(packRoot)) {
  for (const pack of fs.readdirSync(packRoot, { withFileTypes: true })) {
    if (!pack.isDirectory()) continue;
    const srcDir = path.join(packRoot, pack.name);
    const dstDir = path.join(animRoot, pack.name);
    ensureDir(dstDir);
    for (const f of fs.readdirSync(srcDir)) {
      linkOrCopy(path.join(srcDir, f), path.join(dstDir, f));
    }
  }
}

console.log("[fix-asset-aliases] path aliases ready under artifacts/animator/public");

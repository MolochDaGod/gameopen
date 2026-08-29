/**
 * Bake Human Crafting Animations FREE (B-* skeleton) → Bip001 rotation-only JSON.
 *
 * Source: public/anim/crafting/*.fbx  (copied from Documents/Human Crafting Animations FREE)
 * Output: public/anims/baked/harvest/{gathering,mining,chop,farm-plow,fishing-*}.json
 *
 * Usage (from artifacts/animator):
 *   node scripts/bake-human-crafting-harvest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT_ROOT = path.join(PUBLIC, "anims/baked");

/** Human Crafting FREE (B-*) → grudge6 Bip001 */
const B_TO_BIP001 = {
  "B-hips": "Bip001 Pelvis",
  "B-spine": "Bip001 Spine",
  "B-spineProxy": "Bip001 Spine1",
  "B-chest": "Bip001 Spine2",
  "B-neck": "Bip001 Neck",
  "B-head": "Bip001 Head",
  "B-shoulderL": "Bip001 L Clavicle",
  "B-upperArmL": "Bip001 L UpperArm",
  "B-forearmL": "Bip001 L Forearm",
  "B-handL": "Bip001 L Hand",
  "B-shoulderR": "Bip001 R Clavicle",
  "B-upperArmR": "Bip001 R UpperArm",
  "B-forearmR": "Bip001 R Forearm",
  "B-handR": "Bip001 R Hand",
  "B-thighL": "Bip001 L Thigh",
  "B-shinL": "Bip001 L Calf",
  "B-footL": "Bip001 L Foot",
  "B-toeL": "Bip001 L Toe0",
  "B-thighR": "Bip001 R Thigh",
  "B-shinR": "Bip001 R Calf",
  "B-footR": "Bip001 R Foot",
  "B-toeR": "Bip001 R Toe0",
};

const TARGETS = [
  { bakeRel: "harvest/gathering", src: "anim/crafting/gathering01.fbx" },
  { bakeRel: "harvest/gathering02", src: "anim/crafting/gathering02.fbx" },
  { bakeRel: "harvest/gathering03", src: "anim/crafting/gathering03.fbx" },
  { bakeRel: "harvest/mining", src: "anim/crafting/mining-r-ground.fbx" },
  { bakeRel: "harvest/mining-l", src: "anim/crafting/mining-l-ground.fbx" },
  { bakeRel: "harvest/mining-wall", src: "anim/crafting/mining-r-wall.fbx" },
  { bakeRel: "harvest/chop", src: "anim/crafting/hammering-r-loop.fbx" },
  { bakeRel: "harvest/hammer", src: "anim/crafting/hammering-r-loop.fbx" },
  { bakeRel: "harvest/hammer-begin", src: "anim/crafting/hammering-r-begin.fbx" },
  { bakeRel: "harvest/farm-plow", src: "anim/crafting/farming-plow-loop.fbx" },
  { bakeRel: "harvest/farm-plow-begin", src: "anim/crafting/farming-plow-begin.fbx" },
  { bakeRel: "harvest/fishing-cast", src: "anim/crafting/fishing-throw.fbx" },
  { bakeRel: "harvest/fishing-wait", src: "anim/crafting/fishing-loop.fbx" },
  { bakeRel: "harvest/fishing-begin", src: "anim/crafting/fishing-begin.fbx" },
  { bakeRel: "harvest/fishing-catch", src: "anim/crafting/fishing-pullout.fbx" },
];

function mapTrackName(trackName) {
  const dot = trackName.lastIndexOf(".");
  if (dot < 0) return null;
  const bone = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  if (prop !== "quaternion") return null;
  let bip = B_TO_BIP001[bone];
  if (!bip) {
    const key = Object.keys(B_TO_BIP001).find((k) => k.toLowerCase() === bone.toLowerCase());
    bip = key ? B_TO_BIP001[key] : null;
  }
  if (!bip) return null;
  return `${bip}.quaternion`;
}

function bakeFbxToJson(srcAbs, bakeRel) {
  const buf = fs.readFileSync(srcAbs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new FBXLoader();
  const group = loader.parse(ab, path.dirname(srcAbs) + path.sep);
  const clip = group.animations?.[0];
  if (!clip) throw new Error("no animations in FBX");

  const byName = new Map();
  for (const t of clip.tracks) {
    const mapped = mapTrackName(t.name);
    if (!mapped) continue;
    byName.set(mapped, {
      name: mapped,
      type: "quaternion",
      times: Array.from(t.times),
      values: Array.from(t.values),
    });
  }
  if (byName.size < 6) {
    throw new Error(`too few mapped tracks (${byName.size})`);
  }
  return {
    name: bakeRel,
    duration: clip.duration || 0.01,
    tracks: [...byName.values()],
  };
}

function main() {
  const report = [];
  for (const t of TARGETS) {
    const srcAbs = path.join(PUBLIC, t.src);
    const outAbs = path.join(OUT_ROOT, `${t.bakeRel}.json`);
    if (!fs.existsSync(srcAbs)) {
      console.warn(`MISS ${t.src}`);
      report.push({ bakeRel: t.bakeRel, ok: false, reason: "missing source" });
      continue;
    }
    try {
      const json = bakeFbxToJson(srcAbs, t.bakeRel);
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      fs.writeFileSync(outAbs, JSON.stringify(json));
      console.log(
        `OK ${t.bakeRel}.json  dur=${json.duration.toFixed(3)} tracks=${json.tracks.length}`,
      );
      report.push({
        bakeRel: t.bakeRel,
        ok: true,
        duration: json.duration,
        tracks: json.tracks.length,
      });
    } catch (e) {
      console.error(`FAIL ${t.bakeRel}:`, e.message);
      report.push({ bakeRel: t.bakeRel, ok: false, reason: e.message });
    }
  }

  // Merge into harvest manifest
  const manPath = path.join(OUT_ROOT, "harvest", "manifest.json");
  let existing = { pack: "harvest", clips: [] };
  try {
    if (fs.existsSync(manPath)) existing = JSON.parse(fs.readFileSync(manPath, "utf8"));
  } catch {
    /* keep empty */
  }
  const okNames = report.filter((r) => r.ok).map((r) => r.bakeRel.replace(/^harvest\//, ""));
  const set = new Set([...(existing.clips || []), ...okNames]);
  const man = {
    pack: "harvest",
    source: "farming Mixamo + Human Crafting Animations FREE (B→Bip001)",
    updated: new Date().toISOString().slice(0, 10),
    skeleton: "Bip001",
    stripPositionTracks: true,
    clips: [...set].sort(),
    humanCrafting: report,
  };
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));

  // Also copy into client/public for Open dual tree
  const clientBaked = path.resolve(ROOT, "../../client/public/anims/baked/harvest");
  if (fs.existsSync(path.dirname(clientBaked))) {
    fs.mkdirSync(clientBaked, { recursive: true });
    for (const r of report.filter((x) => x.ok)) {
      const name = r.bakeRel.replace(/^harvest\//, "") + ".json";
      const from = path.join(OUT_ROOT, "harvest", name);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(clientBaked, name));
    }
    fs.copyFileSync(manPath, path.join(clientBaked, "manifest.json"));
    console.log("mirrored → client/public/anims/baked/harvest");
  }

  const ok = report.filter((r) => r.ok).length;
  const fail = report.filter((r) => !r.ok).length;
  console.log(`\nHuman Crafting bake done: ok=${ok} fail=${fail}`);
}

main();

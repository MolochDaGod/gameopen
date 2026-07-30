/**
 * Bake Mixamo climb/swim mobility FBX → Bip001 rotation-only JSON
 * under public/anims/baked/ (P0 fleet gate).
 *
 * Usage (from artifacts/animator):
 *   node scripts/bake-mobility-p1.mjs
 *
 * Policy: Bip001 names · quaternion tracks only · strip root position.
 * Source: public/anim/climb/*.fbx + public/anim/swim/*.fbx
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT_ROOT = path.join(PUBLIC, "anims/baked");

/** Mixamo (mixamorig* or bare) → Bip001 (grudge6 / arena pack convention). */
const MIXAMO_TO_BIP001 = {
  mixamorigHips: "Bip001 Pelvis",
  Hips: "Bip001 Pelvis",
  mixamorigSpine: "Bip001 Spine",
  Spine: "Bip001 Spine",
  mixamorigSpine1: "Bip001 Spine1",
  Spine1: "Bip001 Spine1",
  mixamorigSpine2: "Bip001 Spine2",
  Spine2: "Bip001 Spine2",
  mixamorigNeck: "Bip001 Neck",
  Neck: "Bip001 Neck",
  mixamorigHead: "Bip001 Head",
  Head: "Bip001 Head",
  mixamorigLeftShoulder: "Bip001 L Clavicle",
  LeftShoulder: "Bip001 L Clavicle",
  mixamorigLeftArm: "Bip001 L UpperArm",
  LeftArm: "Bip001 L UpperArm",
  mixamorigLeftForeArm: "Bip001 L Forearm",
  LeftForeArm: "Bip001 L Forearm",
  mixamorigLeftHand: "Bip001 L Hand",
  LeftHand: "Bip001 L Hand",
  mixamorigRightShoulder: "Bip001 R Clavicle",
  RightShoulder: "Bip001 R Clavicle",
  mixamorigRightArm: "Bip001 R UpperArm",
  RightArm: "Bip001 R UpperArm",
  mixamorigRightForeArm: "Bip001 R Forearm",
  RightForeArm: "Bip001 R Forearm",
  mixamorigRightHand: "Bip001 R Hand",
  RightHand: "Bip001 R Hand",
  mixamorigLeftUpLeg: "Bip001 L Thigh",
  LeftUpLeg: "Bip001 L Thigh",
  mixamorigLeftLeg: "Bip001 L Calf",
  LeftLeg: "Bip001 L Calf",
  mixamorigLeftFoot: "Bip001 L Foot",
  LeftFoot: "Bip001 L Foot",
  mixamorigLeftToeBase: "Bip001 L Toe0",
  LeftToeBase: "Bip001 L Toe0",
  mixamorigRightUpLeg: "Bip001 R Thigh",
  RightUpLeg: "Bip001 R Thigh",
  mixamorigRightLeg: "Bip001 R Calf",
  RightLeg: "Bip001 R Calf",
  mixamorigRightFoot: "Bip001 R Foot",
  RightFoot: "Bip001 R Foot",
  mixamorigRightToeBase: "Bip001 R Toe0",
  RightToeBase: "Bip001 R Toe0",
};

/**
 * bakeRel (path under anims/baked without .json) → Mixamo source under public/
 */
const TARGETS = [
  { bakeRel: "climb/climbing", src: "anim/climb/climbing.fbx" },
  { bakeRel: "climb/up", src: "anim/climb/climbing-up-wall.fbx" },
  { bakeRel: "climb/down", src: "anim/climb/climbing-down-wall.fbx" },
  { bakeRel: "climb/to_top", src: "anim/climb/climbing-to-top.fbx" },
  { bakeRel: "climb/hang_idle", src: "anim/climb/hanging-idle.fbx" },
  { bakeRel: "climb/jump_to_hang", src: "anim/climb/jump-to-freehang.fbx" },
  { bakeRel: "climb/stand_to_hang", src: "anim/climb/stand-to-freehang.fbx" },
  { bakeRel: "climb/wall_run", src: "anim/climb/wall-run.fbx" },
  { bakeRel: "climb/freehang_climb", src: "anim/climb/freehang-climb.fbx" },
  { bakeRel: "swim/swimming", src: "anim/swim/swimming.fbx" },
  { bakeRel: "swim/treading", src: "anim/swim/treading-water.fbx" },
  { bakeRel: "swim/to_edge", src: "anim/swim/swimming-to-edge.fbx" },
];

function mapTrackName(trackName) {
  // "mixamorigLeftArm.quaternion" → bone + prop
  const dot = trackName.lastIndexOf(".");
  if (dot < 0) return null;
  const bone = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  if (prop !== "quaternion") return null; // rotation-only
  // try exact then strip mixamorig case variants
  let bip = MIXAMO_TO_BIP001[bone];
  if (!bip) {
    const key = Object.keys(MIXAMO_TO_BIP001).find(
      (k) => k.toLowerCase() === bone.toLowerCase(),
    );
    bip = key ? MIXAMO_TO_BIP001[key] : null;
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
    // QuaternionKeyframeTrack → plain arrays
    const times = Array.from(t.times);
    const values = Array.from(t.values);
    byName.set(mapped, {
      name: mapped,
      type: "quaternion",
      times,
      values,
    });
  }

  if (byName.size < 6) {
    throw new Error(`too few mapped tracks (${byName.size}) from ${srcAbs}`);
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
      console.warn(`MISS source ${t.src}`);
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
        bytes: fs.statSync(outAbs).size,
      });
    } catch (e) {
      console.error(`FAIL ${t.bakeRel}:`, e.message);
      report.push({ bakeRel: t.bakeRel, ok: false, reason: e.message });
    }
  }

  const manifestPath = path.join(OUT_ROOT, "climb", "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        updated: new Date().toISOString().slice(0, 10),
        skeleton: "Bip001",
        stripPositionTracks: true,
        clips: report.filter((r) => r.ok),
      },
      null,
      2,
    ),
  );

  const ok = report.filter((r) => r.ok).length;
  const bad = report.filter((r) => !r.ok).length;
  console.log(`\nBaked ${ok} · failed ${bad}`);
  if (ok < 6) process.exit(1);
}

main();

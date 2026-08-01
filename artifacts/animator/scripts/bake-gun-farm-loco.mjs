/**
 * Bake pistol / rifle / farming / 8-way key clips: Mixamo FBX → Bip001 JSON.
 *
 * Usage (from artifacts/animator):
 *   node scripts/bake-gun-farm-loco.mjs
 *
 * Policy: Bip001 · rotation-only · strip position (same as bake-mobility-p1).
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

/** Live pack paths used by ANIM_PACK_CLIPS + weapon-live-packs */
const TARGETS = [
  // Rifle (fixes degraded rifle/pistol weapons on integrity)
  { bakeRel: "rifle/rifle-aiming-idle", src: "anim/rifle/rifle-aiming-idle.fbx" },
  { bakeRel: "rifle/walking", src: "anim/rifle/walking.fbx" },
  { bakeRel: "rifle/rifle-run", src: "anim/rifle/rifle-run.fbx" },
  { bakeRel: "rifle/firing-rifle", src: "anim/rifle/firing-rifle.fbx" },
  { bakeRel: "rifle/reloading", src: "anim/rifle/reloading.fbx" },
  { bakeRel: "rifle/rifle-jump", src: "anim/rifle/rifle-jump.fbx" },
  { bakeRel: "rifle/hit-reaction", src: "anim/rifle/hit-reaction.fbx" },
  { bakeRel: "rifle/strafe-left", src: "anim/rifle/strafe-left.fbx" },
  { bakeRel: "rifle/strafe-right", src: "anim/rifle/strafe-right.fbx" },
  { bakeRel: "rifle/run-backwards", src: "anim/rifle/run-backwards.fbx" },
  { bakeRel: "rifle/walking-backwards", src: "anim/rifle/walking-backwards.fbx" },

  // Pistol
  { bakeRel: "pistol/idle", src: "anim/pistol/idle.fbx" },
  { bakeRel: "pistol/walk-forward", src: "anim/pistol/walk-forward.fbx" },
  { bakeRel: "pistol/run-forward", src: "anim/pistol/run-forward.fbx" },
  { bakeRel: "pistol/walk-backward", src: "anim/pistol/walk-backward.fbx" },
  { bakeRel: "pistol/run-backward", src: "anim/pistol/run-backward.fbx" },
  { bakeRel: "pistol/gunplay", src: "anim/pistol/gunplay.fbx" },
  { bakeRel: "pistol/pistol-jump", src: "anim/pistol/pistol-jump.fbx" },
  { bakeRel: "pistol/strafe-left", src: "anim/pistol/strafe-left.fbx" },
  { bakeRel: "pistol/strafe-right", src: "anim/pistol/strafe-right.fbx" },
  { bakeRel: "pistol/drawing-gun", src: "anim/pistol/drawing-gun.fbx" },
  { bakeRel: "pistol/pistol-whip", src: "anim/pistol/pistol-whip.fbx" },
  { bakeRel: "pistol/charged-pistol", src: "anim/pistol/charged-pistol.fbx" },
  { bakeRel: "pistol/kneeling-idle", src: "anim/pistol/kneeling-idle.fbx" },

  // Farming / harvest (Controller harvest roles)
  { bakeRel: "harvest/dig-and-plant-seeds", src: "anim/farming/dig-and-plant-seeds.fbx" },
  { bakeRel: "harvest/plant-tree", src: "anim/farming/plant-tree.fbx" },
  { bakeRel: "harvest/watering", src: "anim/farming/watering.fbx" },
  { bakeRel: "harvest/pick-fruit", src: "anim/farming/pick-fruit.fbx" },
  { bakeRel: "harvest/pull-plant", src: "anim/farming/pull-plant.fbx" },
  { bakeRel: "harvest/plant-a-plant", src: "anim/farming/plant-a-plant.fbx" },
  { bakeRel: "locomotion/plant_seed", src: "anim/farming/dig-and-plant-seeds.fbx" },

  // Magic loco (strengthen magic pack walk/run from user magic_loco zip)
  { bakeRel: "magic/Standing Walk Forward", src: "anim/magic-loco/standing-walk-forward.fbx" },
  { bakeRel: "magic/Standing Run Forward", src: "anim/magic-loco/standing-run-forward.fbx" },
  { bakeRel: "magic/standing idle", src: "anim/magic-loco/standing-idle.fbx" },

  // 8-way crouch walk (mobility crouchWalk)
  { bakeRel: "locomotion/crouch_walk", src: "anim/loco-8way/walk-crouching-forward.fbx" },
  { bakeRel: "locomotion/idle", src: "anim/loco-8way/idle.fbx" },
  { bakeRel: "locomotion/walk_forward", src: "anim/loco-8way/walk-forward.fbx" },
  { bakeRel: "locomotion/run_forward", src: "anim/loco-8way/run-forward.fbx" },
];

function mapTrackName(trackName) {
  const dot = trackName.lastIndexOf(".");
  if (dot < 0) return null;
  const bone = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  if (prop !== "quaternion") return null;
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
  const man = path.join(OUT_ROOT, "rifle", "manifest.json");
  fs.mkdirSync(path.dirname(man), { recursive: true });
  fs.writeFileSync(
    man,
    JSON.stringify(
      {
        version: 1,
        updated: new Date().toISOString().slice(0, 10),
        skeleton: "Bip001",
        stripPositionTracks: true,
        source: "ingest-anim-packs + bake-gun-farm-loco",
        clips: report.filter((r) => r.ok),
        failed: report.filter((r) => !r.ok),
      },
      null,
      2,
    ),
  );
  const ok = report.filter((r) => r.ok).length;
  const fail = report.filter((r) => !r.ok).length;
  console.log(`\nBake done: ok=${ok} fail=${fail}`);
}

main();

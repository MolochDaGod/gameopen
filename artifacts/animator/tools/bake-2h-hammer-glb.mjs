// ─────────────────────────────────────────────────────────────────────────────
// Bake 2hweaponhammerretarget.glb → rotation-only 2H mace / hammer packs
//   1) Bip001   → public/anims/baked/twohand_hammer/**
//   2) mixamorig → public/anims/baked/twohand_hammer_mixamo/**
//
// Source: Soulcalibur-style custom Bone* hierarchy (Bone4 hips, Bone5–8 spine/head,
// L/R arms + legs). Weapon chain (Bone0/48/1–3) is intentionally skipped — hands
// hold the hammer mesh at runtime.
//
// Run from artifacts/character-viewer:
//   node tools/bake-2h-hammer-glb.mjs
//   node tools/bake-2h-hammer-glb.mjs --target=bip001|mixamo|both
// Env:
//   HAMMER_GLB=D:/Games/Models/2hweaponhammerretarget.glb
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
  if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => "blob:bake-stub";
  if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
}
THREE.TextureLoader.prototype.load = function (u, onLoad) {
  const t = new THREE.Texture();
  if (onLoad) queueMicrotask(() => onLoad(t));
  return t;
};
THREE.ImageLoader.prototype.load = function (u, onLoad) {
  const i = { width: 1, height: 1, data: new Uint8Array(4) };
  if (onLoad) queueMicrotask(() => onLoad(i));
  return i;
};

const PUBLIC = "public";
const BAKED = join(PUBLIC, "anims", "baked");

const HAMMER_GLB =
  process.env.HAMMER_GLB || "D:/Games/Models/2hweaponhammerretarget.glb";

const BIP_TARGET =
  process.env.BIP_TARGET ||
  "public/assets/barbarians/models/characters/BRB_Characters_customizable.FBX";

const MIXAMO_TARGET =
  process.env.MIXAMO_TARGET || "public/anims/action/idle.fbx";

// Source joints from 2hweaponhammerretarget.glb bind pose (Y-up, +X ≈ left).
// Weapon chain Bone0_046 → Bone3_050 is skipped (runtime mesh attach).
const SRC = {
  pelvis: ["Bone4_03", "Bone4"],
  spine: ["Bone5_012", "Bone5"],
  spine1: ["Bone6_013", "Bone6"],
  neck: ["Bone7_029", "Bone7"],
  head: ["Bone8_030", "Bone8"],
  lClav: ["Bone9_014", "Bone9"],
  lArm: ["Bone10_015", "Bone10"],
  lFore: ["Bone11_016", "Bone11"],
  lHand: ["Bone12_019", "Bone12"],
  rClav: ["Bone24_031", "Bone24"],
  rArm: ["Bone25_032", "Bone25"],
  rFore: ["Bone26_033", "Bone26"],
  rHand: ["Bone27_036", "Bone27"],
  lThigh: ["Bone40_05", "Bone40"],
  lCalf: ["Bone41_06", "Bone41"],
  lFoot: ["Bone42_07", "Bone42"],
  lToe: ["Bone43_08", "Bone43"],
  rThigh: ["Bone44_09", "Bone44"],
  rCalf: ["Bone45_00", "Bone45"],
  rFoot: ["Bone46_010", "Bone46"],
  rToe: ["Bone47_011", "Bone47"],
};

const BIP_PAIR_KEYS = {
  Bip001_Pelvis: "pelvis",
  Bip001_Spine: "spine",
  Bip001_Neck: "neck",
  Bip001_Head: "head",
  Bip001_L_Clavicle: "lClav",
  Bip001_L_UpperArm: "lArm",
  Bip001_L_Forearm: "lFore",
  Bip001_L_Hand: "lHand",
  Bip001_R_Clavicle: "rClav",
  Bip001_R_UpperArm: "rArm",
  Bip001_R_Forearm: "rFore",
  Bip001_R_Hand: "rHand",
  Bip001_L_Thigh: "lThigh",
  Bip001_L_Calf: "lCalf",
  Bip001_L_Foot: "lFoot",
  Bip001_L_Toe0: "lToe",
  Bip001_R_Thigh: "rThigh",
  Bip001_R_Calf: "rCalf",
  Bip001_R_Foot: "rFoot",
  Bip001_R_Toe0: "rToe",
};

const MIXAMO_PAIR_KEYS = {
  mixamorigHips: "pelvis",
  mixamorigSpine: "spine",
  mixamorigSpine1: "spine1",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "lClav",
  mixamorigLeftArm: "lArm",
  mixamorigLeftForeArm: "lFore",
  mixamorigLeftHand: "lHand",
  mixamorigRightShoulder: "rClav",
  mixamorigRightArm: "rArm",
  mixamorigRightForeArm: "rFore",
  mixamorigRightHand: "rHand",
  mixamorigLeftUpLeg: "lThigh",
  mixamorigLeftLeg: "lCalf",
  mixamorigLeftFoot: "lFoot",
  mixamorigLeftToeBase: "lToe",
  mixamorigRightUpLeg: "rThigh",
  mixamorigRightLeg: "rCalf",
  mixamorigRightFoot: "rFoot",
  mixamorigRightToeBase: "rToe",
};

const BIP_CHILD = {
  Bip001_Spine: "Bip001_Neck",
  Bip001_Neck: "Bip001_Head",
  Bip001_L_Clavicle: "Bip001_L_UpperArm",
  Bip001_L_UpperArm: "Bip001_L_Forearm",
  Bip001_L_Forearm: "Bip001_L_Hand",
  Bip001_R_Clavicle: "Bip001_R_UpperArm",
  Bip001_R_UpperArm: "Bip001_R_Forearm",
  Bip001_R_Forearm: "Bip001_R_Hand",
  Bip001_L_Thigh: "Bip001_L_Calf",
  Bip001_L_Calf: "Bip001_L_Foot",
  Bip001_R_Thigh: "Bip001_R_Calf",
  Bip001_R_Calf: "Bip001_R_Foot",
};

const MIXAMO_CHILD = {
  mixamorigSpine: "mixamorigNeck",
  mixamorigSpine1: "mixamorigNeck",
  mixamorigNeck: "mixamorigHead",
  mixamorigLeftShoulder: "mixamorigLeftArm",
  mixamorigLeftArm: "mixamorigLeftForeArm",
  mixamorigLeftForeArm: "mixamorigLeftHand",
  mixamorigRightShoulder: "mixamorigRightArm",
  mixamorigRightArm: "mixamorigRightForeArm",
  mixamorigRightForeArm: "mixamorigRightHand",
  mixamorigLeftUpLeg: "mixamorigLeftLeg",
  mixamorigLeftLeg: "mixamorigLeftFoot",
  mixamorigRightUpLeg: "mixamorigRightLeg",
  mixamorigRightLeg: "mixamorigRightFoot",
};

/** SC_SC_* clip → flat role basename under twohand_hammer/ */
const OUT_BASENAME = {
  SC_SC_Idle: "idle",
  SC_SC_Jab: "attack",
  SC_SC_ChargeStrike: "attack-charge",
  "SC_SC_180x2Sweep": "attack-sweep",
  SC_SC_GroundFlinch: "hit",
  SC_SC_StepForward: "step-forward",
  SC_SC_SideStepLeft: "step-left",
  SC_SC_SideStepRight: "step-right",
  SC_SC_BackStep: "backstep",
  SC_SC_Jump_Up: "jump",
  SC_SC_JumpUpQuick: "jump-quick",
  SC_SC_Jump_Down: "land",
  SC_SC_Fall_From_Pilllar: "fall",
  SC_SC_SummonCrows: "skill-summon",
};

// Also alias jab as attack1 for combo wiring
const EXTRA_ALIASES = {
  SC_SC_Jab: ["attack1", "jab"],
  SC_SC_ChargeStrike: ["attack2", "charge"],
  "SC_SC_180x2Sweep": ["attack3", "sweep", "skill"],
  SC_SC_Idle: ["fight_idle"],
  SC_SC_StepForward: ["walk"],
  SC_SC_BackStep: ["dodgeB"],
  SC_SC_Jump_Up: ["jump_up"],
  SC_SC_SummonCrows: ["skill2"],
};

function loadFBX(path) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new FBXLoader().parse(ab, "");
}

async function loadGLB(path) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new GLTFLoader().parseAsync(ab, "");
}

function canonicalBoneMap(group) {
  const map = new Map();
  const q = [...group.children];
  while (q.length) {
    const n = q.shift();
    if (n.isBone && !map.has(n.name)) map.set(n.name, n);
    q.push(...n.children);
  }
  return map;
}

function boneDepth(b) {
  let d = 0,
    cur = b.parent;
  while (cur) {
    if (cur.isBone) d++;
    cur = cur.parent;
  }
  return d;
}

function boneNameVariants(name) {
  const out = new Set([name]);
  out.add(name.replace(/_/g, " "));
  out.add(name.replace(/ /g, "_"));
  if (name.startsWith("mixamorig") && !name.includes(":")) {
    out.add(`mixamorig:${name.slice("mixamorig".length)}`);
  }
  if (name.startsWith("mixamorig:")) {
    out.add(name.replace("mixamorig:", "mixamorig"));
  }
  return [...out];
}

function findBone(bones, name) {
  for (const v of boneNameVariants(name)) {
    if (bones.has(v)) return bones.get(v);
  }
  const stem = name.replace(/_\d+$/, "").replace(/ /g, "_").toLowerCase();
  for (const [k, b] of bones) {
    const ks = k.replace(/_\d+$/, "").replace(/ /g, "_").toLowerCase();
    if (ks === stem) return b;
  }
  return null;
}

function resolveSrcName(srcBones, candidates) {
  for (const c of candidates) {
    const b = findBone(srcBones, c);
    if (b) return b.name;
  }
  return null;
}

function buildPairMap(srcBones, keyMap) {
  const pair = {};
  for (const [tgt, key] of Object.entries(keyMap)) {
    const srcName = resolveSrcName(srcBones, SRC[key] ?? []);
    if (srcName) pair[tgt] = srcName;
  }
  return pair;
}

function retarget(srcRoot, clip, targetRoot, pairMap, childMap) {
  srcRoot.updateMatrixWorld(true);
  targetRoot.updateMatrixWorld(true);
  const srcBones = canonicalBoneMap(srcRoot);
  const tgtBones = canonicalBoneMap(targetRoot);

  const srcBindWorld = new Map();
  const srcBindPos = new Map();
  srcBones.forEach((b, name) => {
    srcBindWorld.set(name, b.getWorldQuaternion(new THREE.Quaternion()));
    srcBindPos.set(name, b.getWorldPosition(new THREE.Vector3()));
  });

  const tgtBindWorld = new Map();
  const tgtBindLocal = new Map();
  const tgtBindPos = new Map();
  tgtBones.forEach((b, name) => {
    tgtBindWorld.set(name, b.getWorldQuaternion(new THREE.Quaternion()));
    tgtBindLocal.set(name, b.quaternion.clone());
    tgtBindPos.set(name, b.getWorldPosition(new THREE.Vector3()));
  });

  function resetTarget() {
    tgtBones.forEach((b, name) => b.quaternion.copy(tgtBindLocal.get(name)));
    targetRoot.updateMatrixWorld(true);
  }

  const srcInterp = new Map();
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf(".");
    if (dot < 0 || t.name.slice(dot + 1) !== "quaternion") continue;
    srcInterp.set(t.name.slice(0, dot), t.createInterpolant());
  }

  const pairs = [];
  for (const [tgtName, srcName] of Object.entries(pairMap)) {
    const tgt = findBone(tgtBones, tgtName);
    const src = findBone(srcBones, srcName);
    if (!tgt || !src) continue;
    const sBind = srcBindWorld.get(src.name);
    const tBind = tgtBindWorld.get(tgt.name);
    if (!sBind || !tBind) continue;

    const qFix = new THREE.Quaternion();
    const tChildName = childMap[tgtName];
    const sChildName = tChildName ? pairMap[tChildName] : null;
    if (tChildName && sChildName) {
      const tChild = findBone(tgtBones, tChildName);
      const sChild = findBone(srcBones, sChildName);
      if (tChild && sChild) {
        const tDir = tgtBindPos.get(tChild.name)?.clone().sub(tgtBindPos.get(tgt.name));
        const sDir = srcBindPos.get(sChild.name)?.clone().sub(srcBindPos.get(src.name));
        if (tDir && sDir && tDir.lengthSq() > 1e-8 && sDir.lengthSq() > 1e-8) {
          qFix.setFromUnitVectors(tDir.normalize(), sDir.normalize());
        }
      }
    }
    pairs.push({
      tgt,
      src,
      sBindInv: sBind.clone().invert(),
      qFix,
      tBind,
    });
  }
  pairs.sort((a, b) => boneDepth(a.tgt) - boneDepth(b.tgt));
  if (!pairs.length) return { clip: null, pairs: 0, frames: 0, moving: false };

  const fps = 30;
  const numFrames = Math.max(2, Math.round(clip.duration * fps));
  const dt = clip.duration / (numFrames - 1);
  const times = new Float32Array(numFrames);
  const quats = pairs.map(() => new Float32Array(numFrames * 4));
  const qWorld = new THREE.Quaternion();
  const qParInv = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const srcCur = new THREE.Quaternion();
  resetTarget();

  for (let f = 0; f < numFrames; f++) {
    const t = f * dt;
    times[f] = t;
    for (const [name, interp] of srcInterp) {
      const b = srcBones.get(name);
      if (!b) continue;
      interp.evaluate(t);
      const r = interp.resultBuffer;
      b.quaternion.set(r[0], r[1], r[2], r[3]);
    }
    srcRoot.updateMatrixWorld(true);
    for (let i = 0; i < pairs.length; i++) {
      const { tgt, src, sBindInv, qFix, tBind } = pairs[i];
      src.getWorldQuaternion(srcCur);
      qWorld.copy(srcCur).multiply(sBindInv).multiply(qFix).multiply(tBind);
      if (tgt.parent) {
        tgt.parent.getWorldQuaternion(qParInv).invert();
        qLocal.copy(qParInv).multiply(qWorld);
      } else {
        qLocal.copy(qWorld);
      }
      tgt.quaternion.copy(qLocal);
      tgt.updateMatrixWorld(true);
      quats[i][f * 4] = qLocal.x;
      quats[i][f * 4 + 1] = qLocal.y;
      quats[i][f * 4 + 2] = qLocal.z;
      quats[i][f * 4 + 3] = qLocal.w;
    }
  }
  resetTarget();

  // Prefer space-separated Bip001 track names (live FBX skin often uses spaces).
  const tracks = pairs.map((p, i) => {
    let name = p.tgt.name;
    if (name.startsWith("Bip001_")) name = name.replace(/_/g, " ");
    return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, quats[i]);
  });
  const out = new THREE.AnimationClip(clip.name || "clip", clip.duration, tracks);
  let moving = false;
  if (quats.length) {
    const a = quats[0].slice(0, 4);
    const m = quats[0].slice((numFrames >> 1) * 4, (numFrames >> 1) * 4 + 4);
    moving = a.some((v, k) => Math.abs(v - m[k]) > 1e-3);
  }
  return { clip: out, pairs: pairs.length, frames: numFrames, moving };
}

const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith("--target="));
const targetMode = (targetArg?.slice("--target=".length) || "both").toLowerCase();

console.log(`[2h-hammer] source ${HAMMER_GLB}`);
if (!existsSync(HAMMER_GLB)) {
  console.error(`[2h-hammer] missing ${HAMMER_GLB}`);
  process.exit(1);
}

const gltf = await loadGLB(HAMMER_GLB);
const srcRoot = gltf.scene;
const clipsByName = new Map(gltf.animations.map((c) => [c.name, c]));
const srcBones0 = canonicalBoneMap(srcRoot);
console.log(
  `[2h-hammer] ${gltf.animations.length} clips; hips/spine sample:`,
  [...srcBones0.keys()].filter((n) => /^Bone(4|5|6|7|8|9|10|24|25|40|44)_/.test(n)).join(" | "),
);

const jobs = [];
if (targetMode === "bip001" || targetMode === "both") {
  if (!existsSync(BIP_TARGET)) {
    console.error(`[2h-hammer] missing ${BIP_TARGET}`);
    process.exit(1);
  }
  jobs.push({
    label: "bip001",
    root: loadFBX(BIP_TARGET),
    pairMap: buildPairMap(srcBones0, BIP_PAIR_KEYS),
    childMap: BIP_CHILD,
    outPrefix: "twohand_hammer",
  });
}
if (targetMode === "mixamo" || targetMode === "both") {
  if (!existsSync(MIXAMO_TARGET)) {
    console.error(`[2h-hammer] missing ${MIXAMO_TARGET}`);
    process.exit(1);
  }
  jobs.push({
    label: "mixamo",
    root: loadFBX(MIXAMO_TARGET),
    pairMap: buildPairMap(srcBones0, MIXAMO_PAIR_KEYS),
    childMap: MIXAMO_CHILD,
    outPrefix: "twohand_hammer_mixamo",
  });
}

let ok = 0,
  failed = 0,
  missing = 0;

for (const job of jobs) {
  console.log(`\n[2h-hammer] ── ${job.label} pairs=${Object.keys(job.pairMap).length} ──`);
  console.log(
    `[2h-hammer] map:`,
    Object.entries(job.pairMap)
      .map(([t, s]) => `${t}←${s}`)
      .join(", "),
  );
  for (const [clipName, base] of Object.entries(OUT_BASENAME)) {
    const srcClip = clipsByName.get(clipName);
    if (!srcClip) {
      missing++;
      console.warn(`[2h-hammer] missing clip ${clipName}`);
      continue;
    }
    try {
      const { clip: baked, pairs, frames, moving } = retarget(
        srcRoot,
        srcClip,
        job.root,
        job.pairMap,
        job.childMap,
      );
      if (!baked || pairs < 10) {
        failed++;
        console.warn(`[2h-hammer] ✗ ${clipName} pairs=${pairs}`);
        continue;
      }
      const names = [base, ...(EXTRA_ALIASES[clipName] ?? [])];
      const json = JSON.stringify(THREE.AnimationClip.toJSON(baked));
      for (const role of names) {
        const rel = join(job.outPrefix, `${role}.json`);
        const outPath = join(BAKED, rel);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, json);
        ok++;
        console.log(
          `[2h-hammer] ✓ ${rel} pairs=${pairs} frames=${frames} motion=${moving ? "Y" : "n"} dur=${srcClip.duration.toFixed(2)}s`,
        );
      }
    } catch (e) {
      failed++;
      console.error(`[2h-hammer] ✗ ${clipName}: ${e.message}`);
    }
  }
}

console.log(`\n[2h-hammer] done: ${ok} files written, ${missing} missing clips, ${failed} failed`);
if (ok === 0) process.exit(1);

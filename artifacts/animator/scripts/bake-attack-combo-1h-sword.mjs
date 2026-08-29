/**
 * Bake Kassimkot Sketchfab Attack Combo packs → Bip001 rotation-only JSON
 * for 1H sword (sword_shield pack).
 *
 * Sources (already in public/anim/combo/):
 *   melee-combo-1.glb  → anim name "Attack Combo"     (AttackCombo01)
 *   melee-combo-2.glb  → anim name "Attack Combo 2"   (strong follow-up)
 *
 * Sketchfab:
 *   https://sketchfab.com/3d-models/attackcombo01-578057e0f49e448eaf0a9758676ecf59
 *   https://sketchfab.com/3d-models/attack-combo-2-66bbad5ffe1940c088451a2e56c288a1
 *
 * Rig: mixamorig:<Bone>_<NN> (suffix Mixamo export) → Bip001 core 22.
 * Policy: quaternion only · strip position/scale (hip Y/XZ owned by controller).
 *
 * Usage (artifacts/animator):
 *   node scripts/bake-attack-combo-1h-sword.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "anims/baked/sword_shield");
const COMBO_DIR = path.join(PUBLIC, "anim/combo");

/** Bare Mixamo bone → Bip001 (grudge6). */
const BARE_TO_BIP001 = {
  Hips: "Bip001 Pelvis",
  Spine: "Bip001 Spine",
  Spine1: "Bip001 Spine1",
  Spine2: "Bip001 Spine2",
  Neck: "Bip001 Neck",
  Head: "Bip001 Head",
  LeftShoulder: "Bip001 L Clavicle",
  LeftArm: "Bip001 L UpperArm",
  LeftForeArm: "Bip001 L Forearm",
  LeftHand: "Bip001 L Hand",
  RightShoulder: "Bip001 R Clavicle",
  RightArm: "Bip001 R UpperArm",
  RightForeArm: "Bip001 R Forearm",
  RightHand: "Bip001 R Hand",
  LeftUpLeg: "Bip001 L Thigh",
  LeftLeg: "Bip001 L Calf",
  LeftFoot: "Bip001 L Foot",
  LeftToeBase: "Bip001 L Toe0",
  RightUpLeg: "Bip001 R Thigh",
  RightLeg: "Bip001 R Calf",
  RightFoot: "Bip001 R Foot",
  RightToeBase: "Bip001 R Toe0",
};

/**
 * Output role → source file + optional trim (seconds from start).
 * Combo-01 has a ~1s wind-up; we strip it on the primary attack role
 * (matches explorer loader CLIP_TRIM_SECONDS for melee-combo-1).
 */
const TARGETS = [
  {
    role: "attack-combo-01",
    file: "melee-combo-1.glb",
    sourceClipHint: "Attack Combo",
    trimStart: 0,
    sketchfab: "attackcombo01-578057e0f49e448eaf0a9758676ecf59",
  },
  {
    role: "attack-combo-01-trimmed",
    file: "melee-combo-1.glb",
    sourceClipHint: "Attack Combo",
    trimStart: 1,
    sketchfab: "attackcombo01-578057e0f49e448eaf0a9758676ecf59",
  },
  {
    role: "attack",
    file: "melee-combo-1.glb",
    sourceClipHint: "Attack Combo",
    trimStart: 1,
    sketchfab: "attackcombo01-578057e0f49e448eaf0a9758676ecf59",
  },
  {
    role: "attack1",
    file: "melee-combo-1.glb",
    sourceClipHint: "Attack Combo",
    trimStart: 1,
    sketchfab: "attackcombo01-578057e0f49e448eaf0a9758676ecf59",
  },
  {
    role: "attack-combo-02",
    file: "melee-combo-2.glb",
    sourceClipHint: "Attack Combo 2",
    trimStart: 0,
    sketchfab: "attack-combo-2-66bbad5ffe1940c088451a2e56c288a1",
  },
  {
    role: "attack2",
    file: "melee-combo-2.glb",
    sourceClipHint: "Attack Combo 2",
    trimStart: 0,
    sketchfab: "attack-combo-2-66bbad5ffe1940c088451a2e56c288a1",
  },
  {
    role: "skill",
    file: "melee-combo-2.glb",
    sourceClipHint: "Attack Combo 2",
    trimStart: 0,
    sketchfab: "attack-combo-2-66bbad5ffe1940c088451a2e56c288a1",
  },
];

function parseGlb(buf) {
  if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("Not a GLB");
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32LE(offset);
    const type = buf.toString("utf8", offset + 4, offset + 8);
    offset += 8;
    const chunk = buf.subarray(offset, offset + len);
    offset += len;
    if (type.startsWith("JSON")) json = JSON.parse(chunk.toString("utf8"));
    else if (type.startsWith("BIN")) bin = chunk;
  }
  if (!json || !bin) throw new Error("GLB missing JSON/BIN");
  return { json, bin };
}

function readAccessor(json, bin, accIndex) {
  const acc = json.accessors[accIndex];
  const bv = json.bufferViews[acc.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] || 1;
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  if (acc.componentType !== 5126) {
    throw new Error(`Unsupported componentType ${acc.componentType}`);
  }
  const arr = new Float32Array(
    bin.buffer,
    bin.byteOffset + byteOffset,
    acc.count * comps,
  );
  return { count: acc.count, comps, values: arr };
}

/** mixamorig:Hips_02 → Hips */
function bareBoneName(nodeName) {
  if (!nodeName) return null;
  let n = String(nodeName);
  n = n.replace(/^mixamorig:/i, "").replace(/^mixamorig/i, "");
  n = n.replace(/_\d+$/, "");
  return n || null;
}

function mapNodeToBip(nodeName) {
  const bare = bareBoneName(nodeName);
  if (!bare) return null;
  return BARE_TO_BIP001[bare] || null;
}

/**
 * Slice track times/values to start at trimStart seconds; re-zero times.
 */
function trimTrack(times, values, comps, trimStart) {
  if (!(trimStart > 0) || !times.length) {
    return { times: Array.from(times), values: Array.from(values) };
  }
  let i0 = 0;
  while (i0 < times.length && times[i0] < trimStart) i0++;
  if (i0 >= times.length) {
    // all before trim — keep last key
    i0 = times.length - 1;
  }
  const tOut = [];
  const vOut = [];
  for (let i = i0; i < times.length; i++) {
    tOut.push(Math.max(0, times[i] - trimStart));
    for (let c = 0; c < comps; c++) vOut.push(values[i * comps + c]);
  }
  if (!tOut.length) {
    tOut.push(0);
    for (let c = 0; c < comps; c++) vOut.push(values[(times.length - 1) * comps + c]);
  }
  return { times: tOut, values: vOut };
}

function bakeAnimation(json, bin, anim, trimStart = 0) {
  const tracks = [];
  let duration = 0;
  const nodes = json.nodes;

  for (const ch of anim.channels) {
    if (ch.target.path !== "rotation") continue;
    const nodeName = nodes[ch.target.node]?.name;
    const bip = mapNodeToBip(nodeName);
    if (!bip) continue;

    const sampler = anim.samplers[ch.sampler];
    const timesAcc = readAccessor(json, bin, sampler.input);
    const valsAcc = readAccessor(json, bin, sampler.output);
    const trimmed = trimTrack(
      timesAcc.values,
      valsAcc.values,
      valsAcc.comps,
      trimStart,
    );
    if (!trimmed.times.length) continue;
    duration = Math.max(duration, trimmed.times[trimmed.times.length - 1] || 0);

    tracks.push({
      name: `${bip}.quaternion`,
      type: "quaternion",
      times: trimmed.times,
      values: trimmed.values,
    });
  }

  const byName = new Map();
  for (const t of tracks) byName.set(t.name, t);

  return {
    name: anim.name,
    duration: duration || 0.01,
    tracks: [...byName.values()],
  };
}

function pickAnim(json, hint) {
  const anims = json.animations || [];
  if (!anims.length) return null;
  if (hint) {
    const exact = anims.find((a) => a.name === hint);
    if (exact) return exact;
    const soft = anims.find((a) =>
      String(a.name || "")
        .toLowerCase()
        .includes(String(hint).toLowerCase().replace(/\s+/g, "")),
    );
    if (soft) return soft;
  }
  return anims[0];
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const glbCache = new Map();
  const report = [];

  for (const t of TARGETS) {
    const srcAbs = path.join(COMBO_DIR, t.file);
    if (!fs.existsSync(srcAbs)) {
      console.warn(`MISS ${t.file}`);
      report.push({ role: t.role, ok: false, reason: "missing source" });
      continue;
    }
    try {
      let parsed = glbCache.get(t.file);
      if (!parsed) {
        const buf = fs.readFileSync(srcAbs);
        parsed = parseGlb(buf);
        glbCache.set(t.file, parsed);
        console.log(
          `Loaded ${t.file} anims=${parsed.json.animations?.length} nodes=${parsed.json.nodes?.length}`,
        );
      }
      const anim = pickAnim(parsed.json, t.sourceClipHint);
      if (!anim) throw new Error("no animation in GLB");
      const baked = bakeAnimation(parsed.json, parsed.bin, anim, t.trimStart || 0);
      if (baked.tracks.length < 8) {
        throw new Error(`too few tracks (${baked.tracks.length})`);
      }
      const payload = {
        name: `sword_shield/${t.role}`,
        duration: baked.duration,
        tracks: baked.tracks,
        meta: {
          source: t.file,
          sourceClip: anim.name,
          sketchfab: t.sketchfab,
          skeleton: "Bip001",
          stripPositionTracks: true,
          stripScaleTracks: true,
          hipPolicy: "controller-owns-y-xz",
          trimStart: t.trimStart || 0,
          handBones: ["Bip001 L Hand", "Bip001 R Hand"],
          purpose: "1H sword AttackCombo01 / Attack Combo 2",
        },
      };
      const outPath = path.join(OUT, `${t.role}.json`);
      fs.writeFileSync(outPath, JSON.stringify(payload));
      const sha = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex")
        .slice(0, 12);
      console.log(
        `  OK ${t.role}.json ← ${anim.name} trim=${t.trimStart || 0}s dur=${baked.duration.toFixed(3)} tracks=${baked.tracks.length} sha=${sha}`,
      );
      report.push({
        role: t.role,
        ok: true,
        source: t.file,
        sourceClip: anim.name,
        duration: baked.duration,
        tracks: baked.tracks.length,
        trimStart: t.trimStart || 0,
      });
    } catch (e) {
      console.error(`FAIL ${t.role}:`, e.message);
      report.push({ role: t.role, ok: false, reason: e.message });
    }
  }

  // Keep existing thin sword_shield clips; only document new combo roles.
  const manifestPath = path.join(OUT, "attack-combo-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        updated: new Date().toISOString().slice(0, 10),
        skeleton: "Bip001",
        sources: {
          "attack-combo-01": {
            file: "anim/combo/melee-combo-1.glb",
            sketchfab:
              "https://sketchfab.com/3d-models/attackcombo01-578057e0f49e448eaf0a9758676ecf59",
            note: "quick Attack Combo (Kassimkot)",
          },
          "attack-combo-02": {
            file: "anim/combo/melee-combo-2.glb",
            sketchfab:
              "https://sketchfab.com/3d-models/attack-combo-2-66bbad5ffe1940c088451a2e56c288a1",
            note: "strong Attack Combo 2 (Kassimkot)",
          },
        },
        policy: {
          rotationOnly: true,
          hipYxz: "controller",
          primaryAttack: "attack / attack1 ← attack-combo-01 trimmed 1s",
          strongAttack: "attack2 / skill ← attack-combo-02 full",
        },
        roles: report.filter((r) => r.ok),
        missing: report.filter((r) => !r.ok),
      },
      null,
      2,
    ),
  );

  // Also stage copies under anim/imported for importClip Studio path
  const importedDir = path.join(PUBLIC, "anim/imported");
  fs.mkdirSync(importedDir, { recursive: true });
  for (const [dst, src] of [
    ["attack-combo-01.glb", "melee-combo-1.glb"],
    ["attack-combo-02.glb", "melee-combo-2.glb"],
  ]) {
    const from = path.join(COMBO_DIR, src);
    const to = path.join(importedDir, dst);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log(`Staged imported/${dst}`);
    }
  }

  const ok = report.filter((r) => r.ok).length;
  const bad = report.filter((r) => !r.ok).length;
  console.log(`\nBaked ${ok} · failed ${bad} → ${OUT}`);
  if (ok < 4) process.exit(1);
}

main();

/**
 * Bake dual_wieldingandothers.glb (custom Bone* hierarchy) → Bip001 rotation-only
 * JSON under public/anims/baked/dual_wield/ for grudge6 + Explorer (via rematch).
 *
 * Policy (fleet SSOT):
 *  - Quaternion tracks only — strip ALL position/scale (hip Y/XZ owned by controller)
 *  - Map custom bones → Bip001 core 22
 *  - Hands: Bip001 L/R Hand (weapon sockets attach separately on containers)
 *  - No root translation — prevents 0.4–3.0 m hip float on SwordLunge etc.
 *
 * Usage (artifacts/animator):
 *   node scripts/bake-dual-wield-glb.mjs
 *   DUAL_WIELD_GLB=D:/Games/Models/dual\ wieldingandothers.glb node scripts/bake-dual-wield-glb.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC =
  process.env.DUAL_WIELD_GLB ||
  "D:/Games/Models/dual wieldingandothers.glb";
const OUT = path.join(ROOT, "public/anims/baked/dual_wield");
const STAGE = path.join(ROOT, "public/models/source/dual_wieldingandothers.glb");

/**
 * Source joint name → Bip001 (grudge6 / fleet bake SSOT).
 * Derived from rest-pose hierarchy in dual wieldingandothers.glb.
 */
const SOURCE_TO_BIP001 = {
  Bone0_09: "Bip001 Pelvis",
  Bone40_00: "Bip001 Spine",
  Bone38_019: "Bip001 Spine1",
  Bone39_020: "Bip001 Spine2",
  Bone26_032: "Bip001 Neck",
  Bone52_033: "Bip001 Head",
  // Left arm (+X)
  Bone37_021: "Bip001 L Clavicle",
  Bone36_022: "Bip001 L UpperArm",
  Bone10_023: "Bip001 L Forearm",
  Bone11_025: "Bip001 L Hand",
  // Right arm (-X)
  Bone6_035: "Bip001 R Clavicle",
  Bone7_036: "Bip001 R UpperArm",
  Bone17_037: "Bip001 R Forearm",
  Bone18_039: "Bip001 R Hand",
  // Left leg (+X)
  Bone28_011: "Bip001 L Thigh",
  Bone29_012: "Bip001 L Calf",
  Bone30_013: "Bip001 L Foot",
  Bone31_014: "Bip001 L Toe0",
  // Right leg (-X)
  Bone32_015: "Bip001 R Thigh",
  Bone33_016: "Bip001 R Calf",
  Bone34_017: "Bip001 R Foot",
  Bone35_018: "Bip001 R Toe0",
};

/**
 * Clip selection for melee dash / attacks / take-hit / mobility.
 * role → source anim name (exact match on GLB animation.name)
 */
const ROLE_MAP = {
  // Melee dash / lunge (MM)
  sword_dash_attack: "PC_B_SwordLungeFwd",
  dash: "PC_B_SwordLungeFwd",
  // Attacks
  attack: "PC_B_SwordSlash",
  attack2: "PC_B_SwordSlash2",
  attack3: "PC_B_SwordSlice",
  attack4: "PC_B_SwordSlice2",
  attack5: "PC_B_SwordUppercut",
  skill1: "PC_B_SwordLungeFwd",
  skill2: "PC_B_SliceDice",
  skill3: "PC_B_Windmill",
  skill4: "PC_B_Figure_Eight",
  overhead: "PC_B_SwordUppercut",
  slash: "PC_B_SwordSlash",
  thrust: "PC_B_SwordLungeFwd",
  special: "PC_B_DefendStrike",
  combo: "PC_B_SwordSlash2",
  // Take hit / death
  hurt: "PC_B_Flinch",
  hit: "PC_B_Flinch",
  flinch: "PC_B_Flinch",
  airFlinch: "PC_B_AirFlinch",
  hitfly: "PC_GR_KnockDown",
  death: "PC_B_LargeDeath",
  death2: "PC_B_SmallDeath",
  // Dodge / roll (not used as walk/run)
  dodgeF: "PC_B_Rollforward",
  dodgeB: "PC_B_Rollback",
  dodgeL: "PC_B_RollLeft",
  dodgeR: "PC_B_RollRight",
  // Kicks / extra melee
  kick: "PC_B_RoundhouseKick",
  kick2: "PC_B_DoubleKick",
  flyingKick: "PC_B_FlyingKick1",
  // Block
  block: "PC_B_BlockStanceLoop",
  // Optional loco (rotation-only cycles — hip strip keeps feet grounded)
  idle: "PC_B_Idle",
  walk: "PC_B_Walk",
  run: "PC_B_Run",
  jump: "PC_B_Jump1",
};

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

function bakeAnimation(json, bin, anim) {
  const tracks = [];
  let duration = 0;
  const nodes = json.nodes;

  for (const ch of anim.channels) {
    if (ch.target.path !== "rotation") continue; // rotation-only (Y hip / XZ stripped)
    const nodeName = nodes[ch.target.node]?.name;
    const bip = SOURCE_TO_BIP001[nodeName];
    if (!bip) continue;

    const sampler = anim.samplers[ch.sampler];
    const timesAcc = readAccessor(json, bin, sampler.input);
    const valsAcc = readAccessor(json, bin, sampler.output);
    const times = Array.from(timesAcc.values);
    const values = Array.from(valsAcc.values);
    if (!times.length) continue;
    duration = Math.max(duration, times[times.length - 1] || 0);

    tracks.push({
      name: `${bip}.quaternion`,
      type: "quaternion",
      times,
      values,
    });
  }

  // Dedupe by bone (last wins)
  const byName = new Map();
  for (const t of tracks) byName.set(t.name, t);

  return {
    name: anim.name,
    duration: duration || 0.01,
    tracks: [...byName.values()],
  };
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source missing:", SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(STAGE), { recursive: true });
  // Stage a copy for repo/docs (optional — may be gitignored by size)
  try {
    fs.copyFileSync(SRC, STAGE);
    console.log("Staged", STAGE);
  } catch (e) {
    console.warn("Stage copy skipped", e.message);
  }

  const buf = fs.readFileSync(SRC);
  const { json, bin } = parseGlb(buf);
  const byName = new Map((json.animations || []).map((a) => [a.name, a]));
  console.log(
    `Source anims=${json.animations?.length} skins=${json.skins?.length} mapped bones=${Object.keys(SOURCE_TO_BIP001).length}`,
  );

  const report = [];
  const written = new Set();

  for (const [role, srcName] of Object.entries(ROLE_MAP)) {
    const anim = byName.get(srcName);
    if (!anim) {
      console.warn(`  MISS anim ${srcName} → ${role}`);
      report.push({ role, src: srcName, ok: false, reason: "missing anim" });
      continue;
    }
    const baked = bakeAnimation(json, bin, anim);
    if (baked.tracks.length < 8) {
      console.warn(`  WEAK ${role} tracks=${baked.tracks.length}`);
      report.push({ role, src: srcName, ok: false, reason: "few tracks" });
      continue;
    }
    const payload = {
      name: `dual_wield/${role}`,
      duration: baked.duration,
      tracks: baked.tracks,
      meta: {
        source: "dual_wieldingandothers.glb",
        sourceClip: srcName,
        skeleton: "Bip001",
        stripPositionTracks: true,
        stripScaleTracks: true,
        hipPolicy: "controller-owns-y-xz",
        handBones: ["Bip001 L Hand", "Bip001 R Hand"],
      },
    };
    const outPath = path.join(OUT, `${role}.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload));
    written.add(role);
    const sha = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 12);
    console.log(
      `  OK ${role}.json ← ${srcName}  dur=${baked.duration.toFixed(3)} tracks=${baked.tracks.length} sha=${sha}`,
    );
    report.push({
      role,
      src: srcName,
      ok: true,
      duration: baked.duration,
      tracks: baked.tracks.length,
      file: `dual_wield/${role}.json`,
    });
  }

  const manifest = {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    source: path.basename(SRC),
    skeleton: "Bip001",
    policy: {
      rotationOnly: true,
      hipYxz: "controller",
      hands: "Bip001 L/R Hand",
      rematch: "rematchClipToSkeleton on grudge6 + Explorer",
    },
    boneMap: SOURCE_TO_BIP001,
    roles: report.filter((r) => r.ok),
    missing: report.filter((r) => !r.ok),
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${written.size} clips → ${OUT}`);
  if (written.size < 10) process.exit(1);
}

main();

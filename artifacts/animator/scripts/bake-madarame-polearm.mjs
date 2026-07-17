/**
 * Bake ikkaku_madarame.glb → rotation-only Bip001 clips for grudge6 spear / 2H.
 *
 * Source is already Bip001 (Noesis export with `_N` bone suffixes). We:
 *  1. Strip numeric suffixes → canonical "Bip001 Pelvis" names
 *  2. Keep only the 20-bone core used by arena baked packs
 *  3. Export quaternion tracks only (controller owns root XYZ)
 *  4. Map combat names → polearm pack roles
 *
 * Usage (from artifacts/animator):
 *   node scripts/bake-madarame-polearm.mjs
 *
 * Out: public/anims/baked/polearm/*.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC =
  process.env.MADARAME_GLB ||
  path.join(ROOT, "content/source-anims/ikkaku_madarame.glb");
const OUT = path.join(ROOT, "public/anims/baked/polearm");

/** Bones kept — matches sword_shield / magic baked packs on arena. */
const KEEP_BONES = new Set([
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Spine1",
  "Bip001 Spine2",
  "Bip001 Neck",
  "Bip001 Head",
  "Bip001 L Clavicle",
  "Bip001 L UpperArm",
  "Bip001 L Forearm",
  "Bip001 L Hand",
  "Bip001 R Clavicle",
  "Bip001 R UpperArm",
  "Bip001 R Forearm",
  "Bip001 R Hand",
  "Bip001 L Thigh",
  "Bip001 L Calf",
  "Bip001 L Foot",
  "Bip001 L Toe0",
  "Bip001 R Thigh",
  "Bip001 R Calf",
  "Bip001 R Foot",
  "Bip001 R Toe0",
]);

/**
 * Madarame clip → polearm role names written under public/anims/baked/polearm/
 * (file base without .json). Multiple roles may share one source clip.
 */
const CLIP_MAP = {
  idle: "idle",
  move: "walk",
  // Combo chain → attack variants + primary attack
  attack1_1: "attack",
  attack1_2: "attack2",
  attack1_3: "attack3",
  attack1_4: "attack4",
  attack1_5: "attack5",
  // Skills → hotbar / weapon skill slots
  skill1_1: "skill1",
  skill1_1_loop: "skill1_loop",
  skill2_1: "skill2",
  skill2_1_loop: "skill2_loop",
  skill3_1: "skill3",
  skill4: "skill4",
  skill6_1: "skill6",
  skill6_1_loop: "skill6_loop",
  // Utility
  hit: "hurt",
  die: "death",
  bankai: "special",
  win: "win",
  switch: "switch",
  debut: "debut",
  dizzy: "dizzy",
  hitback: "hitback",
  hitdown: "hitdown",
  hitfly: "hitfly",
  hitkneel: "hitkneel",
};

/** Alias roles that re-use a primary file for locomotion/sprint fallbacks. */
const ALIASES = {
  // No dedicated run in source — clone walk as run/sprint base (runtime can speed up)
  run: "walk",
  sprint: "walk",
  // Combo skill keys used by T0 / weaponSkillPacks
  combo: "attack",
  thrust: "attack",
  slash: "attack2",
  overhead: "attack3",
  special: "special",
  power: "skill4",
  cast: "skill1",
  skill: "skill1",
  skill1: "skill1",
  skill2: "skill2",
  skill3: "skill3",
  skill4: "skill4",
};

function parseGlb(buf) {
  const magic = buf.toString("utf8", 0, 4);
  if (magic !== "glTF") throw new Error(`Not glTF: ${magic}`);
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
  // FLOAT only for anim data we care about
  if (acc.componentType !== 5126) {
    throw new Error(`Unsupported componentType ${acc.componentType} on accessor ${accIndex}`);
  }
  const arr = new Float32Array(
    bin.buffer,
    bin.byteOffset + byteOffset,
    acc.count * comps,
  );
  return { count: acc.count, comps, values: arr };
}

/** Strip Noesis `_N` suffix and normalize to spaced Bip001 names. */
function canonicalizeBone(name) {
  if (!name) return null;
  let n = String(name).trim();
  // drop trailing _digits (Noesis)
  n = n.replace(/_\d+$/, "");
  // underscores → spaces for Bip001 body parts (keep Bip001 prefix)
  if (/^Bip001[_ ]/i.test(n)) {
    n = n.replace(/^Bip001[_ ]?/i, "Bip001 ");
    n = n.replace(/_/g, " ");
    n = n.replace(/\s+/g, " ").trim();
  }
  // Root bone alone
  if (n === "Bip001" || n === "Bip001 37") return null; // skip root — controller owns root
  if (!n.startsWith("Bip001 ")) return null;
  // Drop fingers / props / face
  if (/Finger|Prop|head_|eye|mouth|weapon|lweapon/i.test(n)) return null;
  if (!KEEP_BONES.has(n)) {
    // Allow Spine1/2 even if not in core 20 of some packs
    if (!/^Bip001 Spine\d?$/i.test(n) && !KEEP_BONES.has(n)) return null;
  }
  return n;
}

function bakeAnimation(json, bin, anim) {
  const tracks = [];
  let duration = 0;

  for (const ch of anim.channels) {
    const path = ch.target.path; // rotation | translation | scale
    if (path !== "rotation") continue; // rotation-only bake
    const nodeName = json.nodes[ch.target.node]?.name;
    const bone = canonicalizeBone(nodeName);
    if (!bone) continue;

    const sampler = anim.samplers[ch.sampler];
    const timesAcc = readAccessor(json, bin, sampler.input);
    const valsAcc = readAccessor(json, bin, sampler.output);
    const times = Array.from(timesAcc.values);
    // glTF quaternions are XYZW
    const values = Array.from(valsAcc.values);
    if (times.length === 0) continue;
    duration = Math.max(duration, times[times.length - 1] || 0);

    tracks.push({
      name: `${bone}.quaternion`,
      type: "quaternion",
      times,
      values,
    });
  }

  // Prefer unique bone tracks (last wins if duplicates)
  const byName = new Map();
  for (const t of tracks) byName.set(t.name, t);

  return {
    name: anim.name,
    duration: duration || 0.01,
    tracks: [...byName.values()],
    blendMode: 2500, // THREE.NormalAnimationBlendMode
  };
}

function writeClip(role, clipJson) {
  const outPath = path.join(OUT, `${role}.json`);
  const payload = {
    name: `polearm/${role}`,
    duration: clipJson.duration,
    tracks: clipJson.tracks,
    // THREE.AnimationClip.parse expects uuid optional
  };
  fs.writeFileSync(outPath, JSON.stringify(payload));
  return { role, duration: clipJson.duration, tracks: clipJson.tracks.length, file: outPath };
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source missing: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const buf = fs.readFileSync(SRC);
  const { json, bin } = parseGlb(buf);
  console.log(
    `Source: ${SRC}\n  anims=${json.animations?.length} nodes=${json.nodes?.length}`,
  );

  const bySourceName = new Map();
  for (const anim of json.animations || []) {
    bySourceName.set(anim.name, bakeAnimation(json, bin, anim));
  }

  const report = [];
  const written = new Set();

  for (const [srcName, role] of Object.entries(CLIP_MAP)) {
    const baked = bySourceName.get(srcName);
    if (!baked || baked.tracks.length < 4) {
      console.warn(`  skip ${srcName} → ${role} (tracks=${baked?.tracks?.length ?? 0})`);
      continue;
    }
    report.push(writeClip(role, baked));
    written.add(role);
    console.log(
      `  ${srcName} → ${role}.json  dur=${baked.duration.toFixed(3)} tracks=${baked.tracks.length}`,
    );
  }

  // Aliases as copies (so loadBakedClip("polearm/run") works)
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (written.has(alias)) continue;
    const srcFile = path.join(OUT, `${target}.json`);
    if (!fs.existsSync(srcFile)) {
      console.warn(`  alias skip ${alias} → ${target} (missing)`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(srcFile, "utf8"));
    data.name = `polearm/${alias}`;
    fs.writeFileSync(path.join(OUT, `${alias}.json`), JSON.stringify(data));
    written.add(alias);
    console.log(`  alias ${alias} → ${target}`);
  }

  // Manifest for agents / loaders
  const manifest = {
    source: "ikkaku_madarame.glb",
    skeleton: "Bip001 (canonical spaced names)",
    rotationOnly: true,
    roles: [...written].sort(),
    map: CLIP_MAP,
    aliases: ALIASES,
    bakedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${written.size} roles → ${OUT}`);
  console.log(JSON.stringify(report.map((r) => `${r.role}:${r.duration.toFixed(2)}s/${r.tracks}t`), null, 0));
}

main();

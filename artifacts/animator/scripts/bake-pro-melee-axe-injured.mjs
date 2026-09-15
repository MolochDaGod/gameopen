/**
 * Bake Mixamo FBX packs → Bip001 rotation-only JSON for fleet play.
 *
 * Sources (extracted under public/anim/):
 *   - pro-melee-axe/     Pro Melee Axe Pack (47 clips)
 *   - male-injured/      Male Injured Pack (20 clips)
 *
 * Outputs:
 *   public/anims/baked/pro_melee_axe/*.json
 *   public/anims/baked/pro_melee_axe_mirror/*.json  (L/R mirrored for off-hand)
 *   public/anims/baked/male_injured/*.json
 *
 * Policy: quaternion only · strip root position · Bip001 core 22.
 *
 * Usage:
 *   node scripts/bake-pro-melee-axe-injured.mjs
 *   node scripts/bake-pro-melee-axe-injured.mjs --pack=axe
 *   node scripts/bake-pro-melee-axe-injured.mjs --pack=injured
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

/** Mirror L↔R bone names (warrior off-hand). */
const MIRROR_BONE = {
  "Bip001 L Clavicle": "Bip001 R Clavicle",
  "Bip001 R Clavicle": "Bip001 L Clavicle",
  "Bip001 L UpperArm": "Bip001 R UpperArm",
  "Bip001 R UpperArm": "Bip001 L UpperArm",
  "Bip001 L Forearm": "Bip001 R Forearm",
  "Bip001 R Forearm": "Bip001 L Forearm",
  "Bip001 L Hand": "Bip001 R Hand",
  "Bip001 R Hand": "Bip001 L Hand",
  "Bip001 L Thigh": "Bip001 R Thigh",
  "Bip001 R Thigh": "Bip001 L Thigh",
  "Bip001 L Calf": "Bip001 R Calf",
  "Bip001 R Calf": "Bip001 L Calf",
  "Bip001 L Foot": "Bip001 R Foot",
  "Bip001 R Foot": "Bip001 L Foot",
  "Bip001 L Toe0": "Bip001 R Toe0",
  "Bip001 R Toe0": "Bip001 L Toe0",
};

/**
 * Source FBX basename (lowercase, no .fbx) → role basename.
 * Every clip from Pro Melee Axe Pack.
 */
const AXE_ROLES = {
  "standing idle": "idle",
  "standing idle looking ver. 1": "idle_look_1",
  "standing idle looking ver. 2": "idle_look_2",
  "standing walk forward": "walk",
  "standing walk back": "walk_back",
  "standing walk left": "walk_left",
  "standing walk right": "walk_right",
  "standing run forward": "run",
  "standing run back": "run_back",
  "standing jump": "jump",
  "standing turn left 90": "turn_left",
  "standing turn right 90": "turn_right",
  "standing block idle": "block_idle",
  "standing block react large": "block_hit",
  "standing melee attack horizontal": "attack",
  "standing melee attack downward": "attack_down",
  "standing melee attack backhand": "attack_backhand",
  "standing melee attack 360 high": "attack_360_high",
  "standing melee attack 360 low": "attack_360_low",
  "standing melee attack kick ver. 1": "attack_kick_1",
  "standing melee attack kick ver. 2": "attack_kick_2",
  "standing melee combo attack ver. 1": "combo_1",
  "standing melee combo attack ver. 2": "combo_2",
  "standing melee combo attack ver. 3": "combo_3",
  "standing melee run jump attack": "jump_attack",
  "standing react large from left": "hit_left",
  "standing react large from right": "hit_right",
  "standing react large gut": "hit_gut",
  "standing taunt battlecry": "taunt_battlecry",
  "standing taunt chest thump": "taunt_chest",
  "standing disarm over shoulder": "disarm_shoulder",
  "standing disarm underarm": "disarm_underarm",
  "unarmed equip over shoulder": "equip_shoulder",
  "unarmed equip underarm": "equip_underarm",
  "unarmed idle": "unarmed_idle",
  "unarmed idle looking ver. 1": "unarmed_idle_look_1",
  "unarmed idle looking ver. 2": "unarmed_idle_look_2",
  "unarmed walk forward": "unarmed_walk",
  "unarmed walk back": "unarmed_walk_back",
  "unarmed run forward": "unarmed_run",
  "unarmed run back": "unarmed_run_back",
  "unarmed jump": "unarmed_jump",
  "unarmed jump running": "unarmed_jump_run",
  "unarmed turn left 90": "unarmed_turn_left",
  "unarmed turn right 90": "unarmed_turn_right",
  "crouch idle": "crouch_idle",
  "crouch to standing idle": "crouch_stand",
};

/** Male Injured Pack — slowed / wounded locomotion + idles. */
const INJURED_ROLES = {
  "injured idle": "idle",
  "injured hurting idle": "hurt_idle",
  "injured stumble idle": "stumble_idle",
  "injured wave idle": "wave_idle",
  "injured walk": "walk",
  "injured walk backwards": "walk_back",
  "injured walk left turn": "walk_left",
  "injured walk right turn": "walk_right",
  "injured run": "run",
  "injured run backwards": "run_back",
  "injured run left turn": "run_left",
  "injured run right turn": "run_right",
  "injured run backwards left turn": "run_back_left",
  "injured run backwards right turn": "run_back_right",
  "injured turn left": "turn_left",
  "injured turn right": "turn_right",
  "injured backwards turn left": "turn_back_left",
  "injured backwards turn right": "turn_back_right",
  "injured standing jump": "jump",
  "injured run jump": "run_jump",
};

function slugFile(name) {
  return name
    .toLowerCase()
    .replace(/\.fbx$/i, "")
    .trim();
}

function mapTrackName(trackName) {
  const dot = trackName.lastIndexOf(".");
  if (dot < 0) return null;
  let bone = trackName.slice(0, dot);
  const prop = trackName.slice(dot + 1);
  if (prop !== "quaternion") return null;
  bone = bone.replace(/^mixamorig:/, "mixamorig");
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

/**
 * Mirror quaternion track for off-hand: swap L/R target bone and negate x/w
 * components of quat (standard Y-up character mirror).
 */
function mirrorQuatTrack(name, times, values) {
  const bone = name.replace(/\.quaternion$/, "");
  const mirroredBone = MIRROR_BONE[bone] || bone;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 4) {
    // x,y,z,w → -x, y, z, -w  (reflect across YZ plane)
    out[i] = -values[i];
    out[i + 1] = values[i + 1];
    out[i + 2] = values[i + 2];
    out[i + 3] = -values[i + 3];
  }
  return {
    name: `${mirroredBone}.quaternion`,
    type: "quaternion",
    times: Array.from(times),
    values: Array.from(out),
  };
}

function bakeFbx(srcAbs, role, { mirror = false } = {}) {
  const buf = fs.readFileSync(srcAbs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const group = new FBXLoader().parse(ab, path.dirname(srcAbs) + path.sep);
  const clip = group.animations?.[0];
  if (!clip) throw new Error("no animations");

  const byName = new Map();
  for (const t of clip.tracks) {
    const mapped = mapTrackName(t.name);
    if (!mapped) continue;
    const times = Array.from(t.times);
    const values = Array.from(t.values);
    if (mirror) {
      const m = mirrorQuatTrack(mapped, times, values);
      byName.set(m.name, m);
    } else {
      byName.set(mapped, {
        name: mapped,
        type: "quaternion",
        times,
        values,
      });
    }
  }
  if (byName.size < 6) throw new Error(`few tracks ${byName.size}`);
  return {
    name: role,
    duration: clip.duration || 0.01,
    tracks: [...byName.values()],
    meta: {
      skeleton: "Bip001",
      stripPositionTracks: true,
      mirror: !!mirror,
      hipPolicy: "controller-owns-y-xz",
    },
  };
}

function bakePack({ srcDir, outPack, roleMap, alsoMirror }) {
  const absSrc = path.join(PUBLIC, srcDir);
  const outDir = path.join(OUT_ROOT, outPack);
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(absSrc)) {
    console.error("MISS source dir", absSrc);
    return { ok: 0, bad: 1 };
  }

  const files = fs.readdirSync(absSrc).filter((f) => f.toLowerCase().endsWith(".fbx"));
  let ok = 0;
  let bad = 0;
  const report = [];

  for (const file of files) {
    const key = slugFile(file);
    const role = roleMap[key] || key.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const srcAbs = path.join(absSrc, file);
    try {
      const json = bakeFbx(srcAbs, `${outPack}/${role}`, { mirror: false });
      fs.writeFileSync(path.join(outDir, `${role}.json`), JSON.stringify(json));
      console.log(`  OK ${outPack}/${role} ← ${file} tracks=${json.tracks.length} dur=${json.duration.toFixed(2)}`);
      ok++;
      report.push({ role, file, ok: true, tracks: json.tracks.length, duration: json.duration });

      if (alsoMirror) {
        const mOut = path.join(OUT_ROOT, `${outPack}_mirror`);
        fs.mkdirSync(mOut, { recursive: true });
        const mJson = bakeFbx(srcAbs, `${outPack}_mirror/${role}`, { mirror: true });
        fs.writeFileSync(path.join(mOut, `${role}.json`), JSON.stringify(mJson));
        console.log(`     mirror ${role} tracks=${mJson.tracks.length}`);
      }
    } catch (e) {
      console.error(`  FAIL ${file}:`, e.message);
      bad++;
      report.push({ role, file, ok: false, reason: e.message });
    }
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        version: 1,
        updated: new Date().toISOString().slice(0, 10),
        pack: outPack,
        skeleton: "Bip001",
        sourceDir: srcDir,
        clipCount: ok,
        roles: report.filter((r) => r.ok),
        missing: report.filter((r) => !r.ok),
        note: alsoMirror
          ? "Mirror pack at pro_melee_axe_mirror/ for off-hand warrior"
          : undefined,
      },
      null,
      2,
    ),
  );
  return { ok, bad };
}

function main() {
  const arg = process.argv.find((a) => a.startsWith("--pack="));
  const only = arg ? arg.split("=")[1] : "all";

  let totalOk = 0;
  let totalBad = 0;

  if (only === "all" || only === "axe") {
    console.log("\n=== Pro Melee Axe → pro_melee_axe (+ mirror) ===");
    const r = bakePack({
      srcDir: "anim/pro-melee-axe",
      outPack: "pro_melee_axe",
      roleMap: AXE_ROLES,
      alsoMirror: true,
    });
    totalOk += r.ok;
    totalBad += r.bad;
  }

  if (only === "all" || only === "injured") {
    console.log("\n=== Male Injured → male_injured (slow/wounded) ===");
    const r = bakePack({
      srcDir: "anim/male-injured",
      outPack: "male_injured",
      roleMap: INJURED_ROLES,
      alsoMirror: false,
    });
    totalOk += r.ok;
    totalBad += r.bad;
  }

  console.log(`\nDone ok=${totalOk} bad=${totalBad}`);
  if (totalOk < 10) process.exit(1);
}

main();

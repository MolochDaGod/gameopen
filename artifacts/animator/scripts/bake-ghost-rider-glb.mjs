/**
 * Bake Ghost Rider (PS2 2007) animations ONLY — discard all Marvel mesh/skin.
 *
 * Source: D:/Games/Models/ghost_rider_-_2007_video_game_marvel_ps2.glb
 *   98 PC_GR_* clips · custom Bone* rig · 8 skinned meshes (ignored)
 *
 * Outputs:
 *   public/anims/baked/ghost_rider/*.json     — Bip001 rotation-only body clips
 *   public/anims/baked/locomotion/roll_*.json — shared dodge rolls (aliases)
 *   public/anims/baked/ghost_rider/fx/*.json  — chain tip / weapon-path samples
 *                                              for flame (NOT mesh stretch)
 *
 * Policy:
 *  - Quaternion tracks only for body (controller owns hip Y/XZ)
 *  - Scale max deviation ~0.005 in source → stretch was NEVER real scale;
 *    PS2 extended chain via link bones Bone19–24 / Bone91–92. We sample those
 *    positions into FX paths and emit hellfire along the path at runtime.
 *  - No Ghost Rider mesh, textures, or weapon skinned geometry ship.
 *
 * Usage (artifacts/animator):
 *   node scripts/bake-ghost-rider-glb.mjs
 *   GHOST_RIDER_GLB=D:/path/to.glb node scripts/bake-ghost-rider-glb.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC =
  process.env.GHOST_RIDER_GLB ||
  "D:/Games/Models/ghost_rider_-_2007_video_game_marvel_ps2.glb";
const OUT = path.join(ROOT, "public/anims/baked/ghost_rider");
const LOCO = path.join(ROOT, "public/anims/baked/locomotion");
const FX_OUT = path.join(OUT, "fx");

/** Body only — chain bones stay out of body retarget. */
const SOURCE_TO_BIP001 = {
  Bone0_08: "Bip001 Pelvis",
  Bone40_017: "Bip001 Spine",
  Bone38_018: "Bip001 Spine1",
  Bone39_019: "Bip001 Spine2",
  Bone26_030: "Bip001 Neck",
  Bone27_031: "Bip001 Head",
  // Left arm (+X)
  Bone37_021: "Bip001 L Clavicle",
  Bone36_022: "Bip001 L UpperArm",
  Bone10_023: "Bip001 L Forearm",
  Bone11_025: "Bip001 L Hand",
  // Right arm (-X) — chain attaches at R Hand
  Bone6_033: "Bip001 R Clavicle",
  Bone7_034: "Bip001 R UpperArm",
  Bone17_035: "Bip001 R Forearm",
  Bone18_037: "Bip001 R Hand",
  // Left leg (+X)
  Bone28_010: "Bip001 L Thigh",
  Bone29_011: "Bip001 L Calf",
  Bone30_012: "Bip001 L Foot",
  Bone31_013: "Bip001 L Toe0",
  // Right leg (-X)
  Bone32_014: "Bip001 R Thigh",
  Bone33_015: "Bip001 R Calf",
  Bone34_016: "Bip001 R Foot",
  Bone35_00: "Bip001 R Toe0",
};

/**
 * Hellfire chain links (from R Hand forward). Used only for FX path samples —
 * never skinned onto grudge6 characters as mesh.
 */
const CHAIN_BONES = [
  "Bone19_038",
  "Bone20_039",
  "Bone21_040",
  "Bone22_041",
  "Bone23_042",
  "Bone24_043",
];
/** Secondary whip tip (lateral extension in bind). */
const CHAIN_ALT = ["Bone91_044", "Bone92_045"];
const HAND_R = "Bone18_037";
const HAND_L = "Bone11_025";

/**
 * role → source clip. Rolls go to ghost_rider/* AND locomotion/* for everyone.
 */
const ROLE_MAP = {
  // ── Shared locomotion / dodge (fleet-wide) ─────────────────────────────
  roll_forward: "PC_GR_Rollforward",
  roll_back: "PC_GR_Rollback",
  roll_left: "PC_GR_RollLeft",
  roll_right: "PC_GR_RollRight",
  dodgeF: "PC_GR_Rollforward",
  dodgeB: "PC_GR_Rollback",
  dodgeL: "PC_GR_RollLeft",
  dodgeR: "PC_GR_RollRight",
  land_roll: "PC_GR_Rollforward",
  // ── Combo finisher: Quakesmash (reuse on many melee / ranged-melee) ───
  quakesmash: "PC_GR_Quakesmash_together",
  quakesmash_together: "PC_GR_Quakesmash_together",
  combo_finisher: "PC_GR_Quakesmash_together",
  finisher: "PC_GR_Quakesmash_together",
  quakesmash3: "PC_GR_Quakesmash3",
  // ── Mega chain slam (animated chain → flame path FX) ───────────────────
  megachain_slam: "PC_GR_MegaChainSlamFireQuake",
  megachain_firequake: "PC_GR_MegaChainSlamFireQuake",
  ultimate: "PC_GR_MegaChainSlamFireQuake",
  // ── Ranged-melee chain toolkit ─────────────────────────────────────────
  chain_throw: "PC_GR_ChainThrowCombined",
  chain_stab: "PC_GR_ChainStab",
  chain_stab_hyper: "PC_GR_HyperChainStab",
  chain_stab_back: "PC_GR_ChainStabBack",
  chain_spin: "PC_GR_ChainSpin",
  chain_spin_up: "PC_GR_ChainSpinUpgrade",
  chain_slash: "PC_GR_ChainSlashBack",
  chain_swing: "PC_GR_ChainSwingAttack",
  chain_swing_360: "PC_GR_ChainSwingAttack360",
  chain_smash: "PC_GR_ChainSmash_together",
  chain_smash3: "PC_GR_ChainSmash3",
  chain_uppercut: "PC_GR_ChainUppercut",
  forward_chain_slam: "PC_GR_ForwardChainSlam",
  forward_chain_roll: "PC_GR_ForwardChainRoll",
  whip_rainbow: "PC_GR_WhipBackUpRainbowBackSmash",
  // ── Fire / shotgun / air gun (cast poses — flame bolt from hand path) ─
  fireball: "PC_GR_Fireball",
  hellfire_shotgun: "PC_GR_HellfireShotgunBlast2",
  airgun_level: "PC_GR_AirgunLevel",
  airgun_up: "PC_GR_AirgunUP",
  airgun_down: "PC_GR_AirgunDown",
  // ── Core combat / loco extras ──────────────────────────────────────────
  idle: "PC_GR_Idle",
  walk: "PC_GR_WALK",
  run: "PC_GR_Run",
  heavy_punch: "PC_GR_HeavyPunch",
  uppercut: "PC_GR_UpperCut",
  charge_punch: "PC_GR_ChargePunch",
  baton_twirl: "PC_GR_BatonTwirl",
  block: "PC_GR_BlockLoop",
  rage: "PC_GR_RAGE",
  jump1: "PC_GR_Jump1",
  jump2: "PC_GR_Jump2",
  jump3: "PC_GR_Jump3",
  hurt: "PC_GR_QuickHit",
  hit: "PC_GR_QuickHit",
  knockdown: "PC_GR_KnockDown",
  death: "PC_GR_LargeDeath",
  floor_sweep: "PC_GR_LargeFloorSweep",
  god_spin: "PC_GR_GodSpin",
  final_spin: "PC_GR_FinalSpin",
  double_spin: "PC_GR_DoubleHanderSpin",
};

/** Roles that also copy into locomotion/ for shared dodge SSOT. */
const LOCO_ALIASES = {
  roll_forward: "roll_forward",
  roll_back: "roll_back",
  roll_left: "roll_left",
  roll_right: "roll_right",
  land_roll: "land_roll",
  dodgeF: "dodge_fwd",
  dodgeB: "dodge_back",
  dodgeL: "dodge_l",
  dodgeR: "dodge_r",
};

/** Clips that need chain tip path samples for flame FX. */
const FX_CHAIN_ROLES = [
  "megachain_slam",
  "quakesmash",
  "chain_throw",
  "chain_stab_hyper",
  "chain_spin",
  "forward_chain_slam",
  "whip_rainbow",
  "fireball",
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

function bakeBodyRotation(json, bin, anim) {
  const tracks = [];
  let duration = 0;
  const nodes = json.nodes;

  for (const ch of anim.channels) {
    if (ch.target.path !== "rotation") continue;
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

  const byName = new Map();
  for (const t of tracks) byName.set(t.name, t);

  return {
    name: anim.name,
    duration: duration || 0.01,
    tracks: [...byName.values()],
  };
}

/**
 * Sample chain / hand local position curves for hellfire path FX.
 * Runtime: spawn flame particles along path[t] instead of stretching weapon mesh.
 */
function sampleChainFx(json, bin, anim) {
  const nodes = json.nodes;
  const want = new Set([HAND_R, HAND_L, ...CHAIN_BONES, ...CHAIN_ALT]);
  const curves = {};

  for (const ch of anim.channels) {
    if (ch.target.path !== "translation") continue;
    const nodeName = nodes[ch.target.node]?.name;
    if (!want.has(nodeName)) continue;
    const sampler = anim.samplers[ch.sampler];
    const timesAcc = readAccessor(json, bin, sampler.input);
    const valsAcc = readAccessor(json, bin, sampler.output);
    curves[nodeName] = {
      times: Array.from(timesAcc.values),
      values: Array.from(valsAcc.values),
    };
  }

  // Build tip path: prefer chain tip Bone24, fallback Bone92, else R hand
  const tipName = curves["Bone24_043"]
    ? "Bone24_043"
    : curves["Bone92_045"]
      ? "Bone92_045"
      : HAND_R;
  const tip = curves[tipName];
  const hand = curves[HAND_R];
  if (!tip && !hand) {
    return {
      hasChain: false,
      tipBone: tipName,
      note: "no translation curves for chain/hand",
    };
  }

  const src = tip || hand;
  const pathSamples = [];
  const n = src.times.length;
  // downsample to ≤ 24 samples
  const step = Math.max(1, Math.floor(n / 24));
  for (let i = 0; i < n; i += step) {
    pathSamples.push({
      t: +src.times[i].toFixed(4),
      x: +src.values[i * 3].toFixed(4),
      y: +src.values[i * 3 + 1].toFixed(4),
      z: +src.values[i * 3 + 2].toFixed(4),
    });
  }

  // Extension metric: max tip |delta| from first sample
  let maxExt = 0;
  if (pathSamples.length > 1) {
    const o = pathSamples[0];
    for (const p of pathSamples) {
      const d = Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z);
      if (d > maxExt) maxExt = d;
    }
  }

  return {
    hasChain: Boolean(curves["Bone24_043"] || curves["Bone20_039"]),
    tipBone: tipName,
    handBone: HAND_R,
    chainBones: CHAIN_BONES.filter((b) => curves[b]),
    maxExtensionM: +maxExt.toFixed(3),
    /**
     * Runtime VFX recipe (no Ghost Rider mesh):
     *  - sample pathSamples in local R-hand space (or world after attach)
     *  - emit flame ribbon / hellfire trail along path (fire_aura + particle)
     *  - optional chain links as procedural cylinders with flame shader
     *  - never scale weapon mesh to "stretch"
     */
    flameRecipe: {
      effectIds: ["fire_aura", "fireball", "inferno"],
      mode: "path_ribbon",
      attach: "Bip001 R Hand",
      widthM: 0.08,
      life: 0.35,
      color: 0xff6020,
    },
    pathSamples,
  };
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj));
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Source missing:", SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(LOCO, { recursive: true });
  fs.mkdirSync(FX_OUT, { recursive: true });

  const buf = fs.readFileSync(SRC);
  const { json, bin } = parseGlb(buf);
  const byName = new Map((json.animations || []).map((a) => [a.name, a]));
  console.log(
    `[ghost-rider] anims=${json.animations?.length} skins=${json.skins?.length} (mesh discarded) bodyMap=${Object.keys(SOURCE_TO_BIP001).length}`,
  );
  console.log(
    `[ghost-rider] intent: ANIM ONLY — no Marvel mesh; chain stretch → flame path FX`,
  );

  const report = [];
  const written = new Set();

  for (const [role, srcName] of Object.entries(ROLE_MAP)) {
    const anim = byName.get(srcName);
    if (!anim) {
      console.warn(`  MISS ${srcName} → ${role}`);
      report.push({ role, src: srcName, ok: false, reason: "missing" });
      continue;
    }
    const baked = bakeBodyRotation(json, bin, anim);
    if (baked.tracks.length < 10) {
      console.warn(`  WEAK ${role} tracks=${baked.tracks.length}`);
      report.push({ role, src: srcName, ok: false, reason: "few tracks" });
      continue;
    }

    const payload = {
      name: `ghost_rider/${role}`,
      duration: baked.duration,
      tracks: baked.tracks,
      meta: {
        source: "ghost_rider_-_2007_video_game_marvel_ps2.glb",
        sourceClip: srcName,
        skeleton: "Bip001",
        meshPolicy: "none — Marvel mesh discarded; body motion only",
        stripPositionTracks: true,
        stripScaleTracks: true,
        hipPolicy: "controller-owns-y-xz",
        handBones: ["Bip001 L Hand", "Bip001 R Hand"],
        stretchPolicy:
          "source scale≈identity; chain extension via Bone19–24 positions → flame path FX, never weapon mesh scale",
        chainBones: CHAIN_BONES,
      },
    };

    const outPath = path.join(OUT, `${role}.json`);
    writeJson(outPath, payload);
    written.add(role);

    // Shared locomotion copies for dodge / land roll
    if (LOCO_ALIASES[role]) {
      const locoName = LOCO_ALIASES[role];
      const locoPayload = {
        ...payload,
        name: `locomotion/${locoName}`,
        meta: {
          ...payload.meta,
          sharedLoco: true,
          useWith: ["dodge", "landRoll", "Controller.rollOut", "all packs"],
        },
      };
      writeJson(path.join(LOCO, `${locoName}.json`), locoPayload);
    }

    // Chain / flame path samples
    if (FX_CHAIN_ROLES.includes(role)) {
      const fx = sampleChainFx(json, bin, anim);
      writeJson(path.join(FX_OUT, `${role}_chain_path.json`), {
        role,
        sourceClip: srcName,
        ...fx,
      });
      console.log(
        `  FX  ${role}_chain_path  tip=${fx.tipBone} ext=${fx.maxExtensionM ?? "?"}m samples=${fx.pathSamples?.length ?? 0}`,
      );
    }

    const sha = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex")
      .slice(0, 12);
    console.log(
      `  OK  ${role}.json ← ${srcName}  dur=${baked.duration.toFixed(3)} tracks=${baked.tracks.length} sha=${sha}`,
    );
    report.push({
      role,
      src: srcName,
      ok: true,
      duration: baked.duration,
      tracks: baked.tracks.length,
      file: `ghost_rider/${role}.json`,
    });
  }

  const manifest = {
    version: 1,
    updated: new Date().toISOString().slice(0, 10),
    source: path.basename(SRC),
    skeleton: "Bip001",
    mesh: "DISCARDED — animations only",
    understanding: {
      scaleStretch: "negligible (max |s-1|≈0.005) — not how chain extends",
      chainExtension:
        "Bone19–24 (primary) + Bone91–92 (alt) position curves from R Hand; sample into fx/*_chain_path.json",
      flameInsteadOfStretch:
        "Emit hellfire ribbon along chain path (fire_aura / path_ribbon). Do not scale sword/mace meshes.",
      rolls: "Rollforward/back/left/right → locomotion/* for all packs + dodge",
      quakesmash:
        "Quakesmash_together = short slam finisher (~0.63s) for combo enders / ranged-melee impacts",
      megachain:
        "MegaChainSlamFireQuake = ultimate; body bake + chain path for animated flame chain",
    },
    policy: {
      rotationOnly: true,
      hipYxz: "controller",
      hands: "Bip001 L/R Hand",
      rematch: "rematchClipToSkeleton on grudge6 + Explorer",
    },
    boneMap: SOURCE_TO_BIP001,
    chainBones: CHAIN_BONES,
    roles: report.filter((r) => r.ok),
    missing: report.filter((r) => !r.ok),
  };
  writeJson(path.join(OUT, "manifest.json"), manifest);
  // Human-readable review
  writeJson(path.join(OUT, "REVIEW.md.json"), {
    note: "See docs/GHOST_RIDER_ANIM_BAKE.md for full review",
    roles: Object.keys(ROLE_MAP).length,
    written: written.size,
  });

  console.log(`\n[ghost-rider] wrote ${written.size} body clips → ${OUT}`);
  console.log(`[ghost-rider] shared rolls → ${LOCO}`);
  if (written.size < 20) process.exit(1);
}

main();

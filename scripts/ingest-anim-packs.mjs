/**
 * Ingest user-dropped Mixamo / 25-bone animation zips into gameopen authoring SSOT.
 *
 * Stage:   _anim_pack_stage/<pack>/*.fbx  (Expand-Archive first)
 * Dest:    artifacts/animator/public/anim/{pistol,rifle,farming,magic-loco,loco-8way,...}
 *
 * Naming: kebab-case; never overwrite existing author FBX unless --force.
 *
 * Usage (repo root):
 *   node scripts/ingest-anim-packs.mjs
 *   node scripts/ingest-anim-packs.mjs --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STAGE = path.join(ROOT, "_anim_pack_stage");
const ANIM = path.join(ROOT, "artifacts/animator/public/anim");
const FORCE = process.argv.includes("--force");

function kebab(name) {
  return String(name)
    .replace(/\.fbx$/i, "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Explicit renames so bake targets / ANIM_PACK_CLIPS match.
 * key: kebab(source basename) → dest relative under public/anim/
 */
const RENAME = {
  // --- rifle (gun pack + shooter packs) ---
  "firing-rifle": "rifle/firing-rifle.fbx",
  "rifle-aiming-idle": "rifle/rifle-aiming-idle.fbx",
  "rifle-run": "rifle/rifle-run.fbx",
  "rifle-jump": "rifle/rifle-jump.fbx",
  reloading: "rifle/reloading.fbx",
  "hit-reaction": "rifle/hit-reaction.fbx",
  walking: "rifle/walking.fbx",
  "walking-backwards": "rifle/walking-backwards.fbx",
  "run-backwards": "rifle/run-backwards.fbx",
  "strafe-left": "rifle/strafe-left.fbx",
  "strafe-right": "rifle/strafe-right.fbx",
  strafe: "rifle/strafe.fbx",
  "toss-grenade": "rifle/toss-grenade.fbx",
  "turn-left": "rifle/turn-left.fbx",
  "turning-right-45-degrees": "rifle/turn-right-45.fbx",
  "jump-forward": "rifle/jump-forward.fbx",
  "jump-backward": "rifle/jump-backward.fbx",
  "start-walking": "rifle/start-walking.fbx",
  "start-walking-backwards": "rifle/start-walking-backwards.fbx",
  "stop-walking": "rifle/stop-walking.fbx",
  "walk-backwards-stop": "rifle/walk-backwards-stop.fbx",
  "walking-to-dying": "rifle/walking-to-dying.fbx",

  // --- pistol ---
  "pistol-idle": "pistol/idle.fbx",
  "pistol-walk": "pistol/walk-forward.fbx",
  "pistol-walk-backward": "pistol/walk-backward.fbx",
  "pistol-run": "pistol/run-forward.fbx",
  "pistol-run-backward": "pistol/run-backward.fbx",
  "pistol-jump": "pistol/pistol-jump.fbx",
  "pistol-strafe": "pistol/strafe-left.fbx",
  "pistol-kneeling-idle": "pistol/kneeling-idle.fbx",
  "pistol-stand-to-kneel": "pistol/stand-to-kneel.fbx",
  "pistol-kneel-to-stand": "pistol/kneel-to-stand.fbx",
  "pistol-walk-arc": "pistol/walk-arc-right.fbx",
  "pistol-run-arc": "pistol/run-arc-right.fbx",
  "pistol-walk-backward-arc": "pistol/walk-backward-arc-right.fbx",
  "pistol-run-backward-arc": "pistol/run-backward-arc-right.fbx",

  // --- magic locomotion (merge into magic-loco) ---
  "standing-idle": "magic-loco/standing-idle.fbx",
  "standing-walk-forward": "magic-loco/standing-walk-forward.fbx",
  "standing-walk-back": "magic-loco/standing-walk-back.fbx",
  "standing-walk-left": "magic-loco/standing-walk-left.fbx",
  "standing-walk-right": "magic-loco/standing-walk-right.fbx",
  "standing-run-forward": "magic-loco/standing-run-forward.fbx",
  "standing-run-back": "magic-loco/standing-run-back.fbx",
  "standing-run-left": "magic-loco/standing-run-left.fbx",
  "standing-run-right": "magic-loco/standing-run-right.fbx",
  "standing-sprint-forward": "magic-loco/standing-sprint-forward.fbx",
  "standing-jump": "magic-loco/standing-jump.fbx",
  "standing-jump-running": "magic-loco/standing-jump-running.fbx",
  "standing-jump-running-landing": "magic-loco/standing-jump-running-landing.fbx",
  "standing-land-to-standing-idle": "magic-loco/standing-land-to-standing-idle.fbx",
  "standing-turn-left-90": "magic-loco/standing-turn-left-90.fbx",
  "standing-turn-right-90": "magic-loco/standing-turn-right-90.fbx",

  // --- farming ---
  "dig-and-plant-seeds": "farming/dig-and-plant-seeds.fbx",
  "plant-a-plant": "farming/plant-a-plant.fbx",
  "plant-tree": "farming/plant-tree.fbx",
  "pick-fruit": "farming/pick-fruit.fbx",
  "pull-plant": "farming/pull-plant.fbx",
  watering: "farming/watering.fbx",
  "cow-milking": "farming/cow-milking.fbx",
  "holding-idle": "farming/holding-idle.fbx",
  "holding-walk": "farming/holding-walk.fbx",
  "holding-turn-left": "farming/holding-turn-left.fbx",
  "holding-turn-right": "farming/holding-turn-right.fbx",
  "kneeling-idle": "farming/kneeling-idle.fbx",
  "box-idle": "farming/box-idle.fbx",
  "box-walk-arc": "farming/box-walk-arc.fbx",
  "box-turn": "farming/box-turn.fbx",
  "wheelbarrow-idle": "farming/wheelbarrow-idle.fbx",
  "wheelbarrow-walk": "farming/wheelbarrow-walk.fbx",
  "wheelbarrow-walk-turn": "farming/wheelbarrow-walk-turn.fbx",
  "wheelbarrow-dump": "farming/wheelbarrow-dump.fbx",

  // --- 8-way + unarmed loco (authoring under loco-8way / reactions) ---
  idle: "loco-8way/idle.fbx",
  "idle-aiming": "loco-8way/idle-aiming.fbx",
  "idle-crouching": "loco-8way/idle-crouching.fbx",
  "idle-crouching-aiming": "loco-8way/idle-crouching-aiming.fbx",
  "walk-forward": "loco-8way/walk-forward.fbx",
  "walk-backward": "loco-8way/walk-backward.fbx",
  "walk-left": "loco-8way/walk-left.fbx",
  "walk-right": "loco-8way/walk-right.fbx",
  "walk-forward-left": "loco-8way/walk-forward-left.fbx",
  "walk-forward-right": "loco-8way/walk-forward-right.fbx",
  "walk-backward-left": "loco-8way/walk-backward-left.fbx",
  "walk-backward-right": "loco-8way/walk-backward-right.fbx",
  "run-forward": "loco-8way/run-forward.fbx",
  "run-backward": "loco-8way/run-backward.fbx",
  "run-left": "loco-8way/run-left.fbx",
  "run-right": "loco-8way/run-right.fbx",
  "run-forward-left": "loco-8way/run-forward-left.fbx",
  "run-forward-right": "loco-8way/run-forward-right.fbx",
  "run-backward-left": "loco-8way/run-backward-left.fbx",
  "run-backward-right": "loco-8way/run-backward-right.fbx",
  "sprint-forward": "loco-8way/sprint-forward.fbx",
  "sprint-backward": "loco-8way/sprint-backward.fbx",
  "sprint-left": "loco-8way/sprint-left.fbx",
  "sprint-right": "loco-8way/sprint-right.fbx",
  "sprint-forward-left": "loco-8way/sprint-forward-left.fbx",
  "sprint-forward-right": "loco-8way/sprint-forward-right.fbx",
  "sprint-backward-left": "loco-8way/sprint-backward-left.fbx",
  "sprint-backward-right": "loco-8way/sprint-backward-right.fbx",
  "walk-crouching-forward": "loco-8way/walk-crouching-forward.fbx",
  "walk-crouching-backward": "loco-8way/walk-crouching-backward.fbx",
  "walk-crouching-left": "loco-8way/walk-crouching-left.fbx",
  "walk-crouching-right": "loco-8way/walk-crouching-right.fbx",
  "jump-up": "loco-8way/jump-up.fbx",
  "jump-loop": "loco-8way/jump-loop.fbx",
  "jump-down": "loco-8way/jump-down.fbx",
  "turn-90-left": "loco-8way/turn-90-left.fbx",
  "turn-90-right": "loco-8way/turn-90-right.fbx",
  "crouching-turn-90-left": "loco-8way/crouching-turn-90-left.fbx",
  "crouching-turn-90-right": "loco-8way/crouching-turn-90-right.fbx",
  "death-from-the-front": "reactions/death-from-front.fbx",
  "death-from-the-back": "reactions/death-from-back.fbx",
  "death-from-right": "reactions/death-from-right.fbx",
  "death-from-front-headshot": "reactions/death-from-front-headshot.fbx",
  "death-from-back-headshot": "reactions/death-from-back-headshot.fbx",
  "death-crouching-headshot-front": "reactions/death-crouching-headshot-front.fbx",

  // --- action adventure ---
  "falling-idle": "action-adventure/falling-idle.fbx",
  "falling-to-roll": "action-adventure/falling-to-roll.fbx",
  "hard-landing": "action-adventure/hard-landing.fbx",
  "jumping-up": "action-adventure/jumping-up.fbx",
  "run-to-stop": "action-adventure/run-to-stop.fbx",
  // BAN as gait: action_adventure/running.fbx is often run-to-stop transition
  "crouched-sneaking-left": "action-adventure/crouched-sneaking-left.fbx",
  "crouched-sneaking-right": "action-adventure/crouched-sneaking-right.fbx",
  "stand-to-cover": "action-adventure/stand-to-cover.fbx",
  "cover-to-stand": "action-adventure/cover-to-stand.fbx",
  "left-cover-sneak": "action-adventure/left-cover-sneak.fbx",
  "right-cover-sneak": "action-adventure/right-cover-sneak.fbx",

  // --- generic grudge6 loco pack ---
  "left-strafe": "loco/left-strafe.fbx",
  "right-strafe": "loco/right-strafe.fbx",
  "left-strafe-walking": "loco/left-strafe-walking.fbx",
  "right-strafe-walking": "loco/right-strafe-walking.fbx",
  "left-turn": "loco/left-turn.fbx",
  "right-turn": "loco/right-turn.fbx",
  "left-turn-90": "loco/left-turn-90.fbx",
  "right-turn-90": "loco/right-turn-90.fbx",
  jump: "loco/jump.fbx",
  // running → do NOT map to gait (often banned run-to-roll)
};

// Pack folder preference when same kebab appears in multiple zips
const PACK_PRIORITY = [
  "gun", // best rifle combat
  "25bone_shooter",
  "25bone_slim_shooter",
  "pistol",
  "25bone_pistol_loco",
  "wand_pistols",
  "magic_loco",
  "farming",
  "8way_loco",
  "action_adventure",
  "loco",
];

function listFbx(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFbx(p));
    else if (/\.fbx$/i.test(ent.name) && !/heavy_mixamo/i.test(ent.name)) out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(STAGE)) {
    console.error("Missing stage", STAGE);
    process.exit(1);
  }

  /** @type {Map<string, {src: string, pack: string, destRel: string}>} */
  const chosen = new Map();

  for (const pack of PACK_PRIORITY) {
    const packDir = path.join(STAGE, pack);
    if (!fs.existsSync(packDir)) {
      console.warn("skip missing pack", pack);
      continue;
    }
    for (const src of listFbx(packDir)) {
      const base = path.basename(src);
      const k = kebab(base);
      if (k === "running" || k === "walking" && pack === "action_adventure") {
        // walking from AA may be tip-walk; still allow under action-adventure only
      }
      if (k === "running") {
        // store only as action-adventure/run-cycle-suspect for review — never gait
        const destRel = "action-adventure/running-suspect-run-to-roll.fbx";
        if (!chosen.has(destRel)) chosen.set(destRel, { src, pack, destRel });
        continue;
      }
      let destRel = RENAME[k];
      if (!destRel) {
        // default folder by pack
        const folder =
          pack.includes("pistol") || pack === "wand_pistols"
            ? "pistol"
            : pack.includes("shooter") || pack === "gun"
              ? "rifle"
              : pack.includes("magic")
                ? "magic-loco"
                : pack.includes("farm")
                  ? "farming"
                  : pack.includes("8way")
                    ? "loco-8way"
                    : pack.includes("action")
                      ? "action-adventure"
                      : pack === "loco"
                        ? "loco"
                        : "misc";
        destRel = `${folder}/${k}.fbx`;
      }
      // First priority pack wins
      if (!chosen.has(destRel)) {
        chosen.set(destRel, { src, pack, destRel });
      }
    }
  }

  let copied = 0;
  let skipped = 0;
  let forced = 0;
  for (const { src, pack, destRel } of chosen.values()) {
    const dest = path.join(ANIM, destRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest) && !FORCE) {
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dest);
    if (fs.existsSync(dest) && FORCE) forced++;
    else copied++;
    console.log(`${FORCE && fs.existsSync(dest) ? "UPD" : "NEW"} ${destRel}  ← ${pack}/${path.basename(src)}`);
  }

  // Creator GLB clips → public/anim/creator-glb (not Mixamo; keep separate)
  const creatorGlb = path.join(STAGE, "creator");
  if (fs.existsSync(creatorGlb)) {
    const glbs = [];
    const walk = (d) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.glb$/i.test(ent.name) && /anim_/i.test(ent.name)) glbs.push(p);
      }
    };
    walk(creatorGlb);
    const outDir = path.join(ANIM, "creator-glb");
    fs.mkdirSync(outDir, { recursive: true });
    for (const g of glbs) {
      const dest = path.join(outDir, path.basename(g).toLowerCase());
      if (!fs.existsSync(dest) || FORCE) {
        fs.copyFileSync(g, dest);
        console.log(`NEW creator-glb/${path.basename(dest)}`);
        copied++;
      }
    }
  }

  console.log(
    `\nIngest complete: new=${copied} skipped(existing)=${skipped} force-updates=${forced} total-mapped=${chosen.size}`,
  );
  console.log("Next: node artifacts/animator/scripts/bake-gun-farm-loco.mjs");
}

main();

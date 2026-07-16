/**
 * Scale verification rules per asset purpose.
 *
 * Production contract (meters, Y-up, feet/ground at y≈0 for characters):
 *  - characters / NPCs: height 1.5–2.1 m (target 1.7)
 *  - weapons: max dim 0.15–2.5 m (hand props, not 170 cm giants)
 *  - maps: at least one axis ≥ 8 m (or author meters with colliders)
 *  - props: max dim 0.05–6 m
 *
 * If cm-authored FBX still at cm scale, height will read ~170 → fail → need --cm-to-m.
 */
import { PURPOSE_PIPELINE } from "./purpose.mjs";
import { inspectGlb } from "./glb-bounds.mjs";

/**
 * @param {string} purpose
 * @param {{ size?: {x:number,y:number,z:number}, min?: number[], skinCount?: number, animCount?: number, clipNames?: string[] }} info
 */
export function evaluateScale(purpose, info) {
  const pipe = PURPOSE_PIPELINE[purpose] || PURPOSE_PIPELINE.unknown;
  /** @type {{ level: 'pass'|'warn'|'fail', code: string, msg: string }[]} */
  const checks = [];
  const size = info.size;
  if (!size) {
    checks.push({
      level: "warn",
      code: "NO_BOUNDS",
      msg: "Could not read mesh bounds — run grudge-convert inspect after convert",
    });
    return { ok: true, checks, score: "yellow" };
  }

  const maxDim = Math.max(size.x, size.y, size.z);
  const height = size.y;
  const groundY = info.min ? info.min[1] : null;

  if (purpose === "character" || purpose === "npc") {
    if (height > 50) {
      checks.push({
        level: "fail",
        code: "LIKELY_CM",
        msg: `Height ${height.toFixed(2)} units — looks like centimeters. Convert with --cm-to-m --height 1.7`,
      });
    } else if (height < 0.8 || height > 2.6) {
      checks.push({
        level: "fail",
        code: "HEIGHT_OUT",
        msg: `Character height ${height.toFixed(2)} m outside 0.8–2.6 m. Bake with --height 1.7`,
      });
    } else if (height < 1.45 || height > 2.0) {
      checks.push({
        level: "warn",
        code: "HEIGHT_SOFT",
        msg: `Height ${height.toFixed(2)} m off target 1.7 m (±0.25 soft)`,
      });
    } else {
      checks.push({
        level: "pass",
        code: "HEIGHT_OK",
        msg: `Height ${height.toFixed(2)} m in hero band`,
      });
    }
    if (groundY != null && Math.abs(groundY) > 0.15) {
      checks.push({
        level: "warn",
        code: "GROUND_Y",
        msg: `Feet not near y=0 (minY=${groundY.toFixed(3)}). Prefer --y-hip ground bake`,
      });
    } else if (groundY != null) {
      checks.push({ level: "pass", code: "GROUND_OK", msg: `Grounded minY=${groundY.toFixed(3)}` });
    }
    if ((info.skinCount ?? 0) < 1 && purpose === "character") {
      checks.push({
        level: "warn",
        code: "NO_SKIN",
        msg: "No skins — character may be static mesh; AI locomotion needs skinned rig",
      });
    }
  }

  if (purpose === "weapon") {
    if (maxDim > 5) {
      checks.push({
        level: "fail",
        code: "WEAPON_HUGE",
        msg: `Weapon max dim ${maxDim.toFixed(2)} m — likely wrong scale or character mesh mis-tagged`,
      });
    } else if (maxDim < 0.05) {
      checks.push({
        level: "warn",
        code: "WEAPON_TINY",
        msg: `Weapon max dim ${maxDim.toFixed(3)} m — may be invisible in hand`,
      });
    } else {
      checks.push({
        level: "pass",
        code: "WEAPON_OK",
        msg: `Weapon max dim ${maxDim.toFixed(2)} m`,
      });
    }
  }

  if (purpose === "map") {
    if (maxDim < 4) {
      checks.push({
        level: "warn",
        code: "MAP_SMALL",
        msg: `Map max dim ${maxDim.toFixed(2)} m — small for an arena; verify author units`,
      });
    } else {
      checks.push({
        level: "pass",
        code: "MAP_OK",
        msg: `Map extent ~${maxDim.toFixed(1)} m`,
      });
    }
  }

  if (purpose === "prop") {
    if (maxDim > 40) {
      checks.push({
        level: "warn",
        code: "PROP_MAPLIKE",
        msg: `Prop max dim ${maxDim.toFixed(1)} m — may be a map chunk mis-tagged as prop`,
      });
    } else {
      checks.push({
        level: "pass",
        code: "PROP_OK",
        msg: `Prop max dim ${maxDim.toFixed(2)} m`,
      });
    }
  }

  // AI anim readiness for skinned assets
  if (pipe.ai?.requiredClipRoles?.length && (info.animCount ?? 0) > 0) {
    const names = (info.clipNames || []).map((n) => n.toLowerCase());
    const missing = pipe.ai.requiredClipRoles.filter(
      (role) => !names.some((n) => n.includes(role) || fuzzyRole(n, role)),
    );
    if (missing.length) {
      checks.push({
        level: "warn",
        code: "AI_CLIPS",
        msg: `Missing AI clip roles: ${missing.join(", ")} (have ${info.animCount} clips)`,
      });
    } else {
      checks.push({
        level: "pass",
        code: "AI_CLIPS_OK",
        msg: `AI clip roles covered (${info.animCount} clips)`,
      });
    }
  } else if (pipe.ai?.needsSkeleton && (info.animCount ?? 0) === 0) {
    checks.push({
      level: "warn",
      code: "NO_ANIMS",
      msg: "No animations — pair with anim bank / retarget for AI locomotion",
    });
  }

  const fail = checks.some((c) => c.level === "fail");
  const warn = checks.some((c) => c.level === "warn");
  return {
    ok: !fail,
    checks,
    score: fail ? "red" : warn ? "yellow" : "green",
    size,
    purpose,
  };
}

function fuzzyRole(clipName, role) {
  const map = {
    idle: ["stand", "breath", "ready"],
    walk: ["locomotion", "move"],
    run: ["sprint", "jog"],
    attack: ["slash", "strike", "shoot", "cast", "combo"],
    hurt: ["hit", "damage", "react", "flinch"],
    death: ["die", "dead", "ko"],
  };
  const alts = map[role] || [];
  return alts.some((a) => clipName.includes(a));
}

/**
 * Inspect file + evaluate.
 * @param {string} filePath
 * @param {string} purpose
 */
export function verifyFileScale(filePath, purpose) {
  const info = inspectGlb(filePath);
  if (!info.ok && !info.size) {
    return {
      ok: false,
      score: "red",
      checks: [{ level: "fail", code: "READ", msg: info.err || "read failed" }],
      info,
    };
  }
  const eval_ = evaluateScale(purpose, info);
  return { ...eval_, info };
}

import * as THREE from "three";
import { assetLoadError, resolveGrudgeAssetCandidates } from "./assetBase";
import { FLEET_ASSET_HOSTS } from "../fleetAssetResolver";

// Animation packs match the gear-preset `animPack` field. Each pack maps to a
// set of pre-baked Bip001 clips (idle / walk / run / attack). The clips were
// retargeted offline to Bip001 by the viewer's bake tool and shipped as JSON
// under `/anims/baked/<rel>.json`; we load them directly (no runtime retarget).
//
// SSOT with grudge-arena `src/bakedAnimLoader.js` ANIM_PACK_CLIPS (2026-07)
// + Open `polearm` pack baked from ikkaku_madarame.glb (spear / 2H).
export type AnimPack = "magic" | "sword_shield" | "longbow" | "unarmed" | "polearm";

export interface LoadoutClips {
  idle: string;
  walk: string;
  run: string;
  attack: string;
  /** Optional extra roles loaded for weapon skills (combo / skill1–4). */
  extras?: string[];
}

/**
 * HARD BAN — never use these as walk / run / sprint locomotion.
 *
 * - `locomotion/running` (~2.5s) is a **run-into-roll** transition, not a cycle.
 * - `uploads_2026_06/locomotion/running` (~1.6s) is the same class of bad upload
 *   (pelvis first≠last, tips/tumbles). Arena marks it as ~180° wrong / moonwalk.
 * - `uploads/locomotion/Quick_Roll_To_Run` is an evade roll, not run.
 *
 * Sprint must clone the pack `run` clip (see loadGrudge6CombatRig), never these.
 */
export const BANNED_LOCOMOTION_CLIPS = [
  "locomotion/running",
  "uploads_2026_06/locomotion/running",
  "uploads/locomotion/Quick_Roll_To_Run",
  "boxanimations/locomotion/Quick Roll To Run (1)",
  /** Tips / lean on Arena Bip001 kits — never map walk here */
  "locomotion/walking",
] as const;

export function isBannedLocomotionClip(rel: string): boolean {
  const n = String(rel || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.json$/i, "");
  return (BANNED_LOCOMOTION_CLIPS as readonly string[]).some(
    (b) =>
      n === b ||
      n.endsWith(`/${b}`) ||
      n.includes("Quick_Roll_To_Run") ||
      n.includes("Quick Roll To Run"),
  );
}

/**
 * Pelvis first≈last sum-abs error for rotation tracks. Run-to-roll ≈ 0.9;
 * good cycles ≈ 0.0. Used to reject renamed roll clips at load time.
 */
export function pelvisLoopError(clip: THREE.AnimationClip): number {
  const pelvis = clip.tracks.find(
    (t) => /pelvis|hips/i.test(t.name) && t.name.endsWith(".quaternion"),
  );
  if (!pelvis || pelvis.times.length < 2) return 0;
  const n = pelvis.times.length;
  const dim = pelvis.values.length / n;
  let err = 0;
  for (let i = 0; i < dim; i++) {
    err += Math.abs(pelvis.values[i]! - pelvis.values[(n - 1) * dim + i]!);
  }
  return err;
}

/** True if clip looks like a non-looping transition (run-to-roll class). */
export function isNonLoopingLocoClip(clip: THREE.AnimationClip, rel = ""): boolean {
  if (isBannedLocomotionClip(rel)) return true;
  // Long duration + open pelvis loop = classic roll transition
  if (clip.duration > 1.8 && pelvisLoopError(clip) > 0.25) return true;
  return false;
}

// Paths are relative to `/anims/baked/`, WITHOUT the `.json` extension.
// Walk/run must be **looping cycles** (pelvis first≈last). Verified on arena CDN.
export const ANIM_PACK_CLIPS: Record<AnimPack, LoadoutClips> = {
  unarmed: {
    idle: "unarmed/fight_idle",
    // Pack-neutral cycle walk (locomotion/walking tips Arena GLB kits → “falling”).
    walk: "magic/Standing Walk Forward",
    // True forward run cycle — NOT locomotion/running (run-to-roll).
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "unarmed/punching",
  },
  magic: {
    idle: "magic/standing idle",
    walk: "magic/Standing Walk Forward",
    run: "magic/Standing Run Forward",
    attack: "magic/standing 1h cast spell 01",
  },
  sword_shield: {
    idle: "sword_shield/sword and shield idle",
    // No dedicated sword walk bake — use clean magic forward walk cycle.
    walk: "magic/Standing Walk Forward",
    run: "sword_shield/sword and shield run",
    attack: "sword_shield/sword and shield attack",
  },
  longbow: {
    idle: "longbow/standing idle 01",
    walk: "longbow/standing walk forward",
    run: "longbow/standing run forward",
    attack: "longbow/standing aim recoil",
  },
  /**
   * Spear / 2H polearm — baked from Madarame (`ikkaku_madarame.glb`).
   * Same-origin: public/anims/baked/polearm/*.json
   * attack1_1..5 → attack..attack5 · skill1–4 for hotbar · special = bankai
   */
  polearm: {
    idle: "polearm/idle",
    walk: "polearm/walk",
    run: "polearm/run",
    attack: "polearm/attack",
    extras: [
      "polearm/attack2",
      "polearm/attack3",
      "polearm/attack4",
      "polearm/attack5",
      "polearm/skill1",
      "polearm/skill2",
      "polearm/skill3",
      "polearm/skill4",
      "polearm/special",
      "polearm/combo",
      "polearm/thrust",
      "polearm/slash",
      "polearm/overhead",
      "polearm/power",
      "polearm/hurt",
      "polearm/death",
    ],
  },
};

/** Map arsenal weapon id → anim pack (overrides class default when 2H/spear). */
export function animPackForWeapon(weaponId: string | null | undefined): AnimPack | null {
  const w = String(weaponId || "").toLowerCase();
  if (!w || w === "none") return null;
  if (
    w === "spear" ||
    w === "javelin" ||
    w === "lance" ||
    w === "greatsword" ||
    w === "greataxe" ||
    w === "hammer2h" ||
    w === "halberd" ||
    w === "polearm"
  ) {
    return "polearm";
  }
  if (w.startsWith("staff") || w === "wand") return "magic";
  if (w === "bow" || w === "longbow" || w === "crossbow") return "longbow";
  if (w === "sword" || w === "axe" || w === "dagger" || w === "mace" || w === "hammer") {
    return "sword_shield";
  }
  return null;
}

export function asAnimPack(value: string): AnimPack {
  return value in ANIM_PACK_CLIPS ? (value as AnimPack) : "unarmed";
}

/**
 * @deprecated Do not load this for sprint. It points at the banned run-to-roll
 * upload. Runtime **clones pack.run** for sprint (arena parity).
 * Kept only so old imports compile; never pass to loadBakedClip for gait.
 */
export const SPRINT_CLIP = "locomotion/running";

/** Playback scale for sprint band vs run (matches arena SPRINT_LOCO_MULT). */
export const SPRINT_LOCO_MULT = 1.75;

// Build the primary URL for a baked clip (R2 default; loaders try all hosts).
export function bakedClipUrl(rel: string, baseOverride?: string): string {
  const path = `anims/baked/${rel}.json`;
  if (baseOverride !== undefined) {
    return `${baseOverride.replace(/\/+$/, "")}/${path}`;
  }
  return `${FLEET_ASSET_HOSTS.r2}/${path}`;
}

/** Ordered hosts for baked Bip001 JSON clips. */
export function bakedClipCandidates(rel: string, baseOverride?: string): string[] {
  const path = `anims/baked/${rel}.json`;
  const urls: string[] = [];
  // Same-origin first (Open ships remade loco packs under public/anims/baked/).
  if (typeof window !== "undefined" && window.location?.origin) {
    urls.push(`${window.location.origin}/${path}`);
    // Vite base / relative
    urls.push(`/${path}`);
  } else {
    urls.push(`/${path}`);
  }
  if (baseOverride) {
    urls.push(`${baseOverride.replace(/\/+$/, "")}/${path}`);
  }
  // Arena CDN (historical SSOT) then fleet hosts
  urls.push(`${FLEET_ASSET_HOSTS.arena}/${path}`);
  urls.push(...resolveGrudgeAssetCandidates(path));
  return [...new Set(urls)];
}

// Rotation-only conformation — bone lengths come from the MODEL skeleton, motion
// (rotations) comes from the clip. Baked Bip001 clips are already rotation-only,
// so this is effectively a no-op for them, but it stays as a safety net.
export function toRotationOnlyClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => t.name.endsWith(".quaternion"));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Fetch + parse a baked Bip001 clip as a rotation-only AnimationClip (multi-host).
export async function loadBakedClip(rel: string, baseOverride?: string): Promise<THREE.AnimationClip> {
  if (isBannedLocomotionClip(rel)) {
    throw assetLoadError(
      `anims/baked/${rel}.json`,
      new Error(
        `banned locomotion clip (run-to-roll / tipping walk): ${rel} — use pack standing walk/run cycles`,
      ),
    );
  }
  let lastErr: unknown;
  for (const url of bakedClipCandidates(rel, baseOverride)) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        lastErr = assetLoadError(`${url} (HTTP ${res.status})`);
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        lastErr = assetLoadError(`HTML fake-200 ${url}`);
        continue;
      }
      const json = (await res.json()) as THREE.AnimationClipJSON;
      const clip = toRotationOnlyClip(THREE.AnimationClip.parse(json));
      if (isNonLoopingLocoClip(clip, rel)) {
        lastErr = new Error(
          `non-looping loco (roll/transition) ${rel} dur=${clip.duration.toFixed(2)} pelvisErr=${pelvisLoopError(clip).toFixed(3)}`,
        );
        continue;
      }
      return clip;
    } catch (err) {
      lastErr = err;
    }
  }
  throw assetLoadError(`anims/baked/${rel}.json`, lastErr);
}

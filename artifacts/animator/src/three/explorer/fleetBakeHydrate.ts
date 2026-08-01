/**
 * Production Explorer motion when Mixamo FBX is NOT on the host (Vercel).
 *
 * Loads the same Bip001 baked packs as grudge6 RTS_TOON, rematches tracks onto
 * the Mixamo box-rig skeleton, and registers them under the catalog IDs that
 * {@link WEAPON_SETS} / {@link UNIVERSAL_MOVEMENT} already resolve.
 *
 * Result: Explorer avatar + grudge6 race kits share one animation source of truth.
 */
import type * as THREE from "three";
import {
  ANIM_PACK_CLIPS,
  loadBakedClip,
  type AnimPack,
  type LoadoutClips,
} from "../grudge/anims";
import { rematchClipToSkeleton } from "../grudge/skeleton";
import { filterBindableTracks } from "../clipTracks";
import {
  WEAPON_SETS,
  UNIVERSAL_LOCO,
  UNIVERSAL_MOVEMENT,
  BASE_PACK_FALLBACKS,
} from "./clipCatalog";
import type { WeaponClass } from "./types";

/** Map Explorer weapon class → grudge6 baked pack id. */
export function animPackForWeaponClass(weapon: WeaponClass): AnimPack {
  switch (weapon) {
    case "unarmed":
      return "unarmed";
    case "sword":
    case "knife":
    case "axe":
    case "mace":
      return "sword_shield";
    case "greatsword":
    case "greataxe":
      return "twohand";
    case "spear":
      return "polearm";
    case "hammer":
    case "hammer2h":
      return "hammer";
    case "bow":
    case "ranged":
      return "longbow";
    case "magic":
      return "magic";
    case "pistol":
      return "rifle";
    default:
      return "sword_shield";
  }
}

export type ClipInject = (id: string, clip: THREE.AnimationClip) => void;

/**
 * Inject one baked path under one or more catalog ids (first id is primary).
 */
async function injectBake(
  skeletonRoot: THREE.Object3D,
  bakeRel: string,
  catalogIds: string[],
  inject: ClipInject,
  has: (id: string) => boolean,
): Promise<boolean> {
  const targets = catalogIds.filter((id) => id && !has(id));
  if (!targets.length) return true;
  try {
    const raw = await loadBakedClip(bakeRel);
    const rematched = rematchClipToSkeleton(skeletonRoot, raw);
    const clip = filterBindableTracks(skeletonRoot, rematched);
    if (!clip.tracks.length) return false;
    for (const id of targets) {
      const named = clip.clone();
      named.name = id;
      inject(id, named);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Core fleet loco + combat under universal / weapon catalog IDs.
 * Safe to call multiple times (skips ids already present).
 */
export async function hydrateExplorerFleetBakes(opts: {
  skeletonRoot: THREE.Object3D;
  inject: ClipInject;
  has: (id: string) => boolean;
  /** Weapon classes to prime (default: all choosable). */
  weapons?: WeaponClass[];
  log?: boolean;
}): Promise<{ loaded: number; failed: string[] }> {
  const { skeletonRoot, inject, has } = opts;
  const failed: string[] = [];
  let loaded = 0;

  const tryOne = async (bakeRel: string, ids: string[]) => {
    const ok = await injectBake(skeletonRoot, bakeRel, ids, inject, has);
    if (ok) loaded += ids.filter((i) => !opts.has(i) || true).length;
    else failed.push(bakeRel);
  };

  // Universal loco (every class falls back here)
  await tryOne("magic/Standing Walk Forward", [
    UNIVERSAL_LOCO.walkF,
    UNIVERSAL_LOCO.walkB,
    UNIVERSAL_LOCO.walkL,
    UNIVERSAL_LOCO.walkR,
    "animations/sword/sword-and-shield-run",
    "animations/sword/sword-and-shield-run-2",
    "animations/sword/sword-and-shield-strafe",
    "animations/sword/sword-and-shield-strafe-2",
  ]);
  await tryOne("uploads_2026_06/locomotion/torch run forward", [
    UNIVERSAL_LOCO.runF,
    UNIVERSAL_LOCO.runB,
    UNIVERSAL_LOCO.runL,
    UNIVERSAL_LOCO.runR,
    "animations/sword/run-with-sword",
  ]);
  await tryOne("sword_shield/sword and shield idle", [
    UNIVERSAL_LOCO.idle,
    "animations/sword/sword-and-shield-idle",
    "animations/bow/unarmed-idle-01",
  ]);
  await tryOne("sword_shield/sword and shield run", [
    "animations/sword/sword-and-shield-run",
  ]);
  await tryOne("sword_shield/sword and shield attack", [
    "animations/sword/sword-and-shield-attack",
    "animations/sword/one-hand-sword-combo",
  ]);

  // Traversal / reactions (Bip001 → Mixamo)
  await tryOne("locomotion/jump", ["animations/reactions/jump-up", BASE_PACK_FALLBACKS.jumpAir!].filter(Boolean) as string[]);
  await tryOne("locomotion/dodge_fwd", [UNIVERSAL_MOVEMENT.dodgeF]);
  await tryOne("locomotion/dodge_back", [UNIVERSAL_MOVEMENT.dodgeB]);
  await tryOne("locomotion/dodge_l", [UNIVERSAL_MOVEMENT.dodgeL]);
  await tryOne("locomotion/dodge_r", [UNIVERSAL_MOVEMENT.dodgeR]);
  await tryOne("longbow/fall-a-loop", [UNIVERSAL_MOVEMENT.jumpAir]);
  await tryOne("longbow/fall-a-land", [UNIVERSAL_MOVEMENT.land]);
  await tryOne("polearm/hurt", ["animations/bow/standing-react-small-from-front"]);
  await tryOne("dual_wield/dash", [UNIVERSAL_MOVEMENT.dash, "animations/bow/standing-dive-forward"]);
  await tryOne("dual_wield/attack", ["animations/bow/standing-melee-punch", "animations/striker/punch-to-elbow-combo"]);
  await tryOne("dual_wield/attack2", ["animations/striker/quick-kick"]);
  await tryOne("dual_wield/skill1", ["animations/striker/flip-kick"]);
  await tryOne("dual_wield/hurt", ["animations/bow/standing-react-small-from-front"]);
  await tryOne("dual_wield/death", ["animations/bow/standing-death-forward-01"]);

  // Climb / swim when available
  await tryOne("climb/climbing", ["animations/climb/climbing"]);
  await tryOne("climb/wall_run", [UNIVERSAL_MOVEMENT.wallRun, "animations/climb/wall-run"]);
  await tryOne("swim/swimming", ["animations/swim/swimming"]);
  await tryOne("swim/treading", ["animations/swim/treading-water"]);

  const weapons =
    opts.weapons ??
    ([
      "unarmed",
      "sword",
      "greatsword",
      "spear",
      "bow",
      "magic",
      "hammer",
      "axe",
      "knife",
    ] as WeaponClass[]);

  for (const w of weapons) {
    const n = await hydrateWeaponClassPack(skeletonRoot, w, inject, has);
    loaded += n;
  }

  if (opts.log !== false && typeof console !== "undefined") {
    console.info(
      `[explorer-fleet-bake] injected≈${loaded} catalog slots · fails=${failed.length ? failed.slice(0, 8).join(",") : "none"}`,
    );
  }
  return { loaded, failed };
}

/**
 * Load a weapon pack's idle/walk/run/attack (+ extras) onto catalog IDs for that class.
 */
export async function hydrateWeaponClassPack(
  skeletonRoot: THREE.Object3D,
  weapon: WeaponClass,
  inject: ClipInject,
  has: (id: string) => boolean,
): Promise<number> {
  const pack = animPackForWeaponClass(weapon);
  const row: LoadoutClips = ANIM_PACK_CLIPS[pack] || ANIM_PACK_CLIPS.sword_shield;
  const set = WEAPON_SETS[weapon];
  if (!set) return 0;
  let n = 0;

  const map: Array<{ bake: string; ids: string[] }> = [
    { bake: row.idle, ids: [set.loco.idle].filter(Boolean) as string[] },
    {
      bake: row.walk,
      ids: [set.loco.walkF, set.loco.walkB, set.loco.walkL, set.loco.walkR].filter(Boolean) as string[],
    },
    {
      bake: row.run,
      ids: [set.loco.runF, set.loco.runB, set.loco.runL, set.loco.runR].filter(Boolean) as string[],
    },
    {
      bake: row.attack,
      ids: [
        set.actions.attack1,
        set.actions.attack2,
        set.actions.skill,
        set.actions.comboHit1,
      ].filter(Boolean) as string[],
    },
  ];

  // Skill extras → skill / attack2 / attack3
  const extras = row.extras || [];
  if (extras[0] && set.actions.attack2) {
    map.push({ bake: extras[0], ids: [set.actions.attack2] });
  }
  if (extras[1] && set.actions.attack3) {
    map.push({ bake: extras[1], ids: [set.actions.attack3] });
  }
  if (extras[2] && set.actions.skill) {
    map.push({ bake: extras[2], ids: [set.actions.skill] });
  }

  for (const { bake, ids } of map) {
    if (!bake || !ids.length) continue;
    const ok = await injectBake(skeletonRoot, bake, ids, inject, has);
    if (ok) n += 1;
  }
  return n;
}

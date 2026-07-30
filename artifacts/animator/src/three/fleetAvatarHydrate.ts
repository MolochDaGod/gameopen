/**
 * Fleet avatar hydrate SSOT — every playable character gets the same role set
 * for controller / combat / climb / swim, regardless of GLB native clips.
 *
 * Production clips: /anims/baked/{bakeRel}.json (Bip001, rotation-only).
 * Bound via rematchClipToSkeleton so Mixamo / Bip001 / Noesis names all work.
 */
import * as THREE from "three";
import { filterBindableTracks } from "./clipTracks";
import { loadBakedClip, MOBILITY_CLIPS } from "./grudge/anims";
import { rematchClipToSkeleton } from "./grudge/skeleton";
import type { AnimRole } from "./types";

/** Core roles every Avatar must expose for Controller + combat math. */
export const FLEET_REQUIRED_ROLES: AnimRole[] = [
  "idle",
  "walk",
  "run",
  "sprint",
  "attack",
  "jump",
  "hurt",
  "block",
  "death",
  "climb",
  "climbUp",
  "climbDown",
  "hang",
  "mantle",
  "wallRun",
  "grab",
  "swim",
  "tread",
];

/** Baked paths for core combat/loco (universal Danger Room base pack). */
export const FLEET_CORE_BAKE: ReadonlyArray<{ role: AnimRole; bakeRel: string }> = [
  { role: "idle", bakeRel: "sword_shield/sword and shield idle" },
  { role: "walk", bakeRel: "magic/Standing Walk Forward" },
  { role: "run", bakeRel: "sword_shield/sword and shield run" },
  { role: "attack", bakeRel: "sword_shield/sword and shield attack" },
  { role: "jump", bakeRel: "locomotion/jump" },
  { role: "hurt", bakeRel: "polearm/hurt" },
  // Secondary walk/run fallbacks tried if primary 404
  // (handled in load with fallbacks list)
];

const CORE_FALLBACKS: Record<string, string[]> = {
  idle: [
    "sword_shield/sword and shield idle",
    "polearm/idle",
    "magic/standing idle",
    "unarmed/fight_idle",
  ],
  walk: [
    "magic/Standing Walk Forward",
    "longbow/standing walk forward",
    "polearm/walk",
  ],
  run: [
    "sword_shield/sword and shield run",
    "magic/Standing Run Forward",
    "longbow/standing run forward",
    "uploads_2026_06/locomotion/torch run forward",
    "polearm/run",
  ],
  attack: [
    "sword_shield/sword and shield attack",
    "polearm/attack",
    "unarmed/punching",
  ],
  jump: ["locomotion/jump"],
  hurt: ["polearm/hurt", "polearm/hitback"],
  block: ["sword_shield/sword and shield idle"], // soft stand-in
  death: ["polearm/death", "polearm/hurt"],
};

export type HydrateRegister = (role: string, clip: THREE.AnimationClip) => void;

export type HydrateReport = {
  loaded: string[];
  failed: string[];
  aliased: string[];
  hasSkinned: boolean;
};

/**
 * Load and register all fleet roles onto a skinned model + mixer.
 * Does not overwrite roles already present (caller decides).
 */
export async function hydrateFleetAvatarRoles(opts: {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  /** true if role already has a usable action */
  hasRole: (role: string) => boolean;
  register: HydrateRegister;
  logId?: string;
  /** Force re-load even if hasRole (default false) */
  force?: boolean;
}): Promise<HydrateReport> {
  const loaded: string[] = [];
  const failed: string[] = [];
  const aliased: string[] = [];
  const logId = opts.logId || "avatar";

  let hasSkinned = false;
  opts.model.traverse((o) => {
    const s = o as THREE.SkinnedMesh;
    if (s.isSkinnedMesh && s.skeleton?.bones?.length) hasSkinned = true;
  });
  if (!hasSkinned) {
    return { loaded, failed: ["no-skinned-mesh"], aliased, hasSkinned: false };
  }

  const tryBake = async (role: string, paths: string[]): Promise<boolean> => {
    if (!opts.force && opts.hasRole(role)) return true;
    for (const path of paths) {
      try {
        const raw = await loadBakedClip(path);
        const clip = rematchClipToSkeleton(opts.model, raw);
        // Ensure enough tracks after rematch
        if (!clip.tracks.length) {
          failed.push(`${role}:${path}:empty-tracks`);
          continue;
        }
        opts.register(role, filterBindableTracks(opts.model, clip));
        loaded.push(`${role}←${path}`);
        return true;
      } catch {
        /* try next */
      }
    }
    failed.push(role);
    return false;
  };

  // 1) Core loco + combat
  for (const { role, bakeRel } of FLEET_CORE_BAKE) {
    const paths = CORE_FALLBACKS[role] || [bakeRel];
    await tryBake(role, paths);
  }
  for (const role of ["block", "death"] as AnimRole[]) {
    if (!opts.hasRole(role)) {
      await tryBake(role, CORE_FALLBACKS[role] || []);
    }
  }

  // 2) Sprint = clone run (never locomotion/running roll JSON)
  if (!opts.hasRole("sprint") && opts.hasRole("run")) {
    // register alias handled by caller via roleClip map if needed
    aliased.push("sprint→run");
  }

  // 3) Full mobility pack (climb/swim/hang/mantle/wallRun/…)
  await Promise.all(
    MOBILITY_CLIPS.map(async ({ role, bakeRel }) => {
      if (!opts.force && opts.hasRole(role)) return;
      await tryBake(role, [bakeRel]);
    }),
  );

  // 4) Alias chain so controller never hits empty hasRole
  const aliasPairs: [string, string][] = [
    ["sprint", "run"],
    ["walk", "run"],
    ["run", "walk"],
    ["climbUp", "climb"],
    ["climbDown", "climb"],
    ["climb", "hang"],
    ["hang", "climb"],
    ["mantle", "jump"],
    ["grab", "hang"],
    ["wallRun", "run"],
    ["tread", "swim"],
    ["swim", "tread"],
    ["swimExit", "jump"],
    ["block", "idle"],
    ["death", "hurt"],
    ["hurt", "idle"],
    ["jump", "idle"],
  ];
  // Aliases only mark intent — caller should set roleClip when actions map shares clip
  for (const [need, from] of aliasPairs) {
    if (!opts.hasRole(need) && opts.hasRole(from)) {
      aliased.push(`${need}→${from}`);
    }
  }

  if (loaded.length || failed.length) {
    console.info(
      `[fleetAvatarHydrate] ${logId} loaded=${loaded.length} failed=${failed.length} aliased=${aliased.length}`,
      failed.length ? { failed: failed.slice(0, 12) } : "",
    );
  }

  return { loaded, failed, aliased, hasSkinned: true };
}

/** After hydrate, fill roleClip aliases for missing roles (same action key). */
export function applyRoleAliases(
  hasAction: (name: string) => boolean,
  setAlias: (role: string, actionKey: string) => void,
  hasRole: (role: string) => boolean,
): string[] {
  const applied: string[] = [];
  const pairs: [string, string][] = [
    ["sprint", "run"],
    ["walk", "run"],
    ["run", "walk"],
    ["climbUp", "climb"],
    ["climbDown", "climb"],
    ["climb", "hang"],
    ["hang", "climb"],
    ["mantle", "jump"],
    ["grab", "hang"],
    ["wallRun", "run"],
    ["tread", "swim"],
    ["swim", "tread"],
    ["block", "idle"],
    ["death", "hurt"],
    ["hurt", "idle"],
  ];
  for (const [need, from] of pairs) {
    if (hasRole(need)) continue;
    if (hasAction(from) || hasRole(from)) {
      setAlias(need, from);
      applied.push(`${need}→${from}`);
    }
  }
  return applied;
}

/** Audit which required roles are missing. */
export function missingFleetRoles(hasRole: (role: string) => boolean): string[] {
  return FLEET_REQUIRED_ROLES.filter((r) => !hasRole(r));
}

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
/**
 * grudge6 baked pack ids under /anims/baked/{pack}/ (or composite packs).
 * `samurai` = curated retargeted slash set (sword loco + Madarame combat).
 * `twohand` | `crossbow` | `rifle` fall back until full bake ships.
 */
export type AnimPack =
  | "magic"
  | "sword_shield"
  | "longbow"
  | "unarmed"
  | "polearm"
  | "twohand"
  | "crossbow"
  | "rifle"
  /** Sidearm / pistol loco + gunplay (prod/anims/pistol). */
  | "pistol"
  /** Katana / iaijutsu feel — retargeted Bip001 greatsword_samurai bake. */
  | "samurai"
  /** 2H mace / war-hammer — SC_SC_* from 2hweaponhammerretarget.glb → Bip001. */
  | "hammer";

/** Production anim CDN (ObjectStore packages:prod:anims). */
export const PROD_ANIMS_CDN = "https://assets.grudge-studio.com/prod/anims";

export interface LoadoutClips {
  idle: string;
  walk: string;
  run: string;
  attack: string;
  /**
   * Sprint is NEVER a separate banned upload (locomotion/running = run-to-roll).
   * Runtime clones `run` and applies {@link SPRINT_LOCO_MULT}. Optional bake
   * target for a true faster cycle once Mixamo sprint is retargeted.
   */
  sprint?: string;
  /** Optional extra roles loaded for weapon skills (combo / skill1–4). */
  extras?: string[];
}

/** Cross-fade / lock timings for gait and skill layers (seconds). */
export const ANIM_BLEND = {
  loco: 0.14,
  sprintIn: 0.12,
  attackIn: 0.08,
  attackOut: 0.16,
  skillIn: 0.1,
  skillOut: 0.18,
  dashOverlay: 0.06,
  hurt: 0.08,
  traversal: 0.12,
} as const;

/**
 * Shared mobility beyond jump/dodge — Mixamo authoring under public/anim/{climb,swim}/.
 * Bake targets: /anims/baked/{rel}.json (Bip001). Until bake lands, status=placeholder
 * and SurfaceLocomotion falls back (jump/dodge or procedural).
 */
export type MobilityRole =
  | "crawl"
  | "crouchWalk"
  | "swim"
  | "tread"
  | "swimExit"
  | "climb"
  | "climbUp"
  | "climbDown"
  | "hang"
  | "mantle"
  | "wallRun"
  | "grab"
  | "jumpAir"
  | "land"
  | "landRoll"
  | "dive"
  | "hurt"
  | "hitfly"
  | "getUp";

/**
 * Dual-wield / PC_B melee pack from dual_wieldingandothers.glb
 * (Bip001 bake: anims/baked/dual_wield/*). Rotation-only, hip Y/XZ stripped.
 * Use for dash, attacks, flinch, dodge on grudge6 + Explorer.
 */
export const DUAL_WIELD_CLIPS: ReadonlyArray<{
  role: string;
  bakeRel: string;
  loop: boolean;
  kind: "dash" | "attack" | "hit" | "dodge" | "block" | "loco" | "kick";
}> = [
  { role: "sword_dash_attack", bakeRel: "dual_wield/sword_dash_attack", loop: false, kind: "dash" },
  { role: "dash", bakeRel: "dual_wield/dash", loop: false, kind: "dash" },
  { role: "attack", bakeRel: "dual_wield/attack", loop: false, kind: "attack" },
  { role: "attack2", bakeRel: "dual_wield/attack2", loop: false, kind: "attack" },
  { role: "attack3", bakeRel: "dual_wield/attack3", loop: false, kind: "attack" },
  { role: "attack4", bakeRel: "dual_wield/attack4", loop: false, kind: "attack" },
  { role: "attack5", bakeRel: "dual_wield/attack5", loop: false, kind: "attack" },
  { role: "skill1", bakeRel: "dual_wield/skill1", loop: false, kind: "dash" },
  { role: "skill2", bakeRel: "dual_wield/skill2", loop: false, kind: "attack" },
  { role: "skill3", bakeRel: "dual_wield/skill3", loop: false, kind: "attack" },
  { role: "skill4", bakeRel: "dual_wield/skill4", loop: false, kind: "attack" },
  { role: "overhead", bakeRel: "dual_wield/overhead", loop: false, kind: "attack" },
  { role: "slash", bakeRel: "dual_wield/slash", loop: false, kind: "attack" },
  { role: "thrust", bakeRel: "dual_wield/thrust", loop: false, kind: "dash" },
  { role: "special", bakeRel: "dual_wield/special", loop: false, kind: "attack" },
  { role: "combo", bakeRel: "dual_wield/combo", loop: false, kind: "attack" },
  { role: "hurt", bakeRel: "dual_wield/hurt", loop: false, kind: "hit" },
  { role: "hitfly", bakeRel: "dual_wield/hitfly", loop: false, kind: "hit" },
  { role: "death", bakeRel: "dual_wield/death", loop: false, kind: "hit" },
  // Dodge: dual_wield rolls kept as soft fallback — fleet SSOT is Ghost Rider
  // locomotion/roll_* (see GHOST_RIDER_CLIPS + TRAVERSAL_CLIPS end overrides).
  { role: "dodgeF", bakeRel: "dual_wield/dodgeF", loop: false, kind: "dodge" },
  { role: "dodgeB", bakeRel: "dual_wield/dodgeB", loop: false, kind: "dodge" },
  { role: "dodgeL", bakeRel: "dual_wield/dodgeL", loop: false, kind: "dodge" },
  { role: "dodgeR", bakeRel: "dual_wield/dodgeR", loop: false, kind: "dodge" },
  { role: "block", bakeRel: "dual_wield/block", loop: true, kind: "block" },
  { role: "kick", bakeRel: "dual_wield/kick", loop: false, kind: "kick" },
];

/**
 * Ghost Rider PS2 (2007) — **animations only** (Marvel mesh discarded).
 * Baked Bip001 under anims/baked/ghost_rider/* + shared rolls in locomotion/*.
 *
 * Stretch policy: source scale≈identity; chain “stretch” is Bone19–24 position
 * curves → hellfire path FX (never weapon mesh scale). See fx/*_chain_path.json.
 */
export const GHOST_RIDER_CLIPS: ReadonlyArray<{
  role: string;
  bakeRel: string;
  loop: boolean;
  kind: "dodge" | "finisher" | "chain" | "fire" | "loco" | "hit" | "ultimate";
  /** Optional flame path sample (relative to /anims/baked/). */
  chainFxRel?: string;
}> = [
  // Shared dodge rolls (also locomotion/roll_* for Controller + every pack)
  { role: "dodgeF", bakeRel: "locomotion/dodge_fwd", loop: false, kind: "dodge" },
  { role: "dodgeB", bakeRel: "locomotion/dodge_back", loop: false, kind: "dodge" },
  { role: "dodgeL", bakeRel: "locomotion/dodge_l", loop: false, kind: "dodge" },
  { role: "dodgeR", bakeRel: "locomotion/dodge_r", loop: false, kind: "dodge" },
  { role: "roll", bakeRel: "locomotion/roll_forward", loop: false, kind: "dodge" },
  { role: "roll_forward", bakeRel: "locomotion/roll_forward", loop: false, kind: "dodge" },
  { role: "roll_back", bakeRel: "locomotion/roll_back", loop: false, kind: "dodge" },
  { role: "roll_left", bakeRel: "locomotion/roll_left", loop: false, kind: "dodge" },
  { role: "roll_right", bakeRel: "locomotion/roll_right", loop: false, kind: "dodge" },
  { role: "landRoll", bakeRel: "locomotion/land_roll", loop: false, kind: "dodge" },
  // Combo finisher (quakesmash) — use on many melee + ranged-melee enders
  {
    role: "combo_finisher",
    bakeRel: "ghost_rider/quakesmash",
    loop: false,
    kind: "finisher",
    chainFxRel: "ghost_rider/fx/quakesmash_chain_path",
  },
  {
    role: "quakesmash",
    bakeRel: "ghost_rider/quakesmash",
    loop: false,
    kind: "finisher",
    chainFxRel: "ghost_rider/fx/quakesmash_chain_path",
  },
  {
    role: "finisher",
    bakeRel: "ghost_rider/quakesmash",
    loop: false,
    kind: "finisher",
    chainFxRel: "ghost_rider/fx/quakesmash_chain_path",
  },
  // Mega chain slam ultimate — body anim + animated chain path → flame
  {
    role: "megachain_slam",
    bakeRel: "ghost_rider/megachain_slam",
    loop: false,
    kind: "ultimate",
    chainFxRel: "ghost_rider/fx/megachain_slam_chain_path",
  },
  {
    role: "ultimate",
    bakeRel: "ghost_rider/megachain_slam",
    loop: false,
    kind: "ultimate",
    chainFxRel: "ghost_rider/fx/megachain_slam_chain_path",
  },
  // Ranged-melee chain toolkit
  {
    role: "chain_throw",
    bakeRel: "ghost_rider/chain_throw",
    loop: false,
    kind: "chain",
    chainFxRel: "ghost_rider/fx/chain_throw_chain_path",
  },
  {
    role: "chain_stab",
    bakeRel: "ghost_rider/chain_stab_hyper",
    loop: false,
    kind: "chain",
    chainFxRel: "ghost_rider/fx/chain_stab_hyper_chain_path",
  },
  {
    role: "chain_spin",
    bakeRel: "ghost_rider/chain_spin",
    loop: false,
    kind: "chain",
    chainFxRel: "ghost_rider/fx/chain_spin_chain_path",
  },
  {
    role: "forward_chain_slam",
    bakeRel: "ghost_rider/forward_chain_slam",
    loop: false,
    kind: "chain",
    chainFxRel: "ghost_rider/fx/forward_chain_slam_chain_path",
  },
  {
    role: "fireball",
    bakeRel: "ghost_rider/fireball",
    loop: false,
    kind: "fire",
    chainFxRel: "ghost_rider/fx/fireball_chain_path",
  },
];

export const MOBILITY_CLIPS: ReadonlyArray<{
  role: MobilityRole;
  /** Preferred baked path (after bake pipeline). */
  bakeRel: string;
  /** Mixamo authoring FBX under public/anim (not live on Vercel). */
  mixamoRel: string;
  loop: boolean;
}> = [
  // Authoring sources on disk (not cycles — need proper crouch-walk bake later).
  { role: "crawl", bakeRel: "locomotion/crawl", mixamoRel: "anim/reactions/running-crawl.fbx", loop: true },
  { role: "crouchWalk", bakeRel: "locomotion/crouch_walk", mixamoRel: "anim/rifle/idle-crouching.fbx", loop: true },
  { role: "swim", bakeRel: "swim/swimming", mixamoRel: "anim/swim/swimming.fbx", loop: true },
  { role: "tread", bakeRel: "swim/treading", mixamoRel: "anim/swim/treading-water.fbx", loop: true },
  { role: "swimExit", bakeRel: "swim/to_edge", mixamoRel: "anim/swim/swimming-to-edge.fbx", loop: false },
  { role: "climb", bakeRel: "climb/climbing", mixamoRel: "anim/climb/climbing.fbx", loop: true },
  { role: "climbUp", bakeRel: "climb/up", mixamoRel: "anim/climb/climbing-up-wall.fbx", loop: true },
  { role: "climbDown", bakeRel: "climb/down", mixamoRel: "anim/climb/climbing-down-wall.fbx", loop: true },
  { role: "hang", bakeRel: "climb/hang_idle", mixamoRel: "anim/climb/hanging-idle.fbx", loop: true },
  { role: "mantle", bakeRel: "climb/to_top", mixamoRel: "anim/climb/climbing-to-top.fbx", loop: false },
  { role: "wallRun", bakeRel: "climb/wall_run", mixamoRel: "anim/climb/wall-run.fbx", loop: true },
  { role: "grab", bakeRel: "climb/jump_to_hang", mixamoRel: "anim/climb/jump-to-freehang.fbx", loop: false },
  // Fall / land / dive (bow pack has proven fall loops)
  { role: "jumpAir", bakeRel: "longbow/fall-a-loop", mixamoRel: "anim/bow/fall-a-loop.fbx", loop: true },
  { role: "land", bakeRel: "longbow/fall-a-land", mixamoRel: "anim/bow/fall-a-land-to-standing-idle-01.fbx", loop: false },
  // Ghost Rider roll → landRoll (shared for every hero)
  { role: "landRoll", bakeRel: "locomotion/land_roll", mixamoRel: "anim/striker/roll.fbx", loop: false },
  { role: "dive", bakeRel: "longbow/standing-dive-forward", mixamoRel: "anim/bow/standing-dive-forward.fbx", loop: false },
  // Hit / knockback hybrid ragdoll (prefer clip + impulse over full multi-body)
  { role: "hurt", bakeRel: "polearm/hurt", mixamoRel: "anim/reactions/react-small-from-front.fbx", loop: false },
  { role: "hitfly", bakeRel: "polearm/hitfly", mixamoRel: "anim/reactions/hit-fly.fbx", loop: false },
  { role: "getUp", bakeRel: "polearm/getup", mixamoRel: "anim/reactions/get-up.fbx", loop: false },
];

/**
 * Fall speed thresholds (m/s, SI) for land vs landRoll vs ragdoll hybrid.
 * Heavy knockback uses hitfly + impulse when force ≥ HEAVY_KB_FORCE.
 */
export const IMPACT_LOCO = {
  /** Soft land clip if |vertical| below this on ground contact. */
  softLandSpeed: 6,
  /** Use landRoll if impact speed above this. */
  hardLandSpeed: 11,
  /** Dive into water if airborne over water and vertical below -this. */
  diveEnterSpeed: 4,
  /** Epicfight / Controller force that triggers hitfly hybrid ragdoll. */
  heavyKbForce: 22,
  /** Hit blend-in seconds. */
  hurtBlendIn: 0.08,
  hitflyBlendIn: 0.06,
} as const;

/** Roles that must never be filled by aliasing pack.attack (breaks mobility). */
export const NEVER_ALIAS_TO_ATTACK = new Set([
  "idle",
  "walk",
  "run",
  "sprint",
  "jump",
  "jumpAway",
  "jumpAir",
  "land",
  "landRoll",
  "dive",
  "dodge",
  "dodgeF",
  "dodgeB",
  "dodgeL",
  "dodgeR",
  "roll",
  "crawl",
  "crouchWalk",
  "swim",
  "tread",
  "swimExit",
  "climb",
  "climbUp",
  "climbDown",
  "hang",
  "mantle",
  "wallRun",
  "grab",
  "hurt",
  "hitfly",
  "getUp",
  "death",
  "block",
  "parry",
]);

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
  const base = n.split("/").pop() || n;
  // Path ban list + name heuristics so renamed roll uploads can't slip in as "run"
  if (
    /roll|tumble|somersault|cartwheel/i.test(base) ||
    /quick[_\s-]?roll/i.test(n) ||
    /^running$/i.test(base) // bare "running" = historical run-to-roll file stem
  ) {
    return true;
  }
  return (BANNED_LOCOMOTION_CLIPS as readonly string[]).some(
    (b) =>
      n === b ||
      n.endsWith(`/${b}`) ||
      n.includes("Quick_Roll_To_Run") ||
      n.includes("Quick Roll To Run"),
  );
}

/**
 * GLB / mixer clip names that must never auto-map to walk/run/sprint.
 * "Running Roll", "roll-running", dodge cycles, etc.
 */
export function isBadLocoClipName(name: string): boolean {
  const n = String(name || "");
  return (
    /roll|dodge|tumble|flip|somersault|cartwheel|quick[_\s-]?roll/i.test(n) ||
    /run[-_\s]?to[-_\s]?roll|running[-_\s]?roll|roll[-_\s]?run/i.test(n) ||
    isBannedLocomotionClip(n)
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

/**
 * True if clip looks like a non-looping transition (run-to-roll class).
 * Safe for loadBakedClip (all roles) — does NOT reject long attack/skill takes.
 */
export function isNonLoopingLocoClip(clip: THREE.AnimationClip, rel = ""): boolean {
  if (isBannedLocomotionClip(rel) || isBadLocoClipName(clip.name || rel)) return true;
  // Classic run-to-roll: long + open pelvis loop
  if (clip.duration > 1.8 && pelvisLoopError(clip) > 0.25) return true;
  return false;
}

/**
 * Stricter gate for **walk / run / sprint only**.
 * Pure stride cycles are ~0.6–1.2s; Madarame full takes (~5s) must never drive gait.
 */
export function isUnsuitableLocoCycle(clip: THREE.AnimationClip, rel = ""): boolean {
  if (isNonLoopingLocoClip(clip, rel)) return true;
  if (clip.duration > 1.45) return true;
  if (clip.duration > 1.2 && pelvisLoopError(clip) > 0.08) return true;
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
    // Prefer same-origin JSON; loadBakedClip also tries prod/anims GLB roles.
    idle: "sword_shield/sword and shield idle",
    walk: "magic/Standing Walk Forward",
    run: "sword_shield/sword and shield run",
    attack: "sword_shield/sword and shield attack",
    extras: [
      // Preset knight weapon skills only (no extra weapon mesh swaps)
      "sword_shield/sword-and-shield-attack-2",
      "sword_shield/sword-and-shield-attack-3",
      "sword_shield/sword-and-shield-attack-4",
      "sword_shield/sword-and-shield-attack-5",
      "sword_shield/sword-and-shield-block",
      "sword_shield/sword-and-shield-block-idle",
      "sword_shield/one-hand-sword-combo",
      "polearm/slash",
      "polearm/thrust",
      "polearm/overhead",
      "polearm/combo",
      "polearm/skill1",
      "polearm/skill2",
      "block/parry",
      "block/left-block",
      "block/right-block",
    ],
  },
  /**
   * Samurai — production greatsword_samurai Bip001 JSON (retargeted).
   * Paths resolve via prod/anims/greatsword_samurai/* first.
   */
  samurai: {
    idle: "greatsword_samurai/gs_samurai_idle",
    walk: "greatsword_samurai/gs_samurai_walk",
    run: "greatsword_samurai/gs_samurai_run",
    attack: "greatsword_samurai/gs_samurai_combo_a",
    extras: [
      "greatsword_samurai/gs_samurai_combo_b",
      "greatsword_samurai/gs_samurai_dash_opener",
      "greatsword_samurai/gs_samurai_teleport_strike",
      "greatsword_samurai/gs_samurai_jump",
      "greatsword_samurai/gs_samurai_sword_on",
      "greatsword_samurai/gs_samurai_sword_off",
      "greatsword_samurai/gs_samurai_idle_sword",
      "greatsword_samurai/gs_samurai_walk_sword",
      "greatsword_samurai/gs_samurai_run_sword",
      // skill aliases filled by aliasCombatRoles from attack when missing
      "polearm/skill1",
      "polearm/skill2",
      "polearm/special",
    ],
  },
  longbow: {
    idle: "longbow/standing idle 01",
    walk: "longbow/standing walk forward",
    run: "longbow/standing run forward",
    attack: "longbow/standing aim recoil",
    extras: [
      "longbow/draw",
      "longbow/overdraw",
      "longbow/recoil",
      "longbow/equip",
      "longbow/disarm",
      "longbow/idle",
      "longbow/aim-idle",
      "longbow/run-forward",
      "longbow/walk-forward",
    ],
  },
  /**
   * Spear / 2H polearm — Madarame Bip001 bake (same-origin + prod mirror).
   */
  polearm: {
    idle: "polearm/idle",
    walk: "magic/Standing Walk Forward",
    run: "uploads_2026_06/locomotion/torch run forward",
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
  /**
   * 2H mace / war-hammer — not swords. SC_SC_Jab / ChargeStrike / 180x2Sweep /
   * SummonCrows from 2hweaponhammerretarget.glb (rotation-only, weapon chain off).
   */
  hammer: {
    idle: "twohand_hammer/idle",
    walk: "twohand_hammer/walk",
    run: "uploads_2026_06/locomotion/torch run forward",
    attack: "twohand_hammer/attack",
    extras: [
      "twohand_hammer/attack1",
      "twohand_hammer/attack2",
      "twohand_hammer/attack3",
      "twohand_hammer/jab",
      "twohand_hammer/charge",
      "twohand_hammer/sweep",
      "twohand_hammer/skill",
      "twohand_hammer/skill2",
      "twohand_hammer/skill-summon",
      "twohand_hammer/hit",
      "twohand_hammer/backstep",
      "twohand_hammer/dodgeB",
      "twohand_hammer/step-left",
      "twohand_hammer/step-right",
      "twohand_hammer/jump",
      "twohand_hammer/land",
    ],
  },
  /**
   * 2H sword / greatsword — **samurai** production bake (Bip001 JSON).
   * Primary attack + skills 1–4 use gs_samurai_* clips with Getsuga/slash VFX.
   * 2h_melee GLB paths remain as soft fallbacks via loadBakedClip candidates if needed.
   */
  twohand: {
    idle: "greatsword_samurai/gs_samurai_idle_sword",
    walk: "greatsword_samurai/gs_samurai_walk_sword",
    run: "greatsword_samurai/gs_samurai_run_sword",
    attack: "greatsword_samurai/gs_samurai_combo_a",
    extras: [
      // Slot / skill mapping (see grudge6Runtime extras role normalize + SAMURAI_2H_SKILLS)
      "greatsword_samurai/gs_samurai_combo_b", // skill1 / attack2
      "greatsword_samurai/gs_samurai_dash_opener", // skill2
      "greatsword_samurai/gs_samurai_teleport_strike", // skill3
      "greatsword_samurai/gs_samurai_jump_sword", // skill4 / jump attack
      "greatsword_samurai/gs_samurai_combo_a",
      "greatsword_samurai/gs_samurai_jump",
      "greatsword_samurai/gs_samurai_sword_on",
      "greatsword_samurai/gs_samurai_sword_off",
      // Soft fallbacks if samurai clip 404s
      "2h_melee/great-sword-slash",
      "2h_melee/great-sword-overhead",
      "2h_melee/great-sword-blocking",
    ],
  },
  /** Crossbow — longbow aim set until dedicated bake. */
  crossbow: {
    idle: "crossbow/idle",
    walk: "crossbow/walk",
    run: "crossbow/run",
    attack: "crossbow/shoot",
    extras: ["crossbow/aim", "crossbow/reload", "crossbow/skill1", "crossbow/skill2"],
  },
  /** Rifle — prod/anims/rifle JSON (Bip001 retargeted). */
  rifle: {
    idle: "rifle/rifle-aiming-idle",
    walk: "rifle/walking",
    run: "rifle/rifle-run",
    attack: "rifle/firing-rifle",
    extras: [
      "rifle/reloading",
      "rifle/rifle-jump",
      "rifle/hit-reaction",
      "rifle/downrange-aiming-idle",
      "rifle/strafe-left",
      "rifle/strafe-right",
    ],
  },
  /** Pistol — prod/anims/pistol GLB library. */
  pistol: {
    idle: "pistol/idle",
    walk: "pistol/walk-forward",
    run: "pistol/run-forward",
    attack: "pistol/gunplay",
    extras: [
      "pistol/charged-pistol",
      "pistol/pistol-whip",
      "pistol/drawing-gun",
      "pistol/pistol-jump",
      "pistol/strafe-left",
      "pistol/strafe-right",
    ],
  },
};

/**
 * Packs that may not have baked JSON yet → fall back for runtime safety.
 * Explosive FREE only ships teaser Attack1 clips; full packs required for twohand/crossbow.
 */
export const ANIM_PACK_FALLBACK: Partial<Record<AnimPack, AnimPack>> = {
  // twohand now uses samurai bake; only fall back to samurai pack id if needed
  twohand: "samurai",
  crossbow: "longbow",
  // rifle/pistol have prod packs — do not force unarmed
};

/**
 * Resolve pack + clip table.
 * Always returns a LoadoutClips row (twohand/crossbow/rifle rows exist for bake targets;
 * runtime falls back when loadBakedClip 404s — callers may prefer ANIM_PACK_FALLBACK first).
 */
export function resolveAnimPackClips(pack: AnimPack): {
  pack: AnimPack;
  clips: LoadoutClips;
  fallbackFrom?: AnimPack;
} {
  // Prefer fallback pack when we know full bake is not shipped yet
  // (Explosive FREE teasers only — see docs/EXPLOSIVE_WARRIOR_PACK_REVIEW.md).
  // Prefer intended pack clips (prod CDN fills gaps). Only force-fallback crossbow.
  if (pack === "crossbow") {
    const forceFb = ANIM_PACK_FALLBACK.crossbow;
    if (forceFb && ANIM_PACK_CLIPS[forceFb]) {
      return { pack: forceFb, clips: ANIM_PACK_CLIPS[forceFb]!, fallbackFrom: pack };
    }
  }
  const clips = ANIM_PACK_CLIPS[pack];
  if (clips) return { pack, clips };
  const fb = ANIM_PACK_FALLBACK[pack];
  if (fb && ANIM_PACK_CLIPS[fb]) {
    return { pack: fb, clips: ANIM_PACK_CLIPS[fb]!, fallbackFrom: pack };
  }
  return { pack: "unarmed", clips: ANIM_PACK_CLIPS.unarmed, fallbackFrom: pack };
}

/**
 * Shared traversal / mobility clips loaded for EVERY grudge6 hero.
 * Role keys match Studio dodge / wall / jump clip name lists.
 * Paths relative to /anims/baked/ (no .json).
 */
export const TRAVERSAL_CLIPS: ReadonlyArray<{ role: string; rel: string }> = [
  { role: "jump", rel: "locomotion/jump" },
  // Ghost Rider rolls are fleet SSOT for dodge (see end-of-list overrides)
  { role: "dodge", rel: "locomotion/dodge_back" },
  { role: "dodgeF", rel: "locomotion/dodge_fwd" },
  { role: "dodgeB", rel: "locomotion/dodge_back" },
  { role: "dodgeL", rel: "locomotion/dodge_l" },
  { role: "dodgeR", rel: "locomotion/dodge_r" },
  // Studio alias names (hyphen / underscore)
  { role: "standing-dodge-forward", rel: "longbow/standing dodge forward" },
  { role: "standing_dodge_forward", rel: "longbow/standing dodge forward" },
  { role: "standing-dodge-left", rel: "longbow/standing dodge left" },
  { role: "standing_dodge_left", rel: "longbow/standing dodge left" },
  { role: "standing-dodge-right", rel: "longbow/standing dodge right" },
  { role: "standing_dodge_right", rel: "longbow/standing dodge right" },
  { role: "standing-dodge-backward", rel: "locomotion/dodge_back" },
  { role: "standing_dodge_backward", rel: "locomotion/dodge_back" },
  { role: "dodge_forward", rel: "locomotion/dodge_fwd" },
  { role: "dodge_left", rel: "locomotion/dodge_l" },
  { role: "dodge_right", rel: "locomotion/dodge_r" },
  { role: "dodge_backward", rel: "locomotion/dodge_back" },
  // Mobility SSOT (bake plan + prod/anims fallbacks via loadBakedClip candidates)
  ...MOBILITY_CLIPS.map((m) => ({ role: m.role, rel: m.bakeRel })),
  // Dual-wield melee dash / attacks / hits (dual_wieldingandothers.glb → Bip001)
  ...DUAL_WIELD_CLIPS.map((m) => ({ role: m.role, rel: m.bakeRel })),
  // Ghost Rider (anim only) — finishers / chain / roll aliases.
  // Note: TRAVERSAL load is first-wins (`if clips.has(role) return`); early dodge_*
  // rows already point at locomotion/dodge_* (GR rolls). GHOST_RIDER fills missing roles only.
  ...GHOST_RIDER_CLIPS.map((m) => ({ role: m.role, rel: m.bakeRel })),
  // Prefer GR land/roll over legacy roll_dodge (only if roll not already set)
  { role: "roll", rel: "locomotion/roll_forward" },
  { role: "climbAlt", rel: "locomotion/climbup_1m" },
  { role: "swimFast", rel: "locomotion/swim_fast" },
  { role: "fall", rel: "locomotion/fall_in" },
  { role: "harvest", rel: "locomotion/plant_seed" },
  { role: "plant", rel: "harvest/plant-tree" },
  { role: "block", rel: "block/standing-block-idle" },
  { role: "parry", rel: "block/parry" },
  { role: "blockHit", rel: "block/block-react-large" },
];

/**
 * Map arsenal weapon id → anim pack (overrides class default when 2H/spear/gun).
 * See docs/EXPLOSIVE_WARRIOR_PACK_REVIEW.md for ExplosiveLLC → pack mapping.
 */
export function animPackForWeapon(weaponId: string | null | undefined): AnimPack | null {
  const w = String(weaponId || "").toLowerCase();
  if (!w || w === "none") return "unarmed";
  // Blunt 2H / mace / war-hammer — dedicated SC_SC bake (NOT samurai blades)
  if (
    w === "hammer2h" ||
    w === "mace2h" ||
    w === "maul" ||
    w === "warhammer" ||
    w === "war_hammer" ||
    (w.includes("hammer") && w.includes("2h")) ||
    w === "mace" ||
    w === "hammer"
  ) {
    return "hammer";
  }
  // 2H heavy blades — samurai anim pack (twohand SSOT = greatsword_samurai clips)
  if (
    w === "greatsword" ||
    w === "greataxe" ||
    w === "scythe" ||
    w === "nodachi" ||
    w === "two_hand_sword" ||
    w === "2h_sword"
  ) {
    return "twohand"; // clips are samurai; alias also "samurai"
  }
  // Polearm / spear family — Madarame bake SSOT
  if (w === "spear" || w === "javelin" || w === "lance" || w === "halberd" || w === "polearm") {
    return "polearm";
  }
  if (w.startsWith("staff") || w === "wand" || w === "tome") return "magic";
  // Crossbow — Explosive Crossbow pack when baked; else longbow aim set
  if (w === "crossbow") return "crossbow";
  if (w === "bow" || w === "longbow") return "longbow";
  // Sidearm vs long gun (separate baked packs)
  if (w === "pistol" || w === "revolver" || w === "handgun") {
    return "pistol";
  }
  if (
    w === "rifle" ||
    w === "hunter-rifle" ||
    w === "shotgun" ||
    w === "gunblade" ||
    w === "assault_rifle" ||
    w === "ak74u" ||
    w === "smg" ||
    w === "gun"
  ) {
    return "rifle";
  }
  if (w === "sword" || w === "axe" || w === "dagger" || w === "shield") {
    return "sword_shield";
  }
  // Katana / samurai weapons
  if (w === "katana" || w === "samurai" || w === "nodachi" || w === "wakizashi") {
    return "samurai";
  }
  return null;
}

export function asAnimPack(value: string): AnimPack {
  if (value in ANIM_PACK_CLIPS) return value as AnimPack;
  // Accept aliases used in gear / Explosive maps / combat styles
  const alias: Record<string, AnimPack> = {
    "2h": "twohand",
    "2h_melee": "twohand",
    greatsword: "twohand",
    greataxe: "twohand",
    gun: "rifle",
    handgun: "pistol",
    revolver: "pistol",
    bow: "longbow",
    katana: "samurai",
    iaijutsu: "samurai",
    greatsword_samurai: "samurai",
    knight: "sword_shield",
    spearman: "polearm",
    spear: "polearm",
    striker: "unarmed",
    mage: "magic",
    archer: "longbow",
    gunner: "rifle",
    berserker: "twohand",
    hammer: "hammer",
    hammer2h: "hammer",
    mace: "hammer",
    mace2h: "hammer",
    maul: "hammer",
    warhammer: "hammer",
  };
  return alias[value] ?? "unarmed";
}

/** Human labels for pack picker / Admin. */
export const ANIM_PACK_LABELS: Record<AnimPack, string> = {
  unarmed: "Unarmed / Striker",
  sword_shield: "Knight (Sword & Shield)",
  samurai: "Samurai (Retargeted)",
  polearm: "Spearman (Madarame)",
  magic: "Mage / Staff",
  longbow: "Archer / Longbow",
  twohand: "Berserker / 2H",
  hammer: "2H Mace / War Hammer",
  crossbow: "Crossbow",
  rifle: "Gunner / Rifle",
  pistol: "Pistol / Sidearm",
};

/** Packs offered as explicit player choices (retargeted / ready). */
export const CHOOSABLE_ANIM_PACKS: AnimPack[] = [
  "samurai",
  "sword_shield",
  "polearm",
  "hammer",
  "unarmed",
  "magic",
  "longbow",
  "twohand",
  "rifle",
  "pistol",
];

/**
 * @deprecated NAME LIE — this path is **run-to-roll**, not a sprint cycle.
 * Do not load for sprint/run/walk. Runtime clones pack `run` and scales with
 * {@link SPRINT_LOCO_MULT}. Kept only so old imports compile.
 */
export const SPRINT_CLIP = "locomotion/running";

/** Playback scale for sprint band vs run (matches arena SPRINT_LOCO_MULT). */
export const SPRINT_LOCO_MULT = 1.75;

/**
 * True if a human label / file stem is a fake "sprint" that is actually roll
 * or run-to-roll (naming errors in uploads and Mixamo folders).
 */
export function isFakeSprintName(name: string): boolean {
  const n = String(name || "").toLowerCase().replace(/\\/g, "/");
  if (isBannedLocomotionClip(n)) return true;
  // Mixamo folders often mislabel transitions as sprint
  if (/crouch[-_\s]?to[-_\s]?sprint|crouched[-_\s]?to[-_\s]?sprint/.test(n)) return true;
  if (/sprint/.test(n) && /roll|tumble|dive|somersault|crawl/.test(n)) return true;
  if (n.includes("run") && n.includes("roll")) return true;
  if (n.includes("locomotion/running")) return true;
  return false;
}

/** Resolve which clip role to play for a weapon skill slot (1–4). */
export function skillSlotToClipRole(slot: 1 | 2 | 3 | 4): string {
  return (`skill${slot}` as const);
}

// Build the primary URL for a baked clip (R2 default; loaders try all hosts).
export function bakedClipUrl(rel: string, baseOverride?: string): string {
  const path = `anims/baked/${rel}.json`;
  if (baseOverride !== undefined) {
    return `${baseOverride.replace(/\/+$/, "")}/${path}`;
  }
  return `${FLEET_ASSET_HOSTS.r2}/${path}`;
}

/**
 * Map logical pack folder → production CDN pack id under prod/anims/.
 */
function prodAnimPackId(pack: string): string {
  const p = pack.toLowerCase();
  if (p === "samurai" || p === "greatsword_samurai") return "greatsword_samurai";
  if (p === "twohand" || p === "2h" || p === "2h_melee") return "2h_melee";
  if (p === "spear") return "spear";
  return pack;
}

/**
 * Candidate URLs for a clip rel like `sword_shield/sword and shield idle`
 * or `pistol/idle` or `2h_melee/great-sword-idle`.
 *
 * Order: same-origin baked JSON → prod CDN JSON → prod CDN GLB → arena → R2.
 * Heroes use baked anims only (no Mixamo FBX on Vercel).
 */
export function bakedClipCandidates(rel: string, baseOverride?: string): string[] {
  const clean = String(rel || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.json$/i, "")
    .replace(/\.glb$/i, "");
  const parts = clean.split("/").filter(Boolean);
  const pack = parts[0] || "";
  const file = parts.slice(1).join("/") || pack;
  const fileSlug = file.replace(/\s+/g, "-");
  const fileUnderscore = file.replace(/\s+/g, "_");
  const prodPack = prodAnimPackId(pack);

  const urls: string[] = [];
  const bakedJson = `anims/baked/${clean}.json`;

  // Same-origin first (Open vercel rewrites → arena/public)
  if (typeof window !== "undefined" && window.location?.origin) {
    urls.push(`${window.location.origin}/${bakedJson}`);
    urls.push(`/${bakedJson}`);
  } else {
    urls.push(`/${bakedJson}`);
  }
  if (baseOverride) {
    urls.push(`${baseOverride.replace(/\/+$/, "")}/${bakedJson}`);
  }

  // Production packages (JSON tracks + GLB animation libraries)
  const prodBase = PROD_ANIMS_CDN.replace(/\/+$/, "");
  if (prodPack && file) {
    for (const stem of [file, fileSlug, fileUnderscore]) {
      if (!stem) continue;
      urls.push(`${prodBase}/${prodPack}/${stem}.json`);
      urls.push(`${prodBase}/${prodPack}/${stem}.glb`);
    }
    // Same-origin proxy for prod if configured
    urls.push(`/prod/anims/${prodPack}/${fileSlug}.json`);
    urls.push(`/prod/anims/${prodPack}/${fileSlug}.glb`);
  }

  // Arena CDN (historical) then fleet hosts
  urls.push(`${FLEET_ASSET_HOSTS.arena}/${bakedJson}`);
  urls.push(...resolveGrudgeAssetCandidates(bakedJson));
  return [...new Set(urls)];
}

// Rotation-only conformation — bone lengths come from the MODEL skeleton, motion
// (rotations) comes from the clip. Baked Bip001 clips are already rotation-only,
// so this is effectively a no-op for them, but it stays as a safety net.
export function toRotationOnlyClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => t.name.endsWith(".quaternion"));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/** Load first animation from a production GLB anim library (FBX→GLB bake). */
async function loadClipFromGlbUrl(url: string): Promise<THREE.AnimationClip> {
  const { sharedGltfLoader } = await import("../loaders/gltf");
  const loader = sharedGltfLoader();
  const gltf = await loader.loadAsync(url);
  const list = gltf.animations ?? [];
  if (!list.length) {
    throw new Error(`GLB has no animations: ${url}`);
  }
  // Prefer named clip matching URL stem
  const stem = url.split("/").pop()?.replace(/\.glb$/i, "") ?? "";
  const named =
    list.find((c) => c.name && stem && c.name.toLowerCase().includes(stem.slice(0, 12))) ??
    list[0]!;
  return toRotationOnlyClip(named);
}

// Fetch + parse a baked Bip001 clip as a rotation-only AnimationClip (multi-host).
// Supports JSON track packs and prod/anims/*.glb animation libraries.
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
      if (/\.glb(\?|$)/i.test(url)) {
        const clip = await loadClipFromGlbUrl(url);
        if (isNonLoopingLocoClip(clip, rel)) {
          lastErr = new Error(`non-looping loco GLB ${rel} dur=${clip.duration.toFixed(2)}`);
          continue;
        }
        clip.name = clip.name || rel.split("/").pop() || rel;
        return clip;
      }

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
      // Some CDN keys may return binary mislabeled — sniff
      if (ct.includes("model/gltf") || ct.includes("octet-stream")) {
        const clip = await loadClipFromGlbUrl(url);
        return clip;
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
  throw assetLoadError(`anims/baked|prod/anims/${rel}`, lastErr);
}

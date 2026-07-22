/**
 * Host adapter contract — any Voxel / Warlords / Open scene implements this
 * thin surface so the same CombatController + fleet rules drive combat.
 *
 * Three.js / Rapier / DOM stay in the host; pure rules stay in epicfight.
 */

import type { AttackPayload, DefensiveResult, DodgeDir } from "../types.js";
import type { CombatController } from "../CombatController.js";
import type { FleetWeaponSkill } from "./weaponSkill.js";
import type { ParrySide } from "./rules.js";

/** Minimal 3-vector so hosts don't need to import Three in this package. */
export type FleetVec3 = { x: number; y: number; z: number };

/**
 * What every fleet combat host must provide.
 * Studio / Warlord battle / Voxel arena each implement this once.
 */
export interface FleetCombatHost {
  /** Player combat state machine (epicfight). */
  playerCC: CombatController;

  getStamina(): number;
  getMaxStamina(): number;
  getHealth(): number;
  drainStamina(amount: number, holdRegen?: number): void;
  restoreStamina(amount: number, holdRegen?: number): void;

  /** World player position (feet). */
  playerPosition(): FleetVec3;
  /** Planar forward (unit). */
  playerForward(): FleetVec3;

  /** Play one-shot clip by name; return duration s or 0 if missing. */
  playAnim(clipOrRole: string, opts?: { from?: number; to?: number; timeScale?: number; fade?: number }): number;
  /** Root motion dash in world metres. */
  dash(dir: FleetVec3, distance: number, duration: number): void;
  /** Optional hop for roll start. */
  hop?(height: number): void;

  /** Apply hit against hostiles near center (returns primary result). */
  hitHostiles(
    center: FleetVec3,
    radius: number,
    payload: AttackPayload,
  ): DefensiveResult | null;

  /** Spawn cast / impact VFX by catalog id. */
  spawnVfx?(effectId: string, at: FleetVec3, color?: number): void;
  /** Spawn slash projectile (Getsuga family). */
  spawnSlashProjectile?(
    from: FleetVec3,
    dir: FleetVec3,
    opts: {
      variant?: string;
      speed?: number;
      range?: number;
      aim?: FleetVec3;
    },
  ): void;

  /** Flash combat HUD string. */
  combatFlash?(text: string, sec?: number): void;

  /** Resolve equipped weapon skills (4-slot kit). */
  getWeaponSkills?(): FleetWeaponSkill[];
  /** Cast skill by slot; host owns CD tracking. */
  castSkill?(slot: 0 | 1 | 2 | 3): boolean;
}

/** Optional soft-lock / focus for directional parry. */
export interface FleetCombatTargeting {
  /** Hard-lock or soft-lock world point, or null. */
  focusPoint(): FleetVec3 | null;
  /** Side of threat relative to player facing. */
  threatSide(threat: FleetVec3): ParrySide;
}

/**
 * Suggested lifecycle for hosts (document, don't enforce):
 *
 * 1. Construct CombatController via makeFighterCC / fighterConfig
 * 2. Each frame: playerCC.update(dt); apply root motion from dodge/slide plans
 * 3. On input: planDodge / parry / slide → drain stam → anim → dash
 * 4. On incoming hit: playerCC.applyAttack(payload) → resolveDefense outcomes
 * 5. On skill cast: read FleetWeaponSkill → anim + mesh + collider + VFX + CD
 */
export type FleetCombatBootstrap = {
  host: FleetCombatHost;
  targeting?: FleetCombatTargeting;
  /** Called once after host ready — preload slash meshes / skill GLBs */
  onReady?: () => void;
};

/** Default player combat config patch used by Open + recommended for Warlords. */
export function fleetPlayerCombatPatch(): {
  maxStamina: number;
  staminaRegenPerSec: number;
  dodge: {
    duration: number;
    iframeStart: number;
    iframeEnd: number;
    staminaCost: number;
    distance: number;
  };
  block: { staminaCostOnRaise: number; staminaDrainPerSec: number; force: number };
  parry: {
    deflectWindow: number;
    perfectWindow: number;
    force: number;
    staminaCost: number;
  };
} {
  return {
    maxStamina: 120,
    staminaRegenPerSec: 22,
    dodge: {
      duration: 0.72,
      iframeStart: 0.06,
      iframeEnd: 0.56,
      staminaCost: 48,
      distance: 4.9,
    },
    block: { staminaCostOnRaise: 8, staminaDrainPerSec: 10, force: 2 },
    parry: {
      deflectWindow: 0.3,
      perfectWindow: 0.12,
      force: 2,
      staminaCost: 18,
    },
  };
}

// re-export CombatController type for host typing without deep paths
export type { CombatController, AttackPayload, DefensiveResult, DodgeDir };

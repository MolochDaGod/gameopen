import {
  CombatController,
  defaultCombatConfig,
  type CombatConfig,
  type CombatEvents,
  type DefensiveOutcome,
} from "@workspace/epicfight";

/**
 * Single source of truth for fighter combat tuning. Every combatant in the
 * Animator — the player, each sparring opponent, each dungeon enemy and every
 * boss — owns one {@link CombatController} built here, and ALL damage/defense
 * resolves through `defenderCC.applyAttack(payload)`. This module only holds the
 * per-archetype config + a couple of pure mapping helpers so the engine stays
 * the single combat authority (no parallel damage maths).
 */
export type FighterArchetype = "player" | "grunt" | "elite" | "boss";

/** Per-archetype overrides layered on top of `defaultCombatConfig`. */
const ARCHETYPE_CONFIG: Record<FighterArchetype, Partial<CombatConfig>> = {
  player: {
    maxHealth: 100,
    maxStamina: 120,
    staminaRegenPerSec: 22,
    staminaRegenDelay: 0.5,
    maxPoise: 60,
    poiseRegenPerSec: 15,
    staggerDuration: 0.55,
    stunnedDuration: 1.8,
    fallenDuration: 1.4,
    critWindowDuration: 2.0,
    // Timed roll: ~0.5s i-frames; Studio scales travel by stamina (40% cost).
    // max distance = baseline + 0.5 m; floor 0.5 m under 15% stamina.
    dodge: {
      duration: 0.72,
      iframeStart: 0.06,
      iframeEnd: 0.56,
      staminaCost: 48, // 40% of maxStamina 120 — Studio may override with frac
      distance: 4.9,
    },
    block: { staminaCostOnRaise: 8, staminaDrainPerSec: 10, force: 2 },
    parry: { deflectWindow: 0.3, perfectWindow: 0.12, force: 2, staminaCost: 18 },
  },
  grunt: {
    maxHealth: 100,
    maxStamina: 80,
    staminaRegenPerSec: 15,
    staminaRegenDelay: 0.7,
    maxPoise: 40,
    poiseRegenPerSec: 10,
    staggerDuration: 0.7,
    stunnedDuration: 2.0,
    fallenDuration: 1.5,
    critWindowDuration: 2.0,
  },
  elite: {
    maxHealth: 190,
    maxStamina: 110,
    staminaRegenPerSec: 16,
    maxPoise: 75,
    poiseRegenPerSec: 13,
    staggerDuration: 0.55,
    stunnedDuration: 1.6,
    fallenDuration: 1.3,
    critWindowDuration: 1.8,
  },
  boss: {
    maxHealth: 560,
    maxStamina: 180,
    staminaRegenPerSec: 20,
    maxPoise: 150,
    poiseRegenPerSec: 20,
    staggerDuration: 0.45,
    stunnedDuration: 1.3,
    // A knee-poise break drops the boss into a long, exploitable "downed" window
    // (head/chest exposed for big bonus damage) before it gets up and re-armours.
    // The crit window is held open for the same span so every blow during the
    // downed phase auto-upgrades to a crit through the CC.
    fallenDuration: 3.0,
    critWindowDuration: 3.5,
    block: { staminaCostOnRaise: 4, staminaDrainPerSec: 6, force: 3 },
    // Boss: slightly wider parry than players (fairness), still T0-aligned.
    parry: { deflectWindow: 0.32, perfectWindow: 0.12, force: 3, staminaCost: 12 },
  },
  // Player defaults come from epicfight defaultCombatConfig (T0 reaction windows).
};

/** Resolve a full {@link CombatConfig} for an archetype, with optional overrides. */
export function fighterConfig(
  arch: FighterArchetype,
  overrides: Partial<CombatConfig> = {},
): CombatConfig {
  return defaultCombatConfig({ ...ARCHETYPE_CONFIG[arch], ...overrides });
}

/** Build a fresh {@link CombatController} for `arch` (defender-only moveset). */
export function makeFighterCC(
  arch: FighterArchetype,
  events: CombatEvents = {},
  overrides: Partial<CombatConfig> = {},
): CombatController {
  return new CombatController(
    fighterConfig(arch, overrides),
    { id: arch, light: [], heavy: [] },
    events,
  );
}

/**
 * Knockback multiplier for a resolved outcome: a clean hit shoves fully, a crit
 * a little more, a stopped block barely nudges, and any full avoidance (deflect/
 * parry/dodge) applies no shove. Keeps the force system in lockstep with damage.
 */
export function outcomeForceScale(outcome: DefensiveOutcome): number {
  switch (outcome) {
    case "crit":
      return 1.25;
    case "hit":
      return 1;
    case "blockStop":
      return 0.2;
    case "deflect":
    case "perfectParry":
    case "dodgeEvade":
    case "dodgePunish":
      return 0;
  }
}

/** True when the outcome avoided damage (block/parry/dodge), false on hit/crit. */
export function isDefended(outcome: DefensiveOutcome): boolean {
  return outcome !== "hit" && outcome !== "crit";
}

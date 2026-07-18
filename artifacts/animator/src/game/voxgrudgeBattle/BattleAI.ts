/**
 * Bot brains for VoxGrudge Battle.
 * Strategy profiles → movement + skill + sidearm decisions (pure math, no Three).
 */

import { profileForStrategy } from "../strategyProfiles";
import type { StrategyProfileId } from "../modes";
import type { BattleFighterLive, BattleMode } from "./types";
import { strategyForWeapon } from "./botRoster";
import type { WeaponId } from "../../three/types";

export type BotIntent =
  | { kind: "idle" }
  | { kind: "chase"; tx: number; tz: number }
  | { kind: "strafe"; tx: number; tz: number; dir: 1 | -1 }
  | { kind: "retreat"; tx: number; tz: number }
  | { kind: "support"; tx: number; tz: number }
  | { kind: "attack"; skillSlot: 1 | 2 | 3 | 4 | null }
  | { kind: "swapSidearm" };

export interface BotBrainState {
  id: string;
  strategy: StrategyProfileId;
  primary: WeaponId;
  reactionTimer: number;
  strafeDir: 1 | -1;
  skillCd: [number, number, number, number];
  lastIntent: BotIntent;
}

export function createBrain(
  id: string,
  strategy: StrategyProfileId,
  primary: WeaponId,
): BotBrainState {
  return {
    id,
    strategy: strategy || strategyForWeapon(primary),
    primary,
    reactionTimer: 0,
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    skillCd: [0, 0, 0, 0],
    lastIntent: { kind: "idle" },
  };
}

function dist(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.hypot(dx, dz);
}

function pickTarget(
  self: BattleFighterLive,
  all: BattleFighterLive[],
  mode: BattleMode,
): BattleFighterLive | null {
  let best: BattleFighterLive | null = null;
  let bestD = Infinity;
  for (const o of all) {
    if (!o.alive || o.id === self.id) continue;
    if (o.team === self.team) continue;
    const d = dist(self.x, self.z, o.x, o.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function allyTarget(self: BattleFighterLive, all: BattleFighterLive[]): BattleFighterLive | null {
  let best: BattleFighterLive | null = null;
  let bestD = Infinity;
  for (const o of all) {
    if (!o.alive || o.id === self.id) continue;
    if (o.team !== self.team) continue;
    const d = dist(self.x, self.z, o.x, o.z);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/**
 * Tick one bot brain. Call at ~10–20 Hz; host applies movement each frame.
 */
export function thinkBot(
  brain: BotBrainState,
  self: BattleFighterLive,
  all: BattleFighterLive[],
  mode: BattleMode,
  dt: number,
  zoneCenter: { x: number; z: number },
  zoneRadius: number,
): BotIntent {
  const prof = profileForStrategy(brain.strategy);
  for (let i = 0; i < 4; i++) {
    brain.skillCd[i] = Math.max(0, brain.skillCd[i]! - dt);
  }
  brain.reactionTimer -= dt;

  // Zone pressure — retreat toward center if near edge
  const fromCenter = dist(self.x, self.z, zoneCenter.x, zoneCenter.z);
  if (fromCenter > zoneRadius * 0.92) {
    brain.lastIntent = { kind: "chase", tx: zoneCenter.x, tz: zoneCenter.z };
    return brain.lastIntent;
  }

  if (brain.reactionTimer > 0) return brain.lastIntent;
  brain.reactionTimer = prof.reactionLatency + Math.random() * 0.08;

  const foe = pickTarget(self, all, mode);
  if (!foe) {
    brain.lastIntent = { kind: "idle" };
    return brain.lastIntent;
  }

  const d = dist(self.x, self.z, foe.x, foe.z);
  const w = prof.weights;
  const hp01 = self.hp / Math.max(1, self.maxHp);

  // Support ally when healer / tank and ally is low
  if ((brain.strategy === "support-healer" || brain.strategy === "tank-guard") && mode === "duos") {
    const ally = allyTarget(self, all);
    if (ally && ally.hp / ally.maxHp < 0.45 && (w.support ?? 0) > 0.8) {
      brain.lastIntent = { kind: "support", tx: ally.x, tz: ally.z };
      return brain.lastIntent;
    }
  }

  // Low HP retreat
  if (hp01 < 0.28 * prof.bias.caution && d < 14) {
    brain.lastIntent = { kind: "retreat", tx: foe.x, tz: foe.z };
    return brain.lastIntent;
  }

  // Sidearm swap at mid range if ranged primary and too close
  if (prof.preferRanged && d < 5 && !self.usingSidearm && Math.random() < 0.15) {
    brain.lastIntent = { kind: "swapSidearm" };
    return brain.lastIntent;
  }
  if (prof.preferRanged && d > 12 && self.usingSidearm && Math.random() < 0.2) {
    brain.lastIntent = { kind: "swapSidearm" };
    return brain.lastIntent;
  }

  // Attack band
  const engage = prof.preferRanged ? 18 : 3.2;
  const inner = prof.preferRanged ? 8 : 1.4;

  if (d <= engage && d >= inner * 0.7) {
    // skill pick weighted
    let skillSlot: 1 | 2 | 3 | 4 | null = null;
    if (Math.random() < prof.bias.skillFrequency) {
      const order: (1 | 2 | 3 | 4)[] = prof.preferRanged ? [3, 2, 4, 1] : [1, 2, 4, 3];
      for (const s of order) {
        if (brain.skillCd[s - 1]! <= 0) {
          skillSlot = s;
          brain.skillCd[s - 1] = s === 4 ? 4.5 : s === 3 ? 2.2 : s === 2 ? 2.8 : 1.6;
          break;
        }
      }
    }
    brain.lastIntent = { kind: "attack", skillSlot };
    return brain.lastIntent;
  }

  if (d < inner) {
    if (Math.random() < 0.4) brain.strafeDir = brain.strafeDir === 1 ? -1 : 1;
    brain.lastIntent = { kind: "strafe", tx: foe.x, tz: foe.z, dir: brain.strafeDir };
    return brain.lastIntent;
  }

  // Close gap or kite
  if (prof.preferRanged && d < engage * 0.85) {
    brain.lastIntent = { kind: "retreat", tx: foe.x, tz: foe.z };
  } else {
    brain.lastIntent = { kind: "chase", tx: foe.x, tz: foe.z };
  }
  return brain.lastIntent;
}

/** Move speed m/s by strategy. */
export function botMoveSpeed(strategy: StrategyProfileId): number {
  const p = profileForStrategy(strategy);
  if (p.preferRanged) return 5.2;
  if (p.bias.aggression > 1.2) return 6.4;
  return 5.8;
}

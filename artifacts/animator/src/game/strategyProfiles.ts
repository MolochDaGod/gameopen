/**
 * AI strategy profiles → FighterBias + tactical weights.
 * Consumed by FighterBrain host (Targets) and ally directors.
 *
 * Three.js best practice: keep AI pure (no Three objects here).
 * Host applies perception from world matrices each frame.
 */

import type { FighterBias } from "../three/ai/FighterBrain";
import type { StrategyProfileId } from "./modes";

export interface StrategyProfile {
  id: StrategyProfileId;
  label: string;
  /** Maps to FighterBrain bias. */
  bias: FighterBias;
  /** Seconds of reaction latency before a new goal commits. */
  reactionLatency: number;
  /** Prefer gap-close lunges over walk-in when in band. */
  preferLunge: boolean;
  /** Prefer spell/turret stand-off when available. */
  preferRanged: boolean;
  /** Ally-only: stay near player within this radius (m). */
  supportRadius?: number;
  /** Boss-only: phase aggressiveness multipliers. */
  phaseAggression?: { armored: number; downed: number };
  /** Goal desirability weights (higher = more often). */
  weights: {
    engage: number;
    attack: number;
    defend: number;
    retreat: number;
    cast: number;
    deploy: number;
    support: number;
  };
}

export const STRATEGY_PROFILES: Record<StrategyProfileId, StrategyProfile> = {
  "aggressive-rusher": {
    id: "aggressive-rusher",
    label: "Aggressive Rusher",
    bias: { aggression: 1.35, caution: 0.45, skillFrequency: 0.55 },
    reactionLatency: 0.08,
    preferLunge: true,
    preferRanged: false,
    weights: {
      engage: 1.2,
      attack: 1.4,
      defend: 0.5,
      retreat: 0.2,
      cast: 0.3,
      deploy: 0.1,
      support: 0,
    },
  },
  "cautious-duelist": {
    id: "cautious-duelist",
    label: "Cautious Duelist",
    bias: { aggression: 0.85, caution: 1.25, skillFrequency: 0.35 },
    reactionLatency: 0.14,
    preferLunge: false,
    preferRanged: false,
    weights: {
      engage: 0.9,
      attack: 1.0,
      defend: 1.3,
      retreat: 0.7,
      cast: 0.4,
      deploy: 0.2,
      support: 0,
    },
  },
  "ranged-skirmisher": {
    id: "ranged-skirmisher",
    label: "Ranged Skirmisher",
    bias: { aggression: 0.7, caution: 1.1, skillFrequency: 0.25 },
    reactionLatency: 0.12,
    preferLunge: false,
    preferRanged: true,
    weights: {
      engage: 0.6,
      attack: 0.5,
      defend: 0.8,
      retreat: 1.0,
      cast: 1.5,
      deploy: 0.9,
      support: 0.2,
    },
  },
  "support-healer": {
    id: "support-healer",
    label: "Support / Ally",
    bias: { aggression: 0.5, caution: 1.0, skillFrequency: 0.2 },
    reactionLatency: 0.16,
    preferLunge: false,
    preferRanged: true,
    supportRadius: 8,
    weights: {
      engage: 0.5,
      attack: 0.6,
      defend: 1.1,
      retreat: 0.5,
      cast: 0.8,
      deploy: 0.6,
      support: 1.6,
    },
  },
  "tank-guard": {
    id: "tank-guard",
    label: "Tank Guard",
    bias: { aggression: 0.9, caution: 1.15, skillFrequency: 0.3 },
    reactionLatency: 0.11,
    preferLunge: true,
    preferRanged: false,
    supportRadius: 5,
    weights: {
      engage: 1.1,
      attack: 0.9,
      defend: 1.4,
      retreat: 0.3,
      cast: 0.2,
      deploy: 0.4,
      support: 1.2,
    },
  },
  "boss-phased": {
    id: "boss-phased",
    label: "Phased Boss",
    bias: { aggression: 1.1, caution: 0.9, skillFrequency: 0.65 },
    reactionLatency: 0.1,
    preferLunge: true,
    preferRanged: true,
    phaseAggression: { armored: 0.85, downed: 1.4 },
    weights: {
      engage: 1.0,
      attack: 1.2,
      defend: 1.0,
      retreat: 0.4,
      cast: 1.1,
      deploy: 0.5,
      support: 0,
    },
  },
  "swarm-horde": {
    id: "swarm-horde",
    label: "Swarm Horde",
    bias: { aggression: 1.5, caution: 0.3, skillFrequency: 0.15 },
    reactionLatency: 0.2,
    preferLunge: true,
    preferRanged: false,
    weights: {
      engage: 1.5,
      attack: 1.3,
      defend: 0.2,
      retreat: 0.1,
      cast: 0.1,
      deploy: 0,
      support: 0,
    },
  },
  flanker: {
    id: "flanker",
    label: "Flanker",
    bias: { aggression: 1.05, caution: 0.95, skillFrequency: 0.45 },
    reactionLatency: 0.1,
    preferLunge: true,
    preferRanged: false,
    weights: {
      engage: 1.0,
      attack: 1.15,
      defend: 0.7,
      retreat: 0.6,
      cast: 0.5,
      deploy: 0.3,
      support: 0.1,
    },
  },
  commander: {
    id: "commander",
    label: "Commander",
    bias: { aggression: 0.95, caution: 1.05, skillFrequency: 0.5 },
    reactionLatency: 0.13,
    preferLunge: false,
    preferRanged: true,
    weights: {
      engage: 0.8,
      attack: 0.9,
      defend: 1.0,
      retreat: 0.5,
      cast: 1.2,
      deploy: 1.4,
      support: 0.8,
    },
  },
};

export function biasForStrategy(id: StrategyProfileId): FighterBias {
  return { ...STRATEGY_PROFILES[id].bias };
}

export function profileForStrategy(id: StrategyProfileId): StrategyProfile {
  return STRATEGY_PROFILES[id];
}

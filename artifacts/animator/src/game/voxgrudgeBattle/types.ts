/**
 * VoxGrudge Battle — shared pure types (no Three.js).
 * Last-fighter-standing battleground on Hunger Games Arena + practice biome kit.
 */

import type { WeaponId } from "../../three/types";
import type { StrategyProfileId } from "../modes";

export type BattleMode = "singles" | "duos";

export type BattlePhase =
  | "lobby" // pre-battle loadout UI
  | "countdown"
  | "alive"
  | "spectate"
  | "result";

export type AnimalKind = "gator" | "fox" | "wolf" | "buffalo" | "bear";

export type BiomeKitId =
  | "hunger-center"
  | "forest-pocket"
  | "coast-docks"
  | "faction-fort"
  | "enemy-wall"
  | "ruins-plaza"
  | "river-bend";

/** Primary weapon + sidearm selected pre-battle (Danger Room skill kits). */
export interface BattleLoadout {
  primary: WeaponId;
  sidearm: WeaponId;
  /** T0 skill slots 1–4 bound to primary (labels resolved at equip time). */
  skillLabels?: [string, string, string, string];
}

export interface BattleSpawnPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Team index for duos (0..7). Singles: each player own team. */
  team: number;
}

export interface BattleFighterSpec {
  id: string;
  name: string;
  isBot: boolean;
  isLocal: boolean;
  team: number;
  avatarRaceId: string;
  model: string;
  strategy: StrategyProfileId;
  loadout: BattleLoadout;
  spawn: BattleSpawnPoint;
  /** Tint for minimap / team stripe */
  color: string;
}

export interface BattleFighterLive {
  id: string;
  alive: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  kills: number;
  team: number;
  name: string;
  isBot: boolean;
  isLocal: boolean;
  color: string;
  /** Currently holding sidearm vs primary */
  usingSidearm: boolean;
}

export interface BattleMatchConfig {
  mode: BattleMode;
  /** 2..16 inclusive */
  playerSlots: number;
  fillWithBots: boolean;
  mapId: string;
  seed: string;
  localLoadout: BattleLoadout;
  localRaceId: string;
  localName: string;
}

export interface BattleHudSnapshot {
  phase: BattlePhase;
  mode: BattleMode;
  aliveCount: number;
  maxPlayers: number;
  localHp: number;
  localMaxHp: number;
  localKills: number;
  placement: number | null;
  countdown: number;
  winnerName: string | null;
  winnerTeam: number | null;
  minimapOpen: boolean;
  fighters: BattleFighterLive[];
  primary: WeaponId;
  sidearm: WeaponId;
  usingSidearm: boolean;
  skills: Array<{ slot: 1 | 2 | 3 | 4; label: string; cd: number; cdMax: number; ready: boolean }>;
  killFeed: string[];
  loadError: string | null;
}

export const MAX_BATTLE_PLAYERS = 16;
export const MIN_BATTLE_PLAYERS = 2;
export const DEFAULT_BATTLE_HP = 150;
export const SHRINK_START_SEC = 90;
export const SHRINK_END_RADIUS = 12;
export const ARENA_RADIUS = 72;

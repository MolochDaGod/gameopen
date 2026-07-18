/**
 * Bot roster — avatars, brains (strategy), loadouts for VoxGrudge Battle fill.
 */

import type { StrategyProfileId } from "../modes";
import type { BattleFighterSpec, BattleLoadout, BattleMode } from "./types";
import { DEFAULT_BATTLE_LOADOUT } from "./weaponLoadout";
import { buildSpawnRing } from "./mapDeployment";
import type { WeaponId } from "../../three/types";

const BOT_NAMES = [
  "Ashen", "Brink", "Cinder", "Drift", "Ember", "Frost", "Grit", "Haze",
  "Ivy", "Jolt", "Knurl", "Lumen", "Moss", "Nyx", "Oath", "Pike",
  "Quill", "Rook", "Sable", "Thorn", "Ulric", "Vesper", "Wren", "Yarrow",
];

const RACES = ["human", "orc", "undead", "barbarian", "dwarf", "high_elf"] as const;

const STRATEGIES: StrategyProfileId[] = [
  "aggressive-rusher",
  "cautious-duelist",
  "ranged-skirmisher",
  "flanker",
  "tank-guard",
  "commander",
];

const BOT_LOADOUTS: BattleLoadout[] = [
  { primary: "sword", sidearm: "pistol" },
  { primary: "greatsword", sidearm: "dagger" },
  { primary: "bow", sidearm: "sword" },
  { primary: "staffFire", sidearm: "wand" },
  { primary: "spear", sidearm: "shield" },
  { primary: "axe", sidearm: "pistol" },
  { primary: "crossbow", sidearm: "dagger" },
  { primary: "shotgun", sidearm: "mace" },
  { primary: "rifle", sidearm: "sword" },
  { primary: "hammer", sidearm: "pistol" },
];

const COLORS = [
  "#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3", "#f38181", "#aa96da",
  "#fcbad3", "#a8d8ea", "#ff9a76", "#61c0bf", "#bbded6", "#fae3d9",
  "#ffb6b9", "#fae3d9", "#bbded6", "#8ac6d1",
];

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

export function modelForRace(raceId: string): string {
  return `models/races/${raceId}.glb`;
}

/**
 * Build full fighter list for a match (local player + bots).
 * Duos: teams of 2 (team 0 = local+ally bot, then pairs).
 */
export function buildBattleRoster(opts: {
  mode: BattleMode;
  playerSlots: number;
  seed: string;
  localName: string;
  localRaceId: string;
  localLoadout: BattleLoadout;
  spawnRadius: number;
  spawnY?: number;
}): BattleFighterSpec[] {
  const slots = Math.max(2, Math.min(16, opts.playerSlots));
  const spawns = buildSpawnRing(slots, opts.spawnRadius, opts.spawnY ?? 0.1, opts.seed);
  const h = hash(opts.seed);
  const fighters: BattleFighterSpec[] = [];

  // Assign teams
  const teams: number[] = [];
  if (opts.mode === "singles") {
    for (let i = 0; i < slots; i++) teams.push(i);
  } else {
    // duos: 0,0,1,1,2,2...
    for (let i = 0; i < slots; i++) teams.push(Math.floor(i / 2));
  }

  // Local always index 0
  fighters.push({
    id: "local-player",
    name: opts.localName || "You",
    isBot: false,
    isLocal: true,
    team: teams[0]!,
    avatarRaceId: opts.localRaceId || "human",
    model: modelForRace(opts.localRaceId || "human"),
    strategy: "cautious-duelist",
    loadout: opts.localLoadout ?? DEFAULT_BATTLE_LOADOUT,
    spawn: { ...spawns[0]!, team: teams[0]! },
    color: COLORS[0]!,
  });

  for (let i = 1; i < slots; i++) {
    const race = pick(RACES, h + i * 3);
    const loadout = pick(BOT_LOADOUTS, h + i * 7);
    // Duo partner of local gets support-healer lean
    const isLocalAlly = opts.mode === "duos" && teams[i] === teams[0];
    fighters.push({
      id: `bot-${i}`,
      name: pick(BOT_NAMES, h + i * 11) + (isLocalAlly ? " (Ally)" : ""),
      isBot: true,
      isLocal: false,
      team: teams[i]!,
      avatarRaceId: race,
      model: modelForRace(race),
      strategy: isLocalAlly ? "support-healer" : pick(STRATEGIES, h + i * 5),
      loadout,
      spawn: { ...spawns[i]!, team: teams[i]! },
      color: COLORS[i % COLORS.length]!,
    });
  }

  return fighters;
}

/** Recommend bot strategy based on held weapon. */
export function strategyForWeapon(primary: WeaponId): StrategyProfileId {
  switch (primary) {
    case "bow":
    case "crossbow":
    case "rifle":
    case "hunter-rifle":
    case "pistol":
      return "ranged-skirmisher";
    case "staff":
    case "staffFire":
    case "staffIce":
    case "staffStorm":
    case "wand":
    case "tome":
      return "commander";
    case "greatsword":
    case "greataxe":
    case "hammer":
    case "hammer2h":
      return "tank-guard";
    case "dagger":
    case "scythe":
      return "flanker";
    case "shotgun":
    case "axe":
      return "aggressive-rusher";
    default:
      return "cautious-duelist";
  }
}

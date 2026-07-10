/**
 * Game modes for Grudge Open / Danger Room.
 * Pure data — Studio / Lobby consume this catalog.
 */

export type GameModeId =
  | "danger-room"
  | "boss-rush"
  | "horde"
  | "duel"
  | "coop-assault"
  | "sparring"
  | "arena-war"
  | "dungeon-crawl"
  | "pirate-siege"
  | "warlord-genesis";

export type FactionRole = "player" | "ally" | "enemy" | "boss" | "neutral";

export interface ModeSpawnPlan {
  /** Max concurrent hostiles. */
  maxEnemies: number;
  /** Ally sparring partners / party NPCs. */
  maxAllies: number;
  /** Bosses (weak-point epicfight bots). */
  bosses: number;
  /** Wave count (0 = endless / free roam). */
  waves: number;
  /** Seconds of intro grace before first hostile engage. */
  introGraceSec: number;
}

export interface GameModeDef {
  id: GameModeId;
  title: string;
  blurb: string;
  icon: string; // lucide name or public icon path
  spawn: ModeSpawnPlan;
  /** Default AI strategy profile for hostiles. */
  enemyStrategy: StrategyProfileId;
  allyStrategy: StrategyProfileId;
  bossStrategy: StrategyProfileId;
  /** Preferred map / room asset key. */
  mapKey: string;
  multiplayer: boolean;
}

export type StrategyProfileId =
  | "aggressive-rusher"
  | "cautious-duelist"
  | "ranged-skirmisher"
  | "support-healer"
  | "tank-guard"
  | "boss-phased"
  | "swarm-horde"
  | "flanker"
  | "commander";

export const GAME_MODES: readonly GameModeDef[] = [
  {
    id: "danger-room",
    title: "Danger Room",
    blurb: "Free training chamber — tune combat, camera, and skills live.",
    icon: "/icons/anim-test.png",
    spawn: { maxEnemies: 4, maxAllies: 1, bosses: 0, waves: 0, introGraceSec: 2 },
    enemyStrategy: "cautious-duelist",
    allyStrategy: "support-healer",
    bossStrategy: "boss-phased",
    mapKey: "danger-room",
    multiplayer: true,
  },
  {
    id: "sparring",
    title: "Sparring",
    blurb: "1v1 or 2v2 skill drills with reaction-latency AI.",
    icon: "/icons/combat-pad.png",
    spawn: { maxEnemies: 1, maxAllies: 1, bosses: 0, waves: 0, introGraceSec: 1 },
    enemyStrategy: "cautious-duelist",
    allyStrategy: "tank-guard",
    bossStrategy: "boss-phased",
    mapKey: "danger-room",
    multiplayer: true,
  },
  {
    id: "boss-rush",
    title: "Boss Rush",
    blurb: "Yellow-bot weak points, phased armor breaks, head/chest punish windows.",
    icon: "/icons/siege.png",
    spawn: { maxEnemies: 2, maxAllies: 0, bosses: 3, waves: 3, introGraceSec: 4 },
    enemyStrategy: "flanker",
    allyStrategy: "support-healer",
    bossStrategy: "boss-phased",
    mapKey: "arena-war-zone",
    multiplayer: false,
  },
  {
    id: "horde",
    title: "Horde",
    blurb: "Waves of voxel zombies + pirate deck trash. Survive the clock.",
    icon: "/icons/ambush.png",
    spawn: { maxEnemies: 12, maxAllies: 2, bosses: 1, waves: 10, introGraceSec: 5 },
    enemyStrategy: "swarm-horde",
    allyStrategy: "tank-guard",
    bossStrategy: "boss-phased",
    mapKey: "arena-war-zone",
    multiplayer: true,
  },
  {
    id: "duel",
    title: "Duel Arena",
    blurb: "Honor rules: no turrets, skill window punish focus.",
    icon: "/icons/attack.png",
    spawn: { maxEnemies: 1, maxAllies: 0, bosses: 0, waves: 0, introGraceSec: 3 },
    enemyStrategy: "aggressive-rusher",
    allyStrategy: "tank-guard",
    bossStrategy: "boss-phased",
    mapKey: "danger-room",
    multiplayer: true,
  },
  {
    id: "coop-assault",
    title: "Co-op Assault",
    blurb: "Carrier room multiplayer — coordinate with allies vs commander AI.",
    icon: "/icons/rally.png",
    spawn: { maxEnemies: 8, maxAllies: 3, bosses: 1, waves: 5, introGraceSec: 6 },
    enemyStrategy: "commander",
    allyStrategy: "flanker",
    bossStrategy: "boss-phased",
    mapKey: "dungeon",
    multiplayer: true,
  },
  {
    id: "arena-war",
    title: "Arena War",
    blurb: "Full arena-war-zone GLB — destructibles, props, open combat.",
    icon: "/icons/pvp.png",
    spawn: { maxEnemies: 6, maxAllies: 2, bosses: 1, waves: 0, introGraceSec: 3 },
    enemyStrategy: "aggressive-rusher",
    allyStrategy: "ranged-skirmisher",
    bossStrategy: "boss-phased",
    mapKey: "arena-war-zone",
    multiplayer: true,
  },
  {
    id: "dungeon-crawl",
    title: "Dungeon Crawl",
    blurb: "Haunting door + dungeon layout — tighter corridors, ambush AI.",
    icon: "/icons/explore.png",
    spawn: { maxEnemies: 5, maxAllies: 1, bosses: 1, waves: 4, introGraceSec: 4 },
    enemyStrategy: "flanker",
    allyStrategy: "support-healer",
    bossStrategy: "boss-phased",
    mapKey: "dungeon",
    multiplayer: false,
  },
  {
    id: "pirate-siege",
    title: "Pirate Siege",
    blurb: "Black Tide deck — cannons, crates, flag props. Boarding tactics AI.",
    icon: "/icons/loot.png",
    spawn: { maxEnemies: 7, maxAllies: 2, bosses: 1, waves: 6, introGraceSec: 5 },
    enemyStrategy: "commander",
    allyStrategy: "tank-guard",
    bossStrategy: "boss-phased",
    mapKey: "pirate-black-tide",
    multiplayer: true,
  },
  {
    id: "warlord-genesis",
    title: "Warlord Genesis",
    blurb: "Choose your race. Enter the arena. Survive 4 waves to claim the Warlord title.",
    icon: "/icons/combat-pad.png",
    spawn: { maxEnemies: 10, maxAllies: 0, bosses: 1, waves: 4, introGraceSec: 3 },
    enemyStrategy: "swarm-horde",
    allyStrategy: "tank-guard",
    bossStrategy: "boss-phased",
    mapKey: "arena-war-zone",
    multiplayer: false,
  },
] as const;

export function getMode(id: GameModeId): GameModeDef {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0]!;
}

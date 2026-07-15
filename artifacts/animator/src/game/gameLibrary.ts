/**
 * Grudge Open — Steam / Roblox–style game library catalog.
 *
 * open.grudge-studio.com is the launcher + deployer shell.
 * World authority for voxel Realms = Mine-Loader (local + fleet deploy).
 *
 * Inventory consolidated from D:/GitHub, F:/GitHub, Desktop, Documents, D:/Games
 * and the fleet skill map — only titles we actively launch or migrate here.
 */

import { assetUrl } from "../lib/fleet";
import { PLAY_SHELL_HOST } from "./grudoxZones";
import { MINE_LOADER_FLEET, mineLoaderLobbyUrl } from "../lib/productionRuntime";

/** How a title launches from the Open launcher. */
export type LaunchKind =
  | "native" // in-process App mode (danger, brawl, …)
  | "external" // new tab / deep-link
  | "mine-loader" // Mine-Loader world SPA (Vercel + Railway + CF)
  | "editor"; // editor surface (voxel / dressing / mine world tools)

export type GameCategory =
  | "combat"
  | "open-world"
  | "rts"
  | "survival"
  | "editor"
  | "social"
  | "arcade"
  | "account";

export type EngineTag =
  | "mine-loader"
  | "three"
  | "r3f"
  | "rapier"
  | "colyseus"
  | "socketio"
  | "html-static"
  | "procedural";

export type DeployStack = {
  /** Static / SPA host */
  client: "vercel" | "cf-pages" | "local";
  /** Authoritative world / API (if any) */
  server?: "railway" | "cf-worker" | "none";
  /** Edge domain proxy */
  edge?: "cloudflare-worker" | "none";
  /** Single-replica world note for Mine-Loader */
  singleReplica?: boolean;
};

export type GameEntry = {
  id: string;
  title: string;
  short: string;
  blurb: string;
  category: GameCategory;
  tags: string[];
  tone: string;
  /** public/rooms/<posterKey>-scene.png or full URL */
  posterKey: string;
  /** Optional icon under public/icons/ */
  icon?: string;
  engines: EngineTag[];
  launch: LaunchKind;
  /** Native App mode when launch === native | editor */
  nativeMode?:
    | "danger"
    | "brawl"
    | "mimic"
    | "genesis"
    | "voxgrudge-native"
    | "voxel"
    | "editor"
    | "lobby"
    | "zones"
    | "ledmask"
    | "account";
  /** Absolute URL for external / mine-loader */
  url?: string;
  deploy: DeployStack;
  /** Local paths / repos (docs + agent context) */
  sources: string[];
  /** Featured on library home row */
  featured?: boolean;
  status: "live" | "beta" | "local" | "migrating";
};

/** Mine-Loader production Realms — fleet SSOT for voxel worlds (GitHub promote path). */
export const MINE_LOADER = {
  localPath: "D:\\GitHub\\minegrudge\\Mine-Loader",
  mirrorPath: "F:\\GitHub\\voxgrudge\\Mine-Loader",
  github: MINE_LOADER_FLEET.github,
  clientUrl: MINE_LOADER_FLEET.client,
  edgeUrl: MINE_LOADER_FLEET.edge,
  /** Placeholder until Railway hostname is finalized */
  apiHost: "https://mine-loader-api-production.up.railway.app",
  docs: "docs/FLEET_DEPLOY.md",
  openContract: "docs/MINE_LOADER_SSOT.md",
  /** SSO lobby deep-link builder */
  lobbyUrl: mineLoaderLobbyUrl,
  rules: [
    "SSOT: github.com/MolochDaGod/mine-loader — promote editor/world/API there",
    "Never deploy production from Replit — GitHub → Vercel + Railway + CF",
    "Exactly one API replica (in-memory world authority → Postgres flush)",
    "Open /voxel exports interchange → Realms scene; combat labs stay on Open /danger",
    "Accounts: same Grudge ID + characterId on Open and Realms handoff",
  ],
} as const;

/**
 * Canonical library. Keep in sync with DoorSelect / AppShell when adding titles.
 */
export const GAME_LIBRARY: readonly GameEntry[] = [
  {
    id: "account-hub",
    title: "Account Hub",
    short: "Characters · wallet · treaty",
    blurb:
      "charactersgrudox race kit, credits, custodial wallet, GRUDOX tier, treaty chat. Same Grudge ID everywhere.",
    category: "account",
    tags: ["SSO", "Characters", "Treaty"],
    tone: "#4fc3ff",
    posterKey: "library-account",
    icon: "inventory",
    engines: ["three"],
    launch: "native",
    nativeMode: "account",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["D:\\GitHub\\gameopen", "charactersgrudox races"],
    featured: true,
    status: "live",
  },
  {
    id: "mine-loader-realms",
    title: "Mine-Loader Realms",
    short: "Authoritative voxel worlds",
    blurb:
      "Networked Minecraft-like Realms — build, combat, parties. World server = Mine-Loader (Railway Postgres, 1 replica). Launcher deploys & opens this stack.",
    category: "open-world",
    tags: ["Worlds", "Multiplayer", "Deploy"],
    tone: "#7ee0a0",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["mine-loader", "three"],
    launch: "mine-loader",
    url: MINE_LOADER.clientUrl,
    deploy: {
      client: "vercel",
      server: "railway",
      edge: "cloudflare-worker",
      singleReplica: true,
    },
    sources: [MINE_LOADER.localPath, MINE_LOADER.mirrorPath],
    featured: true,
    status: "live",
  },
  {
    id: "danger-room",
    title: "Danger Room",
    short: "Combat sandbox",
    blurb: "Live combat sandbox — weapons, skills, sparring, fleet characters, A.L.E. review.",
    category: "combat",
    tags: ["PvE", "Training", "AI"],
    tone: "#ff7a7a",
    posterKey: "library-danger",
    icon: "combat-pad",
    engines: ["three", "rapier"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["D:\\GitHub\\gameopen\\artifacts\\animator"],
    featured: true,
    status: "live",
  },
  {
    id: "ruins-brawler",
    title: "Ruins Brawler",
    short: "Twin-stick co-op",
    blurb: "3D twin-stick co-op survival in the shared GRUDOX ruins arena.",
    category: "combat",
    tags: ["Co-op", "Live"],
    tone: "#ff9a7a",
    posterKey: "library-brawl",
    icon: "attack",
    engines: ["three", "socketio"],
    launch: "native",
    nativeMode: "brawl",
    deploy: { client: "vercel", server: "railway" },
    sources: ["D:\\GitHub\\gameopen"],
    featured: true,
    status: "live",
  },
  {
    id: "voxgrudge",
    title: "VoxGrudge Open World",
    short: "Voxel survival open world",
    blurb:
      "Nexus Era open voxel world — classes, craft, build, GRUDOX co-op. Prefer Mine-Loader worlds for persistent multiplayer Realms.",
    category: "open-world",
    tags: ["Voxel", "Survival"],
    tone: "#5fe0ff",
    posterKey: "library-voxworld",
    icon: "explore",
    engines: ["three", "html-static"],
    launch: "native",
    nativeMode: "voxgrudge-native",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\voxgrudge", "D:\\Games\\grudge-voxel"],
    featured: true,
    status: "live",
  },
  {
    id: "warlord-genesis",
    title: "Warlord Genesis",
    short: "Race survival boss rush",
    blurb: "Pick Human / Orc / Elf / Dwarf / Barbarian / Undead — survive waves to claim the title.",
    category: "combat",
    tags: ["Boss", "Races"],
    tone: "#ffd24d",
    posterKey: "library-genesis",
    icon: "skill-vfx-lab",
    engines: ["three"],
    launch: "native",
    nativeMode: "genesis",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\warlord-genesis", "D:\\GitHub\\gameopen"],
    featured: true,
    status: "live",
  },
  {
    id: "voxel-editor",
    title: "Voxel World Editor",
    short: "Build maps & deployables",
    blurb:
      "In-launcher map editor. For production Realms worlds, export / sync to Mine-Loader world APIs (blocks, sites, parties).",
    category: "editor",
    tags: ["Create", "Maps", "Mine-Loader"],
    tone: "#7ee0a0",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["three", "mine-loader"],
    launch: "editor",
    nativeMode: "voxel",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\gameopen\\artifacts\\animator\\src\\three\\voxel"],
    featured: true,
    status: "live",
  },
  {
    id: "dressing-room",
    title: "Dressing Room",
    short: "Equip & preview",
    blurb: "Avatar editor — race GLBs, weapons, animations, VFX. charactersgrudox + grudge6 kits.",
    category: "editor",
    tags: ["Avatar", "Gear"],
    tone: "#ffb24d",
    posterKey: "dressing",
    icon: "equip",
    engines: ["three", "rapier"],
    launch: "editor",
    nativeMode: "editor",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\gameopen", "charactersgrudox"],
    status: "live",
  },
  {
    id: "grudox-island",
    title: "GRUDOX Island",
    short: "Persistent play shell island",
    blurb: "Harvest, craft, build, PvP as your Warlords character. Account bag on Railway.",
    category: "open-world",
    tags: ["Island", "PvP"],
    tone: "#5fd48a",
    posterKey: "lobby",
    icon: "loot",
    engines: ["r3f", "rapier"],
    launch: "external",
    url: `${PLAY_SHELL_HOST}/?door=lobbyWorld`,
    deploy: { client: "vercel", server: "railway" },
    sources: ["play shell threejs-rapier"],
    featured: true,
    status: "live",
  },
  {
    id: "warlords",
    title: "Grudge Warlords",
    short: "Main Warlords client",
    blurb: "Primary Warlords game client — characters, islands, Colyseus lobbies.",
    category: "open-world",
    tags: ["Flagship", "Colyseus"],
    tone: "#e86a1a",
    posterKey: "zones",
    icon: "rally",
    engines: ["three", "colyseus"],
    launch: "external",
    url: "https://grudgewarlords.com/",
    deploy: { client: "vercel", server: "railway" },
    sources: ["D:\\GitHub\\GrudgeWarlords", "F:\\GitHub\\GrudgeBuilder"],
    status: "live",
  },
  {
    id: "rts-grudge",
    title: "Voxel RTS / Command",
    short: "Toon RTS + Forge",
    blurb: "R3F + Rapier RTS / Hero Command. Forge map editor at forge.grudge-studio.com.",
    category: "rts",
    tags: ["RTS", "Forge"],
    tone: "#9d8bff",
    posterKey: "library-rts",
    icon: "siege",
    engines: ["r3f", "rapier"],
    launch: "external",
    url: "https://play.grudge-studio.com/",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: [
      "C:\\Users\\nugye\\Documents\\GRUDGE_RTS",
      "C:\\Users\\nugye\\Documents\\GrudgeSpaceRTS",
      "F:\\GitHub\\grudge-warlords-rts",
    ],
    featured: true,
    status: "live",
  },
  {
    id: "dungeon-crawler",
    title: "Dungeon Crawler Quest",
    short: "Voxel dungeon RPG",
    blurb: "Three.js + voxel + Rapier dungeon crawler. DCQ live domain.",
    category: "survival",
    tags: ["Dungeon", "RPG"],
    tone: "#c9a0ff",
    posterKey: "mimic",
    icon: "ambush",
    engines: ["three", "rapier"],
    launch: "external",
    url: "https://dcq.grudge-studio.com/",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\Dungeon-Crawler-Quest", "D:\\Games\\Dungeon-Crawler-Quest"],
    status: "live",
  },
  {
    id: "survival-grudges",
    title: "Grudges Survival",
    short: "Survival R3F",
    blurb: "Open survival on grudges.grudge-studio.com — Railway survival-api.",
    category: "survival",
    tags: ["Survival"],
    tone: "#88cc88",
    posterKey: "voxgrudge",
    icon: "harvest",
    engines: ["r3f", "rapier"],
    launch: "external",
    url: "https://grudges.grudge-studio.com/",
    deploy: { client: "vercel", server: "railway" },
    sources: ["survival repo"],
    status: "live",
  },
  {
    id: "z-brawl",
    title: "Z-Brawl",
    short: "Voxel fight arena",
    blurb: "Protocol Extinction arena combat — GRUDOX arcade handoff.",
    category: "arcade",
    tags: ["Arena", "Voxel"],
    tone: "#9d8bff",
    posterKey: "brawl",
    icon: "charge",
    engines: ["three"],
    launch: "external",
    url: "https://open.grudge-studio.com/arcade/play/z-brawl",
    deploy: { client: "vercel" },
    sources: ["GRUDOX arcade"],
    status: "beta",
  },
  {
    id: "mimic-dungeon",
    title: "Test Dungeon · Mimic",
    short: "Encounter lab",
    blurb: "Vol scene — open a barrel, fight the Mimic (melee + acid AoE).",
    category: "combat",
    tags: ["Boss", "Test"],
    tone: "#9cff5a",
    posterKey: "mimic",
    icon: "ambush",
    engines: ["three"],
    launch: "native",
    nativeMode: "mimic",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\gameopen"],
    status: "live",
  },
  {
    id: "lobby",
    title: "The Lobby",
    short: "Rooms & community",
    blurb: "Join multiplayer rooms or browse community maps & scenes.",
    category: "social",
    tags: ["Rooms", "UGC"],
    tone: "#9d8bff",
    posterKey: "lobby",
    icon: "inventory",
    engines: ["three"],
    launch: "native",
    nativeMode: "lobby",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\gameopen"],
    status: "live",
  },
  {
    id: "metaverse",
    title: "Grudge Metaverse",
    short: "Lobby → play heroes",
    blurb: "Grudge ID → Warlords characters → grudge6 GLB play world.",
    category: "social",
    tags: ["Metaverse"],
    tone: "#6ea8ff",
    posterKey: "lobby",
    icon: "explore",
    engines: ["three", "socketio"],
    launch: "external",
    url: "https://metaverse.grudge-studio.com/",
    deploy: { client: "vercel", server: "railway" },
    sources: ["D:\\GitHub\\grudge-metaverse"],
    status: "live",
  },
  {
    id: "mech-forge",
    title: "Mech Forge",
    short: "Mech builder PvP",
    blurb: "R3F mech playground — pair with Railway pvp-server.",
    category: "combat",
    tags: ["Mech", "PvP"],
    tone: "#ff8844",
    posterKey: "danger",
    icon: "siege",
    engines: ["r3f", "socketio"],
    launch: "external",
    url: "https://mech-playground.vercel.app/",
    deploy: { client: "vercel", server: "railway" },
    sources: ["F:\\GitHub\\grudge-mech-forge"],
    status: "live",
  },
  {
    id: "forge-editor",
    title: "Studio Forge",
    short: "Map & model editor",
    blurb: "Fleet map editor — forge.grudge-studio.com (RTS-Grudge studio).",
    category: "editor",
    tags: ["Forge", "Maps"],
    tone: "#c9a227",
    posterKey: "voxel",
    icon: "world-editor",
    engines: ["r3f"],
    launch: "external",
    url: "https://forge.grudge-studio.com/",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["F:\\GitHub\\Grudge-Studio-Forge"],
    status: "live",
  },
] as const;

export function posterUrl(posterKey: string): string {
  return assetUrl(`rooms/${posterKey}-scene.png`);
}

export function iconUrl(name: string): string {
  return assetUrl(`icons/${name}.png`);
}

export function libraryByCategory(cat: GameCategory | "all"): GameEntry[] {
  if (cat === "all") return [...GAME_LIBRARY];
  return GAME_LIBRARY.filter((g) => g.category === cat);
}

export function featuredGames(): GameEntry[] {
  return GAME_LIBRARY.filter((g) => g.featured);
}

export function mineLoaderGames(): GameEntry[] {
  return GAME_LIBRARY.filter(
    (g) => g.engines.includes("mine-loader") || g.launch === "mine-loader",
  );
}

export function getGame(id: string): GameEntry | undefined {
  return GAME_LIBRARY.find((g) => g.id === id);
}

/** Build launch URL with fleet SSO handoff. */
export function gameLaunchUrl(
  game: GameEntry,
  params: { token?: string | null; characterId?: string | null } = {},
): string | null {
  if (game.launch === "native" || game.launch === "editor") return null;
  const base = game.url || MINE_LOADER.clientUrl;
  try {
    const u = new URL(base);
    if (params.token) {
      u.searchParams.set("grudge_token", params.token);
      u.searchParams.set("sso_token", params.token);
    }
    if (params.characterId) u.searchParams.set("characterId", params.characterId);
    u.searchParams.set("open", "1");
    u.searchParams.set("from", "gameopen");
    return u.toString();
  } catch {
    return base;
  }
}

export type LibraryFilter = "all" | "featured" | GameCategory;

export const LIBRARY_FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "featured", label: "Featured" },
  { id: "open-world", label: "Worlds" },
  { id: "combat", label: "Combat" },
  { id: "rts", label: "RTS" },
  { id: "survival", label: "Survival" },
  { id: "editor", label: "Create" },
  { id: "social", label: "Social" },
  { id: "arcade", label: "Arcade" },
  { id: "account", label: "Account" },
];

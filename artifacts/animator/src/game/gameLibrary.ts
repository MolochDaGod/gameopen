/**
 * Grudge Open — Steam / Roblox–style game library catalog.
 *
 * open.grudge-studio.com is the launcher + deployer shell.
 *
 * ## Era categories (SSOT for import / deploy — do not invent parallel games)
 *  - **voxel**    — VoxGrudge production, Mine-Loader Realms, DCQ, Z-Brawl, Worldbuilder
 *  - **warlords** — Fantasy flagship **client** (+ Open tools: Danger, Dressing).
 *    Home islands, sectors, scatter maps live **inside Warlords**, not as Open tiles.
 *  - **nexus**    — Sci-fi / mech / metaverse / space-adjacent fleet
 *  - **armada**   — Naval / Grim Armada / sail maps
 *  - **account**  — Platform hub only (SSO, rooms shell) — not a game era
 *
 * ## Hard rules (agents + humans)
 * 1. Prefer the **live production URL** (probed 200). Never list Desktop HTML forks
 *    (index.html, live.html, grudge-warlords-vox.html, …) as separate games.
 * 2. Desktop `grudgeproduction/voxgrudge` is an **asset + source kit** for the
 *    single production open world at voxgrudge.vercel.app — not N launchers.
 * 3. No duplicates, no “worse” or legacy stacks beside the production entry.
 * 4. New era content ships under its era category only (import path = era).
 * 5. **Warlords world content is not a standalone Open game.** Home island, water
 *    island, sector seas, and in-game maps launch via **Grudge Warlords client**
 *    (`warlordsInGameOnly`). Open may keep Danger training maps separately.
 * 6. **Chicken Gun / PolygonPirates `pirate-islands` lobby** is the Warlords
 *    **opening map and tutorial map** (shipwreck_cove → `/tutorial`, lobby
 *    → `/island-3d?mode=lobby&map=pirate-islands`). It is **not** a GRUDOX
 *    cabinet, **not** an Explorer product, and **not** an Open library tile.
 */

import { assetUrl } from "../lib/fleet";
import { PLAY_SHELL_HOST } from "./grudoxZones";
import {
  MINE_LOADER_FLEET,
  mineLoaderLobbyUrl,
  voxgrudgeWorldUrl,
  dcqWorldUrl,
} from "../lib/productionRuntime";
import { FLEET_WORLD_HOSTS, fleetWorldLaunchUrl } from "../lib/fleetWorlds";

/**
 * Production Chicken Gun / PolygonPirates lobby mesh — Warlords only.
 * Opening + tutorial + era-center lobby. Never GRUDOX / Explorer / Open tile.
 */
export const WARLORDS_PIRATE_LOBBY_PATH =
  "/island-3d?mode=lobby&map=pirate-islands" as const;
export const WARLORDS_TUTORIAL_PATH = "/tutorial" as const;
export const WARLORDS_CLIENT_ORIGIN = "https://client.grudge-studio.com";
export const WARLORDS_PIRATE_LOBBY_URL = `${WARLORDS_CLIENT_ORIGIN}${WARLORDS_PIRATE_LOBBY_PATH}`;
export const WARLORDS_TUTORIAL_URL = `${WARLORDS_CLIENT_ORIGIN}${WARLORDS_TUTORIAL_PATH}`;

/** How a title launches from the Open launcher. */
export type LaunchKind =
  | "native" // in-process App mode (danger, brawl, …)
  | "external" // new tab / deep-link
  | "mine-loader" // Mine-Loader world SPA (Vercel + Railway + CF)
  | "editor"; // editor surface (voxel / dressing / mine world tools)

/**
 * Library filter categories = production eras (+ account platform).
 * Use these when importing/deploying so eras never collide.
 */
export type GameCategory =
  | "voxel"
  | "warlords"
  | "nexus"
  | "armada"
  | "account";

/** Ordered era chips for the library UI. */
export const ERA_CATEGORIES: readonly {
  id: GameCategory;
  label: string;
  blurb: string;
  tone: string;
}[] = [
  {
    id: "voxel",
    label: "Voxel",
    blurb: "VoxGrudge · Realms · DCQ · arenas · Worldbuilder",
    tone: "#5fe0ff",
  },
  {
    id: "warlords",
    label: "Warlords",
    blurb: "Flagship client (home/sectors/islands inside) · Open Danger/Dressing",
    tone: "#e86a1a",
  },
  {
    id: "nexus",
    label: "Nexus",
    blurb: "Sci-fi · mech · metaverse · carrier",
    tone: "#9d8bff",
  },
  {
    id: "armada",
    label: "Armada",
    blurb: "Naval · Grim Armada · sail maps",
    tone: "#4fc3c8",
  },
  {
    id: "account",
    label: "Account",
    blurb: "SSO · characters · lobby shell",
    tone: "#4fc3ff",
  },
] as const;

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
    | "account"
    | "realms"
    | "minegrudge"
    | "survival"
    | "vox-battle";
  /** Absolute URL for external / mine-loader */
  url?: string;
  deploy: DeployStack;
  /** Local paths / repos (docs + agent context) */
  sources: string[];
  /** Featured on library home row */
  featured?: boolean;
  /**
   * Warlords **in-game** world (home island, sector map, scatter island, etc.).
   * Must not appear as a standalone Open library tile — use {@link warlordsClientUrl}.
   */
  warlordsInGameOnly?: boolean;
  status: "live" | "beta" | "local" | "migrating";
};

/** Canonical Warlords product entry (home islands / sectors live inside this client). */
export const WARLORDS_CLIENT_URL = "https://client.grudge-studio.com/home";
export const WARLORDS_PUBLIC_URL = "https://grudgewarlords.com/";

/** Mine-Loader production Realms — fleet SSOT for voxel worlds (GitHub promote path). */
export const MINE_LOADER = {
  localPath: "D:\\GitHub\\minegrudge\\Mine-Loader",
  mirrorPath: "F:\\GitHub\\voxgrudge\\Mine-Loader",
  github: MINE_LOADER_FLEET.github,
  /**
   * Canonical play host — multiplayer, self-hosted maps, harvest + DRC combat,
   * account explorer avatar characters.
   */
  clientUrl: MINE_LOADER_FLEET.client,
  edgeUrl: MINE_LOADER_FLEET.edge,
  vercelUrl: MINE_LOADER_FLEET.vercel,
  /** Live Railway API (world authority + Codex catalog) */
  apiHost: "https://mine-loader-api-production.up.railway.app",
  docs: "docs/FLEET_DEPLOY.md",
  openContract: "docs/MINE_LOADER_SSOT.md",
  /** SSO lobby deep-link builder */
  lobbyUrl: mineLoaderLobbyUrl,
  rules: [
    "SSOT: github.com/MolochDaGod/mine-loader — promote editor/world/API there",
    "Never deploy production from Replit — GitHub → Vercel + Railway + CF",
    "Exactly one API replica (in-memory world authority → Postgres flush)",
    "Play host: https://mineloader.grudge-studio.com (alias mine.grudge-studio.com)",
    "Modes: mode=harvest (Minecraft-like) · mode=drc (combat + explorer avatar)",
    "Map deploys: self-hosted scenes via #/play?mapId=… + Railway worlds API",
    "Accounts: Grudge ID + characterId + baseId=explorer on handoff",
    "Blocks/worlds API: mine-loader-api Railway; characters/bag stay on grudge-api-production",
  ],
} as const;

/**
 * Full open world (production only).
 * Desktop kit: C:\Users\nugye\Desktop\grudgeproduction\voxgrudge
 * (canonical entry grudge-warlords-openworld.html → Vercel voxgrudge).
 * Do NOT register index.html / live.html / grudge-warlords-vox.html as games.
 */
export const VOXGRUDGE_WORLD = {
  clientUrl: FLEET_WORLD_HOSTS.voxgrudge,
  grudoxPath: FLEET_WORLD_HOSTS.grudoxVoxgrudge,
  launchUrl: voxgrudgeWorldUrl,
  sources: [
    "C:\\Users\\nugye\\Desktop\\grudgeproduction\\voxgrudge",
    "D:\\GitHub\\voxgrudge",
    "F:\\GitHub\\voxgrudge",
  ],
  /** Production HTML entry on the Vercel deploy (not local forks). */
  productionEntry: "grudge-warlords-openworld.html",
} as const;

/** Dungeon Crawler Quest. */
export const DCQ_WORLD = {
  clientUrl: FLEET_WORLD_HOSTS.dcq,
  vercelUrl: FLEET_WORLD_HOSTS.dcqVercel,
  launchUrl: dcqWorldUrl,
  sources: ["D:\\GitHub\\Dungeon-Crawler-Quest", "F:\\GitHub\\Dungeon-Crawler-Quest"],
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
    id: "grok-builder",
    title: "Grok Builder",
    short: "Agentic game creator",
    blurb:
      "Deep creative Three.js + Rapier + R3F builder — invent games, modes, edits; stack helpers; fleet CDN assets; Kenney UX kit; export playable scene packages. Open toolbox Create tab + grudge-dev-tool primary builder.",
    category: "voxel",
    tags: ["Grok", "Three.js", "Rapier", "R3F", "Kenney", "Modes", "Create", "AI"],
    tone: "#f5c542",
    posterKey: "worldbuilder",
    icon: "worldbuilder",
    engines: ["three", "rapier", "r3f"],
    launch: "external",
    url: "https://grok-builder.vercel.app/?panel=modes",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["F:\\GitHub\\grok-builder", "F:\\GitHub\\grudge-dev-tool"],
    featured: true,
    status: "live",
  },
  {
    id: "mine-loader-realms",
    title: "Mine-Loader Realms",
    short: "Play · harvest · DRC · maps",
    blurb:
      "mineloader.grudge-studio.com — multiplayer Realms, self-hosted map deploys, harvest (Minecraft-like) + DRC combat with your account explorer avatar. World API = Mine-Loader Railway (1 replica); characters = grudge-api.",
    category: "voxel",
    tags: ["Worlds", "Multiplayer", "Harvest", "DRC", "Explorer", "Deploy"],
    tone: "#7ee0a0",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["mine-loader", "three"],
    // Collection surface: open.grudge-studio.com/realms (in-app canvas + SSO)
    launch: "native",
    nativeMode: "realms",
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
    category: "warlords",
    tags: ["PvE", "Training", "AI", "Map:Danger"],
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
    id: "voxgrudge-battle",
    title: "VoxGrudge Battle",
    short: "BR · singles & duos",
    blurb:
      "Hunger Games Arena last-standing battleground — 16 players, bot brains, Danger Room weapon skills + sidearm pre-select, minimap M. Biomes/walls/boats from practice 15 arenas kit + wildlife (gator, fox, wolf, buffalo, bear).",
    category: "voxel",
    tags: ["BR", "Bots", "Map:Hunger", "Singles", "Duos"],
    tone: "#f0c14b",
    posterKey: "library-danger",
    icon: "pvp",
    engines: ["three"],
    launch: "native",
    nativeMode: "vox-battle",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: [
      "D:\\Games\\Models\\the_hunger_games_arena.glb",
      "D:\\Games\\Models\\practice__15_arenas.glb",
      "F:\\GitHub\\gameopen\\artifacts\\animator\\src\\game\\voxgrudgeBattle",
    ],
    featured: true,
    status: "beta",
  },
  {
    id: "forest-map",
    title: "Forest Map",
    short: "Harvest forest",
    blurb:
      "Danger Room harvest lab (chicken_gun_fruzer dark forest base + Warlords nature scatter). NOT the Warlords Chicken Gun pirate-islands opening/tutorial lobby — that is in-client only (map=pirate-islands).",
    category: "warlords",
    tags: ["Harvest", "DangerLab", "Map:Forest"],
    tone: "#3d7a4a",
    posterKey: "library-mine",
    icon: "harvest",
    engines: ["three"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["D:\\Games\\Models\\chicken_gun_fruzer_dark_forest (1).glb"],
    featured: true,
    status: "live",
  },
  {
    id: "island-life",
    title: "Survival Coast (sailtest stand-in)",
    short: "Survival lab · sailtest mesh",
    blurb:
      "NOT island_life.glb (404 on CDN). Live playable mesh is sailtest.glb until island_life is uploaded to R2. Harvest/build/sail lab on dual islands.",
    category: "voxel",
    tags: ["Survival", "RPG", "Map:SailtestStandIn", "Awaiting:island_life"],
    tone: "#5ec8a0",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["three", "rapier"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: [
      "D:\\Games\\Models\\island_life.glb",
      "models/worlds/sailtest.glb",
    ],
    featured: false,
    status: "beta",
  },
  {
    id: "fabled-main-town",
    title: "Town Stand-in (pirate pack)",
    short: "Fabled capital pending mesh",
    blurb:
      "NOT fabled-zone.glb (404 on CDN). Live mesh: pirate_island_pack + medieval camp. Great-tree capital + sky towns need R2 upload.",
    category: "warlords",
    tags: ["Town", "StandIn", "Map:PiratePack", "Awaiting:fabled-zone"],
    tone: "#b48cff",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["three"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: [
      "models/warlords-era/worlds/pirate_island_pack.glb",
      "C:\\Users\\nugye\\Desktop\\fabledzone.glb",
    ],
    featured: false,
    status: "beta",
  },
  {
    id: "bridge-town-docks",
    title: "Harbor Stand-in",
    short: "Dock kit pending · pirate+sail",
    blurb:
      "NOT bridge_town.glb (404 on CDN/SPA). Live mesh: pirate_island_pack + sailtest. Modular dock kit pending R2 upload.",
    category: "warlords",
    tags: ["Docks", "StandIn", "Awaiting:bridge-town-kit"],
    tone: "#5a9ec8",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["three"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: [
      "models/warlords-era/worlds/pirate_island_pack.glb",
      "models/worlds/sailtest.glb",
      "D:\\Games\\Models\\bridge_town.glb",
    ],
    featured: false,
    status: "beta",
  },
  {
    id: "dwarf-main-city",
    title: "Dwarf Main City",
    short: "Dwarf capital (NPCs ready)",
    blurb:
      "City NPCs use grudge6 dwarf + uMMORPG-style spawn tables. City mesh: convert licensed ummorpgdev/modularcitybuilder offline → models/worlds/dwarf-main-city.glb (no raw Unity in browser).",
    category: "warlords",
    tags: ["Dwarf", "Town", "uMMORPG", "grudge6"],
    tone: "#c4a574",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["three"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["C:\\Users\\nugye\\Documents\\ummorpgdev", "C:\\Users\\nugye\\Documents\\modularcitybuilder"],
    featured: false,
    status: "beta",
  },
  {
    id: "sailtest-map",
    title: "Sailtest Map",
    short: "Dual islands + sail",
    blurb:
      "SAILTEST dual islands near sea level — water, wind, sand, sky, camp, harvest, Grudge HUD/characters. Seed sailtest-island-01.",
    category: "armada",
    tags: ["Camp", "Sail", "Build", "Map:Sailtest"],
    tone: "#5a9ec8",
    posterKey: "library-mine",
    icon: "world-editor",
    engines: ["three"],
    launch: "native",
    nativeMode: "danger",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["C:\\Users\\nugye\\Desktop\\SAILTEST.glb", "models/worlds/sailtest.glb"],
    featured: true,
    status: "live",
  },
  {
    id: "ruins-brawler",
    title: "Ruins Brawler",
    short: "Twin-stick co-op",
    blurb: "3D twin-stick co-op survival in the shared GRUDOX ruins arena.",
    category: "voxel",
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
    title: "VoxGrudge Full World",
    short: "Production voxel open world",
    blurb:
      "THE voxel open-world deploy (voxgrudge.vercel.app · GRUDOX /voxgrudge). Source kit: Desktop grudgeproduction/voxgrudge (entry grudge-warlords-openworld.html). Not index/live HTML forks.",
    category: "voxel",
    tags: ["Voxel", "Survival", "Full World"],
    tone: "#5fe0ff",
    posterKey: "library-voxworld",
    icon: "explore",
    engines: ["three", "html-static"],
    launch: "external",
    url: VOXGRUDGE_WORLD.clientUrl,
    deploy: { client: "vercel", server: "railway" },
    sources: [...VOXGRUDGE_WORLD.sources, "D:\\Games\\grudge-voxel"],
    featured: true,
    status: "live",
  },
  {
    id: "voxgrudge-lab",
    title: "VoxGrudge Lab (Open)",
    short: "In-Open voxel editor + presence",
    blurb:
      "Lightweight Open surface for map tinkering + WS presence. For the full world, launch VoxGrudge Full World.",
    category: "voxel",
    tags: ["Lab", "Voxel"],
    tone: "#3a8a9a",
    posterKey: "library-voxworld",
    icon: "world-editor",
    engines: ["three"],
    launch: "native",
    nativeMode: "voxgrudge-native",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\gameopen\\artifacts\\animator\\src\\components\\VoxGrudgeNative.tsx"],
    status: "live",
  },
  {
    id: "warlord-genesis",
    title: "Warlord Genesis",
    short: "3-lane RTS · 9-sector seas",
    blurb:
      "Warlords-era: your 4 campfire heroes + grudge6 units (explorers are units). Three lanes, buildings, turrets, sailing sectors (3×3). In-app canvas with SSO + characterId; product SPA warlord-genesis.vercel.app.",
    category: "warlords",
    tags: ["MOBA", "RTS", "Fleet", "Sectors", "In-app"],
    tone: "#ffd24d",
    posterKey: "library-genesis",
    icon: "skill-vfx-lab",
    engines: ["three", "r3f"],
    // Native Open mode opens GenesisExternalLaunch → InAppGameCanvas (not a new browser tab).
    launch: "native",
    nativeMode: "genesis",
    url: "https://warstrat.grudge-studio.com/lobby",
    deploy: { client: "vercel", server: "railway", edge: "cloudflare-worker" },
    sources: ["F:\\GitHub\\warlord-genesis", "F:\\GitHub\\gameopen"],
    status: "live",
  },
  {
    id: "voxel-editor",
    title: "Worldbuilder",
    short: "Largest map editor · Play = Danger Room",
    blurb:
      "Open’s largest in-launcher map editor — blocks, deployables, dungeons. Hit Play for the exact Danger Room player UX (camera, loco, weapons, skills, FX, anims) with no admin tools.",
    category: "voxel",
    tags: ["Create", "Maps", "Worldbuilder", "Play"],
    tone: "#7ee0a0",
    posterKey: "worldbuilder",
    icon: "worldbuilder",
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
    category: "warlords",
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
    title: "Warlords Island (in-game)",
    short: "Inside Warlords only",
    blurb:
      "NOT a standalone Open game. Home / lobby island is entered from Grudge Warlords after character select.",
    category: "warlords",
    tags: ["Island", "In-game", "Warlords"],
    tone: "#5fd48a",
    posterKey: "lobby",
    icon: "loot",
    engines: ["r3f", "rapier"],
    launch: "external",
    url: WARLORDS_CLIENT_URL,
    deploy: { client: "vercel", server: "railway" },
    sources: ["Warlords client — not Open library"],
    featured: false,
    warlordsInGameOnly: true,
    status: "live",
  },
  {
    id: "pirate-islands",
    title: "Warlords Pirate Lobby (in-game)",
    short: "Opening + tutorial · Warlords only",
    blurb:
      "Chicken Gun / PolygonPirates lobby mesh (CDN models/lobby/pirate-islands). Warlords opening map AND tutorial map (shipwreck_cove → /tutorial). NOT GRUDOX, NOT Explorer, NOT an Open standalone game — enter via Grudge Warlords client only.",
    category: "warlords",
    tags: ["Lobby", "Opening", "Tutorial", "In-game", "Warlords", "Pirate"],
    tone: "#4a9ec8",
    posterKey: "lobby",
    icon: "explore",
    engines: ["three", "r3f", "rapier"],
    launch: "external",
    url: WARLORDS_PIRATE_LOBBY_URL,
    deploy: { client: "vercel", server: "railway" },
    sources: [
      "https://assets.grudge-studio.com/models/lobby/pirate-islands/scene.glb",
      "F:\\GitHub\\GrudgeBuilder\\client\\public\\production\\manifest.json",
      "F:\\GitHub\\GrudgeBuilder\\shared\\fleet\\gameDeployments.ts",
    ],
    featured: false,
    warlordsInGameOnly: true,
    status: "live",
  },
  {
    id: "warlords",
    title: "Grudge Warlords",
    short: "Main Warlords client",
    blurb:
      "Play Warlords here: pirate lobby, home island, sectors, crafting, hero fleet. Same Grudge ID + era=warlords heroes as Mine-Loader Realms (mineloader). SI 1.8 m · SSO + Railway characters.",
    category: "warlords",
    tags: ["Flagship", "Client", "Home", "Sectors", "Crafting", "Fleet Heroes", "era:warlords"],
    tone: "#e86a1a",
    posterKey: "zones",
    icon: "rally",
    engines: ["three", "colyseus"],
    launch: "external",
    url: WARLORDS_CLIENT_URL,
    deploy: { client: "vercel", server: "railway" },
    sources: ["F:\\GitHub\\warlords-crafting-suite", "F:\\GitHub\\GrudgeBuilder"],
    featured: true,
    status: "live",
  },
  {
    id: "hero-command",
    title: "Hero Command RTS",
    short: "Toon RTS · grudge6 · Rapier",
    blurb:
      "Hero Command (play.grudge-studio.com) — R3F + Rapier heightfield terrain, grudge6 race kits from assets.grudge-studio.com, fleet SSO. Monorepo artifact hero-rts.",
    category: "warlords",
    tags: ["RTS", "Hero", "grudge6", "Rapier"],
    tone: "#9d8bff",
    posterKey: "library-rts",
    icon: "siege",
    engines: ["r3f", "rapier", "three"],
    launch: "external",
    url: FLEET_WORLD_HOSTS.playRts,
    deploy: { client: "vercel" },
    sources: [
      "https://play.grudge-studio.com/",
      "https://hero-rts.vercel.app/",
      "C:\\Users\\nugye\\Documents\\grudge-studio\\artifacts\\hero-rts",
    ],
    featured: true,
    status: "live",
  },
  {
    id: "rts-grudge",
    title: "Warlords Forge Client",
    short: "RTS-Grudge forge shell",
    blurb:
      "RTS-Grudge / Warlords forge client (rts-grudge.vercel.app). Map tooling pairs with forge.grudge-studio.com. For Toon Hero Command use Hero Command RTS.",
    category: "warlords",
    tags: ["RTS", "Forge"],
    tone: "#7c6bb0",
    posterKey: "library-rts",
    icon: "world-editor",
    engines: ["r3f", "rapier"],
    launch: "external",
    url: "https://rts-grudge.vercel.app/",
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["F:\\GitHub\\RTS-Grudge", "F:\\GitHub\\grudge-warlords-rts"],
    status: "live",
  },
  {
    id: "grudge-arena",
    title: "Grudge Arena",
    short: "Instanced PvP · grudge6",
    blurb:
      "Dressing room → Danger-style combat with dual skill HUD. CDN D1 races + baked Bip001 anims.",
    category: "warlords",
    tags: ["PvP", "Arena", "grudge6"],
    tone: "#f43f5e",
    posterKey: "library-danger",
    icon: "siege",
    engines: ["three"],
    launch: "external",
    url: "https://grudge-arena.grudge-studio.com/",
    deploy: { client: "vercel" },
    sources: ["F:\\GitHub\\grudge-arena"],
    status: "live",
  },
  {
    id: "dungeon-crawler",
    title: "Dungeon Crawler Quest",
    short: "Voxel dungeon RPG",
    blurb:
      "Full DCQ — Three.js + voxel + Rapier dungeon RPG. Live at dcq.grudge-studio.com (fallback dungeon-crawler-quest.vercel.app).",
    category: "voxel",
    tags: ["Dungeon", "RPG", "Voxel"],
    tone: "#c9a0ff",
    posterKey: "mimic",
    icon: "ambush",
    engines: ["three", "rapier"],
    launch: "external",
    url: DCQ_WORLD.clientUrl,
    deploy: { client: "vercel", server: "railway" },
    sources: [...DCQ_WORLD.sources, "D:\\Games\\Dungeon-Crawler-Quest"],
    featured: true,
    status: "live",
  },
  {
    id: "water-island",
    title: "Warlords Home Island (in-game)",
    short: "Inside Warlords only",
    blurb:
      "Home / water island is a Warlords world destination — open Grudge Warlords, not a separate Open title. (water.grudge-studio.com serves the client world stack.)",
    category: "warlords",
    tags: ["Island", "Home", "In-game", "Warlords"],
    tone: "#4fc3c8",
    posterKey: "lobby",
    icon: "loot",
    engines: ["three", "r3f"],
    launch: "external",
    url: WARLORDS_CLIENT_URL,
    deploy: { client: "vercel", edge: "cloudflare-worker" },
    sources: ["Warlords client home · water SPA is world mesh host not Open game"],
    featured: false,
    warlordsInGameOnly: true,
    status: "live",
  },
  {
    id: "grudge-multiverse",
    title: "Grudge Multiverse",
    short: "Bermuda · grudge6 · multiplayer",
    blurb:
      "RTS Toon race→class, Bermuda Free Fire island (CDN map), harvest, bosses, Main Panel equipment & skills. Dedicated Railway rooms (wss …/api/mv) — not Carrier. Play #room1.",
    category: "warlords",
    tags: ["Multiverse", "grudge6", "Multiplayer", "Island", "Bermuda"],
    tone: "#c8a84b",
    posterKey: "lobby",
    icon: "explore",
    engines: ["three", "rapier"],
    launch: "external",
    /** Primary play URL — room hash selects Multiverse Railway room */
    url: "https://grudge-multiverse.vercel.app/#room1",
    deploy: { client: "vercel", server: "railway" },
    sources: [
      "F:\\GitHub\\grudge-multiverse",
      "https://grudge-multiverse.vercel.app",
      "https://grudge-multiverse-room-production.up.railway.app",
    ],
    featured: true,
    status: "live",
  },
  {
    id: "angel-island",
    title: "Angel Island",
    short: "Voxel island demo",
    blurb: "Angel Island voxel sandbox (D:\\Games\\angel_island pack).",
    category: "voxel",
    tags: ["Island", "Voxel"],
    tone: "#e8c06a",
    posterKey: "lobby",
    icon: "explore",
    engines: ["three"],
    launch: "external",
    url: FLEET_WORLD_HOSTS.angelIsland,
    deploy: { client: "vercel" },
    sources: ["D:\\Games\\angel_island"],
    status: "live",
  },
  {
    id: "grudox-games",
    title: "GRUDOX Games Hub",
    short: "Arcade + cabinets",
    blurb: "Racer, zombie, z-brawl, waters, voxgrudge path — grudox.grudge-studio.com/games",
    category: "voxel",
    tags: ["Arcade", "Hub"],
    tone: "#7a9cff",
    posterKey: "zones",
    icon: "rally",
    engines: ["three", "html-static"],
    launch: "external",
    url: FLEET_WORLD_HOSTS.grudoxGames,
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\grudox"],
    featured: true,
    status: "live",
  },
  {
    id: "survival-grudges",
    title: "Grudges Survival",
    short: "Survival R3F",
    blurb: "Open survival on grudges.grudge-studio.com — Railway survival-api.",
    category: "voxel",
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
    category: "voxel",
    tags: ["Arena", "Voxel"],
    tone: "#9d8bff",
    posterKey: "brawl",
    icon: "charge",
    engines: ["three"],
    launch: "external",
    url: "https://grudox.grudge-studio.com/arcade/play/z-brawl",
    deploy: { client: "vercel" },
    sources: ["D:\\GitHub\\grudox"],
    status: "live",
  },
  {
    id: "mimic-dungeon",
    title: "Test Dungeon · Mimic",
    short: "Encounter lab",
    blurb: "Vol scene — open a barrel, fight the Mimic (melee + acid AoE).",
    category: "warlords",
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
    category: "account",
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
    category: "nexus",
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
    short: "TPS mech · Rapier · builder",
    blurb:
      "mech-playground — Danger-style third-person camera, soft/hard focus crosshair, capsule Rapier colliders, physics-driven mech anim. Builder shell redirects here. Optional Railway pvp-server.",
    category: "nexus",
    tags: ["Mech", "TPS", "Rapier", "PvP"],
    tone: "#ff8844",
    posterKey: "danger",
    icon: "siege",
    engines: ["r3f", "rapier", "three", "socketio"],
    launch: "external",
    url: FLEET_WORLD_HOSTS.mech,
    deploy: { client: "vercel", server: "railway" },
    sources: [
      "https://mech-playground.vercel.app/",
      "C:\\Users\\nugye\\Documents\\grudge-mech-forge",
      "MolochDaGod/grudge-mech-forge",
    ],
    featured: true,
    status: "live",
  },
  {
    id: "forge-editor",
    title: "Studio Forge",
    short: "Map & model editor",
    blurb: "Fleet map editor — forge.grudge-studio.com (RTS-Grudge studio).",
    category: "warlords",
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
  {
    id: "asset-rig-editor",
    title: "Asset Rig Editor",
    short: "Rig · retarget · asset pipeline",
    blurb:
      "Development asset tool — character customizer / Mixamo-style rig editor. Use from Open as an in-app tool for Warlords & fleet meshes (retarget, skin, preview). Production: asset-rig-editor.vercel.app.",
    category: "warlords",
    tags: ["Tool", "App", "Dev", "Assets", "Rig", "Pipeline"],
    tone: "#5b8def",
    posterKey: "dressing",
    icon: "animation-editor",
    engines: ["three"],
    launch: "external",
    url: "https://asset-rig-editor.vercel.app/",
    deploy: { client: "vercel" },
    sources: [
      "https://asset-rig-editor.vercel.app/",
      "F:\\GitHub\\grudge-character-animator",
    ],
    featured: true,
    status: "live",
  },
  {
    id: "grudge-pipeline",
    title: "Grudge Pipeline",
    short: "Ingest · bake · R2 · Forge",
    blurb:
      "Production asset pipeline — FBX/GLB convert, bake, optimize, push to R2, open scene packs in Forge (postMessage handoff). Live: grudge-pipeline.vercel.app.",
    category: "warlords",
    tags: ["Tool", "App", "Dev", "Assets", "Pipeline", "Forge"],
    tone: "#f0a030",
    posterKey: "voxel",
    icon: "world-editor",
    engines: ["three"],
    launch: "external",
    url: "https://grudge-pipeline.vercel.app/",
    deploy: { client: "vercel" },
    sources: [
      "https://grudge-pipeline.vercel.app/",
      "F:\\GitHub\\grudge-pipeline",
    ],
    featured: true,
    status: "live",
  },
  {
    id: "grim-armada",
    title: "Grim Armada",
    short: "Naval armada era",
    blurb:
      "Production Armada-era fleet title — ships, naval combat. Live grim-armada-web.vercel.app. Import new Armada content under this era only.",
    category: "armada",
    tags: ["Naval", "Armada", "Fleet"],
    tone: "#4fc3c8",
    posterKey: "lobby",
    icon: "rally",
    engines: ["three"],
    launch: "external",
    url: "https://grim-armada-web.vercel.app/",
    deploy: { client: "vercel" },
    sources: ["F:\\GitHub\\grim-armada-web", "GrimArmada"],
    featured: true,
    status: "live",
  },
  {
    id: "nexus-carrier",
    title: "Carrier · Nexus",
    short: "Fleet room / WS nexus",
    blurb:
      "Nexus-era live room relay (carrier.grudge-studio.com). Use for multiplayer presence handoff — not a second open world.",
    category: "nexus",
    tags: ["Nexus", "Multiplayer", "WS"],
    tone: "#9d8bff",
    posterKey: "zones",
    icon: "rally",
    engines: ["socketio"],
    launch: "external",
    url: "https://carrier.grudge-studio.com/",
    deploy: { client: "vercel", server: "railway", edge: "cloudflare-worker" },
    sources: ["gameopen carrier", "voxgrudge-grudox-room"],
    featured: true,
    status: "live",
  },
  {
    id: "nexus-slot",
    title: "Nexus Import Bay",
    short: "Era scaffold · sci-fi",
    blurb:
      "Reserved Nexus-era shelf for production imports (drive, space RTS, cyber packs). Do not dump Warlords or Voxel HTML here — wire a live Vercel URL first.",
    category: "nexus",
    tags: ["Nexus", "Import", "Scaffold"],
    tone: "#7a6cff",
    posterKey: "zones",
    icon: "explore",
    engines: ["three"],
    launch: "external",
    url: "https://grudox.grudge-studio.com/games",
    deploy: { client: "vercel" },
    sources: ["era:nexus"],
    status: "migrating",
  },
  {
    id: "armada-slot",
    title: "Armada Import Bay",
    short: "Era scaffold · naval",
    blurb:
      "Reserved Armada-era shelf for sail/fleet imports beyond Grim Armada + Sailtest. Production URL required before featured.",
    category: "armada",
    tags: ["Armada", "Import", "Scaffold"],
    tone: "#3aa8b0",
    posterKey: "lobby",
    icon: "explore",
    engines: ["three"],
    launch: "external",
    url: "https://grim-armada-web.vercel.app/",
    deploy: { client: "vercel" },
    sources: ["era:armada"],
    status: "migrating",
  },
] as const;

export function posterUrl(posterKey: string): string {
  return assetUrl(`rooms/${posterKey}-scene.png`);
}

export function iconUrl(name: string): string {
  return assetUrl(`icons/${name}.png`);
}

/** Library UI never lists Warlords in-game worlds as standalone titles. */
export function isLibraryVisible(g: GameEntry): boolean {
  return !g.warlordsInGameOnly;
}

export function libraryByCategory(cat: GameCategory | "all"): GameEntry[] {
  const base =
    cat === "all" ? [...GAME_LIBRARY] : GAME_LIBRARY.filter((g) => g.category === cat);
  return base.filter(isLibraryVisible);
}

/** Eras are the library categories (voxel / warlords / nexus / armada). */
export function libraryByEra(era: GameCategory | "all"): GameEntry[] {
  return libraryByCategory(era);
}

/** Live production voxel titles (excludes lab + import scaffolds). */
export function productionVoxelGames(): GameEntry[] {
  return GAME_LIBRARY.filter(
    (g) =>
      g.category === "voxel" &&
      g.status === "live" &&
      g.id !== "voxgrudge-lab" &&
      !g.id.endsWith("-slot") &&
      isLibraryVisible(g),
  );
}

export function featuredGames(): GameEntry[] {
  return GAME_LIBRARY.filter((g) => g.featured && isLibraryVisible(g));
}

/** Warlords sector / home-island catalog (docs + agents) — not Open launch tiles. */
export function warlordsInGameWorlds(): GameEntry[] {
  return GAME_LIBRARY.filter((g) => g.warlordsInGameOnly);
}

export function mineLoaderGames(): GameEntry[] {
  return GAME_LIBRARY.filter(
    (g) => g.engines.includes("mine-loader") || g.launch === "mine-loader",
  );
}

export function getGame(id: string): GameEntry | undefined {
  return GAME_LIBRARY.find((g) => g.id === id);
}

/** Build launch URL with fleet SSO handoff (all external / mine-loader titles). */
export function gameLaunchUrl(
  game: GameEntry,
  params: {
    token?: string | null;
    characterId?: string | null;
    baseId?: string | null;
    characterName?: string | null;
    raceId?: string | null;
  } = {},
): string | null {
  if (game.launch === "native" || game.launch === "editor") return null;

  // Warlords home/sector/map content → always the Warlords client, never a fake standalone
  if (
    game.warlordsInGameOnly ||
    game.id === "water-island" ||
    game.id === "grudox-island" ||
    game.id === "pirate-islands"
  ) {
    try {
      // Chicken Gun pirate lobby = production opening + tutorial mesh (not /home generic)
      const base =
        game.id === "pirate-islands" ? WARLORDS_PIRATE_LOBBY_URL : WARLORDS_CLIENT_URL;
      const u = new URL(base);
      u.searchParams.set("open", "1");
      u.searchParams.set("from", "gameopen");
      u.searchParams.set("warlordsWorld", game.id);
      if (game.id === "pirate-islands") {
        // Preserve mode/map from WARLORDS_PIRATE_LOBBY_PATH; reinforce SSOT
        if (!u.searchParams.get("mode")) u.searchParams.set("mode", "lobby");
        if (!u.searchParams.get("map")) u.searchParams.set("map", "pirate-islands");
      }
      if (params.token) {
        u.searchParams.set("sso_token", params.token);
        u.searchParams.set("grudge_token", params.token);
      }
      if (params.characterId) u.searchParams.set("characterId", params.characterId);
      if (params.characterName) u.searchParams.set("characterName", params.characterName);
      return u.toString();
    } catch {
      return game.id === "pirate-islands" ? WARLORDS_PIRATE_LOBBY_URL : WARLORDS_CLIENT_URL;
    }
  }

  // Specialized builders (hash routes / dual hosts)
  if (game.id === "mine-loader-realms" || game.launch === "mine-loader") {
    return mineLoaderLobbyUrl({
      token: params.token,
      characterId: params.characterId,
      from: "gameopen",
    });
  }
  if (game.id === "voxgrudge") {
    return voxgrudgeWorldUrl({
      token: params.token,
      characterId: params.characterId,
      from: "gameopen",
    });
  }
  if (game.id === "dungeon-crawler") {
    return dcqWorldUrl({
      token: params.token,
      characterId: params.characterId,
      from: "gameopen",
    });
  }
  if (game.id === "warlord-genesis") {
    return fleetWorldLaunchUrl("warlord-genesis", {
      token: params.token,
      characterId: params.characterId,
      baseId: params.baseId,
      characterName: params.characterName,
      raceId: params.raceId,
      from: "open",
    });
  }

  const base = game.url || MINE_LOADER.clientUrl;
  return fleetWorldLaunchUrl(base, {
    token: params.token,
    characterId: params.characterId,
    baseId: params.baseId,
    characterName: params.characterName,
    raceId: params.raceId,
    from: "gameopen",
  });
}

export type LibraryFilter = "all" | "featured" | GameCategory;

/** Library chip row — era-first (import/deploy without confusion). */
export const LIBRARY_FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "featured", label: "Featured" },
  { id: "voxel", label: "Voxel" },
  { id: "warlords", label: "Warlords" },
  { id: "nexus", label: "Nexus" },
  { id: "armada", label: "Armada" },
  { id: "account", label: "Account" },
];

/**
 * Fleet voxel / world / DCQ hosts — live smoke 2026-08.
 *
 * Ownership:
 *  - Full open world (VoxGrudge) → voxgrudge.vercel.app / GRUDOX /voxgrudge
 *  - Authoritative multiplayer Realms / harvest / DRC → **mineloader.grudge-studio.com**
 *  - DCQ dungeon RPG → dcq.grudge-studio.com
 *  - Ruins Brawler → gameopen /brawl only (not Genesis)
 *  - Warlord Genesis / Warstrat → warstrat.grudge-studio.com (canonical)
 */

export const FLEET_WORLD_HOSTS = {
  /**
   * Canonical play host — multiplayer, map deploys, harvest mode, DRC combat,
   * account explorer avatar characters. CF Worker → mine-loader.vercel.app.
   */
  mineLoader: "https://mineloader.grudge-studio.com/",
  /** Short alias edge */
  mineLoaderEdge: "https://mine.grudge-studio.com/",
  /** Vercel origin fallback */
  mineLoaderVercel: "https://mine-loader.vercel.app/",
  /** Mine-Loader Railway API (world authority + Codex /api/blocks) */
  mineLoaderApi: "https://mine-loader-api-production.up.railway.app",
  /** Mine-Loader GitHub SSOT */
  mineLoaderGithub: "https://github.com/MolochDaGod/mine-loader",
  /** Full open-world VoxGrudge (CDN Three openworld HTML) */
  voxgrudge: "https://voxgrudge.vercel.app/",
  /** GRUDOX shell hosts voxgrudge path */
  grudoxVoxgrudge: "https://grudox.grudge-studio.com/voxgrudge/",
  grudoxGames: "https://grudox.grudge-studio.com/games",
  grudox: "https://grudox.grudge-studio.com/",
  /** Dungeon Crawler Quest */
  dcq: "https://dcq.grudge-studio.com/",
  dcqVercel: "https://dungeon-crawler-quest.vercel.app/",
  /** Survival R3F */
  grudgesSurvival: "https://grudges.grudge-studio.com/",
  /**
   * Warlords water / home-island SPA — **only** production host.
   * Do NOT use tactical-infinity.vercel.app (orphaned; not fleet).
   * Do NOT use old Replit TI hosts (dead).
   */
  water: "https://water.grudge-studio.com/",
  waterIsland: "https://water.grudge-studio.com/island",
  /** Angel island demo */
  angelIsland: "https://angel-island.vercel.app/",
  /** Hero Command RTS (hero-rts artifact) — canonical play host */
  playRts: "https://play.grudge-studio.com/",
  /** Vercel twin for Hero Command */
  heroRts: "https://hero-rts.vercel.app/",
  forge: "https://forge.grudge-studio.com/",
  /** Warlords / genesis */
  warlords: "https://grudgewarlords.com/",
  /** Canonical Warstrat production SPA (Warlord Genesis warcamp) */
  warstrat: "https://warstrat.grudge-studio.com/",
  warstratLobby: "https://warstrat.grudge-studio.com/lobby",
  /** Vercel twin for Warstrat / Genesis */
  warlordGenesis: "https://warstrat.grudge-studio.com/lobby",
  warlordGenesisVercel: "https://warlord-genesis.vercel.app/lobby",
  /** Social / meta */
  metaverse: "https://metaverse.grudge-studio.com/",
  carrier: "https://carrier.grudge-studio.com/",
  /** Mech */
  mech: "https://mech-playground.vercel.app/",
  /** Armada era */
  grimArmada: "https://grim-armada-web.vercel.app/",
  /** Open self */
  open: "https://open.grudge-studio.com/",
  /** Alias of open — keep key for older callers; always open.grudge-studio.com */
  gameopen: "https://open.grudge-studio.com/",
  /** GST Islands RTS (portal /gst/) */
  gstIslands: "https://grudge-studio.com/gst/",
  /** Arena PvP */
  grudgeArena: "https://grudge-arena.grudge-studio.com/",
  /** Multiverse */
  multiverse: "https://grudge-multiverse.vercel.app/",
} as const;

export type FleetWorldId =
  | "mine-loader"
  | "voxgrudge"
  | "dcq"
  | "grudges-survival"
  | "water-island"
  | "angel-island"
  | "rts"
  | "forge"
  | "warlords"
  | "warlord-genesis"
  | "metaverse"
  | "carrier"
  | "mech"
  | "grudox-games"
  | "gst-islands"
  | "grudge-arena"
  | "multiverse";

export type FleetWorldDef = {
  id: FleetWorldId;
  title: string;
  /** Primary live URL (HEAD 200 verified) */
  url: string;
  /** Fallback if primary fails */
  fallbackUrl?: string;
  blurb: string;
  kind: "full-world" | "realms" | "dungeon" | "island" | "rts" | "survival" | "hub" | "combat";
  sources: string[];
  featured?: boolean;
};

/** Verified playable worlds for Open library / handoff. */
export const FLEET_WORLDS: readonly FleetWorldDef[] = [
  {
    id: "mine-loader",
    title: "Mine-Loader Realms",
    url: FLEET_WORLD_HOSTS.mineLoader,
    fallbackUrl: FLEET_WORLD_HOSTS.mineLoaderEdge,
    blurb:
      "Play host mineloader.grudge-studio.com — multiplayer Realms, self-hosted maps, harvest (Minecraft-like) + DRC combat with account explorer avatar.",
    kind: "realms",
    sources: ["D:\\GitHub\\minegrudge\\Mine-Loader", "F:\\GitHub\\voxgrudge\\Mine-Loader"],
    featured: true,
  },
  {
    id: "voxgrudge",
    title: "VoxGrudge Full World",
    url: FLEET_WORLD_HOSTS.voxgrudge,
    fallbackUrl: FLEET_WORLD_HOSTS.grudoxVoxgrudge,
    blurb: "Full open-world voxel survival — classes, craft, build, GRUDOX room API.",
    kind: "full-world",
    sources: ["D:\\GitHub\\voxgrudge", "F:\\GitHub\\voxgrudge", "D:\\Games\\grudge-voxel"],
    featured: true,
  },
  {
    id: "dcq",
    title: "Dungeon Crawler Quest",
    url: FLEET_WORLD_HOSTS.dcq,
    fallbackUrl: FLEET_WORLD_HOSTS.dcqVercel,
    blurb: "Voxel dungeon RPG (Three + Rapier). DCQ production domain.",
    kind: "dungeon",
    sources: ["D:\\GitHub\\Dungeon-Crawler-Quest", "F:\\GitHub\\Dungeon-Crawler-Quest"],
    featured: true,
  },
  {
    id: "water-island",
    title: "Warlords Home Island (in-game only)",
    url: FLEET_WORLD_HOSTS.warlords,
    fallbackUrl: "https://client.grudge-studio.com/home",
    blurb:
      "Not a standalone fleet game. Home/water island is entered from Grudge Warlords after hero select. water.grudge-studio.com hosts world assets for the client.",
    kind: "island",
    sources: ["Warlords client", "https://water.grudge-studio.com"],
    featured: false,
  },
  {
    id: "grudges-survival",
    title: "Grudges Survival",
    url: FLEET_WORLD_HOSTS.grudgesSurvival,
    blurb: "Open survival R3F + Railway survival API.",
    kind: "survival",
    sources: ["grudges.grudge-studio.com"],
    featured: true,
  },
  {
    id: "angel-island",
    title: "Angel Island",
    url: FLEET_WORLD_HOSTS.angelIsland,
    blurb: "Voxel island sandbox demo (angel_island pack).",
    kind: "island",
    sources: ["D:\\Games\\angel_island"],
  },
  {
    id: "rts",
    title: "Hero Command RTS",
    url: FLEET_WORLD_HOSTS.playRts,
    fallbackUrl: FLEET_WORLD_HOSTS.heroRts,
    blurb:
      "Hero Command — R3F + Rapier terrain, grudge6 races (CDN). play.grudge-studio.com · hero-rts.",
    kind: "rts",
    sources: [
      "https://play.grudge-studio.com/",
      "C:\\Users\\nugye\\Documents\\grudge-studio\\artifacts\\hero-rts",
      "MolochDaGod/grudge-studio-games",
    ],
    featured: true,
  },
  {
    id: "forge",
    title: "Studio Forge",
    url: FLEET_WORLD_HOSTS.forge,
    blurb: "Map & model editor for fleet worlds.",
    kind: "hub",
    sources: ["F:\\GitHub\\Grudge-Studio-Forge"],
  },
  {
    id: "warlords",
    title: "Grudge Warlords",
    url: FLEET_WORLD_HOSTS.warlords,
    blurb:
      "Flagship client — home island, sectors, maps, crafting, heroes all in-game. Open library does not list islands/sectors as separate titles.",
    kind: "full-world",
    sources: ["D:\\GitHub\\GrudgeWarlords", "https://client.grudge-studio.com/home"],
    featured: true,
  },
  {
    id: "warlord-genesis",
    title: "Warstrat · Warlord Genesis",
    url: FLEET_WORLD_HOSTS.warstratLobby,
    fallbackUrl: FLEET_WORLD_HOSTS.warlordGenesisVercel,
    blurb:
      "Warstrat (warstrat.grudge-studio.com) — 3-lane MOBA/RTS warcamp, shared Grudge ID + Railway account DB. Not Ruins Brawler.",
    kind: "rts",
    sources: [
      "https://warstrat.grudge-studio.com/",
      "F:\\GitHub\\warlord-genesis",
      "C:\\Users\\nugye\\Documents\\warlord-genesis",
    ],
    featured: true,
  },
  {
    id: "metaverse",
    title: "Grudge Metaverse",
    url: FLEET_WORLD_HOSTS.metaverse,
    blurb: "Lobby → play heroes with grudge6 meshes.",
    kind: "hub",
    sources: ["D:\\GitHub\\grudge-metaverse"],
  },
  {
    id: "carrier",
    title: "Carrier",
    url: FLEET_WORLD_HOSTS.carrier,
    blurb: "Fleet command / co-located rooms.",
    kind: "hub",
    sources: ["D:\\GitHub\\grudox"],
  },
  {
    id: "mech",
    title: "Mech Forge",
    url: FLEET_WORLD_HOSTS.mech,
    blurb:
      "Mech playground — TPS Danger cam, Rapier capsule, soft/hard focus crosshair. mech-builder redirects here.",
    kind: "combat",
    sources: [
      "https://mech-playground.vercel.app/",
      "C:\\Users\nugye\\Documents\\grudge-mech-forge",
      "MolochDaGod/grudge-mech-forge",
    ],
    featured: true,
  },
  {
    id: "grudox-games",
    title: "GRUDOX Games Hub",
    url: FLEET_WORLD_HOSTS.grudoxGames,
    blurb: "Arcade + cabinet index (racer, zombie, z-brawl, waters).",
    kind: "hub",
    sources: ["D:\\GitHub\\grudox"],
    featured: true,
  },
  {
    id: "gst-islands",
    title: "Grudge Islands RTS",
    url: FLEET_WORLD_HOSTS.gstIslands,
    blurb:
      "GST /gst/ — airship cinema, island sim, combat showcase. Vercel grudge-studio-tool.",
    kind: "rts",
    sources: [
      "C:\\Users\\nugye\\Documents\\Game-Studio-Tool\\Game-Studio-Tool\\artifacts\\grudge-islands",
    ],
    featured: true,
  },
  {
    id: "grudge-arena",
    title: "Grudge Arena",
    url: FLEET_WORLD_HOSTS.grudgeArena,
    blurb: "Instanced PvP · grudge6 · dual skill HUD.",
    kind: "combat",
    sources: ["F:\\GitHub\\grudge-arena"],
  },
  {
    id: "multiverse",
    title: "Grudge Multiverse",
    url: FLEET_WORLD_HOSTS.multiverse,
    blurb: "Bermuda island multiplayer · dedicated Railway rooms (not Carrier).",
    kind: "full-world",
    sources: ["F:\\GitHub\\grudge-multiverse"],
    featured: true,
  },
] as const;

export function getFleetWorld(id: FleetWorldId): FleetWorldDef | undefined {
  return FLEET_WORLDS.find((w) => w.id === id);
}

/**
 * Build external world URL with fleet SSO + character handoff.
 * All worlds get open=1&from=gameopen so they can capture the same contract.
 */
export function fleetWorldLaunchUrl(
  world: FleetWorldDef | string,
  opts: {
    token?: string | null;
    characterId?: string | null;
    baseId?: string | null;
    characterName?: string | null;
    raceId?: string | null;
    from?: string;
    /** Mine-Loader hash route */
    hash?: string;
  } = {},
): string {
  const def = typeof world === "string" ? getFleetWorld(world as FleetWorldId) : world;
  const base = def?.url || (typeof world === "string" ? world : FLEET_WORLD_HOSTS.open);
  try {
    const u = new URL(base);
    if (opts.token) {
      u.searchParams.set("sso_token", opts.token);
      u.searchParams.set("grudge_token", opts.token);
    }
    if (opts.characterId) u.searchParams.set("characterId", opts.characterId);
    if (opts.baseId) u.searchParams.set("baseId", opts.baseId);
    if (opts.characterName) u.searchParams.set("characterName", opts.characterName);
    if (opts.raceId) u.searchParams.set("raceId", opts.raceId);
    u.searchParams.set("open", "1");
    u.searchParams.set("from", opts.from || "gameopen");
    if (opts.hash) u.hash = opts.hash.startsWith("#") ? opts.hash : `#${opts.hash}`;
    else if (def?.id === "mine-loader" && !u.hash) u.hash = "#/lobby";
    return u.toString();
  } catch {
    return base;
  }
}

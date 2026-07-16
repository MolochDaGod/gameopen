/**
 * Fleet voxel / world / DCQ hosts — verified live (probed 2026-07).
 *
 * Prefer these URLs for library launch + handoff. Do not use DNS names that
 * fail to resolve (e.g. mineloader.grudge-studio.com was NXDOMAIN).
 *
 * Ownership:
 *  - Full open world (VoxGrudge) → voxgrudge.vercel.app / GRUDOX /voxgrudge
 *  - Authoritative multiplayer Realms → mine-loader.vercel.app (Mine-Loader)
 *  - DCQ dungeon RPG → dcq.grudge-studio.com
 *  - Ruins Brawler → gameopen /brawl only (not Genesis)
 *  - Warlord Genesis → warlord-genesis.vercel.app
 */

export const FLEET_WORLD_HOSTS = {
  /** Authoritative voxel Realms SPA (Mine-Loader monorepo deploy) */
  mineLoader: "https://mine-loader.vercel.app/",
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
  /** Tactical Infinity / water / home island */
  water: "https://water.grudge-studio.com/",
  waterIsland: "https://water.grudge-studio.com/island",
  tacticalInfinity: "https://tactical-infinity.vercel.app/",
  /** Angel island demo */
  angelIsland: "https://angel-island.vercel.app/",
  /** RTS / command */
  playRts: "https://play.grudge-studio.com/",
  forge: "https://forge.grudge-studio.com/",
  /** Warlords / genesis */
  warlords: "https://grudgewarlords.com/",
  warlordGenesis: "https://warlord-genesis.vercel.app/lobby",
  /** Social / meta */
  metaverse: "https://metaverse.grudge-studio.com/",
  carrier: "https://carrier.grudge-studio.com/",
  /** Mech */
  mech: "https://mech-playground.vercel.app/",
  /** Open self */
  open: "https://open.grudge-studio.com/",
  gameopen: "https://gameopen.vercel.app/",
} as const;

export type FleetWorldId =
  | "mine-loader"
  | "voxgrudge"
  | "dcq"
  | "grudges-survival"
  | "water-island"
  | "tactical-infinity"
  | "angel-island"
  | "rts"
  | "forge"
  | "warlords"
  | "warlord-genesis"
  | "metaverse"
  | "carrier"
  | "mech"
  | "grudox-games";

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
    blurb: "Authoritative multiplayer voxel Realms (blocks, lobby, parties).",
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
    title: "Warlords Home Island",
    url: FLEET_WORLD_HOSTS.waterIsland,
    fallbackUrl: FLEET_WORLD_HOSTS.water,
    blurb: "Tactical Infinity / water production island — grudge6 + harvest.",
    kind: "island",
    sources: ["F:\\GitHub\\Tactical-Infinity", "water.grudge-studio.com"],
    featured: true,
  },
  {
    id: "tactical-infinity",
    title: "Tactical Infinity",
    url: FLEET_WORLD_HOSTS.tacticalInfinity,
    blurb: "Full TI client — islands, equipment, Warlords era systems.",
    kind: "full-world",
    sources: ["F:\\GitHub\\Tactical-Infinity"],
    featured: true,
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
    title: "Voxel RTS / Command",
    url: FLEET_WORLD_HOSTS.playRts,
    blurb: "Toon RTS + Hero Command (play.grudge-studio.com).",
    kind: "rts",
    sources: ["F:\\GitHub\\RTS-Grudge", "F:\\GitHub\\grudge-warlords-rts"],
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
    blurb: "Flagship Warlords client — characters, islands, lobbies.",
    kind: "full-world",
    sources: ["D:\\GitHub\\GrudgeWarlords"],
    featured: true,
  },
  {
    id: "warlord-genesis",
    title: "Warlord Genesis",
    url: FLEET_WORLD_HOSTS.warlordGenesis,
    blurb: "3-lane MOBA/RTS warcamp (not Ruins Brawler).",
    kind: "rts",
    sources: ["F:\\GitHub\\warlord-genesis"],
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
    blurb: "Mech builder / playground.",
    kind: "combat",
    sources: ["F:\\GitHub\\grudge-mech-forge"],
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

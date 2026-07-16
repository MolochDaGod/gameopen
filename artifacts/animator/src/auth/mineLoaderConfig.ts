/**
 * Mine-Loader / Voxel Realms — fleet-owned hosts only.
 *
 * ALWAYS use fleet production SPA (edge or Vercel). Never iframe /minegrudge/
 * on the play shell (that path 404s on Vercel and was injecting api=replit).
 *
 * Live SPA:  https://mine.grudge-studio.com  (CF → mine-loader.vercel.app)
 * API SSOT:  https://mine-loader-api-production.up.railway.app  (1 replica)
 * Open proxy: same-origin /api/blocks|/api/worlds → Railway (vercel.json)
 */

/** Cloudflare edge alias for the Voxel Realms SPA. */
export const MINE_LOADER_EDGE = "https://mine.grudge-studio.com";

/** Vercel project origin (also valid; edge preferred for players). */
export const MINE_LOADER_VERCEL = "https://mine-loader.vercel.app";

/**
 * Railway world/API authority (blocks, definitions, worlds, WS).
 * Open proxies this via vercel.json for same-origin catalog calls.
 */
export const MINE_LOADER_API =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_MINELOADER_API as string | undefined)?.replace(/\/+$/, "")) ||
  "https://mine-loader-api-production.up.railway.app";

/**
 * Browser SPA origin. Prefer edge; override with VITE_MINELOADER_URL.
 * API is still Railway — SPA rewrites /api/* on Vercel, or pass `api=` query.
 */
export const MINE_LOADER_LIVE =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_MINELOADER_URL as string | undefined)?.replace(/\/+$/, "")) ||
  MINE_LOADER_EDGE;

/** @deprecated Local staged SPA is not deployed on Vercel — do not iframe. */
export const MINE_LOADER_LOCAL_PATH = "/minegrudge/";

export type MineLoaderSurface =
  | "home"
  | "play"
  | "lobby"
  | "editor"
  | "boss"
  | "coop"
  | "codex"
  | "join";

export const MINE_LOADER_PILLARS = [
  {
    id: "survival",
    label: "Survival",
    blurb: "Gather, craft, eat, light the dark, and stay alive underground.",
  },
  {
    id: "combat",
    label: "Combat",
    blurb: "Melee, ranged, magic, armor — fight wildlife, raiders, and bosses.",
  },
  {
    id: "adventure",
    label: "Adventure",
    blurb: "Open world biomes, dungeons, arenas, and hand-authored maps.",
  },
  {
    id: "build",
    label: "Build",
    blurb: "Full block catalog, tools, and world editor that becomes play.",
  },
  {
    id: "social",
    label: "Friends & parties",
    blurb: "Co-op rooms, party tags (no friendly fire), public/private worlds.",
  },
  {
    id: "guilds",
    label: "Guilds & worlds",
    blurb: "Persistent shared worlds, invites, and group adventures online.",
  },
] as const;

export const MINE_LOADER_HASH: Record<MineLoaderSurface, string> = {
  home: "#/",
  play: "#/play",
  lobby: "#/lobby",
  editor: "#/editor",
  boss: "#/play",
  coop: "#/lobby",
  codex: "#/defs",
  join: "#/join",
};

export interface MineLoaderLaunchOpts {
  surface?: MineLoaderSurface;
  characterId?: string | null;
  characterName?: string | null;
  baseId?: string | null;
  token?: string | null;
  joinCode?: string | null;
  /** Minecraft-like world seed (numeric or label). */
  seed?: number | string | null;
  /** Human seed label for UI (optional). */
  seedLabel?: string | null;
  /** Seed-world deployment id from content/worlds/seed-deployments.json */
  deploymentId?: string | null;
  /** Mine-Loader CHUNK_SIZES index 0..7 (16…1024). */
  chunkIdx?: number | null;
  /** play mode: seed-overworld | dungeon | default */
  worldMode?: "seed-overworld" | "dungeon" | string | null;
  /**
   * Absolute API origin for the SPA. Defaults to Railway authority.
   * Prefer Railway so /api never depends on Replit or a broken rewrite.
   */
  apiBase?: string | null;
  /**
   * @deprecated Ignored. Always uses fleet live host — never /minegrudge or Replit.
   */
  preferLive?: boolean;
  forceLocal?: boolean;
}

/**
 * Absolute URL for Mine-Loader Realms (fleet edge / Vercel only).
 * Never returns same-origin /minegrudge or any replit host.
 */
export function buildMineLoaderUrl(opts: MineLoaderLaunchOpts = {}): string {
  const surface = opts.surface ?? "lobby";
  const base = MINE_LOADER_LIVE.replace(/\/+$/, "");
  const url = new URL(`${base}/`);

  url.searchParams.set("from", "gameopen");
  url.searchParams.set("open", "1");
  url.searchParams.set("surface", surface);
  // Collection shell origin (open.grudge-studio.com) for return links inside Realms
  if (typeof window !== "undefined") {
    url.searchParams.set("collection", window.location.origin);
  }

  if (opts.token) {
    url.searchParams.set("grudge_token", opts.token);
    url.searchParams.set("sso_token", opts.token);
  }
  if (opts.characterId) url.searchParams.set("characterId", opts.characterId);
  if (opts.characterName) url.searchParams.set("characterName", opts.characterName);
  if (opts.baseId) url.searchParams.set("baseId", opts.baseId);
  if (opts.joinCode) url.searchParams.set("join", opts.joinCode);
  if (opts.seed != null && opts.seed !== "") {
    url.searchParams.set("seed", String(opts.seed));
  }
  if (opts.seedLabel) url.searchParams.set("seedLabel", String(opts.seedLabel));
  if (opts.deploymentId) url.searchParams.set("deploymentId", opts.deploymentId);
  if (opts.chunkIdx != null && Number.isFinite(Number(opts.chunkIdx))) {
    url.searchParams.set("chunkIdx", String(Math.trunc(Number(opts.chunkIdx))));
  }
  if (opts.worldMode) url.searchParams.set("mode", opts.worldMode);

  // Point SPA API at Railway authority (or same-origin Open proxy when embedded).
  // Mine-Loader Vercel also rewrites /api/* → Railway; absolute API avoids drift.
  const api =
    (opts.apiBase && opts.apiBase.replace(/\/+$/, "")) ||
    MINE_LOADER_API;
  url.searchParams.set("api", api);

  let hash = MINE_LOADER_HASH[surface] || "#/";
  if (opts.joinCode && surface === "join") {
    hash = `#/join/${encodeURIComponent(opts.joinCode)}`;
  }
  url.hash = hash;

  let out = url.toString();
  if (/replit/i.test(out) || /\/minegrudge\//i.test(out)) {
    out = out
      .replace(/https?:\/\/[^/"']*replit[^/"']*/gi, base)
      .replace(/mine-loader\.replit\.app/gi, "mine-loader.vercel.app")
      .replace(/https?:\/\/[^/"']+\/minegrudge\/?/gi, `${base}/`);
    console.warn("[mineLoader] sanitized blocked host →", out);
  }
  return out;
}

export function openMineLoaderLive(
  opts: Omit<MineLoaderLaunchOpts, "preferLive" | "forceLocal"> = {},
): void {
  window.open(buildMineLoaderUrl(opts), "_blank", "noopener,noreferrer");
}

/** Ordered API bases for catalog / share calls from Open. */
export function mineLoaderApiCandidates(path: string): string[] {
  const p = path.startsWith("/") ? path : `/${path}`;
  const bases = [
    "", // same-origin Open vercel rewrites
    MINE_LOADER_API,
    MINE_LOADER_EDGE,
    MINE_LOADER_VERCEL,
  ];
  return bases.map((b) => (b ? `${b.replace(/\/+$/, "")}${p}` : p));
}

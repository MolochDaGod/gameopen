/**
 * Mine-Loader / Voxel Realms — fleet-owned hosts only.
 *
 * ALWAYS use fleet production SPA. Never iframe /minegrudge/ on the play shell.
 *
 * Play host (canonical): https://mineloader.grudge-studio.com
 *   — multiplayer, self-hosted maps, harvest mode, DRC combat + explorer avatar
 * Alias:                 https://mine.grudge-studio.com
 * Origin SPA:            https://mine-loader.vercel.app
 * World API:             https://mine-loader-api-production.up.railway.app  (1 replica)
 * Characters:            Railway grudge-api via SPA rewrites (explorer avatar)
 */

/** Canonical play / multiplayer / map-deploy host. */
export const MINE_LOADER_PLAY = "https://mineloader.grudge-studio.com";

/** Short alias (CF Worker mine-loader-edge). */
export const MINE_LOADER_EDGE = "https://mine.grudge-studio.com";

/** Vercel project origin (fallback). */
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
 * Browser SPA origin. Prefer mineloader play host; override with VITE_MINELOADER_URL.
 */
export const MINE_LOADER_LIVE =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_MINELOADER_URL as string | undefined)?.replace(/\/+$/, "")) ||
  MINE_LOADER_PLAY;

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
  | "join"
  | "harvest"
  | "drc";

/** Play mode contract for map deployments + Open handoff. */
export type MineLoaderPlayMode = "harvest" | "drc" | "combat" | "free" | "lobby";

export const MINE_LOADER_MODE_LABELS: Record<
  MineLoaderPlayMode,
  { label: string; blurb: string }
> = {
  harvest: {
    label: "Harvest",
    blurb: "Minecraft-like gather, place, craft — account explorer avatar on map.",
  },
  drc: {
    label: "DRC Combat",
    blurb: "Danger-Room combat mode — account explorer avatar character + skills.",
  },
  combat: {
    label: "Combat",
    blurb: "Alias of DRC — combat-first play on deployed maps.",
  },
  free: {
    label: "Free play",
    blurb: "Default play on promoted / self-hosted map.",
  },
  lobby: {
    label: "Lobby",
    blurb: "Multiplayer rooms, parties, join codes.",
  },
};

export const MINE_LOADER_PILLARS = [
  {
    id: "survival",
    label: "Survival / Harvest",
    blurb: "Gather, craft, eat, light the dark — mode=harvest on mineloader.",
  },
  {
    id: "combat",
    label: "DRC Combat",
    blurb: "Melee, ranged, magic — mode=drc with account explorer avatar.",
  },
  {
    id: "adventure",
    label: "Adventure",
    blurb: "Open world biomes, dungeons, arenas, and hand-authored maps.",
  },
  {
    id: "build",
    label: "Build & self-host maps",
    blurb: "Block catalog + world editor → deploy to mineloader play rooms.",
  },
  {
    id: "social",
    label: "Friends & parties",
    blurb: "Co-op rooms, party tags, public/private worlds (Railway 1 replica).",
  },
  {
    id: "guilds",
    label: "Guilds & worlds",
    blurb: "Persistent shared worlds, invites, and group adventures online.",
  },
] as const;

export function mineLoaderSurfaceUrl(
  surface: MineLoaderSurface = "lobby",
  opts: {
    token?: string | null;
    characterId?: string | null;
    baseId?: string | null;
    mode?: MineLoaderPlayMode;
    mapId?: string | null;
    room?: string | null;
  } = {},
): string {
  const base = MINE_LOADER_LIVE.replace(/\/+$/, "");
  const u = new URL(`${base}/`);
  const mode: MineLoaderPlayMode =
    opts.mode ||
    (surface === "harvest"
      ? "harvest"
      : surface === "drc" || surface === "boss"
        ? "drc"
        : surface === "play"
          ? "free"
          : surface === "lobby" || surface === "join"
            ? "lobby"
            : "free");

  if (surface === "codex" || surface === "editor") {
    u.hash = surface === "codex" ? "#/defs" : "#/setup";
  } else if (surface === "join" && opts.room) {
    u.hash = `#/join/${encodeURIComponent(opts.room)}`;
  } else if (mode === "lobby" && !opts.room && !opts.mapId) {
    u.hash = "#/lobby";
  } else {
    const hq = new URLSearchParams();
    if (opts.room) hq.set("room", opts.room);
    if (opts.mapId) hq.set("mapId", opts.mapId);
    hq.set("mode", mode);
    u.hash = `#/play?${hq.toString()}`;
  }

  if (opts.token) {
    u.searchParams.set("sso_token", opts.token);
    u.searchParams.set("grudge_token", opts.token);
  }
  if (opts.characterId) u.searchParams.set("characterId", opts.characterId);
  u.searchParams.set("baseId", opts.baseId || "explorer");
  u.searchParams.set("mode", mode);
  if (opts.mapId) u.searchParams.set("mapId", opts.mapId);
  u.searchParams.set("open", "1");
  u.searchParams.set("from", "gameopen");
  return u.toString();
}

/**
 * Production runtime constants — adopt across Open games (Danger Room, voxel
 * playtest, brawler, future modes).
 *
 * Source of practice:
 *  - PhysicsSystem / Controller (Danger Room + dungeon KCC) — **canonical**
 *  - Ruins Brawler (`three/brawler/BrawlerScene`) MUST use the same Controller
 *    + InputState + PhysicsSystem stack (not a custom WASD/camera fork)
 *  - epicfight CombatController (T0 reaction windows)
 *  - Mine-Loader world authority (1 replica, server tick) — see docs/MINE_LOADER_SSOT.md
 *
 * Prefer importing these numbers over hardcoding new gravity/tick rates per game.
 */

/**
 * Physics constants — re-export fleet SSOT from `@workspace/grudge-physics`
 * so every Open surface shares one capsule / tick / gravity definition.
 */
export {
  PHYSICS_HZ,
  PHYSICS_DT,
  PHYSICS_MAX_SUBSTEPS,
  GRAVITY_Y,
  PLAYER_CAPSULE,
  PLAYER_HEIGHT_M,
} from "@workspace/grudge-physics";

/** Third-person camera defaults (Controller). */
export const CAMERA = {
  /** Orbit distance when unobstructed */
  thirdDistance: 4.2,
  /** Min distance after occlusion pull-in */
  thirdMinDistance: 1.2,
  /** Default pitch (radians, look slightly down) */
  thirdPitch: 0.32,
  /** Pitch clamp third-person */
  thirdPitchMin: 0.08,
  thirdPitchMax: 1.15,
  /** First-person eye height above feet */
  firstEyeHeight: 1.55,
  /** Camera ray occlusion layer — meshes registered as occluders */
  occlusionNear: 0.25,
} as const;

/** Locomotion (Controller). */
export const LOCOMOTION = {
  walkSpeed: 4.2,
  sprintMult: 1.55,
  jumpSpeed: 7.2,
  maxJumps: 2,
  /** External knockback damp (1/s) */
  knockbackDamp: 7,
  /** Flat-room bound half-extent when no KCC */
  roomBound: 15,
} as const;

/**
 * Motion-math: 100 MM = 1 m body displacement (Studio combat / skills).
 * Mine-Loader and Open skill kits share this scale.
 */
export const MM_TO_M = 0.01;

/** Re-export T0 reaction windows for games that do not import epicfight directly. */
export const REACTION = {
  parryPerfect: 0.12,
  parryDeflect: 0.3,
  dodgePunish: 0.12,
  dodgeIframeStart: 0.04,
  dodgeIframeEnd: 0.42,
  dodgeDuration: 0.55,
  blockChipFraction: 0.4,
} as const;

/** Attack phase ratios (telegraph UX) — scale to clip length. */
export const ATTACK_PHASE_RATIO = {
  windup: 0.8 / 1.7,
  active: 0.3 / 1.7,
  recovery: 0.6 / 1.7,
} as const;

/**
 * Mine-Loader / fleet URLs for world promote + lobby + play modes.
 * Override with VITE_* when staging.
 *
 * **Play host (canonical):** https://mineloader.grudge-studio.com
 *   — multiplayer Realms, self-hosted map deploys, harvest mode, DRC combat
 * **Alias:** https://mine.grudge-studio.com
 * **Origin SPA:** https://mine-loader.vercel.app
 * **World API:** Railway mine-loader-api (1 replica)
 * **Characters / explorer avatar:** Railway grudge-api via SPA rewrites
 */
export const MINE_LOADER_FLEET = {
  github: "https://github.com/MolochDaGod/mine-loader",
  /**
   * Canonical play host — CF Worker `mineloader-edge-proxy` → Vercel SPA.
   * Use this for library launch, map deploy handoff, multiplayer rooms.
   */
  client:
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_URL as string | undefined)) ||
    "https://mineloader.grudge-studio.com/",
  /** Short alias edge (Worker `mine-loader-edge`). */
  edge:
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_EDGE as string | undefined)) ||
    "https://mine.grudge-studio.com/",
  /** Direct Vercel origin (fallback if CF edge cold). */
  vercel: "https://mine-loader.vercel.app/",
  /**
   * World + Codex API (Railway, 1 replica). Vercel SPA rewrites `/api/*` here.
   * Direct host is a fallback when same-origin / SPA proxy is cold.
   */
  api:
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_API as string | undefined)) ||
    "https://mine-loader-api-production.up.railway.app",
  /** Blocks catalog path (same-origin rewrite preferred when wired). */
  blocksApi: "/api/blocks",
  healthz: "/api/healthz",
  worldsApi: "/api/worlds",
  /** World WS is on the Realms host, not Open. */
  singleReplica: true,
  /**
   * Play modes on mineloader (query `mode=` + hash route).
   * - harvest: Minecraft-like gather / place / craft
   * - drc | combat: Danger-Room-style combat with account explorer avatar
   * - free: default open play / editor-promoted map
   */
  modes: {
    harvest: "harvest",
    drc: "drc",
    combat: "combat",
    free: "free",
    lobby: "lobby",
  },
  /** Default avatar form when character has no race kit yet. */
  defaultBaseId: "explorer",
} as const;

/** SSO handoff query keys (Open → Realms / lobby / danger). */
export const HANDOFF_QUERY = {
  sso: "sso_token",
  launch: "grudge_token",
  characterId: "characterId",
  /** charactersgrudox / grudge6 form — explorer is default voxel body */
  baseId: "baseId",
  raceId: "raceId",
  /** Play mode: harvest | drc | combat | free */
  mode: "mode",
  /** Self-hosted / promoted map id when known */
  mapId: "mapId",
  /** World / room code for multiplayer */
  room: "room",
  open: "open",
  from: "from",
} as const;

export type MineLoaderPlayMode = "harvest" | "drc" | "combat" | "free" | "lobby";

function applyMineHandoff(
  u: URL,
  opts: {
    token?: string | null;
    characterId?: string | null;
    baseId?: string | null;
    raceId?: string | null;
    mode?: MineLoaderPlayMode | string | null;
    mapId?: string | null;
    room?: string | null;
    from?: string;
  },
): void {
  if (opts.token) {
    u.searchParams.set(HANDOFF_QUERY.sso, opts.token);
    u.searchParams.set(HANDOFF_QUERY.launch, opts.token);
  }
  if (opts.characterId) u.searchParams.set(HANDOFF_QUERY.characterId, opts.characterId);
  // Always pass explorer-capable avatar form for voxel body resolve
  u.searchParams.set(
    HANDOFF_QUERY.baseId,
    opts.baseId || MINE_LOADER_FLEET.defaultBaseId,
  );
  if (opts.raceId) u.searchParams.set(HANDOFF_QUERY.raceId, opts.raceId);
  if (opts.mode) u.searchParams.set(HANDOFF_QUERY.mode, opts.mode);
  if (opts.mapId) u.searchParams.set(HANDOFF_QUERY.mapId, opts.mapId);
  if (opts.room) u.searchParams.set(HANDOFF_QUERY.room, opts.room);
  u.searchParams.set(HANDOFF_QUERY.open, "1");
  u.searchParams.set(HANDOFF_QUERY.from, opts.from || "gameopen");
  // Canonical Realms character era (parity with era=warlords on grudgewarlords.com)
  u.searchParams.set("era", "voxel");
  u.searchParams.set("gameEra", "voxel");
  if (typeof window !== "undefined") {
    u.searchParams.set("collection", window.location.origin);
  }
}

/**
 * Build Realms lobby URL with account handoff (multiplayer rooms / parties).
 * characterId must be era=voxel when selecting a Realms hero.
 */
export function mineLoaderLobbyUrl(opts: {
  token?: string | null;
  characterId?: string | null;
  baseId?: string | null;
  raceId?: string | null;
  room?: string | null;
  from?: string;
} = {}): string {
  const base = MINE_LOADER_FLEET.client.replace(/\/+$/, "");
  const u = new URL(`${base}/`);
  u.hash = opts.room ? `#/play?room=${encodeURIComponent(opts.room)}` : "#/lobby";
  applyMineHandoff(u, { ...opts, mode: "lobby" });
  return u.toString();
}

/**
 * Build play URL for a mode + optional self-hosted map deploy.
 *
 * Modes:
 * - **harvest** — Minecraft-like gather/build on map or overworld seed
 * - **drc** / **combat** — DRC combat with account explorer avatar character
 * - **free** — default play on promoted map
 */
export function mineLoaderPlayUrl(opts: {
  token?: string | null;
  characterId?: string | null;
  baseId?: string | null;
  raceId?: string | null;
  mode?: MineLoaderPlayMode | string | null;
  mapId?: string | null;
  room?: string | null;
  from?: string;
} = {}): string {
  const base = MINE_LOADER_FLEET.client.replace(/\/+$/, "");
  const u = new URL(`${base}/`);
  const mode = opts.mode || "free";
  const hashQ = new URLSearchParams();
  if (opts.room) hashQ.set("room", opts.room);
  if (opts.mapId) hashQ.set("mapId", opts.mapId);
  hashQ.set("mode", mode);
  const q = hashQ.toString();
  u.hash = q ? `#/play?${q}` : "#/play";
  applyMineHandoff(u, { ...opts, mode });
  return u.toString();
}

/** Harvest-mode shortcut (Minecraft-like). */
export function mineLoaderHarvestUrl(
  opts: Omit<Parameters<typeof mineLoaderPlayUrl>[0], "mode"> = {},
): string {
  return mineLoaderPlayUrl({ ...opts, mode: "harvest" });
}

/** DRC combat-mode shortcut (account explorer avatar). */
export function mineLoaderDrcUrl(
  opts: Omit<Parameters<typeof mineLoaderPlayUrl>[0], "mode"> = {},
): string {
  return mineLoaderPlayUrl({
    ...opts,
    mode: "drc",
    baseId: opts.baseId || MINE_LOADER_FLEET.defaultBaseId,
  });
}

/**
 * Open Warlords play (era=warlords heroes only).
 * characterId must be a Warlords-era hero — not a Mine-Loader/voxel character.
 * Voxel Realms is a separate era roster (mineLoader* helpers).
 */
export function warlordsPlayUrl(opts: {
  token?: string | null;
  characterId?: string | null;
  baseId?: string | null;
  raceId?: string | null;
  host?: "flagship" | "client";
  from?: string;
} = {}): string {
  const origin =
    opts.host === "client"
      ? "https://client.grudge-studio.com"
      : "https://grudgewarlords.com";
  const u = new URL(origin + "/");
  if (opts.token) {
    u.searchParams.set(HANDOFF_QUERY.sso, opts.token);
    u.searchParams.set(HANDOFF_QUERY.launch, opts.token);
  }
  if (opts.characterId) u.searchParams.set(HANDOFF_QUERY.characterId, opts.characterId);
  if (opts.baseId) u.searchParams.set(HANDOFF_QUERY.baseId, opts.baseId);
  if (opts.raceId) u.searchParams.set(HANDOFF_QUERY.raceId, opts.raceId);
  u.searchParams.set("era", "warlords");
  u.searchParams.set(HANDOFF_QUERY.open, "1");
  u.searchParams.set(HANDOFF_QUERY.from, opts.from || "gameopen");
  return u.toString();
}

/**
 * Open collection path for Realms (preferred entry from Library / Zones).
 * Resolves to open.grudge-studio.com/realms when on the Open host.
 */
export function openRealmsCollectionPath(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/realms`;
  }
  return "https://open.grudge-studio.com/realms";
}

/** Full VoxGrudge open-world (not the in-Open thin voxel editor). */
export function voxgrudgeWorldUrl(opts: {
  token?: string | null;
  characterId?: string | null;
  from?: string;
} = {}): string {
  const u = new URL("https://voxgrudge.vercel.app/");
  if (opts.token) {
    u.searchParams.set(HANDOFF_QUERY.sso, opts.token);
    u.searchParams.set(HANDOFF_QUERY.launch, opts.token);
  }
  if (opts.characterId) u.searchParams.set(HANDOFF_QUERY.characterId, opts.characterId);
  u.searchParams.set(HANDOFF_QUERY.open, "1");
  u.searchParams.set(HANDOFF_QUERY.from, opts.from || "gameopen");
  return u.toString();
}

/** Dungeon Crawler Quest with fleet handoff. */
export function dcqWorldUrl(opts: {
  token?: string | null;
  characterId?: string | null;
  from?: string;
} = {}): string {
  const u = new URL("https://dcq.grudge-studio.com/");
  if (opts.token) {
    u.searchParams.set(HANDOFF_QUERY.sso, opts.token);
    u.searchParams.set(HANDOFF_QUERY.launch, opts.token);
  }
  if (opts.characterId) u.searchParams.set(HANDOFF_QUERY.characterId, opts.characterId);
  u.searchParams.set(HANDOFF_QUERY.open, "1");
  u.searchParams.set(HANDOFF_QUERY.from, opts.from || "gameopen");
  return u.toString();
}

/**
 * Collider bake checklist (call from editor export / arena build).
 * Returns issues; empty = production-ready static bake path.
 */
export function colliderBakeChecklist(flags: {
  matrixWorldUpdated?: boolean;
  scaleBaked?: boolean;
  staticEnvironment?: boolean;
  capsuleMatchesHeight?: boolean;
}): string[] {
  const issues: string[] = [];
  if (!flags.matrixWorldUpdated) issues.push("Call updateMatrixWorld(true) before extracting trimesh");
  if (!flags.scaleBaked) issues.push("Do not scale mesh after collider bake without re-bake");
  if (!flags.staticEnvironment) issues.push("Environment should use fixed rigid bodies");
  if (!flags.capsuleMatchesHeight) issues.push("Player capsule height must match fitCharacterHeight (~2m)");
  return issues;
}

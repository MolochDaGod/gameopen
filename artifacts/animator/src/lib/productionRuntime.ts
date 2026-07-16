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

/** Fixed physics substep (Hz). Match Rapier world.timestep. */
export const PHYSICS_HZ = 60;
export const PHYSICS_DT = 1 / PHYSICS_HZ;
/** Max physics substeps per render frame (prevents spiral of death). */
export const PHYSICS_MAX_SUBSTEPS = 5;

/** Default world gravity Y (m/s²). Danger Room / VoxelArena baseline. */
export const GRAVITY_Y = -12;

/** Character capsule (metres). Total height ≈ 2*radius + 2*halfHeight. */
export const PLAYER_CAPSULE = {
  radius: 0.35,
  halfHeight: 0.55,
  /** KCC skin / offset */
  controllerOffset: 0.08,
} as const;

/**
 * Canonical fitted character height in metres (human-scale SSOT).
 * Maps, cameras, capsules, and grudge6 normalize to this.
 * 1.8 m ≈ adult human — matches arena / survival world scale.
 */
export const PLAYER_HEIGHT_M = 1.8;

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
 * Mine-Loader / fleet URLs for world promote + lobby.
 * Override with VITE_* when staging.
 */
export const MINE_LOADER_FLEET = {
  github: "https://github.com/MolochDaGod/mine-loader",
  /**
   * Live SPA (probed 200). Custom DNS mineloader.grudge-studio.com was NXDOMAIN —
   * use Vercel host until CF edge is attached.
   */
  client:
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_URL as string | undefined)) ||
    "https://mine-loader.vercel.app/",
  /** Optional edge alias when CF live; same as client until then. */
  edge:
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_MINE_LOADER_EDGE as string | undefined)) ||
    "https://mine-loader.vercel.app/",
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
  /** World WS is on the Realms host, not Open. */
  singleReplica: true,
} as const;

/** SSO handoff query keys (Open → Realms / lobby / danger). */
export const HANDOFF_QUERY = {
  sso: "sso_token",
  launch: "grudge_token",
  characterId: "characterId",
  open: "open",
  from: "from",
} as const;

/**
 * Build Realms lobby URL with account handoff.
 */
export function mineLoaderLobbyUrl(opts: {
  token?: string | null;
  characterId?: string | null;
  room?: string | null;
  from?: string;
} = {}): string {
  const base = MINE_LOADER_FLEET.client.replace(/\/+$/, "");
  const u = new URL(`${base}/`);
  // Hash-routed SPA often uses #/play or #/lobby
  u.hash = opts.room ? `#/play?room=${encodeURIComponent(opts.room)}` : "#/lobby";
  if (opts.token) {
    u.searchParams.set(HANDOFF_QUERY.sso, opts.token);
    u.searchParams.set(HANDOFF_QUERY.launch, opts.token);
  }
  if (opts.characterId) u.searchParams.set(HANDOFF_QUERY.characterId, opts.characterId);
  u.searchParams.set(HANDOFF_QUERY.open, "1");
  u.searchParams.set(HANDOFF_QUERY.from, opts.from || "gameopen");
  if (typeof window !== "undefined") {
    u.searchParams.set("collection", window.location.origin);
  }
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

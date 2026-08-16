/**
 * Production systems pattern SSOT — fastest path for Open / fleet.
 *
 * Topology (do not invent parallel hosts):
 *   Browser
 *     → Cloudflare edge (open.grudge-studio.com Worker proxy)
 *     → Vercel SPA (gameopen.vercel.app) + vercel.json rewrites
 *     → Railway Node REST (grudge-api)  |  R2 CDN binaries  |  D1 index
 *     → AI hub ai.grudge-studio.com (JWT) via same-origin /api/ai
 *     → optional WS via CF Worker or Railway (never Vercel upgrade alone)
 *
 * Reliability laws (2026-08 hardened):
 *  1. Auth JWT: one reader (`readProductionAuthToken`) — Open primary key
 *     grudge.open.token, then fleet keys. AI / REST / warmup all use it.
 *  2. GLB props: R2 CDN absolute first; never rely on Vercel SPA for .glb
 *     (vercelignore bans all .glb). Campfire TVS: CAMPFIRE_TVS.
 *  3. Routes: /characters + /lobby + door=characters → CampfireLobby (not account).
 *  4. AI: health is public; chat/image need Bearer JWT; fail with clear auth copy.
 *
 * Use with: cinema timing, BootGate load screens, loadGltfFirst, same-origin /api/*.
 * Docs: docs/PRODUCTION_SYSTEMS_PATTERN.md · docs/FLEET_AUTH_WIRING.md
 */

/** Canonical production hosts (smoke + resolvers). */
export const PROD_HOSTS = {
  open: "https://open.grudge-studio.com",
  openVercel: "https://gameopen.vercel.app",
  assetsCdn: "https://assets.grudge-studio.com",
  d1Assets: "https://api.grudge-studio.com/assets",
  gameData: "https://grudge-api-production-0d46.up.railway.app",
  id: "https://id.grudge-studio.com",
  info: "https://info.grudge-studio.com",
  arena: "https://grudge-arena.grudge-studio.com",
  ai: "https://ai.grudge-studio.com",
} as const;

/**
 * Fleet JWT storage keys — write all on login, read any (Open primary first).
 * Must stay aligned with `lib/fleet.ts` FLEET_TOKEN_KEYS + grudgeAuth TOKEN_KEY.
 */
export const PROD_AUTH_TOKEN_KEYS = [
  "grudge.open.token",
  "grudge_auth_token",
  "grudge_session_token",
  "grudge.token",
  "sso_token",
  "grudge_token",
] as const;

/**
 * Single production JWT reader for AI hub, REST warmup, and any Bearer call.
 * Prefer this over ad-hoc localStorage scans so AI never misses grudge.open.token.
 */
export function readProductionAuthToken(opts?: {
  /** Explicit override (tests / embed). */
  override?: string | null;
}): string | null {
  if (opts && "override" in opts) {
    const o = opts.override;
    if (o) return o;
    if (o === null) return null;
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      for (const k of PROD_AUTH_TOKEN_KEYS) {
        const v = sessionStorage.getItem(k);
        if (v) return v;
      }
    }
    if (typeof localStorage !== "undefined") {
      for (const k of PROD_AUTH_TOKEN_KEYS) {
        const v = localStorage.getItem(k);
        if (v) return v;
      }
    }
  } catch {
    /* private mode */
  }
  return null;
}

/**
 * Campfire /characters TVS Voxel Farm props — production binary law.
 * Vercel SPA omits .glb; loaders must CDN-first then same-origin for local dev.
 */
export const CAMPFIRE_TVS = {
  cdnBase: `${PROD_HOSTS.assetsCdn}/models/campfire-lobby/tvs`,
  localRel: "models/campfire-lobby/tvs",
  /** Files used by CampfireLobbyScene (smoke probes these on R2). */
  files: [
    "campfire.glb",
    "chair.glb",
    "fence.glb",
    "fencepost.glb",
    "haybale.glb",
    "watertrough.glb",
    "soil.glb",
    "wheat.glb",
    "pumpkin.glb",
    "tree.glb",
    "appletree.glb",
    "barn.glb",
  ] as const,
  /** Critical for first paint of farm camp (smoke critical subset). */
  smokeCritical: ["campfire.glb", "chair.glb", "fence.glb", "tree.glb"] as const,
  /**
   * Lobby GLBs shipped without embedded palettes. Bind the live TVS Voxel Farm
   * atlas (already on R2) — do not invent a second texture root.
   * campfire / chair keep their own materials (Sketchfab, not palette.*).
   */
  farmPackTextures: `${PROD_HOSTS.assetsCdn}/models/voxels/tvs/voxel-farm/textures`,
  paletteByFile: {
    "fence.glb": "voxel-farm-fence-texture.png",
    "fencepost.glb": "voxel-farm-fence-post-texture.png",
    "haybale.glb": "voxel-farm-haybale-texture.png",
    "watertrough.glb": "voxel-farm-water-trough-texture.png",
    "soil.glb": "voxel-farm-soil-texture.png",
    "wheat.glb": "voxel-farm-wheat-texture.png",
    "pumpkin.glb": "voxel-farm-pumpkin-texture.png",
    "tree.glb": "voxel-farm-tree-texture.png",
    "appletree.glb": "voxel-farm-apple-tree-texture.png",
    "barn.glb": "voxel-farm-barn-texture.png",
  } as const,
} as const;

/** CDN-first URL candidates for a TVS farm prop filename. */
export function campfireTvsUrls(file: string): string[] {
  const name = file.replace(/^\//, "");
  return [
    `${CAMPFIRE_TVS.cdnBase}/${name}`,
    `/${CAMPFIRE_TVS.localRel}/${name}`,
  ];
}

/** Live TVS Voxel Farm palette for a lobby prop, or null when the GLB owns its look. */
export function campfireTvsTextureUrl(file: string): string | null {
  const name = file.replace(/^\//, "") as keyof typeof CAMPFIRE_TVS.paletteByFile;
  const slug = CAMPFIRE_TVS.paletteByFile[name];
  return slug ? `${CAMPFIRE_TVS.farmPackTextures}/${slug}` : null;
}

/**
 * Voxel-era Encament bake — sits BEHIND the 4-seat campfire (visual + play start).
 * Same Fruzer hub as Grudges `/voxgrudge/#world`. Scale 1. Do not stretch.
 */
export const ENCAMPMENT_BACKDROP = {
  id: "grudges_encampment",
  /** Open VoxelArena play — campfire explorer on Encament + seed. */
  localPlay: "encampment" as const,
  playUrl: "https://open.grudge-studio.com/characters",
  playHash: "",
  era: "voxel",
  kit: "voxel",
  urls: [
    `${PROD_HOSTS.assetsCdn}/models/lobby/chicken_gun_fruzer_encampment.glb`,
    "https://grudox.grudge-studio.com/voxgrudge/models/lobby/chicken_gun_fruzer_encampment.glb",
    "/voxgrudge/models/lobby/chicken_gun_fruzer_encampment.glb",
  ],
} as const;

export function encampmentBackdropUrls(): string[] {
  return [...ENCAMPMENT_BACKDROP.urls];
}

/** Product surface routes that own CampfireLobby (not AccountPanel). */
export const CAMPFIRE_SURFACES = {
  modes: ["characters", "lobby"] as const,
  paths: ["/characters", "/lobby"] as const,
  doorAliases: ["characters", "charactersgrudox", "campfire", "roster-hub"] as const,
  notes: "4-seat TVS farm camp; door=characters must not open account panel",
} as const;

/** AI hub wiring — health public, chat/image JWT. */
export const AI_WIRING = {
  hub: PROD_HOSTS.ai,
  sameOriginPrefix: "/api/ai",
  healthSameOrigin: "/api/ai/health",
  healthAbsolute: `${PROD_HOSTS.ai}/health`,
  /** User-facing errors when JWT missing vs rejected. */
  errNoToken:
    "AI gateway auth failed — sign in with Grudge ID (no fleet JWT in browser)",
  errRejected:
    "AI gateway rejected session — re-sign in with Grudge ID (token expired or wrong issuer)",
} as const;

/**
 * What runs where — platform decision matrix (grudge-stack + live-servers L0–L3).
 */
export const DEPLOY_LAYERS = {
  /** React/Vite SPA, static HTML/JS, vercel.json rewrites */
  frontend: "vercel",
  /** open.* custom domain, DDoS, optional path proxy */
  edge: "cloudflare_worker",
  /** Binaries GLB/WebP/icons */
  binaries: "cloudflare_r2",
  /** Asset index */
  index: "cloudflare_d1",
  /** Characters, account, inventory, island, wallet, auth session */
  playerApi: "railway_node",
  /** Carrier / brawl / zone rooms when WS needed */
  realtime: "railway_or_cf_do",
  /** Definitions catalogs */
  definitions: "info_or_objectstore",
} as const;

/**
 * REST: always prefer **same-origin** `/api/*` on Open so cookies + CORS stay simple.
 * vercel.json rewrites to Railway / id / assets / D1.
 */
export const REST_SAME_ORIGIN = {
  health: "/api/health",
  characters: "/api/characters",
  charactersWarlords: "/api/characters?era=warlords",
  account: "/api/account",
  inventory: "/api/inventory",
  island: "/api/island",
  wallet: "/api/wallet",
  authMe: "/api/auth/me",
  assetRegistry: "/api/asset-registry",
  /** AI hub health (public; chat still needs JWT) */
  aiHealth: "/api/ai/health",
  /** Binary proxy (not preferred for large GLB — use CDN absolute or rewrite paths) */
  assetsProxy: "/api/assets/",
} as const;

/**
 * Timing budgets for production UX (ms). Align cinema + BootGate + REST.
 * BootGate uses per-step 8s soft / 30s hard — surface transitions should be faster.
 */
export const PROD_TIMING_MS = {
  /** Parallel REST warmup budget before UI blocks */
  restWarmupBudget: 2_500,
  /** Soft “still loading” for surface transition */
  surfaceSlowNotice: 4_000,
  /** Hard fail / skip to degraded UI */
  surfaceStall: 12_000,
  /** Cinema skip unlock (catalog may override) */
  cinemaSkipMin: 400,
  /** Prefetch next-surface critical mesh (HEAD + cache) */
  meshPrefetchBudget: 3_000,
  /** BootGate soft (existing SSOT) */
  bootSlowNotice: 8_000,
  /** BootGate hard (existing SSOT) */
  bootStall: 30_000,
} as const;

/** Load-screen roles — pick one pattern per surface. */
export type LoadScreenPattern =
  | "boot_gate" /** Danger/Studio full checklist + HelpersLoadScreen */
  | "cinema_flow" /** ProductionCinema linear gate (characters, lobby) */
  | "cinema_backdrop" /** Ambient intro under UI (doors) */
  | "helpers_orbit" /** helpers.glb orbit while heavy mode boots */
  | "spa_instant"; /** Shell UI only, no WebGL gate */

/**
 * Surface → load pattern + critical deps (REST + CDN keys).
 * Cinema ids match `three/cinema/catalog.ts`.
 */
export const SURFACE_LOAD_PLAN: Record<
  string,
  {
    pattern: LoadScreenPattern;
    cinemaId?: string;
    rest: (keyof typeof REST_SAME_ORIGIN)[];
    /** Relative mesh keys for loadGltfFirst / prefetch */
    criticalMeshes?: string[];
    notes: string;
  }
> = {
  landing: {
    pattern: "spa_instant",
    rest: ["health", "authMe"],
    notes: "Auth only; no WebGL until enter",
  },
  doors: {
    pattern: "cinema_backdrop",
    cinemaId: "intro_doors",
    rest: ["health", "charactersWarlords"],
    // introgamer.glb never shipped — use live CDN heroes only
    criticalMeshes: ["models/racalvin.glb", "models/props/dying-torch.glb"],
    notes: "Ambient cinema + library; roster REST in parallel",
  },
  characters: {
    pattern: "cinema_flow",
    cinemaId: "char_select_establish",
    rest: ["charactersWarlords", "account", "aiHealth"],
    // TVS farm props on R2 — not Vercel public/ (glb banned in deploy tarball)
    criticalMeshes: [
      "models/campfire-lobby/tvs/campfire.glb",
      "models/campfire-lobby/tvs/chair.glb",
      "models/campfire-lobby/tvs/fence.glb",
      "models/campfire-lobby/tvs/tree.glb",
    ],
    notes: "Cinema then TVS farm campfire; heroes Railway; props CDN-only",
  },
  intro_handoff: {
    pattern: "cinema_flow",
    cinemaId: "intro_to_characters",
    rest: ["charactersWarlords", "account"],
    criticalMeshes: ["models/racalvin.glb", "models/props/dying-torch.glb"],
    notes: "Landing → roster cinema",
  },
  lobby: {
    // ONE scene: CampfireLobbyScene (TVS farm) — never dungeon/arena establish
    pattern: "spa_instant",
    cinemaId: undefined,
    rest: ["health", "charactersWarlords", "aiHealth"],
    criticalMeshes: [
      "models/campfire-lobby/tvs/campfire.glb",
      "models/campfire-lobby/tvs/chair.glb",
    ],
    notes: "TVS farm campfire only — no ProductionCinema dungeon shell",
  },
  danger: {
    pattern: "boot_gate",
    cinemaId: "danger_establish",
    rest: ["health", "charactersWarlords", "account"],
    criticalMeshes: [
      // Prefer CDN race kits — HEAD probes only during warmup budget
      // (absolute URLs resolved at call site via assets CDN)
    ],
    notes: "BootGate + HelpersLoadScreen; parallel REST account/characters before ENTER",
  },
  home_island: {
    pattern: "cinema_flow",
    cinemaId: "home_island_arrive",
    rest: ["island", "charactersWarlords"],
    criticalMeshes: ["models/worlds/small_island.glb", "models/worlds/sailtest.glb"],
    notes: "CDN island shells only — never git megamesh",
  },
  hellmaw: {
    pattern: "cinema_flow",
    cinemaId: "sector_hellmaw",
    rest: ["health"],
    criticalMeshes: ["models/bosses/shadow-flame-mantis.prod.glb"],
    notes: "Sector establish; boss mesh CDN",
  },
};

/**
 * Deploy order for fastest safe production ship.
 */
export const DEPLOY_CHECKLIST = [
  "verify:assets:cdn — R2 magic bytes + campfire TVS props HEAD",
  "git push main — Vercel SPA build (or npm run deploy:prod)",
  "wrangler deploy infra/cloudflare/open if edge proxy changed",
  "verify:assets:open — same-origin rewrites on open.grudge-studio.com",
  "REST smoke: GET /api/health + /api/characters (auth)",
  "AI smoke: GET /api/ai/health 200; chat 401 without JWT is expected",
  "Surface smoke: /characters + /lobby = campfire; door=characters not account",
  "Cinema/UI smoke: /login → characters, / doors, /lobby",
] as const;

/** Never do these in production paths. */
export const PROD_KILL_LIST = [
  "Load large GLBs only from git / Vercel bundle (OOM + slow; vercelignore bans .glb)",
  "Campfire TVS props from same-origin only without R2 CDN first",
  "AI client that skips grudge.open.token (only legacy fleet keys)",
  "door=characters → AccountPanel (must be CampfireLobby)",
  "Call Railway absolute API from browser when same-origin /api exists",
  "Use assets.grudge-studio.com/gameopen/* incomplete prefix for GLBs",
  "Expect Vercel alone to upgrade WebSockets",
  "Block cinema/UI on serial REST-then-mesh (always parallelize)",
  "Localhost-only sign-off for cinema or world timing",
  "Ship Meshy/capsules as production heroes",
] as const;

export type WarmupResult = {
  surface: string;
  restOk: Record<string, boolean>;
  restMs: number;
  prefetchOk: string[];
  prefetchFail: string[];
  withinBudget: boolean;
};

/**
 * Parallel production warmup: same-origin REST + optional mesh URL probes.
 * Safe to call during cinema / load screen — never throws.
 */
export async function warmupProductionSurface(
  surface: string,
  opts?: {
    budgetMs?: number;
    /** Prefetch mesh candidates (HEAD or GET range) */
    prefetchMeshes?: string[];
    fetchImpl?: typeof fetch;
    /** Override fleet JWT (tests / embed). Default: grudge.open.token storage. */
    authToken?: string | null;
  },
): Promise<WarmupResult> {
  const plan = SURFACE_LOAD_PLAN[surface];
  const budget = opts?.budgetMs ?? PROD_TIMING_MS.restWarmupBudget;
  const fetchFn = opts?.fetchImpl ?? fetch;
  const restKeys = plan?.rest ?? (["health"] as const);
  const meshes = opts?.prefetchMeshes ?? plan?.criticalMeshes ?? [];

  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const restOk: Record<string, boolean> = {};
  // Single token reader (grudge.open.token + fleet keys) — never AI/REST-only legacy keys
  let authHeader: Record<string, string> = { Accept: "application/json" };
  try {
    const tok =
      opts?.authToken !== undefined
        ? opts.authToken
        : readProductionAuthToken();
    if (tok) authHeader = { ...authHeader, Authorization: `Bearer ${tok}` };
  } catch {
    /* private mode */
  }
  const restJobs = restKeys.map(async (key) => {
    const path = REST_SAME_ORIGIN[key as keyof typeof REST_SAME_ORIGIN];
    if (!path) {
      restOk[String(key)] = false;
      return;
    }
    // Auth-gated routes: skip network when no token (avoids console 401 spam on lobby)
    // aiHealth is public — always probe
    const needsAuth =
      key === "charactersWarlords" ||
      key === "characters" ||
      key === "account" ||
      key === "wallet" ||
      key === "island" ||
      key === "inventory";
    if (needsAuth && !authHeader.Authorization) {
      restOk[String(key)] = true; // deferred until initFleetAuth / guest
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), budget);
      const r = await fetchFn(path, {
        method: "GET",
        credentials: "include",
        signal: ctrl.signal,
        headers: authHeader,
      });
      clearTimeout(timer);
      // 401 is still "reachable" (guest expected before token)
      restOk[String(key)] = r.ok || r.status === 401 || r.status === 403;
    } catch {
      restOk[String(key)] = false;
    }
  });

  const prefetchOk: string[] = [];
  const prefetchFail: string[] = [];
  const meshJobs = meshes.map(async (rel) => {
    const urls = [
      `/${rel.replace(/^\//, "")}`,
      `${PROD_HOSTS.assetsCdn}/${rel.replace(/^\//, "")}`,
    ];
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PROD_TIMING_MS.meshPrefetchBudget);
        const r = await fetchFn(url, { method: "HEAD", signal: ctrl.signal, mode: "cors" });
        clearTimeout(timer);
        if (r.ok) {
          prefetchOk.push(rel);
          return;
        }
      } catch {
        /* try next */
      }
    }
    prefetchFail.push(rel);
  });

  await Promise.allSettled([...restJobs, ...meshJobs]);

  const restMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

  return {
    surface,
    restOk,
    restMs,
    prefetchOk,
    prefetchFail,
    withinBudget: restMs <= budget + 500,
  };
}

/** Agent / docs fragment — keep cinema + deploy AI aligned. */
export const AI_PRODUCTION_SYSTEMS_PROMPT = `
You ship Grudge Open production systems with this stack only:
1. Frontend: Vercel SPA (gameopen) — never put large GLBs in the JS bundle (vercelignore bans .glb).
2. Edge: Cloudflare Worker open.grudge-studio.com → Vercel; R2 assets.grudge-studio.com; D1 asset index (NOT player SSOT).
3. REST: same-origin /api/* rewrites to Railway grudge-api (characters, account, island, wallet, uuid, ledger) and id auth.
4. Auth JWT: readProductionAuthToken() — grudge.open.token first, then fleet keys. Dual-write all keys on login. Prefer sso_token over launch grudge_token. No guest product auto-login.
5. PLAYER DATA LAW (account vs game vs UUID):
   - Account grudge_id (GRUDGE_…): shared bag, resources, inventory, wallet, home island, camps.
   - Character characters.id (RFC UUID) + game_era: progress, professions, body equipment, skills. Handoff only via ?characterId=<uuid>&era=.
   - grudge_code (GRDG-…) is display stamp only — never PK or handoff alone.
   - Unique items: server grudge_uuid + /api/ledger/* (never client-only ent_* bag SSOT).
   - Craft: materials → account bag; profession XP → character progress.
   - ObjectStore = definitions; R2/D1 = assets only. One Railway player DB for all eras/games.
6. AI: /api/ai → ai.grudge-studio.com; health public; chat/image Bearer JWT; use AI_WIRING error copy on 401.
7. Campfire: /characters + /lobby + door=characters → CampfireLobby TVS farm; props from CAMPFIRE_TVS CDN first. Encament Fruzer bake behind the fire (ENCAMPMENT_BACKDROP). Voxel play start = Open Encament / starting lobby with campfire explorer (VoxelArena).
8. Realtime: Railway or CF DO/Worker — Vercel cannot upgrade WebSockets alone.
9. Load UX: BootGate (danger) OR ProductionCinema flow OR HelpersLoadScreen — parallelize REST + CDN, never serial block.
10. Timing: rest warmup ≤2.5s budget; BootGate soft 8s / hard 30s per step; cinema skippableAfterSec from catalog.
11. Assets: loadGltfFirst + fleetAssetResolver CDN-first; never assets…/gameopen incomplete prefix.
12. QA: open.grudge-studio.com smoke:prod:open + /api/health + /api/ai/health + TVS CDN HEADs — not localhost-only.
`.trim();

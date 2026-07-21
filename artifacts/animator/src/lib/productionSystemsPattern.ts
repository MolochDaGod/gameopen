/**
 * Production systems pattern SSOT — fastest path for Open / fleet.
 *
 * Topology (do not invent parallel hosts):
 *   Browser
 *     → Cloudflare edge (open.grudge-studio.com Worker proxy)
 *     → Vercel SPA (gameopen.vercel.app) + vercel.json rewrites
 *     → Railway Node REST (grudge-api)  |  R2 CDN binaries  |  D1 index
 *     → optional WS via CF Worker or Railway (never Vercel upgrade alone)
 *
 * Use with: cinema timing, BootGate load screens, loadGltfFirst, same-origin /api/*.
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
    criticalMeshes: ["models/introgamer.glb", "models/props/dying-torch.glb"],
    notes: "Ambient cinema + library; roster REST in parallel",
  },
  characters: {
    pattern: "cinema_flow",
    cinemaId: "char_select_establish",
    rest: ["charactersWarlords", "account"],
    criticalMeshes: ["models/introgamer.glb"],
    notes: "Cinema then campfire; heroes from Railway",
  },
  intro_handoff: {
    pattern: "cinema_flow",
    cinemaId: "intro_to_characters",
    rest: ["charactersWarlords", "account"],
    criticalMeshes: ["models/introgamer.glb", "models/props/dying-torch.glb"],
    notes: "Landing → roster cinema",
  },
  lobby: {
    pattern: "cinema_flow",
    cinemaId: "lobby_establish",
    rest: ["health", "charactersWarlords"],
    criticalMeshes: ["models/instarena-phyxt-fight.glb"],
    notes: "Establish then multiplayer lobby",
  },
  danger: {
    pattern: "boot_gate",
    cinemaId: "danger_establish",
    rest: ["health", "charactersWarlords"],
    criticalMeshes: [],
    notes: "BootGate + HelpersLoadScreen; optional short cinema first",
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
  "verify:assets:cdn — R2 magic bytes",
  "git push main — Vercel SPA build (or npm run deploy:prod)",
  "wrangler deploy infra/cloudflare/open if edge proxy changed",
  "verify:assets:open — same-origin rewrites on open.grudge-studio.com",
  "REST smoke: GET /api/health + /api/characters (auth)",
  "Cinema/UI smoke: /login → characters, / doors, /lobby",
] as const;

/** Never do these in production paths. */
export const PROD_KILL_LIST = [
  "Load large GLBs only from git / Vercel bundle (OOM + slow)",
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
  const restJobs = restKeys.map(async (key) => {
    const path = REST_SAME_ORIGIN[key as keyof typeof REST_SAME_ORIGIN];
    if (!path) {
      restOk[String(key)] = false;
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), budget);
      const r = await fetchFn(path, {
        method: "GET",
        credentials: "include",
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      // 401 is still "reachable"
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
1. Frontend: Vercel SPA (gameopen) — never put large GLBs in the JS bundle.
2. Edge: Cloudflare Worker open.grudge-studio.com → Vercel; R2 assets.grudge-studio.com; D1 asset index.
3. REST: same-origin /api/* rewrites to Railway grudge-api (characters, account, island, wallet) and id auth.
4. Realtime: Railway or CF DO/Worker — Vercel cannot upgrade WebSockets alone.
5. Load UX: BootGate (danger) OR ProductionCinema flow (characters/lobby) OR HelpersLoadScreen — parallelize REST + CDN during cinema/load, never serial block.
6. Timing: rest warmup ≤2.5s budget; BootGate soft 8s / hard 30s per step; cinema skippableAfterSec from catalog.
7. Assets: loadGltfFirst + fleetAssetResolver CDN-first; never assets…/gameopen incomplete prefix.
8. QA: open.grudge-studio.com + verify:assets:cdn + /api/health — not localhost-only sign-off.
`.trim();

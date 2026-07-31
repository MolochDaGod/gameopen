/**
 * PRODUCTION TOOLS SSOT — Open toolbox, library cards, and fleet deep-links.
 *
 * Hard rules:
 * 1. Auth → id.grudge-studio.com (never apex for /api/auth)
 * 2. Player state → Railway Postgres (grudge-api) — never D1
 * 3. Catalog index → info.grudge-studio.com (preferred) / ObjectStore
 * 4. Binaries → assets.grudge-studio.com (R2)
 * 5. SI metres · human ~1.8 m · no permanent Meshy/capsule heroes
 *
 * @see docs/PRODUCTION_TOOLS.md · docs/PRODUCTION_CONNECTIONS.md
 */

import { FLEET, OPEN_BRAND } from "./fleet";

/** Live production tool / game surfaces (URLs only — no secrets). */
export const PRODUCTION_SURFACES = {
  open: OPEN_BRAND,
  openDanger: `${OPEN_BRAND}/danger`,
  openVoxel: `${OPEN_BRAND}/voxel`,
  openDressing: `${OPEN_BRAND}/dressing`,
  openAccount: `${OPEN_BRAND}/account`,
  openRealms: `${OPEN_BRAND}/realms`,

  auth: FLEET.auth,
  assetsCdn: FLEET.assets,
  definitions: FLEET.definitions,
  gameData: FLEET.gameData,
  ai: FLEET.ai,

  /** Agentic Three.js + Rapier + R3F game creator */
  grokBuilder: "https://grok-builder.vercel.app",
  grokBuilderModes: "https://grok-builder.vercel.app/?panel=modes",
  grokBuilderAgent: "https://grok-builder.vercel.app/?panel=agent",

  forge: "https://forge.grudge-studio.com",
  /** HYDRA UI kit — HUD / menus / settings / game-ui packs for all editors */
  ui: "https://ui.grudge-studio.com",
  uiStudio: "https://ui.grudge-studio.com/studio",
  uiGames: "https://ui.grudge-studio.com/games",
  uiAssets: "https://ui.grudge-studio.com/assets",
  foundry: "https://character.grudge-studio.com",
  client: "https://client.grudge-studio.com",
  coder: "https://coder.grudge-studio.com",
  dash: "https://dash.grudge-studio.com",
  studio: "https://studio.grudge-studio.com",

  arena: FLEET.arena,
  warstrat: "https://warlord-genesis.vercel.app",
  rts: "https://rts-grudge.vercel.app",
  wcs: "https://warlord-crafting-suite.vercel.app",
  water: "https://water.grudge-studio.com/island",
  multiverse: "https://multiverse.grudge-studio.com",
  multiverseFallback: "https://grudge-multiverse.vercel.app",
  metaverse: "https://metaverse.grudge-studio.com",
  mineLoader: FLEET.mineLoader,
  mineLoaderApi: FLEET.mineLoaderApi,

  threeDocs: "https://threejs.org/docs/",
  rapierDocs: "https://rapier.rs/docs/user_guides/javascript/getting_started_js",
  r3fDocs: "https://docs.pmnd.rs/react-three-fiber/getting-started/introduction",
} as const;

export type ProductionSurfaceId = keyof typeof PRODUCTION_SURFACES;

/** Grok Builder deep-link helper (mode / stack / panel / focus). */
export function grokBuilderUrl(params?: Record<string, string>): string {
  const u = new URL(PRODUCTION_SURFACES.grokBuilder);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

/** Fleet health probe targets for ops / AI tools (public GET only). */
export const FLEET_HEALTH_TARGETS: Array<{
  id: string;
  label: string;
  url: string;
  critical: boolean;
}> = [
  { id: "open", label: "Open SPA", url: OPEN_BRAND, critical: true },
  { id: "auth", label: "Grudge ID", url: `${FLEET.auth}/api/auth/health`, critical: true },
  { id: "game-data", label: "Railway grudge-api", url: `${FLEET.gameData}/api/health`, critical: true },
  { id: "ai", label: "AI hub", url: `${FLEET.ai}/health`, critical: false },
  { id: "cdn", label: "Assets CDN", url: FLEET.assets, critical: true },
  { id: "definitions", label: "Info catalogs", url: `${FLEET.definitions}/health`, critical: false },
  {
    id: "grok-builder",
    label: "Grok Builder",
    url: PRODUCTION_SURFACES.grokBuilder,
    critical: false,
  },
  { id: "forge", label: "Forge", url: PRODUCTION_SURFACES.forge, critical: false },
  { id: "mine-loader", label: "Mine-Loader API", url: `${FLEET.mineLoaderApi}/api/healthz`, critical: false },
];

/** Required npm stack for any new fleet 3D game package (checklist). */
export const PRODUCTION_3D_PACKAGE = {
  three: "^0.185",
  "@react-three/fiber": "^9",
  "@react-three/drei": "^10",
  "@react-three/rapier": "^2",
  "@dimforge/rapier3d-compat": "^0.19",
  zustand: "^5",
  notes: [
    "SI units: 1 unit = 1 m; human ~1.8 m",
    "Auth: Grudge ID SSO tokens (grudge_auth_token / sso_token)",
    "Player state: Railway Postgres only",
    "Assets: CDN binaries + info/ObjectStore index",
    "Never route through dead api.grudge-studio.com for new work",
  ],
} as const;

export function productionWiringSummary() {
  return {
    open: OPEN_BRAND,
    auth: FLEET.auth,
    assets: FLEET.assets,
    definitions: FLEET.definitions,
    gameData: FLEET.gameData,
    ai: FLEET.ai,
    builders: {
      grokBuilder: PRODUCTION_SURFACES.grokBuilder,
      forge: PRODUCTION_SURFACES.forge,
      foundry: PRODUCTION_SURFACES.foundry,
      coder: PRODUCTION_SURFACES.coder,
    },
    games: {
      arena: PRODUCTION_SURFACES.arena,
      warstrat: PRODUCTION_SURFACES.warstrat,
      rts: PRODUCTION_SURFACES.rts,
      wcs: PRODUCTION_SURFACES.wcs,
      client: PRODUCTION_SURFACES.client,
      water: PRODUCTION_SURFACES.water,
    },
    package: PRODUCTION_3D_PACKAGE,
  };
}

/**
 * Fleet spider map data — scenes, routes, pages, servers/clients.
 * Consumed by Systems tooling and public/docs/fleet-spider.html (mirrored scores).
 * Human doc: docs/FLEET_SPIDER_MAP.md
 */

export type SpiderAxisId =
  | "scenes"
  | "openRoutes"
  | "warlordsPages"
  | "auth"
  | "playerApi"
  | "assetsCdn"
  | "definitions"
  | "realtime"
  | "aiWorkers"
  | "deploy";

export type SpiderAxis = {
  id: SpiderAxisId;
  label: string;
  /** 0–10 readiness / wire completeness */
  score: number;
  note: string;
};

/** Radar axes for the spider chart (fleet wire maturity). */
export const SPIDER_AXES: readonly SpiderAxis[] = [
  {
    id: "scenes",
    label: "Scenes",
    score: 8,
    note: "danger-room · sailtest · forest-map · genesis · 9 sectors",
  },
  {
    id: "openRoutes",
    label: "Open routes",
    score: 9,
    note: "Path doors SSOT + door aliases",
  },
  {
    id: "warlordsPages",
    label: "Warlords pages",
    score: 7,
    note: "80+ routes; prod path /tutorial /play /world",
  },
  {
    id: "auth",
    label: "Auth",
    score: 9,
    note: "id.grudge-studio.com + fleet JWT keys",
  },
  {
    id: "playerApi",
    label: "Player API",
    score: 9,
    note: "Railway characters · account · island",
  },
  {
    id: "assetsCdn",
    label: "Assets CDN",
    score: 9,
    note: "assets.grudge-studio.com R2",
  },
  {
    id: "definitions",
    label: "Definitions",
    score: 8,
    note: "info.grudge-studio.com catalogs",
  },
  {
    id: "realtime",
    label: "Realtime",
    score: 7,
    note: "Danger/brawl/carrier/zone WS",
  },
  {
    id: "aiWorkers",
    label: "AI workers",
    score: 8,
    note: "ai.grudge-studio.com hub v1.1",
  },
  {
    id: "deploy",
    label: "Deploy",
    score: 8,
    note: "Vercel SPAs + Railway + CF Workers",
  },
] as const;

export type SpiderNodeKind = "client" | "scene" | "page" | "server" | "route";

export type SpiderNode = {
  id: string;
  label: string;
  kind: SpiderNodeKind;
  group?: string;
  url?: string;
};

export type SpiderEdge = {
  from: string;
  to: string;
  via?: string;
};

/** Hub-and-spoke nodes for network spider. */
export const SPIDER_NODES: readonly SpiderNode[] = [
  // Clients
  { id: "c-open", label: "Open", kind: "client", group: "client", url: "https://open.grudge-studio.com" },
  { id: "c-warlords", label: "Warlords", kind: "client", group: "client", url: "https://grudgewarlords.com" },
  { id: "c-gcs", label: "Character Studio", kind: "client", group: "client", url: "https://character.grudge-studio.com" },
  { id: "c-genesis", label: "Genesis", kind: "client", group: "client", url: "https://warlord-genesis.vercel.app" },
  { id: "c-arena", label: "Arena / grudge6", kind: "client", group: "client" },

  // Scenes
  { id: "s-danger", label: "danger-room", kind: "scene", group: "scene" },
  { id: "s-sail", label: "sailtest", kind: "scene", group: "scene" },
  { id: "s-forest", label: "forest-map", kind: "scene", group: "scene" },
  { id: "s-genesis", label: "genesis 3-lane", kind: "scene", group: "scene" },
  { id: "s-sectors", label: "9 sectors seas", kind: "scene", group: "scene" },
  { id: "s-island", label: "home-island", kind: "scene", group: "scene" },

  // Pages / surfaces
  { id: "p-lib", label: "/ Library", kind: "page", group: "page" },
  { id: "p-account", label: "/account Heroes", kind: "page", group: "page" },
  { id: "p-danger", label: "/danger", kind: "page", group: "page" },
  { id: "p-play", label: "/play · /tutorial", kind: "page", group: "page" },
  { id: "p-world", label: "/world · sectors", kind: "page", group: "page" },
  { id: "p-craft", label: "/crafting · harvest", kind: "page", group: "page" },
  { id: "p-genesis", label: "/genesis canvas", kind: "page", group: "page" },
  { id: "p-realms", label: "/realms", kind: "page", group: "page" },

  // Servers
  { id: "srv-id", label: "ID Auth", kind: "server", group: "server", url: "https://id.grudge-studio.com" },
  { id: "srv-api", label: "Railway API", kind: "server", group: "server" },
  { id: "srv-info", label: "info defs", kind: "server", group: "server", url: "https://info.grudge-studio.com" },
  { id: "srv-cdn", label: "R2 CDN", kind: "server", group: "server", url: "https://assets.grudge-studio.com" },
  { id: "srv-ai", label: "AI hub", kind: "server", group: "server", url: "https://ai.grudge-studio.com" },
  { id: "srv-ml", label: "Mine-Loader", kind: "server", group: "server" },
  { id: "srv-ws", label: "WS rooms", kind: "server", group: "server" },
] as const;

/** Edges: client → page/scene → server. */
export const SPIDER_EDGES: readonly SpiderEdge[] = [
  { from: "c-open", to: "p-lib" },
  { from: "c-open", to: "p-account" },
  { from: "c-open", to: "p-danger" },
  { from: "c-open", to: "p-genesis" },
  { from: "c-open", to: "p-realms" },
  { from: "p-danger", to: "s-danger" },
  { from: "p-danger", to: "s-sail" },
  { from: "p-danger", to: "s-forest" },
  { from: "p-genesis", to: "s-genesis" },
  { from: "p-genesis", to: "c-genesis" },
  { from: "c-warlords", to: "p-play" },
  { from: "c-warlords", to: "p-world" },
  { from: "c-warlords", to: "p-craft" },
  { from: "c-warlords", to: "c-gcs" },
  { from: "p-play", to: "s-sectors" },
  { from: "p-world", to: "s-sectors" },
  { from: "p-world", to: "s-island" },
  { from: "c-gcs", to: "srv-api", via: "POST characters" },
  { from: "c-open", to: "srv-id", via: "/login" },
  { from: "c-open", to: "srv-api", via: "/api/characters" },
  { from: "c-open", to: "srv-info", via: "/api/objectstore" },
  { from: "c-open", to: "srv-cdn", via: "GLB/icons" },
  { from: "c-open", to: "srv-ai", via: "/api/ai" },
  { from: "c-open", to: "srv-ml", via: "/api/worlds" },
  { from: "c-open", to: "srv-ws", via: "danger/brawl" },
  { from: "c-warlords", to: "srv-id" },
  { from: "c-warlords", to: "srv-api" },
  { from: "c-warlords", to: "srv-info" },
  { from: "c-warlords", to: "srv-cdn" },
  { from: "c-warlords", to: "srv-ai" },
  { from: "c-warlords", to: "srv-ws" },
  { from: "c-genesis", to: "srv-api" },
  { from: "c-genesis", to: "srv-cdn" },
  { from: "c-arena", to: "srv-cdn" },
  { from: "p-realms", to: "srv-ml" },
] as const;

export type ConnectionRoute = {
  path: string;
  destination: string;
  layer: string;
};

/** Open Vercel rewrites (connection routes). */
export const CONNECTION_ROUTES: readonly ConnectionRoute[] = [
  { path: "/api/auth/* · /login", destination: "id.grudge-studio.com", layer: "identity" },
  { path: "/api/characters · account · inventory · island · wallet", destination: "Railway grudge-api", layer: "player" },
  { path: "/api/objectstore/*", destination: "info.grudge-studio.com", layer: "definitions" },
  { path: "/api/ai/*", destination: "ai.grudge-studio.com", layer: "ai" },
  { path: "/api/assets · /models/grudge6 · /icons", destination: "assets.grudge-studio.com", layer: "cdn" },
  { path: "/api/blocks · worlds · definitions", destination: "Mine-Loader Railway", layer: "worlds" },
  { path: "/api/carrier · brawl · space", destination: "voxgrudge-grudox-room Railway", layer: "realtime" },
  { path: "/api/* (fallback)", destination: "gameopen-production Railway", layer: "open-api" },
] as const;

/** Polar point helper for SVG radar (cx,cy,r, score 0-10, index, n). */
export function spiderPoint(
  cx: number,
  cy: number,
  maxR: number,
  score: number,
  index: number,
  n: number,
): { x: number; y: number } {
  const t = -Math.PI / 2 + (index / n) * Math.PI * 2;
  const r = (Math.max(0, Math.min(10, score)) / 10) * maxR;
  return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
}

export function spiderPolygonPoints(
  cx: number,
  cy: number,
  maxR: number,
  scores: number[],
): string {
  const n = scores.length;
  return scores
    .map((s, i) => {
      const p = spiderPoint(cx, cy, maxR, s, i, n);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

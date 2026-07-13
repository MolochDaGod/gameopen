/**
 * Grudge Open URL map — ONE catalog for path slugs, deep-links, and hub cards.
 *
 * Canonical host: https://open.grudge-studio.com
 * Alias:          https://gameopen.vercel.app
 *
 * Patterns:
 *  - Prefer clean paths:  /danger  /voxel  /brawl  /lobby
 *  - Keep GRUDOX:         /arcade/play/<cabinetId>
 *  - Query overrides:     ?door=<mode>  ?mode=<cabinetId>
 *  - Hub:                 /  or  /hub  or  /doors
 *
 * Practices:
 *  - Every surface owns one Mode string (engine switch).
 *  - URL is source of truth on load + back/forward; mode changes pushState.
 *  - Never invent parallel character stores — fleet GameSession + Railway only.
 */

export type AppMode =
  | "doors"
  | "danger"
  | "voxel"
  | "play"
  | "editor"
  | "lobby"
  | "ledmask"
  | "brawl"
  | "zones"
  | "mimic"
  | "genesis"
  | "voxgrudge-native";

export type SurfaceGroup =
  | "hub"
  | "combat"
  | "create"
  | "multiplayer"
  | "tools"
  | "external";

export interface OpenSurface {
  /** Internal engine mode (App.tsx). */
  mode: AppMode;
  /** Canonical path segment (no leading slash). Empty = hub `/`. */
  slug: string;
  /** Extra path segments that resolve to this mode. */
  aliases: readonly string[];
  /** Arcade / GRUDOX cabinet ids that map here. */
  cabinets: readonly string[];
  title: string;
  blurb: string;
  group: SurfaceGroup;
  /** Optional poster key under public/rooms/<key>-scene.png */
  poster?: string;
  accent?: string;
  tags?: readonly [string, string];
}

/** Ordered hub catalog — doors UI + docs + fleet deep-links. */
export const OPEN_SURFACES: readonly OpenSurface[] = [
  {
    mode: "doors",
    slug: "",
    aliases: ["hub", "doors", "home", "select"],
    cabinets: [],
    title: "Hub",
    blurb: "Choose an arena, editor, or multiplayer room.",
    group: "hub",
    tags: ["Home", "Menu"],
    accent: "#d4a843",
  },
  {
    mode: "danger",
    slug: "danger",
    aliases: ["danger-room", "combat", "train", "sandbox"],
    cabinets: ["danger", "danger-room", "explorer"],
    title: "Danger Room",
    blurb: "Live combat sandbox — weapons, skills, training targets.",
    group: "combat",
    poster: "danger",
    tags: ["Combat", "PvP"],
    accent: "#ff7a7a",
  },
  {
    mode: "play",
    slug: "play",
    aliases: ["test", "playtest", "map-play"],
    cabinets: [],
    title: "Play map",
    blurb: "Load an authored voxel map into a combat session.",
    group: "combat",
    tags: ["Playtest", "Map"],
    accent: "#ff9a6a",
  },
  {
    mode: "genesis",
    slug: "genesis",
    aliases: ["warlord-genesis", "warlords-genesis", "waves"],
    cabinets: ["genesis", "warlord-genesis"],
    title: "Warlord Genesis",
    blurb: "Pick a race and survive waves to claim the title.",
    group: "combat",
    poster: "genesis",
    tags: ["Boss Rush", "Race"],
    accent: "#ffd24d",
  },
  {
    mode: "brawl",
    slug: "brawl",
    aliases: ["ruins", "ruins-brawler", "brawler"],
    cabinets: ["brawl", "brawler", "ruins-brawler"],
    title: "Ruins Brawler",
    blurb: "3D twin-stick co-op survival in the GRUDOX ruins arena.",
    group: "multiplayer",
    poster: "brawl",
    tags: ["3D Live", "Co-op"],
    accent: "#4fc3ff",
  },
  {
    mode: "mimic",
    slug: "mimic",
    aliases: ["dungeon", "test-dungeon", "encounter"],
    cabinets: ["mimic", "dungeon"],
    title: "Test Dungeon",
    blurb: "Vol scene — open a barrel, fight the Mimic encounter.",
    group: "combat",
    poster: "mimic",
    tags: ["Encounter", "Boss"],
    accent: "#9cff5a",
  },
  {
    mode: "voxel",
    slug: "voxel",
    aliases: ["voxel-editor", "build", "map-editor"],
    cabinets: ["voxel", "voxel-editor"],
    title: "Voxel Editor",
    blurb: "Author maps — blocks, deployables, dungeon layout.",
    group: "create",
    poster: "voxel",
    tags: ["Build", "Create"],
    accent: "#7ee0a0",
  },
  {
    mode: "voxgrudge-native",
    slug: "world",
    aliases: ["voxgrudge", "vox-grudge", "open-world", "openworld"],
    cabinets: ["voxgrudge", "vox-grudge"],
    title: "VoxGrudge World",
    blurb: "Open voxel world — explore, build, multiplayer.",
    group: "multiplayer",
    poster: "voxgrudge",
    tags: ["Open World", "MP"],
    accent: "#5fe0ff",
  },
  {
    mode: "editor",
    slug: "dressing",
    aliases: ["editor", "dressing-room", "avatar", "customize"],
    cabinets: ["dressing-room", "dressing"],
    title: "Dressing Room",
    blurb: "Swap models, gear, animations, and VFX on your avatar.",
    group: "create",
    poster: "dressing",
    tags: ["Customize", "Preview"],
    accent: "#ffb24d",
  },
  {
    mode: "lobby",
    slug: "lobby",
    aliases: ["rooms", "multiplayer", "mp"],
    cabinets: ["lobby"],
    title: "The Lobby",
    blurb: "Join multiplayer rooms or browse community maps.",
    group: "multiplayer",
    poster: "lobby",
    tags: ["Multiplayer", "Community"],
    accent: "#9d8bff",
  },
  {
    mode: "zones",
    slug: "zones",
    aliases: ["grudox", "grudox-zones", "external"],
    cabinets: ["zones"],
    title: "GRUDOX Zones",
    blurb: "Launch into shared GRUDOX zones (brawler, racer, open world).",
    group: "external",
    poster: "zones",
    tags: ["External", "GRUDOX"],
    accent: "#5fe0ff",
  },
  {
    mode: "ledmask",
    slug: "ledmask",
    aliases: ["led-mask", "led", "face"],
    cabinets: ["ledmask", "led-mask"],
    title: "LED Mask",
    blurb: "Voxel head + LED visor expressions and poses.",
    group: "tools",
    poster: "avatar",
    tags: ["AI Face", "LED"],
    accent: "#a78bff",
  },
] as const;

const MODE_SET = new Set<string>(OPEN_SURFACES.map((s) => s.mode));

/** Arcade cabinet id → mode (GRUDOX deep-links). */
export const ARCADE_CABINET_MAP: Record<string, AppMode> = (() => {
  const m: Record<string, AppMode> = {};
  for (const s of OPEN_SURFACES) {
    for (const c of s.cabinets) m[c] = s.mode;
  }
  // Historical: bare explorer → danger; explorer?dressing=1 handled in resolve
  m.explorer = "danger";
  return m;
})();

export function surfaceForMode(mode: AppMode): OpenSurface {
  return OPEN_SURFACES.find((s) => s.mode === mode) ?? OPEN_SURFACES[0]!;
}

/** Canonical path for a mode (leading slash). */
export function pathForMode(mode: AppMode): string {
  const s = surfaceForMode(mode);
  return s.slug ? `/${s.slug}` : "/";
}

/** Human label for UI / document.title */
export function titleForMode(mode: AppMode): string {
  return surfaceForMode(mode).title;
}

function normalizeSeg(seg: string): string {
  return seg.replace(/^\/+|\/+$/g, "").toLowerCase();
}

function modeFromSlug(seg: string): AppMode | null {
  const s = normalizeSeg(seg);
  if (!s) return "doors";
  for (const surf of OPEN_SURFACES) {
    if (surf.slug === s) return surf.mode;
    if (surf.aliases.includes(s)) return surf.mode;
    if (surf.mode === s) return surf.mode;
  }
  return null;
}

/**
 * Resolve app mode from location.
 * Priority: ?door= → path slug → /arcade/play/<id> → ?mode= → hub.
 */
export function resolveModeFromLocation(
  pathname = typeof window !== "undefined" ? window.location.pathname : "/",
  search = typeof window !== "undefined" ? window.location.search : "",
): AppMode {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);

    // 1. Explicit ?door=<mode>
    const door = q.get("door");
    if (door && MODE_SET.has(door)) return door as AppMode;

    // 2. Clean path slugs: /danger, /voxel, /brawl, …
    const segs = pathname.split("/").filter(Boolean).map((x) => x.toLowerCase());
    if (segs.length === 0) {
      // fall through to arcade / mode query
    } else if (segs[0] === "arcade" && segs[1] === "play" && segs[2]) {
      const cabinetId = segs[2]!;
      if (cabinetId === "explorer") {
        return q.get("dressing") === "1" ? "editor" : "danger";
      }
      const mapped = ARCADE_CABINET_MAP[cabinetId];
      if (mapped) return mapped;
    } else {
      // /danger, /world, /dressing, /hub, …
      const fromPath = modeFromSlug(segs[0]!);
      if (fromPath) return fromPath;
      // Nested: /arcade/... already handled; /play/<map> still play
      if (segs[0] === "play") return "play";
    }

    // 3. ?mode=<cabinetId>
    const m = q.get("mode");
    if (m && ARCADE_CABINET_MAP[m]) return ARCADE_CABINET_MAP[m]!;
    if (m && MODE_SET.has(m)) return m as AppMode;
  } catch {
    /* ignore */
  }
  return "doors";
}

/**
 * Push or replace the URL to match mode (keeps search params except door/mode noise).
 */
export function syncUrlToMode(mode: AppMode, opts?: { replace?: boolean }): void {
  if (typeof window === "undefined") return;
  const path = pathForMode(mode);
  const url = new URL(window.location.href);
  // Drop obsolete door/mode query so path is SSOT
  url.searchParams.delete("door");
  url.searchParams.delete("mode");
  const next = `${path}${url.search}${url.hash}`;
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === cur) return;
  const state = { openMode: mode };
  if (opts?.replace) window.history.replaceState(state, "", next);
  else window.history.pushState(state, "", next);
  // Title
  try {
    const t = titleForMode(mode);
    document.title =
      mode === "doors"
        ? "Grudge Open — Combat Sandbox | Grudge Studio"
        : `${t} · Grudge Open | Grudge Studio`;
  } catch {
    /* ignore */
  }
}

/** Surfaces shown on the hub door grid (exclude pure hub + play-only). */
export function hubDoorSurfaces(): OpenSurface[] {
  return OPEN_SURFACES.filter(
    (s) => s.mode !== "doors" && s.mode !== "play" && s.group !== "hub",
  );
}

export const SURFACE_GROUP_LABEL: Record<SurfaceGroup, string> = {
  hub: "Hub",
  combat: "Combat labs",
  create: "Create & customize",
  multiplayer: "Multiplayer",
  tools: "Tools",
  external: "Fleet / external",
};

/** Group order for hub sections. */
export const HUB_GROUP_ORDER: SurfaceGroup[] = [
  "combat",
  "create",
  "multiplayer",
  "tools",
  "external",
];

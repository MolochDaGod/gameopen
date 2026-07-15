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
  | "landing"
  | "doors"
  | "danger"
  | "voxel"
  | "play"
  | "editor"
  | "lobby"
  | "ledmask"
  | "avatar"
  | "characters"
  | "minegrudge"
  | "brawl"
  | "survival"
  | "zones"
  | "mimic"
  | "genesis"
  | "voxgrudge-native"
  | "account";

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
    mode: "landing",
    slug: "login",
    aliases: ["sign-in", "signin", "welcome", "landing"],
    cabinets: [],
    title: "Sign in",
    blurb: "Grudge ID login — fleet session for all Open surfaces.",
    group: "hub",
    tags: ["Auth", "SSO"],
    accent: "#4fc3ff",
  },
  {
    mode: "doors",
    slug: "",
    aliases: ["hub", "doors", "home", "select", "library"],
    cabinets: [],
    title: "Hub",
    blurb: "Animator suite — combat, create, LED, Realms (replaces threejs-rapier hub).",
    group: "hub",
    tags: ["Home", "Menu"],
    accent: "#d4a843",
  },
  {
    mode: "danger",
    slug: "danger",
    aliases: ["danger-room", "combat", "train", "sandbox"],
    // Danger Room only — do NOT steal GRUDOX Voxel Arcade cabinets
    // (racer = Voxel Velocity, zombie, z-brawl live on grudox.grudge-studio.com).
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
    aliases: ["warlord-genesis", "warlords-genesis", "waves", "moba"],
    cabinets: ["genesis", "warlord-genesis"],
    title: "Warlord Genesis",
    blurb: "Launch the real 3-lane MOBA/RTS with your fleet Warlords character.",
    group: "combat",
    poster: "genesis",
    tags: ["MOBA", "RTS", "Fleet"],
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
    mode: "survival",
    slug: "survival",
    aliases: ["agama", "agama-survival", "survive", "agama-map"],
    cabinets: ["survival", "agama", "agama-survival"],
    title: "Agama Survival",
    blurb: "Wave survival on the Agama map — hold the safe zone, clear hostiles.",
    group: "combat",
    poster: "brawl",
    tags: ["Survival", "Waves"],
    accent: "#e8a040",
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
    aliases: ["voxgrudge-lab", "open-world-lab", "world-lab"],
    cabinets: ["voxgrudge-lab"],
    title: "VoxGrudge Lab",
    blurb: "In-Open voxel lab editor. Full world → library · voxgrudge.vercel.app",
    group: "create",
    poster: "voxgrudge",
    tags: ["Lab", "Editor"],
    accent: "#5fe0ff",
  },
  {
    mode: "editor",
    slug: "dressing",
    aliases: ["editor", "dressing-room", "animator", "customize"],
    cabinets: ["dressing-room", "dressing", "animator"],
    title: "Dressing Room / Animator",
    blurb: "Full character animator — gear, clips, VFX (threejs-rapier suite).",
    group: "create",
    poster: "dressing",
    tags: ["Customize", "Preview"],
    accent: "#ffb24d",
  },
  {
    mode: "avatar",
    slug: "avatar",
    aliases: ["avatar-edit", "head", "cube-head", "modular-head"],
    cabinets: ["avatar"],
    title: "Avatar Editor",
    blurb: "Cube modular head builder — races, hair, eyes, gear colors.",
    group: "create",
    poster: "avatar",
    tags: ["Avatar", "Create"],
    accent: "#c9a0ff",
  },
  {
    mode: "characters",
    slug: "characters",
    aliases: ["charactersgrudox", "campfire", "roster-hub"],
    cabinets: ["characters", "charactersgrudox"],
    title: "Characters GRUDOX",
    blurb: "Campfire roster hub — launch play surfaces with hero handoff.",
    group: "hub",
    poster: "avatar",
    tags: ["Roster", "Hub"],
    accent: "#5fe0ff",
  },
  {
    mode: "minegrudge",
    slug: "realms",
    aliases: ["minegrudge", "mineloader", "mine-loader", "grudox-realms"],
    cabinets: ["minegrudge", "realms"],
    title: "GRUDOX Realms",
    blurb: "Mine-Loader worlds — lobby, build, co-op (fleet iframe / live).",
    group: "multiplayer",
    poster: "library-mine",
    tags: ["Realms", "Voxel"],
    accent: "#7ee0a0",
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
    blurb: "Fleet games in-app — native Open engines or embedded canvas (no new tab).",
    group: "external",
    poster: "zones",
    tags: ["In-app", "GRUDOX"],
    accent: "#5fe0ff",
  },
  {
    mode: "ledmask",
    slug: "ledmask",
    aliases: ["led-mask", "led", "face", "visor"],
    cabinets: ["ledmask", "led-mask"],
    title: "LED Mask",
    blurb: "Voxel LED visor — chat, faces, banner; right rail scrolls in place.",
    group: "tools",
    poster: "avatar",
    tags: ["AI Face", "LED"],
    accent: "#a78bff",
  },
  {
    mode: "account",
    slug: "account",
    aliases: ["characters", "profile", "wallet", "treaty", "charactersgrudox"],
    cabinets: ["characters", "account"],
    title: "Account Hub",
    blurb:
      "Fleet characters (Railway) · shared account bag · charactersgrudox races · GRUDOX handoff.",
    group: "hub",
    poster: "library-account",
    tags: ["Account", "SSO", "Postgres"],
    accent: "#4fc3ff",
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

    // 0. Fleet handoff from Character Studio / charactersgrudox → Account hub
    //    e.g. /account?open=1&from=charactersgrudox&characterId=…
    const from = (q.get("from") || q.get("source") || "").toLowerCase();
    if (
      from === "charactersgrudox" ||
      from === "character-studio" ||
      from === "gcs" ||
      from === "character"
    ) {
      return "account";
    }

    // 1. Explicit ?door=<mode|alias> (legacy threejs-rapier deep-links)
    const door = q.get("door");
    if (door) {
      if (MODE_SET.has(door)) return door as AppMode;
      if (door === "charactersgrudox" || door === "characters") return "account";
      if (door === "grudoxEditor") return "minegrudge";
      const viaAlias = modeFromSlug(door);
      if (viaAlias) return viaAlias;
    }

    // 2. Clean path slugs: /danger, /voxel, /brawl, …
    const segs = pathname.split("/").filter(Boolean).map((x) => x.toLowerCase());
    if (segs.length === 0) {
      // fall through to arcade / mode query
    } else if (segs[0] === "arcade" && segs[1] === "play" && segs[2]) {
      const cabinetId = segs[2]!;
      if (cabinetId === "explorer") {
        return q.get("dressing") === "1" ? "editor" : "danger";
      }
      // GRUDOX Voxel Arcade cabinets (Voxel Velocity = racer, etc.) do not run
      // inside gameopen. Edge proxy should send /arcade/* to grudox; if we still
      // hit this SPA, hard-redirect to the real arcade host.
      const GRUDOX_ARCADE = new Set([
        "racer",
        "race",
        "velocity",
        "voxel-velocity",
        "zombie",
        "undead",
        "sword-master",
        "swordmaster",
        "z-brawl",
        "zbrawl",
        "sailing",
        "carrier",
      ]);
      if (GRUDOX_ARCADE.has(cabinetId) && typeof window !== "undefined") {
        const dest = new URL(
          `https://grudox.grudge-studio.com/arcade/play/${encodeURIComponent(cabinetId)}`,
        );
        dest.search = search.startsWith("?") ? search : search ? `?${search}` : "";
        if (!dest.searchParams.has("open")) dest.searchParams.set("open", "1");
        window.location.replace(dest.toString());
        return "doors"; // brief shell while navigating away
      }
      const mapped = ARCADE_CABINET_MAP[cabinetId];
      if (mapped) return mapped;
      // Unknown arcade id → hub, never invent Danger Room as a fake racer.
      return "doors";
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
  // Preserve fleet handoff flags for account deep-links
  const keepFrom = url.searchParams.get("from");
  const keepOpen = url.searchParams.get("open");
  // Drop obsolete door/mode query so path is SSOT
  url.searchParams.delete("door");
  url.searchParams.delete("mode");
  if (mode === "account") {
    if (keepFrom) url.searchParams.set("from", keepFrom);
    if (keepOpen) url.searchParams.set("open", keepOpen);
  }
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

/**
 * Surfaces shown on the Steam-style library grid.
 * Exclude pure home (doors), ephemeral play, and login landing.
 * Keep account / characters hub tiles so fleet roster is one click away.
 */
export function hubDoorSurfaces(): OpenSurface[] {
  return OPEN_SURFACES.filter(
    (s) =>
      s.mode !== "doors" &&
      s.mode !== "play" &&
      s.mode !== "landing",
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
  "hub",
  "combat",
  "create",
  "multiplayer",
  "tools",
  "external",
];

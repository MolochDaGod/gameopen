/**
 * GRUDOX zones — launcher cards inside Grudge Open.
 *
 * SSOT for cabinet games:
 *   https://grudox.grudge-studio.com/arcade/play/<id>
 *
 * Voxel Arcade (on GRUDOX) owns — SSOT package @workspace/arcade
 * (source: vfc-build/artifacts/arcade from D:\\Games\\Models\\arcade.zip):
 *   zombie   → Voxel Undead: Sword Master
 *   boat     → Open Water
 *   explorer → Explorer (voxel roam / dressing via ?dressing=1)
 *   racer    → Voxel Velocity — NOT Danger Room
 *   brawler  → Ruins Brawler (also has native Open surface)
 *   arena    → Arena PvP (live /api/arena)
 *   carrier  → external /carrier/ (not in-engine)
 * Legacy (not zip roster): z-brawl → optional voxgrudge HTML only
 *
 * Never deep-link arcade cabinets back to open.grudge-studio.com in a self-loop.
 * Never remap Voxel Velocity to Danger Room.
 *
 * Mine-Loader Realms / Island / Account use externalPath (off-GRUDOX hosts).
 */

/** Canonical GRUDOX host for Voxel Arcade + fleet zone shell. */
export const GRUDOX_HOST = "https://grudox.grudge-studio.com";

/**
 * Play shell hosting GRUDOX Island (Lobby World). Override with VITE_PLAY_SHELL_URL.
 * SSOT: Open (same fleet SPA) — never pin legacy threejs-rapier demo host.
 */
export const PLAY_SHELL_HOST =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_PLAY_SHELL_URL as string | undefined)?.replace(/\/+$/, "")) ||
  "https://open.grudge-studio.com";

export interface GrudoxZone {
  /** Cabinet id — `/arcade/play/:id` on GRUDOX. */
  id: string;
  title: string;
  blurb: string;
  tone: string;
  /**
   * True only when gameopen hosts a real native engine for this zone.
   * false → always open GRUDOX arcade (e.g. Voxel Velocity).
   */
  native?: boolean;
  /**
   * Native AppMode when `native` (optional hint for Open).
   * Prefer resolving via {@link nativeModeForZone} in inAppLaunch.
   */
  nativeMode?:
    | "brawl"
    | "voxgrudge-native"
    | "danger"
    | "minegrudge"
    | "account"
    | "survival"
    | "genesis"
    | "realms";
  /** Optional production URL when the cabinet is hosted off-GRUDOX SPA (racer). */
  productionUrl?: string;
  /**
   * Absolute external URL — when set, launch uses this instead of
   * GRUDOX arcade path (Lobby Island, Mine-Loader Realms, Account hub).
   */
  externalPath?: string;
}

export const GRUDOX_ZONES: readonly GrudoxZone[] = [
  {
    id: "characters",
    title: "Characters · Campfire",
    blurb:
      "4-seat TVS campfire roster (charactersgrudox) · launch PvE/PvP · Account for bag/wallet.",
    tone: "#4fc3ff",
    native: true,
    // Campfire hub — never AccountPanel (door=characters SSOT)
    externalPath: "https://open.grudge-studio.com/characters",
  },
  {
    id: "minegrudge",
    title: "GRUDOX Realms",
    blurb:
      "Networked Minecraft-like survival — mine.grudge-studio.com (GRUDOX voxel era). Open lists it; play is not in-app /realms.",
    tone: "#7ee0a0",
    native: false,
    externalPath: "https://mine.grudge-studio.com/#/play",
  },
  {
    id: "mine-loader-live",
    title: "Mine-Loader Live",
    blurb:
      "Authoritative voxel Realms — GRUDOX era host mine.grudge-studio.com · 1× Railway API + Vercel SPA.",
    tone: "#5fd48a",
    native: false,
    externalPath: "https://mineloader.grudge-studio.com/",
  },
  {
    id: "dcq",
    title: "Dungeon Crawler Quest",
    blurb: "Full DCQ voxel dungeon RPG — dcq.grudge-studio.com",
    tone: "#c9a0ff",
    externalPath: "https://dcq.grudge-studio.com/",
  },
  {
    id: "lobby-island",
    title: "Warlords Island (in-game)",
    blurb:
      "Home / lobby island is inside Grudge Warlords — not a standalone Open zone. Launches Warlords client.",
    tone: "#5fd48a",
    // Never PLAY_SHELL lobbyWorld as a fake Open game — Warlords owns the world
    externalPath: "https://client.grudge-studio.com/home",
  },
  /**
   * Chicken Gun / PolygonPirates mesh — Warlords opening + tutorial only.
   * Never a GRUDOX arcade cabinet; never Explorer. Deep-link into client lobby.
   */
  {
    id: "pirate-islands",
    title: "Warlords Pirate Lobby (in-game)",
    blurb:
      "Chicken Gun pirate map = Warlords opening + tutorial only — not GRUDOX, not Explorer. Launches Warlords client lobby.",
    tone: "#4a9ec8",
    externalPath:
      "https://client.grudge-studio.com/island-3d?mode=lobby&map=pirate-islands",
  },
  {
    id: "brawler",
    title: "Ruins Brawler",
    blurb:
      "Wave survival — Open native brawl preferred; GRUDOX /arcade/play/brawler is zip SPA cabinet.",
    tone: "#ff2d55",
    native: true,
    nativeMode: "brawl",
  },
  {
    id: "danger",
    title: "Danger Room",
    blurb: "Full combat stack — soft lock, RMB focus, arsenal skills (native Open).",
    tone: "#ff5a6a",
    native: true,
    nativeMode: "danger",
  },
  {
    id: "survival",
    title: "Agama Survival",
    blurb: "Wave survival on Agama map — native Open Brawler variant.",
    tone: "#e8a040",
    native: true,
    nativeMode: "survival",
  },
  {
    id: "genesis",
    title: "Warstrat · Warlord Genesis",
    blurb: "3-lane MOBA/RTS — warstrat.grudge-studio.com (canonical) or Open genesis picker.",
    tone: "#ffd24d",
    native: true,
    nativeMode: "genesis",
    productionUrl: "https://warstrat.grudge-studio.com/lobby",
  },
  {
    id: "zombie",
    title: "Voxel Undead: Sword Master",
    blurb: "Sword survival — GRUDOX arcade SPA (arcade.zip SSOT).",
    tone: "#ff0044",
    native: false,
  },
  {
    id: "boat",
    title: "Open Water",
    blurb: "Sailing sandbox — GRUDOX arcade SPA.",
    tone: "#22d3ee",
    native: false,
  },
  {
    id: "explorer",
    title: "Explorer",
    blurb: "Voxel roam + dressing — GRUDOX arcade SPA (not Danger Room).",
    tone: "#a78bfa",
    native: false,
  },
  {
    id: "racer",
    title: "Voxel Velocity",
    blurb: "Arcade racing — GRUDOX /arcade/play/racer (not Danger Room).",
    tone: "#00ffff",
    native: false,
    // Brand alias only; cabinet SSOT is in-arcade zip engine
    productionUrl: "https://drive.grudge-studio.com/",
  },
  {
    id: "arena",
    title: "Arena PvP",
    blurb: "Live third-person combat — GRUDOX arcade + /api/arena.",
    tone: "#fb7185",
    native: false,
  },
  {
    id: "carrier",
    title: "Carrier",
    blurb: "Mothership command — external Carrier host (not in-arcade engine).",
    tone: "#88ff00",
    native: false,
    externalPath: "https://carrier.grudge-studio.com/",
  },
  {
    id: "z-brawl",
    title: "Z-Brawl (legacy)",
    blurb: "Legacy HTML cabinet — not in arcade.zip; optional external only.",
    tone: "#9d8bff",
    native: false,
    externalPath: "https://grudox.grudge-studio.com/voxgrudge/z-brawl.html",
  },
  {
    id: "voxgrudge",
    title: "VoxGrudge Full World",
    blurb: "Full open-world — in-app canvas; Open /world is the local road/biome lab.",
    tone: "#5fe0ff",
    // Prefer lab native first for wiring; full world still embeddable
    native: true,
    nativeMode: "voxgrudge-native",
    productionUrl: "https://voxgrudge.vercel.app/",
    externalPath: "https://voxgrudge.vercel.app/",
  },
  {
    id: "water-island",
    title: "Warlords Home Island (in-game)",
    blurb:
      "Water home island is a Warlords world destination — open the Warlords client, not a separate Open game.",
    tone: "#4fc3c8",
    externalPath: "https://client.grudge-studio.com/home",
  },
] as const;

/** Cabinets that must never be treated as Danger Room / Open modes. */
export const GRUDOX_ARCADE_ONLY_CABINETS = new Set(
  GRUDOX_ZONES.filter((z) => !z.native).map((z) => z.id),
);

export interface GrudoxLinkParams {
  token?: string | null;
  characterId?: string | null;
  host?: string;
}

/** Hosts that proxy `/arcade/*` → GRUDOX (same-origin embed safe). */
function isOpenArcadeProxyHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "open.grudge-studio.com" ||
    h === "gameopen.vercel.app" ||
    h.endsWith(".gameopen.vercel.app") ||
    (typeof window !== "undefined" && window.location.hostname === h)
  );
}

/**
 * Build GRUDOX arcade deep-link (or externalPath / productionUrl when set).
 *
 * Arcade cabinets (racer / zombie / z-brawl) use **same-origin**
 * `/arcade/play/:id` on Open so the CF edge can proxy GRUDOX without
 * X-Frame-Options SAMEORIGIN blocking the in-app canvas.
 * Absolute `grudox.grudge-studio.com` is only used when not on Open (or forced).
 */
export function grudoxDeepLink(zoneId: string, params: GrudoxLinkParams = {}): string {
  const zone = GRUDOX_ZONES.find((z) => z.id === zoneId);

  if (zone?.productionUrl) {
    const base = zone.productionUrl.replace(/\/+$/, "");
    const q = new URLSearchParams();
    if (params.token) {
      q.set("grudge_token", params.token);
      q.set("sso_token", params.token);
    }
    if (params.characterId) q.set("characterId", params.characterId);
    q.set("open", "1");
    q.set("from", "gameopen");
    const qs = q.toString();
    return qs ? `${base}/?${qs}` : `${base}/`;
  }

  const q = new URLSearchParams();
  if (params.token) {
    q.set("grudge_token", params.token);
    q.set("sso_token", params.token);
  }
  if (params.characterId) q.set("characterId", params.characterId);
  q.set("open", "1");
  q.set("from", "gameopen");

  if (zone?.externalPath) {
    try {
      const u = new URL(zone.externalPath);
      // Rewrite absolute open.grudge-studio.com account links to same-origin door
      if (
        typeof window !== "undefined" &&
        (u.hostname === "open.grudge-studio.com" || u.hostname === "gameopen.vercel.app")
      ) {
        const path = u.pathname + u.search;
        const here = new URL(path, window.location.origin);
        for (const [k, v] of q.entries()) here.searchParams.set(k, v);
        return here.toString();
      }
      for (const [k, v] of q.entries()) u.searchParams.set(k, v);
      return u.toString();
    } catch {
      return `${zone.externalPath}${zone.externalPath.includes("?") ? "&" : "?"}${q.toString()}`;
    }
  }

  // Arcade path: prefer same-origin /arcade so Open can iframe without frame-blockers
  const arcadePath = `/arcade/play/${encodeURIComponent(zoneId)}?${q.toString()}`;
  if (params.host) {
    return `${params.host.replace(/\/+$/, "")}${arcadePath}`;
  }
  if (typeof window !== "undefined" && isOpenArcadeProxyHost(window.location.hostname)) {
    return `${window.location.origin}${arcadePath}`;
  }
  // Off Open shell (docs, external launchers): absolute GRUDOX host
  return `${GRUDOX_HOST.replace(/\/+$/, "")}${arcadePath}`;
}

/** Convenience: open GRUDOX Island with current fleet session. */
export function lobbyIslandDeepLink(params: GrudoxLinkParams = {}): string {
  return grudoxDeepLink("lobby-island", params);
}

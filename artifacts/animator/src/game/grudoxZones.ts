/**
 * GRUDOX zones — launcher cards inside Grudge Open.
 *
 * SSOT for cabinet games:
 *   https://grudox.grudge-studio.com/arcade/play/<id>
 *
 * Voxel Arcade (on GRUDOX) owns:
 *   racer  → Voxel Velocity (street racing) — NOT Danger Room
 *   zombie → Voxel Undead
 *   z-brawl → Z-Brawl
 *   brawler → Ruins Brawler (also has native gameopen surface)
 *   voxgrudge → open world (also native)
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
 * Default: production threejs-rapier GRUDOX play deploy.
 */
export const PLAY_SHELL_HOST =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_PLAY_SHELL_URL as string | undefined)?.replace(/\/+$/, "")) ||
  "https://threejs-rapier-react-three-controll.vercel.app";

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
  /** Native AppMode when `native` (optional hint for Open). */
  nativeMode?: "brawl" | "voxgrudge-native" | "danger" | "minegrudge" | "account";
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
    title: "Characters",
    blurb:
      "Account hub: charactersgrudox race kit, create/equip heroes, credits, wallet, treaty — native Open surface.",
    tone: "#4fc3ff",
    native: true,
    // Fallback embed if host navigates via deep-link only
    externalPath: "https://open.grudge-studio.com/?door=account",
  },
  {
    id: "minegrudge",
    title: "GRUDOX Realms",
    blurb:
      "Networked Minecraft-like survival — open.grudge-studio.com/realms (in-app) · Mine-Loader authority.",
    tone: "#7ee0a0",
    native: true,
    nativeMode: "minegrudge", // resolved to AppMode "realms" via nativeModeForZone
    externalPath: "https://mine-loader.vercel.app/",
  },
  {
    id: "mine-loader-live",
    title: "Mine-Loader Live",
    blurb:
      "Authoritative voxel Realms — collection path /realms · 1× Railway API + Vercel SPA.",
    tone: "#5fd48a",
    native: true,
    externalPath: "https://mine-loader.vercel.app/",
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
    title: "GRUDOX Island",
    blurb:
      "Persistent open island — harvest, craft, build, vendors, day/night, PvP as your real Warlords character. Account bag saves to Railway.",
    tone: "#5fd48a",
    externalPath: `${PLAY_SHELL_HOST}/?door=lobbyWorld`,
  },
  {
    id: "brawler",
    title: "Ruins Brawler",
    blurb: "Twin-stick co-op survival — native Open surface or GRUDOX arcade.",
    tone: "#ff7a7a",
    native: true,
    nativeMode: "brawl",
  },
  {
    id: "racer",
    title: "Voxel Velocity",
    blurb: "Production strip racer — GRUDOX arcade or drive.grudge-studio.com.",
    tone: "#ffd24d",
    native: false,
    productionUrl: "https://drive.grudge-studio.com/",
  },
  {
    id: "zombie",
    title: "Voxel Undead: Sword Master",
    blurb: "Sword survival — GRUDOX Voxel Arcade cabinet.",
    tone: "#7ee0a0",
    native: false,
  },
  {
    id: "z-brawl",
    title: "Z-Brawl",
    blurb: "Protocol Extinction arena — GRUDOX Voxel Arcade cabinet.",
    tone: "#9d8bff",
    native: false,
  },
  {
    id: "voxgrudge",
    title: "VoxGrudge Full World",
    blurb: "Full open-world voxel survival — voxgrudge.vercel.app in-app canvas (lab stays under Library → World).",
    tone: "#5fe0ff",
    productionUrl: "https://voxgrudge.vercel.app/",
    externalPath: "https://voxgrudge.vercel.app/",
  },
  {
    id: "water-island",
    title: "Warlords Home Island",
    blurb: "water.grudge-studio.com/island — harvest, grudge6, nature packs.",
    tone: "#4fc3c8",
    externalPath: "https://water.grudge-studio.com/island",
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

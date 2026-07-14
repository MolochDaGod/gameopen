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
 * Never deep-link these back to open.grudge-studio.com (that was a self-loop).
 * Never remap Voxel Velocity to Danger Room.
 */

/** Canonical GRUDOX host for Voxel Arcade + fleet zone shell. */
export const GRUDOX_HOST = "https://grudox.grudge-studio.com";

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
  nativeMode?: "brawl" | "voxgrudge-native" | "danger";
  /** Optional production URL when the cabinet is hosted off-GRUDOX SPA (racer). */
  productionUrl?: string;
}

export const GRUDOX_ZONES: readonly GrudoxZone[] = [
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
    /** Production host for the real racer (not a staging/dev shell). */
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
    title: "VoxGrudge: Open World",
    blurb: "Open voxel world — native Open surface or GRUDOX.",
    tone: "#5fe0ff",
    native: true,
    nativeMode: "voxgrudge-native",
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

/**
 * Build GRUDOX arcade deep-link.
 * Always targets grudox.grudge-studio.com unless host override is explicit.
 */
export function grudoxDeepLink(zoneId: string, params: GrudoxLinkParams = {}): string {
  const zone = GRUDOX_ZONES.find((z) => z.id === zoneId);
  // Production racer ships on drive.grudge-studio.com (Voxel Velocity).
  // Prefer that URL so Open/GRUDOX launchers never hit a stale staging shell.
  if (zone?.productionUrl) {
    const base = zone.productionUrl.replace(/\/+$/, "");
    const q = new URLSearchParams();
    if (params.token) q.set("grudge_token", params.token);
    if (params.characterId) q.set("characterId", params.characterId);
    q.set("from", "grudox");
    const qs = q.toString();
    return qs ? `${base}/?${qs}` : `${base}/`;
  }
  const host = (params.host || GRUDOX_HOST).replace(/\/+$/, "");
  const q = new URLSearchParams();
  if (params.token) q.set("grudge_token", params.token);
  if (params.characterId) q.set("characterId", params.characterId);
  q.set("open", "1");
  return `${host}/arcade/play/${encodeURIComponent(zoneId)}?${q.toString()}`;
}

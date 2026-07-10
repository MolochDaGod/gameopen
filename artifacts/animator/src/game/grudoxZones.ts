/**
 * GRUDOX zones exposed inside gameopen.
 *
 * These are the selected GRUDOX modes surfaced as launcher cards. Each card
 * deep-links into the GRUDOX web shell's arcade cabinet carrying the fleet SSO
 * token + the active fleet character, so the same Grudge ID and character carry
 * across gameopen and GRUDOX:
 *
 *   https://open.grudge-studio.com/arcade/play/<id>?grudge_token=<jwt>&characterId=<id>&open=1
 *
 * `brawler` also has a NATIVE in-gameopen surface (Ruins Brawler) that connects
 * straight to the GRUDOX `/api/brawl` room; the card here is the GRUDOX-hosted
 * cabinet equivalent.
 */

/** GRUDOX web-shell host the arcade cabinets are deep-linked into. */
export const GRUDOX_HOST = "https://open.grudge-studio.com";

export interface GrudoxZone {
  /** Roster id — the `/arcade/play/:id` cabinet slug in the GRUDOX shell. */
  id: string;
  title: string;
  blurb: string;
  /** Accent colour for the card. */
  tone: string;
  /** True when gameopen also hosts a native surface for this zone. */
  native?: boolean;
}

export const GRUDOX_ZONES: readonly GrudoxZone[] = [
  {
    id: "brawler",
    title: "Ruins Brawler",
    blurb: "Top-down twin-stick co-op survival in the shared GRUDOX ruins.",
    tone: "#ff7a7a",
    native: true,
  },
  {
    id: "racer",
    title: "Voxel Velocity",
    blurb: "Arcade voxel racing across GRUDOX circuits.",
    tone: "#ffd24d",
  },
  {
    id: "zombie",
    title: "Voxel Undead: Sword Master",
    blurb: "Improved sword survival against the voxel undead horde.",
    tone: "#7ee0a0",
  },
  {
    id: "z-brawl",
    title: "Z-Brawl",
    blurb: "Voxel fight — Z-Brawl: Protocol Extinction arena combat.",
    tone: "#9d8bff",
  },
  {
    id: "voxgrudge",
    title: "VoxGrudge: Open World",
    blurb: "The GRUDOX open voxel world — explore, build, and party up.",
    tone: "#5fe0ff",
    native: true,
  },
] as const;

export interface GrudoxLinkParams {
  /** Fleet SSO token (grudge_token). Omitted from the link when absent. */
  token?: string | null;
  /** Active fleet character id. Omitted from the link when absent. */
  characterId?: string | null;
  /** Override the GRUDOX host (defaults to {@link GRUDOX_HOST}). */
  host?: string;
}

/**
 * Build the GRUDOX arcade deep-link for a zone, carrying the fleet token + the
 * active character so identity + character persist across the handoff. `open=1`
 * always marks the launch as originating from Grudge Open.
 */
export function grudoxDeepLink(zoneId: string, params: GrudoxLinkParams = {}): string {
  const host = (params.host || GRUDOX_HOST).replace(/\/+$/, "");
  const q = new URLSearchParams();
  if (params.token) q.set("grudge_token", params.token);
  if (params.characterId) q.set("characterId", params.characterId);
  q.set("open", "1");
  return `${host}/arcade/play/${encodeURIComponent(zoneId)}?${q.toString()}`;
}

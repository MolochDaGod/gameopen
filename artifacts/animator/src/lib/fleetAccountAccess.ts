/**
 * Fleet account accessibility SSOT — one Grudge ID, same Railway account data,
 * reachable from every production surface (Open · GRUDOX · Warlords · Poker · GST…).
 *
 * Brands stay separate (Open ≠ GRUDOX ≠ Warlords). Account **data** is shared.
 *
 * Law (grudge-production-wiring):
 *   Auth     → id.grudge-studio.com
 *   Player   → Railway Postgres (characters / bag / wallet / island)
 *   Assets   → assets.grudge-studio.com (R2)
 *   Index    → D1 (not player SSOT)
 */

export type FleetSurfaceId =
  | "open"
  | "grudox"
  | "warlords"
  | "foundry"
  | "poker"
  | "gst"
  | "mine-loader"
  | "wallet";

export type FleetSurface = {
  id: FleetSurfaceId;
  label: string;
  blurb: string;
  /** Primary account or hub URL */
  accountUrl: string;
  /** Play / product root */
  homeUrl: string;
  /** Brand role (do not collapse products) */
  brandRole: string;
  /** Same-origin /api rewrites → Railway when true */
  sameOriginApi: boolean;
  /** Eras this surface primarily uses for characters */
  eras: Array<"warlords" | "voxel" | "nexus" | "armada">;
};

/** Canonical account + product entry points for the whole fleet. */
export const FLEET_SURFACES: readonly FleetSurface[] = [
  {
    id: "open",
    label: "Grudge Open",
    blurb: "Steam-style library · Danger Room · native tools · PWA launcher",
    accountUrl: "https://open.grudge-studio.com/?door=account",
    homeUrl: "https://open.grudge-studio.com/?door=library",
    brandRole: "launcher",
    sameOriginApi: true,
    eras: ["warlords", "voxel", "nexus", "armada"],
  },
  {
    id: "grudox",
    label: "GRUDOX",
    blurb:
      "Voxel systems hub · cabinets · editor · deployer · account (Minecraft-like shell)",
    accountUrl: "https://grudox.grudge-studio.com/account",
    homeUrl: "https://grudox.grudge-studio.com/",
    brandRole: "voxel-hub",
    sameOriginApi: true,
    eras: ["voxel", "warlords"],
  },
  {
    id: "warlords",
    label: "Grudge Warlords",
    blurb: "Flagship fantasy client · home island · sectors · pirate lobby",
    accountUrl: "https://client.grudge-studio.com/home",
    homeUrl: "https://client.grudge-studio.com/home",
    brandRole: "flagship-play",
    sameOriginApi: true,
    eras: ["warlords"],
  },
  {
    id: "foundry",
    label: "Character Foundry",
    blurb: "Create-only + 4-slot heroes · not 3D play",
    accountUrl: "https://character.grudge-studio.com/",
    homeUrl: "https://character.grudge-studio.com/foundry",
    brandRole: "create",
    sameOriginApi: true,
    eras: ["warlords", "voxel", "nexus", "armada"],
  },
  {
    id: "poker",
    label: "Grudge Poker",
    blurb: "Poker product · same Grudge ID + Railway wallet/account",
    accountUrl: "https://poker.grudge-studio.com/account",
    homeUrl: "https://poker.grudge-studio.com/",
    brandRole: "game",
    sameOriginApi: true,
    eras: ["nexus"],
  },
  {
    id: "gst",
    label: "Grudge Islands RTS",
    blurb: "GST /gst/ · cinema · island sim · combat lab",
    accountUrl: "https://grudge-studio.com/gst/",
    homeUrl: "https://grudge-studio.com/gst/",
    brandRole: "game",
    sameOriginApi: true,
    eras: ["warlords"],
  },
  {
    id: "mine-loader",
    label: "Mine-Loader Realms",
    blurb: "Voxel multiplayer worlds · harvest · DRC",
    accountUrl: "https://mineloader.grudge-studio.com/",
    homeUrl: "https://mineloader.grudge-studio.com/",
    brandRole: "worlds",
    sameOriginApi: true,
    eras: ["voxel"],
  },
  {
    id: "wallet",
    label: "Fleet Wallet",
    blurb: "Custodial / linked wallet (same account row)",
    accountUrl: "https://wallet.grudge-studio.com/",
    homeUrl: "https://wallet.grudge-studio.com/",
    brandRole: "wallet",
    sameOriginApi: false,
    eras: ["warlords", "voxel", "nexus", "armada"],
  },
] as const;

export function getFleetSurface(id: FleetSurfaceId): FleetSurface | undefined {
  return FLEET_SURFACES.find((s) => s.id === id);
}

/** GRUDOX production account (alias vercel.app also works). */
export const GRUDOX_ACCOUNT_URL = "https://grudox.grudge-studio.com/account";
export const GRUDOX_ACCOUNT_VERCEL = "https://grudox.vercel.app/account";
export const OPEN_ACCOUNT_URL = "https://open.grudge-studio.com/?door=account";

/**
 * Build cross-app account deep-link with SSO handoff so the destination
 * sees the same JWT keys after redirect.
 */
export function fleetAccountHandoffUrl(
  surface: FleetSurfaceId,
  opts: {
    token?: string | null;
    characterId?: string | null;
    from?: string;
  } = {},
): string {
  const s = getFleetSurface(surface);
  const base = s?.accountUrl || OPEN_ACCOUNT_URL;
  try {
    const u = new URL(base);
    if (opts.token) {
      u.searchParams.set("sso_token", opts.token);
      u.searchParams.set("grudge_token", opts.token);
    }
    if (opts.characterId) u.searchParams.set("characterId", opts.characterId);
    u.searchParams.set("open", "1");
    u.searchParams.set("from", opts.from || "gameopen");
    return u.toString();
  } catch {
    return base;
  }
}

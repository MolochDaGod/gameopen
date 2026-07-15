/**
 * In-app launch policy for open.grudge-studio.com.
 *
 * Prefer staying inside the Open shell (native AppMode or embedded canvas).
 * Never force a new browser tab for fleet games — pop-out is opt-in only.
 *
 * Asset/VFX practices:
 *  - Poster art via assetUrl / rooms/* (same-origin → R2 rewrite)
 *  - SSO handoff always carries grudge_token + characterId + open=1
 *  - Embed only production fleet hosts (never broken same-origin stubs)
 */

import type { AppMode } from "./openRoutes";
import {
  GRUDOX_ZONES,
  grudoxDeepLink,
  type GrudoxZone,
} from "../game/grudoxZones";
import type { GameEntry } from "../game/gameLibrary";
import { gameLaunchUrl, posterUrl } from "../game/gameLibrary";
import { assetUrl } from "./fleet";

/** Session shown by {@link InAppGameCanvas}. */
export interface InAppEmbedSession {
  url: string;
  title: string;
  tone?: string;
  /** Room poster key or absolute image URL for loading curtain. */
  poster?: string;
  /** Zone / library id for analytics + return context. */
  id?: string;
  /** Mode to restore when the canvas closes. */
  returnMode?: AppMode;
}

export interface LaunchContext {
  token?: string | null;
  characterId?: string | null;
  baseId?: string | null;
  characterName?: string | null;
  raceId?: string | null;
}

/**
 * Map GRUDOX zone cards → native Open modes when we host a real engine.
 * Everything else opens as an in-app embed of the production URL.
 */
export function nativeModeForZone(zoneId: string): AppMode | null {
  switch (zoneId) {
    case "brawler":
      return "brawl";
    case "voxgrudge-lab":
      // Thin Open lab only — full world embeds production SPA
      return "voxgrudge-native";
    case "characters":
      return "account";
    case "voxgrudge":
    case "minegrudge":
    case "mine-loader-live":
    case "lobby-island":
    case "water-island":
    case "dcq":
    case "racer":
    case "zombie":
    case "z-brawl":
      // Production fleet SPAs → in-app canvas (SSO handoff), not new tabs
      return null;
    default:
      return null;
  }
}

export function zoneById(id: string): GrudoxZone | undefined {
  return GRUDOX_ZONES.find((z) => z.id === id);
}

/** Build an embed session for a zone (production deep-link + poster art). */
export function embedSessionForZone(
  zoneId: string,
  ctx: LaunchContext,
  returnMode: AppMode = "zones",
): InAppEmbedSession | null {
  const zone = zoneById(zoneId);
  if (!zone) return null;
  const url = grudoxDeepLink(zoneId, {
    token: ctx.token,
    characterId: ctx.characterId,
  });
  return {
    id: zone.id,
    url,
    title: zone.title,
    tone: zone.tone,
    poster: zonePosterUrl(zone.id),
    returnMode,
  };
}

/** Poster path for zone cards — uses fleet rooms art when present. */
export function zonePosterUrl(zoneId: string): string {
  const key =
    zoneId === "brawler"
      ? "brawl"
      : zoneId === "voxgrudge"
        ? "voxgrudge"
        : zoneId === "minegrudge" || zoneId === "mine-loader-live"
          ? "library-mine"
          : zoneId === "lobby-island" || zoneId === "water-island"
            ? "lobby"
            : zoneId === "dcq"
              ? "mimic"
              : zoneId === "racer"
                ? "zones"
                : zoneId === "characters"
                  ? "library-account"
                  : "zones";
  return posterUrl(key);
}

/** Library entry → native mode when available. */
export function nativeModeForGame(game: GameEntry): AppMode | null {
  if ((game.launch === "native" || game.launch === "editor") && game.nativeMode) {
    return game.nativeMode;
  }
  return null;
}

/** Library entry → embed session for external / mine-loader titles. */
export function embedSessionForGame(
  game: GameEntry,
  ctx: LaunchContext,
  returnMode: AppMode = "doors",
): InAppEmbedSession | null {
  const native = nativeModeForGame(game);
  if (native) return null;
  const url = gameLaunchUrl(game, ctx);
  if (!url) return null;
  return {
    id: game.id,
    url,
    title: game.title,
    tone: game.tone,
    poster: posterUrl(game.posterKey),
    returnMode,
  };
}

/**
 * Fleet hosts we expect to allow embedding (or at least try).
 * If a host frames-blocks, InAppGameCanvas offers pop-out.
 */
export const EMBED_FRIENDLY_HOSTS = [
  "grudox.grudge-studio.com",
  "open.grudge-studio.com",
  "gameopen.vercel.app",
  "mine-loader.vercel.app",
  "voxgrudge.vercel.app",
  "dcq.grudge-studio.com",
  "dungeon-crawler-quest.vercel.app",
  "water.grudge-studio.com",
  "warlord-genesis.vercel.app",
  "drive.grudge-studio.com",
  "threejs-rapier-react-three-controll.vercel.app",
  "play.grudge-studio.com",
  "forge.grudge-studio.com",
  "grudgewarlords.com",
] as const;

export function isLikelyEmbeddable(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return EMBED_FRIENDLY_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h.replace(/^\*\./, "")}`),
    );
  } catch {
    return false;
  }
}

/** Loading VFX accent color for a tone hex. */
export function loadingParticleColor(tone?: string): string {
  return tone && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(tone) ? tone : "#5fe0ff";
}

/** Safe icon for canvas chrome. */
export function canvasBrandIcon(): string {
  return assetUrl("icons/rally.png");
}

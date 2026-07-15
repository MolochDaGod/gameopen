/**
 * Launch real Warlord Genesis (F:/GitHub/warlord-genesis → warlord-genesis.vercel.app)
 * from open.grudge-studio.com with Grudge ID + active character handoff.
 *
 * Open's old in-process "genesis" wave mini-mode is NOT the product SSOT.
 * Characters GRUDOX hands off via ?open=1&from=charactersgrudox + characterId/baseId.
 */

import { getStoredToken } from "./grudgeAuth";
import { gameSession } from "../game/GameSession";
import { baseIdToRaceKey } from "./grudoxRoster";

/** Production SPA — MOBA/RTS warcamp (lanes, units, turrets, fleet roster). */
export const WARLORD_GENESIS_ORIGIN = "https://warlord-genesis.vercel.app";

/** Canonical entry: lobby warcamp (character + deploy), not intro splash. */
export const WARLORD_GENESIS_ENTRY = `${WARLORD_GENESIS_ORIGIN}/lobby`;

export type GenesisLaunchOpts = {
  token?: string | null;
  characterId?: string | null;
  /** charactersgrudox base form id (explorer, race-human, …) */
  baseId?: string | null;
  characterName?: string | null;
  /** Race key for Genesis hydrate (human, orc, …) */
  raceId?: string | null;
  /** Handoff source — charactersgrudox | open | gameopen */
  from?: string | null;
  /** Path under origin — default /lobby */
  path?: string;
  /** window.open target; "_self" replaces the current tab */
  target?: "_blank" | "_self";
};

/**
 * Build SSO handoff URL for Warlord Genesis.
 * Params match fleet capture on the Genesis client (grudgeStudio + fleet hydrate).
 */
export function buildWarlordGenesisUrl(opts: GenesisLaunchOpts = {}): string {
  const token = opts.token ?? getStoredToken();
  const characterId =
    opts.characterId ?? gameSession.snapshot.selectedCharacterId ?? null;
  const ch = gameSession.selectedCharacter();
  const baseId =
    opts.baseId ??
    (typeof ch?.config?.baseId === "string" ? ch.config.baseId : null) ??
    (ch?.raceId ? `race-${ch.raceId}` : null);
  const characterName = opts.characterName ?? ch?.name ?? null;
  const raceId = opts.raceId ?? (baseId ? baseIdToRaceKey(baseId) : ch?.raceId) ?? null;
  let from = opts.from ?? null;
  if (!from && typeof sessionStorage !== "undefined") {
    try {
      from = sessionStorage.getItem("grudge.open.handoffFrom");
    } catch {
      /* */
    }
  }
  from = from || "open";
  const path = opts.path?.startsWith("/") ? opts.path : opts.path ? `/${opts.path}` : "/lobby";

  try {
    const u = new URL(`${WARLORD_GENESIS_ORIGIN.replace(/\/$/, "")}${path}`);
    u.searchParams.set("open", "1");
    u.searchParams.set("from", from);
    if (token) {
      // Dual-write: full session prefer sso_token; grudge_token for older capture paths
      u.searchParams.set("sso_token", token);
      u.searchParams.set("grudge_token", token);
    }
    if (characterId) {
      u.searchParams.set("characterId", characterId);
    }
    if (baseId) {
      u.searchParams.set("baseId", baseId);
    }
    if (characterName) {
      u.searchParams.set("characterName", characterName);
    }
    if (raceId) {
      u.searchParams.set("raceId", raceId);
    }
    return u.toString();
  } catch {
    return WARLORD_GENESIS_ENTRY;
  }
}

/** Open Genesis in a new tab (library default) or same tab (nav / door). */
export function launchWarlordGenesis(opts: GenesisLaunchOpts = {}): string {
  const url = buildWarlordGenesisUrl(opts);
  const target = opts.target ?? "_blank";
  if (typeof window !== "undefined") {
    if (target === "_self") {
      window.location.assign(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
  return url;
}

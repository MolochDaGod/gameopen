/**
 * Zone game play profiles — controllers, VFX, D1 packs for /zones in-app titles.
 */

import type { AppMode } from "./openRoutes";
import { assetsForZoneGame, type D1AssetRow } from "./d1AssetRegistry";

export interface ZonePlayProfile {
  zoneId: string;
  title: string;
  /** Prefer native Open engine. */
  nativeMode: AppMode | null;
  /** Danger Room–parity controller stack when native. */
  controller: "danger-room" | "embed" | "lab";
  /** Postprocessing when native 3D. */
  postfx: boolean;
  /** 2D gore/impact sprites on hits. */
  goreImpact: boolean;
  /** D1 categories to warm for this zone. */
  d1Hints: string[];
}

export const ZONE_PLAY_PROFILES: Record<string, ZonePlayProfile> = {
  brawler: {
    zoneId: "brawler",
    title: "Ruins Brawler",
    nativeMode: "brawl",
    controller: "danger-room",
    postfx: true,
    goreImpact: true,
    d1Hints: ["arena", "weapon", "vfx"],
  },
  survival: {
    zoneId: "survival",
    title: "Agama Survival",
    nativeMode: "survival",
    controller: "danger-room",
    postfx: true,
    goreImpact: true,
    d1Hints: ["agama", "weapon", "vfx"],
  },
  danger: {
    zoneId: "danger",
    title: "Danger Room",
    nativeMode: "danger",
    controller: "danger-room",
    postfx: true,
    goreImpact: true,
    d1Hints: ["grudge", "weapon", "vfx"],
  },
  genesis: {
    zoneId: "genesis",
    title: "Warlord Genesis",
    nativeMode: "genesis",
    controller: "danger-room",
    postfx: true,
    goreImpact: true,
    d1Hints: ["vfx", "character"],
  },
  voxgrudge: {
    zoneId: "voxgrudge",
    title: "VoxGrudge Lab",
    nativeMode: "voxgrudge-native",
    controller: "lab",
    postfx: false,
    goreImpact: false,
    d1Hints: ["world", "nature", "pack"],
  },
  minegrudge: {
    zoneId: "minegrudge",
    title: "Realms",
    nativeMode: "realms",
    controller: "embed",
    postfx: false,
    goreImpact: false,
    d1Hints: ["voxel", "world"],
  },
  racer: {
    zoneId: "racer",
    title: "Voxel Velocity",
    nativeMode: null,
    controller: "embed",
    postfx: false,
    goreImpact: false,
    d1Hints: ["road", "vehicle"],
  },
  zombie: {
    zoneId: "zombie",
    title: "Voxel Undead",
    nativeMode: null,
    controller: "embed",
    postfx: false,
    goreImpact: true,
    d1Hints: ["enemy", "vfx"],
  },
  "z-brawl": {
    zoneId: "z-brawl",
    title: "Z-Brawl",
    nativeMode: null,
    controller: "embed",
    postfx: false,
    goreImpact: true,
    d1Hints: ["vfx", "arena"],
  },
};

export function profileForZone(zoneId: string): ZonePlayProfile {
  return (
    ZONE_PLAY_PROFILES[zoneId] ?? {
      zoneId,
      title: zoneId,
      nativeMode: null,
      controller: "embed",
      postfx: false,
      goreImpact: false,
      d1Hints: ["vfx"],
    }
  );
}

/** Warm D1 registry for a zone (fire-and-forget). */
export function warmZoneD1Assets(zoneId: string): Promise<D1AssetRow[]> {
  return assetsForZoneGame(zoneId);
}

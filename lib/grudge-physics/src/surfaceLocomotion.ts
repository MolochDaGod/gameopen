/**
 * SurfaceLocomotion SSOT — one enum for feet/water/climb/vehicle state.
 *
 * Fleet pieces already exist separately:
 *   - dungeon water.ts → swim | ground
 *   - Controller wall-run / ledge probes
 *   - inventory mount / boat slots
 *   - dragon anim catalog (fly mount — incomplete)
 *
 * This module is the **shared contract** hosts and anim directors should use
 * so pathfinding, harvest Y, feet IK, and HUD (locoCam) stay consistent.
 *
 * Skills: grudge-production-world · grudge-player-and-grass · grudge6-toon-rts-mounts-siege
 */

import { LOCOMOTION, PLAYER_HEIGHT_M } from "./constants";

const WATER_DEFAULTS = {
  wadeDepthM: 0.9,
  swimDepthM: 0.6,
  humanHeightM: PLAYER_HEIGHT_M,
};

/** Canonical locomotion / vehicle surface modes. */
export type SurfaceLocomotionMode =
  | "ground"
  | "wade"
  | "swim"
  | "climb"
  | "wallRun"
  | "mount"
  | "boat"
  | "fly";

/** Vehicle sub-kind when mode is mount | boat | fly. */
export type VehicleKind =
  | "none"
  | "horse"
  | "cavalry"
  | "rowboat"
  | "ship"
  | "dragon"
  | "other";

export interface SurfaceLocomotionState {
  mode: SurfaceLocomotionMode;
  vehicle: VehicleKind;
  /** Terrain / water surface Y under feet (m, SI). */
  surfaceY: number;
  /** Water surface Y if known; null = dry / unknown. */
  waterY: number | null;
  /** Depth of body in water (m); 0 if dry. */
  waterDepthM: number;
  /** Wall-run / climb active. */
  onWall: boolean;
  /** Optional vehicle entity id (inventory / network). */
  vehicleId: string | null;
  /** Sample height function identity tag for debugging. */
  heightSource?: string;
}

export interface ResolveSurfaceInput {
  /** Feet world Y (m). */
  feetY: number;
  /** Feet XZ. */
  x: number;
  z: number;
  /** Terrain / ground sample at (x,z). Required. */
  sampleHeight: (x: number, z: number) => number | null;
  /** Optional water surface Y at (x,z); null if no water volume. */
  sampleWaterY?: (x: number, z: number) => number | null;
  /** Wall proximity (from probeWall / Rapier). */
  wallHit?: { dist: number } | null;
  /** Player requesting sprint / wall-run. */
  wantWallRun?: boolean;
  /** Airborne (not grounded). */
  airborne?: boolean;
  /** Explicit vehicle from inventory / mount system. */
  vehicle?: VehicleKind;
  vehicleId?: string | null;
  /** Max walkable slope etc. reserved for future. */
  wadeDepthM?: number;
  minSwimDepthM?: number;
}

export const SURFACE_LOCOMOTION_PRIORITY: SurfaceLocomotionMode[] = [
  "fly",
  "boat",
  "mount",
  "wallRun",
  "climb",
  "swim",
  "wade",
  "ground",
];

/**
 * Resolve mode from environment samples + vehicle intent.
 * Vehicles (fly/boat/mount) win over environmental water/ground when set.
 */
export function resolveSurfaceLocomotion(
  input: ResolveSurfaceInput,
): SurfaceLocomotionState {
  const terrainY = input.sampleHeight(input.x, input.z);
  const surfaceY =
    terrainY != null && Number.isFinite(terrainY) ? terrainY : input.feetY;
  const waterYRaw = input.sampleWaterY?.(input.x, input.z) ?? null;
  const waterY =
    waterYRaw != null && Number.isFinite(waterYRaw) ? waterYRaw : null;

  const wade = input.wadeDepthM ?? WATER_DEFAULTS.wadeDepthM;
  const swimMin = input.minSwimDepthM ?? WATER_DEFAULTS.swimDepthM;

  let waterDepthM = 0;
  if (waterY != null) {
    // Depth = water surface - feet (if feet below water surface)
    waterDepthM = Math.max(0, waterY - input.feetY);
  }

  const vehicle = input.vehicle && input.vehicle !== "none" ? input.vehicle : "none";
  const vehicleId = input.vehicleId ?? null;

  // 1) Explicit vehicles
  if (vehicle === "dragon" || vehicle === "other") {
    // dragon defaults to fly; other may be fly or mount — host decides
    if (vehicle === "dragon") {
      return pack("fly", vehicle, surfaceY, waterY, waterDepthM, false, vehicleId);
    }
  }
  if (vehicle === "rowboat" || vehicle === "ship") {
    return pack("boat", vehicle, surfaceY, waterY, waterDepthM, false, vehicleId);
  }
  if (vehicle === "horse" || vehicle === "cavalry") {
    return pack("mount", vehicle, surfaceY, waterY, waterDepthM, false, vehicleId);
  }

  // 2) Wall-run (airborne + wall + sprint intent)
  if (
    input.wantWallRun &&
    input.airborne &&
    input.wallHit &&
    input.wallHit.dist < LOCOMOTION.wallProbe
  ) {
    return pack(
      "wallRun",
      "none",
      surfaceY,
      waterY,
      waterDepthM,
      true,
      null,
    );
  }

  // 3) Water bands
  if (waterY != null && waterDepthM >= wade) {
    // deep enough to swim (past wade)
    return pack("swim", "none", surfaceY, waterY, waterDepthM, false, null);
  }
  if (waterY != null && waterDepthM >= swimMin) {
    return pack("wade", "none", surfaceY, waterY, waterDepthM, false, null);
  }

  // 4) Climb reserved for mantle / ladder hosts (ledge hit → host sets climb)
  // Default ground
  return pack("ground", "none", surfaceY, waterY, waterDepthM, false, null);
}

function pack(
  mode: SurfaceLocomotionMode,
  vehicle: VehicleKind,
  surfaceY: number,
  waterY: number | null,
  waterDepthM: number,
  onWall: boolean,
  vehicleId: string | null,
): SurfaceLocomotionState {
  return {
    mode,
    vehicle,
    surfaceY,
    waterY,
    waterDepthM,
    onWall,
    vehicleId,
  };
}

/** Map mode → AnimationDirector / HUD locoCam string. */
export function modeToLocoCam(
  mode: SurfaceLocomotionMode,
): "walk" | "swim" | "climb" | "mount" | "boat" | "fly" | "free" {
  switch (mode) {
    case "swim":
    case "wade":
      return "swim";
    case "climb":
    case "wallRun":
      return "climb";
    case "mount":
      return "mount";
    case "boat":
      return "boat";
    case "fly":
      return "fly";
    default:
      return "walk";
  }
}

/** Whether navmesh ground agents may stand here. */
export function allowsGroundNav(mode: SurfaceLocomotionMode): boolean {
  return mode === "ground" || mode === "wade" || mode === "mount";
}

/** Whether harvest nodes should use sampleHeight for Y. */
export function harvestUsesTerrainY(mode: SurfaceLocomotionMode): boolean {
  return mode !== "fly" && mode !== "boat" && mode !== "swim";
}

/** Recommended gravity scale vs full GRAVITY_Y. */
export function gravityScaleForMode(mode: SurfaceLocomotionMode): number {
  switch (mode) {
    case "swim":
      return 0.15;
    case "wade":
      return 0.55;
    case "wallRun":
    case "climb":
      return 0;
    case "fly":
      return 0.05;
    case "boat":
      return 0.2;
    case "mount":
      return 1;
    default:
      return 1;
  }
}

/**
 * Host integration sketch:
 *
 * ```ts
 * const state = resolveSurfaceLocomotion({
 *   feetY: player.y,
 *   x: player.x, z: player.z,
 *   sampleHeight: (x,z) => world.sampleTerrainY(x,z),
 *   sampleWaterY: (x,z) => world.sampleWaterSurfaceY(x,z),
 *   wallHit: probeWall(...),
 *   wantWallRun: sprint && !grounded,
 *   airborne: !grounded,
 *   vehicle: inventory.mount ? 'horse' : inventory.boat ? 'rowboat' : 'none',
 * });
 * animDirector.setLocoCam(modeToLocoCam(state.mode));
 * player.y = Math.max(player.y, state.surfaceY); // ground snap when ground/wade
 * ```
 */
export const SURFACE_LOCOMOTION_DOC = {
  version: 1,
  modes: [
    "ground",
    "wade",
    "swim",
    "climb",
    "wallRun",
    "mount",
    "boat",
    "fly",
  ] as const,
  heightContract:
    "sampleHeight(x,z) is L0 SSOT for feet, harvest Y, path agents, grass roots",
  waterContract:
    "sampleWaterY + depth vs wade/swim thresholds; boats need full water column",
  skills: [
    "grudge-production-world",
    "grudge-player-and-grass",
    "grudge6-toon-rts-mounts-siege",
  ],
} as const;

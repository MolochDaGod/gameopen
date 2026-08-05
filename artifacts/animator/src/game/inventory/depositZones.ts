/**
 * Quick-deposit illumination + Albion destination routing.
 *
 * At claim/camp → **camp storage** (RTS inventory stays at camp).
 * At home island warehouse → **home island bag** (account vault).
 * Boat → boat hold. Hidden chest/treasure open via lockpick + loot, not deposit.
 */

import type { DepositContext, DepositZoneKind } from "./types";
import type { StorageLocationKind } from "./locationInventory";

export interface DepositProbeInput {
  /** Player feet position. */
  x: number;
  y: number;
  z: number;
  /** Camp claim planted and player inside claim radius. */
  insideClaim?: boolean;
  /** Near camp structures / sandbox claim. */
  nearCamp?: boolean;
  /** On boat / sailtest deck. */
  onBoat?: boolean;
  /** Near chest / bank prop / home warehouse. */
  nearStorage?: boolean;
  /** Standing on home island (or home warehouse pad). */
  onHomeIsland?: boolean;
  /** Claim key for camp storage id. */
  claimKey?: string;
  /** Boat id when onBoat. */
  boatId?: string;
  /** Account id for home island bag. */
  accountId?: string;
}

export type DepositDestination = {
  kind: StorageLocationKind | "none";
  /** Location storage id when not home (home uses account inv). */
  locationId?: string;
  label: string;
};

/** Where bag deposit goes (Albion: location-bound). */
export function resolveDepositDestination(
  p: DepositProbeInput,
): DepositDestination {
  // Home island warehouse / pad beats field camp when both true
  if (p.onHomeIsland) {
    return {
      kind: "home_island",
      locationId: `home:${p.accountId || "local"}`,
      label: "Home island bag (shared account)",
    };
  }
  if (p.insideClaim || p.nearCamp) {
    const claim = p.claimKey || "default";
    return {
      kind: "camp",
      locationId: `camp:${claim}`,
      label: "Camp storage (RTS · stays at camp)",
    };
  }
  if (p.onBoat) {
    const boat = p.boatId || "default";
    return {
      kind: "boat",
      locationId: `boat:${boat}`,
      label: "Boat hold",
    };
  }
  if (p.nearStorage) {
    return {
      kind: "home_island",
      locationId: `home:${p.accountId || "local"}`,
      label: "Home island bag (shared account)",
    };
  }
  return { kind: "none", label: "No deposit zone" };
}

export function resolveDepositContext(p: DepositProbeInput): DepositContext {
  const dest = resolveDepositDestination(p);
  if (dest.kind === "none") {
    return {
      zone: "none",
      canDeposit: false,
      label: "Deposit (need camp · boat · home island)",
      destination: dest,
    };
  }
  const zone: DepositZoneKind =
    dest.kind === "camp"
      ? p.insideClaim
        ? "claim"
        : "camp"
      : dest.kind === "boat"
        ? "boat"
        : dest.kind === "home_island"
          ? "storage"
          : "none";
  return {
    zone,
    canDeposit: true,
    label: `Deposit → ${dest.label}`,
    destination: dest,
    /** Owner can also send camp → home from camp hub. */
    canSendToHome: dest.kind === "camp",
  };
}

export function depositZoneTone(zone: DepositZoneKind): string {
  switch (zone) {
    case "claim":
      return "#7ee7a8";
    case "boat":
      return "#6ec8ff";
    case "camp":
      return "#e8c96a";
    case "storage":
      return "#c9a0ff";
    default:
      return "#666";
  }
}

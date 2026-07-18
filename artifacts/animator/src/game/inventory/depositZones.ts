/**
 * Quick-deposit illumination: claim radius, camp, boat, storage.
 */

import type { DepositContext, DepositZoneKind } from "./types";

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
  /** Near chest / bank prop. */
  nearStorage?: boolean;
}

export function resolveDepositContext(p: DepositProbeInput): DepositContext {
  if (p.insideClaim) {
    return { zone: "claim", canDeposit: true, label: "Deposit to account · Claim" };
  }
  if (p.onBoat) {
    return { zone: "boat", canDeposit: true, label: "Deposit to account · Boat hold" };
  }
  if (p.nearCamp) {
    return { zone: "camp", canDeposit: true, label: "Deposit to account · Camp" };
  }
  if (p.nearStorage) {
    return { zone: "storage", canDeposit: true, label: "Deposit to account · Storage" };
  }
  return { zone: "none", canDeposit: false, label: "Deposit (need claim / camp / boat)" };
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

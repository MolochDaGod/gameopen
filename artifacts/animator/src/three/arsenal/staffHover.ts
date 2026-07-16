/**
 * Per-staff hover foot FX — spinning disc / wind / arcane ring under the caster
 * while double-jump levitation is active. Ice staff deliberately has no hover.
 */
import type { StaffElement } from "../types";
import { ELEMENT_THEME } from "./elements";

export type StaffHoverStyle =
  | "arcane"
  | "wind"
  | "storm"
  | "nature"
  | "holy"
  | "fire"
  | "none";

export interface StaffHoverTheme {
  style: StaffHoverStyle;
  color: number;
  /** Secondary tint for disc rim / particles */
  accent: number;
  /** True when this staff double-jump should NOT levitate */
  noFloat: boolean;
  label: string;
}

const ARCANE: StaffHoverTheme = {
  style: "arcane",
  color: 0xb98cff,
  accent: 0xe8d0ff,
  noFloat: false,
  label: "Arcane disc",
};

/** Hover theme from equipped weapon element (null → plain arcane staff). */
export function staffHoverTheme(element: StaffElement | undefined | null): StaffHoverTheme {
  if (!element) return ARCANE;
  const t = ELEMENT_THEME[element];
  switch (element) {
    case "fire":
      return { style: "fire", color: t.color, accent: 0xffd080, noFloat: false, label: "Flame disc" };
    case "ice":
      // Tank ice mage — grounded only; frost burst on double-jump, no hover.
      return { style: "none", color: t.color, accent: 0xe8f7ff, noFloat: true, label: "Grounded frost" };
    case "storm":
      return { style: "wind", color: t.color, accent: 0xd8c0ff, noFloat: false, label: "Wind disc" };
    case "nature":
      return { style: "nature", color: t.color, accent: 0xc8ffb0, noFloat: false, label: "Bloom disc" };
    case "holy":
      return { style: "holy", color: t.color, accent: 0xfff6c8, noFloat: false, label: "Radiant disc" };
    default:
      return ARCANE;
  }
}

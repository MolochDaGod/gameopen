/**
 * Attachment-card model — distilled from
 * `three-js-basic-character-customisation` (CodePen / voxgrudge-fresh).
 *
 * Outline of the demo pattern we adopt:
 *
 *  1. **Slot card** (`.attachment`) — fixed % position over the character viewport
 *     (weapon at hand, legs at feet). Shows ＋ / rotates to ✕ when open.
 *  2. **Option strip** (`.attachment-options`) — sibling cards that fan out
 *     next to the slot; each option is an icon card.
 *  3. **apply(slot, optionId)** — swaps the equipped piece and rebuilds the
 *     visual (demo: full scene redraw; we call studio equip callbacks).
 *  4. **One open menu at a time** — toggling a slot closes others.
 *
 * Card kinds for Grudge Open:
 *  - **player**  — local loadout (Main Hand, Off-Hand, future armor)
 *  - **unit**    — party / ally frame equipment teaser
 *  - **character**— roster create/edit (race + class kit from charactersgrudox)
 */

export type AttachmentCardKind = "player" | "unit" | "character";

/** Viewport-normalized anchor (0–100%) for overlay cards. */
export type CardAnchor = {
  /** left % of host */
  x: number;
  /** top % of host */
  y: number;
  /** which side options fan toward */
  fan: "left" | "right" | "up" | "down";
};

export type AttachmentOption = {
  id: string;
  label: string;
  /** Icon key for <Icon /> or emoji fallback */
  icon?: string;
  /** Optional color accent */
  tone?: string;
  /** Disabled (locked / ineligible) */
  disabled?: boolean;
};

export type AttachmentSlotDef = {
  id: string;
  label: string;
  anchor: CardAnchor;
  options: AttachmentOption[];
  /** Currently equipped option id, or null for empty */
  equippedId: string | null;
  /** Empty-state label */
  emptyLabel?: string;
};

/**
 * Default player anchors — mirror the demo's weapon (arm) + legs (lower body)
 * hotspots, plus off-hand and head for a full container set.
 */
export const PLAYER_SLOT_ANCHORS: Record<string, CardAnchor> = {
  weapon: { x: 34, y: 36, fan: "left" },
  offhand: { x: 62, y: 38, fan: "right" },
  head: { x: 48, y: 12, fan: "down" },
  body: { x: 48, y: 48, fan: "right" },
  legs: { x: 55, y: 72, fan: "right" },
};

/** Compact unit-frame anchors (smaller HUD portrait). */
export const UNIT_SLOT_ANCHORS: Record<string, CardAnchor> = {
  weapon: { x: 18, y: 40, fan: "right" },
  head: { x: 50, y: 15, fan: "down" },
  body: { x: 50, y: 55, fan: "right" },
};

/** Character-create panel anchors (centered preview). */
export const CHARACTER_SLOT_ANCHORS: Record<string, CardAnchor> = {
  race: { x: 50, y: 18, fan: "down" },
  weapon: { x: 28, y: 42, fan: "left" },
  armor: { x: 72, y: 42, fan: "right" },
  legs: { x: 50, y: 78, fan: "up" },
};

export function anchorsForKind(kind: AttachmentCardKind): Record<string, CardAnchor> {
  if (kind === "unit") return UNIT_SLOT_ANCHORS;
  if (kind === "character") return CHARACTER_SLOT_ANCHORS;
  return PLAYER_SLOT_ANCHORS;
}

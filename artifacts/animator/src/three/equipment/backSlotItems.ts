/**
 * Back slot = **effect slot** (one equip, not two radials).
 *
 * Product SSOT: items worn on the back *are* the effects — mobility / open-world
 * resources and combat-relevant utilities. Many are planned; only a subset is coded.
 *
 * Runtime wing mesh modes live in {@link ./WingBackRig} (`BACK_SLOT_WING_ITEMS`).
 * This catalog is the wider item SSOT (HUD, radial, bag, future craft).
 */

export type BackSlotDomain = "mobility" | "ocean" | "combat" | "stealth" | "utility";

export type BackSlotStatus = "coded" | "planned";

export type BackSlotItemDef = {
  id: string;
  label: string;
  /** Short effect blurb */
  effect: string;
  domains: BackSlotDomain[];
  status: BackSlotStatus;
  /**
   * When coded: maps to WingBackRig equip id (if wing-driven).
   * Non-wing effects use the same back slot later (shell, stealth, …).
   */
  wingItemId?: string;
};

/**
 * Canonical back-slot catalog.
 * Do not invent a separate "effect slot" radial — equip here.
 */
export const BACK_SLOT_ITEMS: BackSlotItemDef[] = [
  // ── Coded (WingBackRig) ───────────────────────────────────────────
  {
    id: "back_wing_pack",
    label: "Wing Pack",
    effect: "Stowed back pack (circle) — base for deployables",
    domains: ["mobility", "utility"],
    status: "coded",
    wingItemId: "back_wing_pack",
  },
  {
    id: "back_parachute",
    label: "Parachute",
    effect: "Slow descent / fall soft",
    domains: ["mobility"],
    status: "coded",
    wingItemId: "back_parachute",
  },
  {
    id: "back_glider",
    label: "Glider",
    effect: "Horizontal glide from height",
    domains: ["mobility", "utility"],
    status: "coded",
    wingItemId: "back_glider",
  },
  {
    id: "back_flight_rig",
    label: "Flight Rig",
    effect: "Powered lift / flight skill",
    domains: ["mobility", "combat"],
    status: "coded",
    wingItemId: "back_flight_rig",
  },
  {
    id: "back_sail_deploy",
    label: "Deployable Sail",
    effect: "Ocean sail / waterboard couple",
    domains: ["ocean", "mobility"],
    status: "coded",
    wingItemId: "back_sail_deploy",
  },
  // ── Planned (catalog only — not all coded yet) ────────────────────
  {
    id: "back_wind_surf",
    label: "Wind Surf",
    effect:
      "Deploy vehicle (casting.grudge-studio.com windsurf_package) — parent seat + RideIK until get-off",
    domains: ["mobility", "ocean"],
    // Lab vehicle: CastingAbilitiesThreeJS WalkController + HoverboardRide + RideIK
    status: "coded",
    wingItemId: undefined,
  },
  {
    id: "back_hover",
    label: "Hover Rig",
    effect: "Short hover / soft land",
    domains: ["mobility", "utility"],
    status: "planned",
  },
  {
    id: "back_protective_shell",
    label: "Protective Shell",
    effect: "Damage absorb / bubble while active",
    domains: ["combat", "utility"],
    status: "planned",
  },
  {
    id: "back_invisibility",
    label: "Cloak Pack",
    effect: "Go invisible (stealth windows)",
    domains: ["stealth", "combat"],
    status: "planned",
  },
];

export function backSlotItem(id: string): BackSlotItemDef | undefined {
  return BACK_SLOT_ITEMS.find((i) => i.id === id);
}

export function codedBackSlotItems(): BackSlotItemDef[] {
  return BACK_SLOT_ITEMS.filter((i) => i.status === "coded");
}

export function plannedBackSlotItems(): BackSlotItemDef[] {
  return BACK_SLOT_ITEMS.filter((i) => i.status === "planned");
}

/** Cycle equip order for Hold-R → Back (coded only until planned ships). */
export function nextCodedBackSlotId(current: string | null | undefined): string {
  const coded = codedBackSlotItems();
  if (!coded.length) return "back_wing_pack";
  const i = coded.findIndex((c) => c.id === current);
  const next = coded[(i + 1) % coded.length]!;
  return next.id;
}

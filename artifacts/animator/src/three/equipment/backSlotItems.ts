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
  /** Stow GLB on spine (windsurf pack). */
  stowUrl?: string;
  deployUrl?: string;
  /** SI longest-axis length of the stowed mesh (Casting BackSlotEquip). */
  stowLengthM?: number;
  /** Local offset on spine [x,y,z] metres. */
  stowOffset?: [number, number, number];
  /** Local euler degrees. */
  stowEulerDeg?: [number, number, number];
  /** Casting waterBuffs (shark fin). */
  waterBuffs?: { swimSpeedMul: number; sharkAggroImmune: boolean; breatheUnderwater: boolean };
  /** Unity cape variant (default / long / wide). */
  capeVariant?: "default" | "long" | "wide";
};

/** Paperdoll / mesh_ids tag for a back item. */
export function backEquipId(itemId: string): string {
  return itemId.startsWith("equip:back:") ? itemId : `equip:back:${itemId.replace(/^back_/, "")}`;
}

export function backItemIdFromEquip(tag: string): string | null {
  if (tag.startsWith("equip:back:")) {
    const slug = tag.slice("equip:back:".length);
    const withPrefix = slug.startsWith("back_") ? slug : `back_${slug}`;
    if (backSlotItem(withPrefix)) return withPrefix;
    if (backSlotItem(slug)) return slug;
    return withPrefix;
  }
  if (tag.startsWith("back_") && backSlotItem(tag)) return tag;
  return null;
}

export function paperdollBackIds(): string[] {
  return codedBackSlotItems().map((i) => backEquipId(i.id));
}

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
      "Water-only vehicle — stow back_fly_windsurf.glb; deploy windsurf_package (Casting ride SSOT)",
    domains: ["mobility", "ocean"],
    status: "coded",
    wingItemId: undefined,
    stowUrl: "models/ride/back_fly_windsurf.glb",
    deployUrl: "models/ride/windsurf_package.glb",
    stowLengthM: 0.58,
    stowOffset: [0.02, 0.06, -0.14],
    stowEulerDeg: [8, 180, 0],
  },
  {
    id: "back_shark_fin",
    label: "Shark Fin",
    effect: "2× swim · no shark aggro · breathe underwater (Casting waterBuffs)",
    domains: ["ocean", "utility"],
    status: "coded",
    wingItemId: undefined,
    stowUrl: "models/ride/shark_fin.glb",
    stowLengthM: 0.55,
    stowOffset: [0.0, 0.12, -0.18],
    stowEulerDeg: [15, 180, 0],
    waterBuffs: { swimSpeedMul: 2, sharkAggroImmune: true, breatheUnderwater: true },
  },
  {
    id: "back_holy_wings",
    label: "Holy Wings",
    effect: "Jump → glide down (wing type 1)",
    domains: ["mobility"],
    status: "coded",
    wingItemId: "back_holy_wings",
  },
  {
    id: "back_traveler_wings",
    label: "Traveler's Wings",
    effect: "Double-jump fly pose · two flaps · then glide (wing type 2)",
    domains: ["mobility"],
    status: "coded",
    wingItemId: "back_traveler_wings",
  },
  {
    id: "back_cape",
    label: "Cape",
    effect: "Land cloth back — Unity Empty/default cape",
    domains: ["utility"],
    status: "coded",
    wingItemId: undefined,
    capeVariant: "default",
  },
  {
    id: "back_cape_long",
    label: "Long Cape",
    effect: "Unity Long Cape 1 — longer hem",
    domains: ["utility"],
    status: "coded",
    wingItemId: undefined,
    capeVariant: "long",
  },
  {
    id: "back_cape_wide",
    label: "Wide Cape",
    effect: "Unity Wide Cape 1 — broader shoulders",
    domains: ["utility"],
    status: "coded",
    wingItemId: undefined,
    capeVariant: "wide",
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

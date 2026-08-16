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

/** How the item is used — existing keys only (see BACK_SLOT_PREFAB.md). */
export type BackUseKind = "passive" | "hotkey" | "deploy";

export type BackSlotItemDef = {
  id: string;
  label: string;
  /** Short effect blurb */
  effect: string;
  domains: BackSlotDomain[];
  status: BackSlotStatus;
  /** content/backs/bck_*.json */
  prefabId?: string;
  useKind?: BackUseKind;
  /** Existing controller key: Space (jump/air) or E (get-off). Never combat R. */
  useKey?: "Space" | "E" | null;
  useHint?: string;
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
  /** Dedicated wing GLB (holy / traveler tiers) — WingBackRig, not a second attach. */
  meshUrl?: string;
  /** Multipack root to keep visible (gorilla traveler variants). */
  isolateName?: string;
  /** SI wingspan after normalize (holy ~2 m, traveler ~1.6 m). */
  wingSpanM?: number;
  /** Traveler wardrobe tier 1–3 (same pack, better flight). */
  flightTier?: 1 | 2 | 3;
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

/** Verified 200 on assets.grudge-studio.com (HEAD 2026-08-16). */
export const BACK_PACK_ICON: Record<string, string> = {
  back_wing_pack: "icons/pack/misc/Effect.png",
  back_parachute: "icons/pack/misc/Flow.png",
  back_glider: "icons/pack/misc/Flow.png",
  back_flight_rig: "icons/pack/misc/Chaos_2.png",
  back_sail_deploy: "icons/pack/misc/Flow.png",
  back_wind_surf: "icons/pack/misc/Flow.png",
  back_shark_fin: "icons/pack/misc/Flow.png",
  back_holy_wings: "icons/pack/misc/Naturecircle.png",
  back_traveler_wings: "icons/pack/misc/Chaos_2.png",
  back_traveler_wings_t2: "icons/pack/misc/Effect.png",
  back_traveler_wings_t3: "icons/pack/misc/Slash_07.png",
  back_cape: "icons/pack/weapons/Shield_01.png",
  back_cape_long: "icons/pack/weapons/Shield_01.png",
  back_cape_wide: "icons/pack/weapons/Shield_01.png",
  back_quiver: "icons/pack/weapons/Bow_01.png",
  "back:quiver": "icons/pack/weapons/Bow_01.png",
  back_bag: "icons/pack/misc/Effect.png",
  "back:bag": "icons/pack/misc/Effect.png",
  back_wood: "icons/pack/misc/Slash_07.png",
  "back:wood": "icons/pack/misc/Slash_07.png",
  back_hover: "icons/pack/misc/Flow.png",
  back_protective_shell: "icons/pack/weapons/Shield_01.png",
  back_invisibility: "icons/pack/misc/Chaos_2.png",
};

const CDN = "https://assets.grudge-studio.com";

export function backRuntimeFromAnyId(id: string): string {
  const s = String(id || "");
  if (s.startsWith("equip:back:")) return `back_${s.slice("equip:back:".length)}`;
  if (s.startsWith("itm_back_")) return `back_${s.slice("itm_back_".length)}`;
  if (s.startsWith("bck_")) return `back_${s.slice("bck_".length)}`;
  if (s.startsWith("rcp_back_")) return `back_${s.slice("rcp_back_".length)}`;
  return s;
}

export function backItemIconPath(id: string): string {
  if (BACK_PACK_ICON[id]) return BACK_PACK_ICON[id]!;
  const runtime = backRuntimeFromAnyId(id);
  return BACK_PACK_ICON[runtime] || "icons/pack/misc/Effect.png";
}

export function backItemIconUrl(id: string): string {
  return `${CDN}/${backItemIconPath(id)}`;
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
    prefabId: "bck_wing_pack",
    useKind: "passive",
    useKey: null,
    useHint: "Visual pack only",
    wingItemId: "back_wing_pack",
  },
  {
    id: "back_parachute",
    label: "Parachute",
    effect: "Slow descent / fall soft",
    domains: ["mobility"],
    status: "coded",
    prefabId: "bck_parachute",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Airborne Space — high drag, slow fall",
    wingItemId: "back_parachute",
  },
  {
    id: "back_glider",
    label: "Glider",
    effect: "Horizontal glide from height",
    domains: ["mobility", "utility"],
    status: "coded",
    prefabId: "bck_glider",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Airborne Space — glide",
    wingItemId: "back_glider",
  },
  {
    id: "back_flight_rig",
    label: "Flight Rig",
    effect: "Powered lift / flight skill",
    domains: ["mobility", "combat"],
    status: "coded",
    prefabId: "bck_flight_rig",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Airborne Space — lift",
    wingItemId: "back_flight_rig",
  },
  {
    id: "back_sail_deploy",
    label: "Deployable Sail",
    effect: "Ocean sail / waterboard couple",
    domains: ["ocean", "mobility"],
    status: "coded",
    prefabId: "bck_sail_deploy",
    useKind: "deploy",
    useKey: "Space",
    useHint: "Sailtest wind + airborne sail mode",
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
    prefabId: "bck_wind_surf",
    useKind: "deploy",
    useKey: "Space",
    useHint: "Space on water deploy · E get-off",
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
    prefabId: "bck_shark_fin",
    useKind: "passive",
    useKey: null,
    useHint: "Always on in water",
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
    effect: "Jump → glide (SZ_Wing_233 Stand / Run)",
    domains: ["mobility"],
    status: "coded",
    prefabId: "bck_holy_wings",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Space jump → glide · Stand on land · Run in air",
    wingItemId: "back_holy_wings",
    meshUrl: "models/ride/wings/holy_wings.glb",
    wingSpanM: 2.0,
  },
  {
    id: "back_traveler_wings",
    label: "Traveler's Wings I",
    effect: "T1 fire-wing wardrobe · double-jump fly · two flaps · glide",
    domains: ["mobility"],
    status: "coded",
    prefabId: "bck_traveler_wings",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Air Space = fly · Space again = flap (max 2)",
    wingItemId: "back_traveler_wings",
    meshUrl: "models/ride/wings/traveler_wings_variants.glb",
    isolateName: "FireWings_Wardrobe Variant_2",
    wingSpanM: 1.55,
    flightTier: 1,
  },
  {
    id: "back_traveler_wings_t2",
    label: "Traveler's Wings II",
    effect: "T2 fire-wing wardrobe · faster glide than T1",
    domains: ["mobility"],
    status: "coded",
    prefabId: "bck_traveler_wings_t2",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Same Space flaps as T1 · better glide",
    wingItemId: "back_traveler_wings_t2",
    meshUrl: "models/ride/wings/traveler_wings_variants.glb",
    isolateName: "FireWings_Wardrobe Variant.001_5",
    wingSpanM: 1.65,
    flightTier: 2,
  },
  {
    id: "back_traveler_wings_t3",
    label: "Traveler's Wings III",
    effect: "T3 fire-wing wardrobe · longest glide / most lift",
    domains: ["mobility"],
    status: "coded",
    prefabId: "bck_traveler_wings_t3",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Same Space flaps as T1 · best glide",
    wingItemId: "back_traveler_wings_t3",
    meshUrl: "models/ride/wings/traveler_wings_variants.glb",
    isolateName: "FireWings_Wardrobe Variant.002_8",
    wingSpanM: 1.75,
    flightTier: 3,
  },
  {
    id: "back_cape",
    label: "Cape",
    effect: "Land cloth back — Unity Empty/default cape",
    domains: ["utility"],
    status: "coded",
    prefabId: "bck_cape",
    useKind: "passive",
    useKey: null,
    useHint: "Always on",
    wingItemId: undefined,
    capeVariant: "default",
  },
  {
    id: "back_cape_long",
    label: "Long Cape",
    effect: "Unity Long Cape 1 — longer hem",
    domains: ["utility"],
    status: "coded",
    prefabId: "bck_cape_long",
    useKind: "passive",
    useKey: null,
    useHint: "Always on",
    wingItemId: undefined,
    capeVariant: "long",
  },
  {
    id: "back_cape_wide",
    label: "Wide Cape",
    effect: "Unity Wide Cape 1 — broader shoulders",
    domains: ["utility"],
    status: "coded",
    prefabId: "bck_cape_wide",
    useKind: "passive",
    useKey: null,
    useHint: "Always on",
    wingItemId: undefined,
    capeVariant: "wide",
  },
  {
    id: "back_hover",
    label: "Hover Rig",
    effect: "Short hover / soft land",
    domains: ["mobility", "utility"],
    status: "planned",
    prefabId: "bck_hover",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Planned — Space hover",
  },
  {
    id: "back_protective_shell",
    label: "Protective Shell",
    effect: "Damage absorb / bubble while active",
    domains: ["combat", "utility"],
    status: "planned",
    prefabId: "bck_protective_shell",
    useKind: "passive",
    useKey: null,
    useHint: "Planned — absorb while equipped",
  },
  {
    id: "back_invisibility",
    label: "Cloak Pack",
    effect: "Go invisible (stealth windows)",
    domains: ["stealth", "combat"],
    status: "planned",
    prefabId: "bck_invisibility",
    useKind: "hotkey",
    useKey: "Space",
    useHint: "Planned — Space stealth pulse",
  },
];

/** HUD line: PASSIVE · or Space · hint */
export function backUseLegend(def: BackSlotItemDef): string {
  if (def.useKind === "passive" || !def.useKey) return `PASSIVE · ${def.useHint || def.effect}`;
  return `${def.useKey} · ${def.useHint || def.effect}`;
}

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

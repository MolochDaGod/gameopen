/**
 * Albion-style location inventory — items stay where deposited until moved.
 *
 * SSOT layers (do not invent a second bag):
 *   · Character bag 3×3 — carry only (existing characterBag)
 *   · home_island — account inventory / Railway shared vault (existing)
 *   · camp — claim-flag camp storage (RTS play draws from here)
 *   · boat / dungeon / contested / enemy / hidden loot — world location stores
 *
 * ## Lockpick law (product)
 * - **Home islands = SAFE** — never lockpickable (no steal UI, force DC 0).
 * - **Lockpickable:** dungeons, treasures found in-game, chests in contested
 *   areas, enemy territory, conquered-island enemy areas, foreign camps.
 * - Own camp / own boat: open free (no pick). Foreign camp: lockpick.
 *
 * RTS spends camp storage. Transfer camp → home_island to share fleet-wide.
 */

import type { AccountInventoryState, ItemInstance } from "./types";
import {
  depositInstances,
  loadAccountInventory,
  saveAccountInventory,
  pushAccountResources,
} from "./accountInventory";
import { readFleetToken } from "../../auth/fleetCore";

export type StorageLocationKind =
  | "home_island"
  | "camp"
  | "boat"
  | "hidden_chest"
  | "hidden_treasure"
  | "dungeon_chest"
  | "contested_chest"
  | "enemy_chest"
  | "conquered_chest";

/**
 * World zone tag for placement (map/instance).
 * home_island is always safe; everything else in this list can host locks.
 */
export type WorldLootZone =
  | "home_island"
  | "dungeon"
  | "open_world"
  | "contested"
  | "enemy"
  | "conquered"
  | "camp_foreign"
  | "camp_own";

export interface LocationStorageState {
  /** Stable id: camp:<claimKey>, boat:<id>, hchest:<pin>, treasure:<pin>, home:<accountId> */
  locationId: string;
  kind: StorageLocationKind;
  /** Owner account; null = world / unclaimed loot */
  ownerAccountId: string | null;
  /** Display label for UI */
  label: string;
  resources: Record<string, number>;
  items: ItemInstance[];
  /**
   * Lockpick difficulty 0–100.
   * **Always 0 on home_island** (safe zone — never lockpick).
   * Dungeon / contested / enemy / treasure / foreign camp use >0.
   */
  lockDifficulty: number;
  /** After successful bust until owner relocks / restock */
  lockBusted?: boolean;
  /** Placement zone (for lockpick policy) */
  zone?: WorldLootZone;
  /** World pin for map / stealth */
  pos?: { x: number; y: number; z: number };
  updatedAt: number;
}

/** Kinds that may be lockpicked when not owned / not home. */
export const LOCKPICKABLE_STORAGE_KINDS: readonly StorageLocationKind[] = [
  "hidden_chest",
  "hidden_treasure",
  "dungeon_chest",
  "contested_chest",
  "enemy_chest",
  "conquered_chest",
  "camp", // only foreign — see isLockpickAllowed
] as const;

/** Default DC by zone / kind (product tuning). */
export const LOCKPICK_DEFAULT_DC: Record<string, number> = {
  dungeon: 35,
  dungeon_chest: 35,
  hidden_chest: 28,
  hidden_treasure: 48,
  contested: 40,
  contested_chest: 40,
  enemy: 55,
  enemy_chest: 55,
  conquered: 42,
  conquered_chest: 42,
  camp_foreign: 55,
  open_world: 30,
};

const storeKey = (locationId: string) =>
  `grudge:loc-inv:v1:${locationId || "unknown"}`;

/** Canonical location ids. */
export function homeIslandLocationId(accountId = "local"): string {
  return `home:${accountId || "local"}`;
}

export function campLocationId(claimKey: string): string {
  return `camp:${claimKey || "default"}`;
}

/**
 * Stable claim key for a hero — same key for deposit, camp Storage page, Studio probe.
 * Avoids "local_claim" vs "default" desync that emptied the wrong vault.
 */
export function claimKeyForCharacter(characterId: string | null | undefined): string {
  const id = (characterId || "guest").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 64);
  return `claim_${id || "guest"}`;
}

/** Account vault key: grudgeId when signed in, else guest/local. */
export function accountIdForVault(
  grudgeId: string | null | undefined,
  fallback = "guest",
): string {
  const g = (grudgeId || "").trim();
  if (g) return g;
  return fallback || "guest";
}

/** Vehicle stash — same location as boat hold (`boat:<id>`). Not a second bag. */
export const BOAT_STASH_PREFIX = "boat:";

export function boatLocationId(boatId: string): string {
  return `${BOAT_STASH_PREFIX}${boatId || "default"}`;
}

export function isBoatStashLocation(locationId: string, kind?: StorageLocationKind | string | null): boolean {
  if (kind === "boat") return true;
  return String(locationId || "").startsWith(BOAT_STASH_PREFIX);
}

/**
 * Stash is a vehicle compartment at sea.
 * It becomes bag/account inventory only at a safe dock, home island, or friendly dock.
 */
export type StashUnloadDock = "home_island" | "safe_dock" | "friendly_dock" | "none";

export function resolveStashUnloadDock(p: {
  onHomeIsland?: boolean;
  atSafeDock?: boolean;
  atFriendlyDock?: boolean;
}): StashUnloadDock {
  if (p.onHomeIsland) return "home_island";
  if (p.atSafeDock) return "safe_dock";
  if (p.atFriendlyDock) return "friendly_dock";
  return "none";
}

export function canConvertBoatStashToInventory(dock: StashUnloadDock): boolean {
  return dock === "home_island" || dock === "safe_dock" || dock === "friendly_dock";
}

export function hiddenChestLocationId(pinId: string): string {
  return `hchest:${pinId}`;
}

export function hiddenTreasureLocationId(pinId: string): string {
  return `treasure:${pinId}`;
}

/** True when this store is the safe home-island bag (never lockpick). */
export function isHomeIslandStorage(
  locationId: string,
  kind?: StorageLocationKind | string | null,
): boolean {
  if (kind === "home_island") return true;
  if (locationId.startsWith("home:")) return true;
  return false;
}

/**
 * Product law: may the player start a lockpick on this target?
 * Home island → always false. Own storage → false (open free). Else zone/kind.
 */
export function isLockpickAllowed(opts: {
  locationId: string;
  kind: StorageLocationKind | string;
  ownerAccountId?: string | null;
  viewerAccountId?: string | null;
  zone?: WorldLootZone | string | null;
  lockDifficulty?: number;
}): { allowed: boolean; reason: string; defaultDc: number } {
  const {
    locationId,
    kind,
    ownerAccountId,
    viewerAccountId,
    zone,
    lockDifficulty = 0,
  } = opts;

  // 1) Home islands are SAFE — no lockpick ever
  if (isHomeIslandStorage(locationId, kind) || zone === "home_island") {
    return {
      allowed: false,
      reason: "home_island_safe",
      defaultDc: 0,
    };
  }

  // 2) Own camp / own boat — free open, no pick
  if (
    ownerAccountId &&
    viewerAccountId &&
    ownerAccountId === viewerAccountId &&
    (kind === "camp" || kind === "boat" || zone === "camp_own")
  ) {
    return {
      allowed: false,
      reason: "own_storage",
      defaultDc: 0,
    };
  }

  // 3) Explicit safe if DC 0 and already unlocked world prop
  if (lockDifficulty <= 0 && zone !== "enemy" && zone !== "contested") {
    // World loot with no lock still may be "open" containers
    if (
      kind === "camp" &&
      ownerAccountId &&
      viewerAccountId &&
      ownerAccountId !== viewerAccountId
    ) {
      return {
        allowed: true,
        reason: "foreign_camp",
        defaultDc: LOCKPICK_DEFAULT_DC.camp_foreign ?? 55,
      };
    }
  }

  // 4) Lockpickable zones / kinds
  const lockpickZones = new Set([
    "dungeon",
    "contested",
    "enemy",
    "conquered",
    "camp_foreign",
    "open_world",
  ]);
  const kindOk =
    LOCKPICKABLE_STORAGE_KINDS.includes(kind as StorageLocationKind) ||
    kind === "container" ||
    kind === "door";
  const zoneOk = zone ? lockpickZones.has(String(zone)) : kindOk;

  if (zoneOk || kindOk) {
    const dcKey = String(zone || kind);
    const defaultDc =
      LOCKPICK_DEFAULT_DC[dcKey] ??
      LOCKPICK_DEFAULT_DC[String(kind)] ??
      Math.max(lockDifficulty, 28);
    return {
      allowed: true,
      reason: "lockpickable_zone",
      defaultDc,
    };
  }

  return {
    allowed: false,
    reason: "not_lockpickable",
    defaultDc: 0,
  };
}

/** Force home island rows to DC 0 (safe). */
export function enforceHomeIslandSafe(
  st: LocationStorageState,
): LocationStorageState {
  if (!isHomeIslandStorage(st.locationId, st.kind)) return st;
  return {
    ...st,
    kind: "home_island",
    lockDifficulty: 0,
    lockBusted: false,
    zone: "home_island",
  };
}

export function newLocationStorage(
  locationId: string,
  kind: StorageLocationKind,
  opts?: Partial<
    Pick<
      LocationStorageState,
      "ownerAccountId" | "label" | "lockDifficulty" | "pos" | "zone"
    >
  >,
): LocationStorageState {
  const home = isHomeIslandStorage(locationId, kind);
  const zone = home ? "home_island" : opts?.zone;
  let lockDifficulty = home
    ? 0
    : (opts?.lockDifficulty ??
      (zone ? LOCKPICK_DEFAULT_DC[zone] : undefined) ??
      (LOCKPICK_DEFAULT_DC[kind] ?? 0));
  if (home) lockDifficulty = 0;

  const defaultLabel =
    kind === "home_island"
      ? "Home island bag"
      : kind === "camp"
        ? "Camp storage"
        : kind === "boat"
          ? "Boat stash"
          : kind === "dungeon_chest"
            ? "Dungeon chest"
            : kind === "contested_chest"
              ? "Contested chest"
              : kind === "enemy_chest"
                ? "Enemy chest"
                : kind === "conquered_chest"
                  ? "Conquered island chest"
                  : kind === "hidden_chest"
                    ? "Hidden chest"
                    : "Hidden treasure";

  return {
    locationId,
    kind: home ? "home_island" : kind,
    ownerAccountId: opts?.ownerAccountId ?? null,
    label: opts?.label ?? defaultLabel,
    resources: {},
    items: [],
    lockDifficulty,
    zone,
    pos: opts?.pos,
    updatedAt: Date.now(),
  };
}

export function loadLocationStorage(
  locationId: string,
  fallback?: LocationStorageState,
): LocationStorageState {
  try {
    const raw = localStorage.getItem(storeKey(locationId));
    if (!raw) {
      return enforceHomeIslandSafe(
        fallback ?? newLocationStorage(locationId, "camp"),
      );
    }
    const parsed = JSON.parse(raw) as LocationStorageState;
    const kind = (parsed.kind || "camp") as StorageLocationKind;
    return enforceHomeIslandSafe({
      locationId: parsed.locationId || locationId,
      kind,
      ownerAccountId: parsed.ownerAccountId ?? null,
      label: parsed.label || "Storage",
      resources: parsed.resources || {},
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lockDifficulty: Math.max(0, Math.min(100, parsed.lockDifficulty ?? 0)),
      lockBusted: !!parsed.lockBusted,
      zone: parsed.zone,
      pos: parsed.pos,
      updatedAt: parsed.updatedAt || Date.now(),
    });
  } catch {
    return enforceHomeIslandSafe(
      fallback ?? newLocationStorage(locationId, "camp"),
    );
  }
}

export function saveLocationStorage(st: LocationStorageState): void {
  try {
    const safe = enforceHomeIslandSafe(st);
    safe.updatedAt = Date.now();
    localStorage.setItem(storeKey(safe.locationId), JSON.stringify(safe));
  } catch {
    /* quota */
  }
}

/** True when viewer may open storage without lockpick. */
export function canAccessLocationWithoutLockpick(
  st: LocationStorageState,
  viewerAccountId: string | null | undefined,
): boolean {
  // Home island always open (safe zone)
  if (isHomeIslandStorage(st.locationId, st.kind)) return true;
  if (st.lockBusted) return true;
  if (st.lockDifficulty <= 0) return true;
  if (!st.ownerAccountId) return false; // locked world loot needs pick
  if (!viewerAccountId) return false;
  return st.ownerAccountId === viewerAccountId;
}

/**
 * Create / load a lockpickable world chest by zone.
 * Never use for home island (returns home bag with DC 0).
 */
export function ensureZoneLootStorage(opts: {
  pinId: string;
  zone: WorldLootZone;
  kind?: StorageLocationKind;
  label?: string;
  ownerAccountId?: string | null;
  pos?: { x: number; y: number; z: number };
  seedLoot?: ItemInstance[];
  lockDifficulty?: number;
}): LocationStorageState {
  if (opts.zone === "home_island" || opts.zone === "camp_own") {
    // Safe path — never create a pickable home store
    const id = homeIslandLocationId(opts.ownerAccountId || "local");
    return enforceHomeIslandSafe(
      newLocationStorage(id, "home_island", {
        ownerAccountId: opts.ownerAccountId ?? "local",
        label: "Home island bag",
        lockDifficulty: 0,
        zone: "home_island",
      }),
    );
  }

  const kind: StorageLocationKind =
    opts.kind ??
    (opts.zone === "dungeon"
      ? "dungeon_chest"
      : opts.zone === "contested"
        ? "contested_chest"
        : opts.zone === "enemy"
          ? "enemy_chest"
          : opts.zone === "conquered"
            ? "conquered_chest"
            : opts.zone === "camp_foreign"
              ? "camp"
              : "hidden_chest");

  const id =
    kind === "camp"
      ? campLocationId(opts.pinId)
      : kind === "hidden_treasure"
        ? hiddenTreasureLocationId(opts.pinId)
        : kind === "dungeon_chest"
          ? `dungeon:${opts.pinId}`
          : kind === "contested_chest"
            ? `contested:${opts.pinId}`
            : kind === "enemy_chest"
              ? `enemy:${opts.pinId}`
              : kind === "conquered_chest"
                ? `conquered:${opts.pinId}`
                : hiddenChestLocationId(opts.pinId);

  const dc =
    opts.lockDifficulty ??
    LOCKPICK_DEFAULT_DC[opts.zone] ??
    LOCKPICK_DEFAULT_DC[kind] ??
    30;

  let st = loadLocationStorage(
    id,
    newLocationStorage(id, kind, {
      ownerAccountId: opts.ownerAccountId ?? null,
      label: opts.label,
      lockDifficulty: dc,
      zone: opts.zone,
      pos: opts.pos,
    }),
  );
  if (!st.zone) st.zone = opts.zone;
  if (st.lockDifficulty <= 0 && !isHomeIslandStorage(st.locationId, st.kind)) {
    st.lockDifficulty = dc;
  }
  if (
    opts.seedLoot?.length &&
    !Object.keys(st.resources).length &&
    !st.items.length
  ) {
    st = depositToLocation(st, opts.seedLoot);
  }
  if (opts.pos) st.pos = opts.pos;
  saveLocationStorage(st);
  return st;
}

/** Deposit item stacks into a location store (camp/boat/hidden). */
export function depositToLocation(
  st: LocationStorageState,
  instances: ItemInstance[],
): LocationStorageState {
  const next: LocationStorageState = {
    ...st,
    resources: { ...st.resources },
    items: [...st.items],
    updatedAt: Date.now(),
  };
  for (const it of instances) {
    if (!it?.templateId || it.qty <= 0) continue;
    const isGear =
      it.templateId.startsWith("wpn_") ||
      it.templateId.startsWith("arm_") ||
      !!it.grudgeUuid;
    if (isGear) {
      next.items.push({ ...it });
    } else {
      next.resources[it.templateId] =
        (next.resources[it.templateId] || 0) + it.qty;
    }
  }
  return next;
}

/**
 * Withdraw resource qty from location → item stacks for bag.
 * Does not place into bag; caller uses addToBag.
 */
export function withdrawResourcesFromLocation(
  st: LocationStorageState,
  templateId: string,
  qty: number,
): { storage: LocationStorageState; taken: number } {
  const have = st.resources[templateId] || 0;
  const take = Math.max(0, Math.min(have, Math.floor(qty)));
  if (take <= 0) return { storage: st, taken: 0 };
  const resources = { ...st.resources };
  resources[templateId] = have - take;
  if (resources[templateId] <= 0) delete resources[templateId];
  return {
    storage: { ...st, resources, updatedAt: Date.now() },
    taken: take,
  };
}

/**
 * Own camp → home island (account vault). Albion-style: goods leave the camp
 * only when explicitly sent home (or carried in bag).
 */
export async function transferLocationToHomeIsland(opts: {
  storage: LocationStorageState;
  accountId: string;
  /** If true, move uniques too; default mats only (safer for RTS camps). */
  includeUniques?: boolean;
}): Promise<{
  ok: boolean;
  storage: LocationStorageState;
  account: AccountInventoryState;
  message: string;
}> {
  const { storage, accountId } = opts;
  if (storage.kind === "home_island") {
    return {
      ok: false,
      storage,
      account: loadAccountInventory(accountId),
      message: "Already on home island bag",
    };
  }
  if (
    storage.ownerAccountId &&
    storage.ownerAccountId !== accountId &&
    accountId !== "local"
  ) {
    return {
      ok: false,
      storage,
      account: loadAccountInventory(accountId),
      message: "Cannot send foreign camp loot to your home (steal to bag first)",
    };
  }

  let account = loadAccountInventory(accountId);
  const instances: ItemInstance[] = [];
  for (const [tid, qty] of Object.entries(storage.resources)) {
    if (qty > 0) {
      instances.push({
        instanceId: `stack_${tid}`,
        templateId: tid,
        qty,
        provisional: false,
      });
    }
  }
  if (opts.includeUniques) {
    for (const it of storage.items) instances.push(it);
  }
  if (!instances.length) {
    return {
      ok: false,
      storage,
      account,
      message: storage.kind === "boat" ? "Boat stash empty" : "Camp storage empty",
    };
  }

  account = depositInstances(account, instances);
  const delta: Record<string, number> = {};
  for (const it of instances) {
    if (!it.grudgeUuid && !it.templateId.startsWith("wpn_")) {
      delta[it.templateId] = (delta[it.templateId] || 0) + it.qty;
    }
  }
  if (readFleetToken() && Object.keys(delta).length) {
    await pushAccountResources(delta);
  }
  saveAccountInventory(account);

  const emptied: LocationStorageState = {
    ...storage,
    resources: {},
    items: opts.includeUniques ? [] : storage.items,
    updatedAt: Date.now(),
  };
  saveLocationStorage(emptied);

  const n = instances.reduce((s, i) => s + i.qty, 0);
  return {
    ok: true,
    storage: emptied,
    account,
    message: `Sent ${n} items to home island bag`,
  };
}

/**
 * Boat stash → account inventory. Allowed only at home island, a safe dock,
 * or a friendly island dock. Same Railway bag — not a second store.
 */
export async function transferBoatStashToInventory(opts: {
  storage: LocationStorageState;
  accountId: string;
  dock: StashUnloadDock;
  includeUniques?: boolean;
}): Promise<{
  ok: boolean;
  storage: LocationStorageState;
  account: AccountInventoryState;
  message: string;
}> {
  if (!isBoatStashLocation(opts.storage.locationId, opts.storage.kind)) {
    return {
      ok: false,
      storage: opts.storage,
      account: loadAccountInventory(opts.accountId),
      message: "Not a boat stash",
    };
  }
  if (!canConvertBoatStashToInventory(opts.dock)) {
    return {
      ok: false,
      storage: opts.storage,
      account: loadAccountInventory(opts.accountId),
      message:
        "Stash becomes inventory only at a safe dock, home island, or friendly island dock",
    };
  }
  return transferLocationToHomeIsland(opts);
}

/**
 * Home island bag is the shared account inventory (Railway when signed in).
 * Projection for UI that expects LocationStorageState.
 */
export function homeIslandAsLocation(
  accountId = "local",
): LocationStorageState {
  const inv = loadAccountInventory(accountId);
  return enforceHomeIslandSafe({
    locationId: homeIslandLocationId(accountId),
    kind: "home_island",
    ownerAccountId: accountId,
    label: "Home island bag",
    resources: { ...inv.resources },
    items: [...inv.items],
    lockDifficulty: 0,
    zone: "home_island",
    updatedAt: inv.updatedAt,
  });
}

/** Ensure camp storage row exists for a claim key. */
export function ensureCampStorage(
  claimKey: string,
  ownerAccountId: string | null,
  opts?: { label?: string; lockDifficulty?: number },
): LocationStorageState {
  const id = campLocationId(claimKey);
  const existing = loadLocationStorage(
    id,
    newLocationStorage(id, "camp", {
      ownerAccountId,
      label: opts?.label ?? "Camp storage",
      lockDifficulty: opts?.lockDifficulty ?? 0,
    }),
  );
  if (!existing.ownerAccountId && ownerAccountId) {
    existing.ownerAccountId = ownerAccountId;
  }
  saveLocationStorage(existing);
  return existing;
}

/** Ensure hidden chest / treasure pin with lock difficulty (always lockpickable). */
export function ensureHiddenLootStorage(opts: {
  pinId: string;
  kind: "hidden_chest" | "hidden_treasure";
  lockDifficulty?: number;
  label?: string;
  pos?: { x: number; y: number; z: number };
  seedLoot?: ItemInstance[];
}): LocationStorageState {
  return ensureZoneLootStorage({
    pinId: opts.pinId,
    zone: "open_world",
    kind: opts.kind,
    label: opts.label,
    pos: opts.pos,
    seedLoot: opts.seedLoot,
    lockDifficulty:
      opts.lockDifficulty ??
      (opts.kind === "hidden_treasure"
        ? LOCKPICK_DEFAULT_DC.hidden_treasure
        : LOCKPICK_DEFAULT_DC.hidden_chest),
  });
}

/** Mark lock busted after successful lockpick. */
export function markLockBusted(st: LocationStorageState): LocationStorageState {
  const next = { ...st, lockBusted: true, updatedAt: Date.now() };
  saveLocationStorage(next);
  return next;
}

/** RTS: total resource qty at camp (for training costs). */
export function campResourceQty(
  claimKey: string,
  templateId: string,
): number {
  const st = loadLocationStorage(campLocationId(claimKey));
  return st.resources[templateId] || 0;
}

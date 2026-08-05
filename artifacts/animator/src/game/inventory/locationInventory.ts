/**
 * Albion-style location inventory — items stay where deposited until moved.
 *
 * SSOT layers (do not invent a second bag):
 *   · Character bag 3×3 — carry only (existing characterBag)
 *   · home_island — account inventory / Railway shared vault (existing)
 *   · camp — claim-flag camp storage (RTS play draws from here)
 *   · boat / hidden_chest / hidden_treasure — world location stores
 *
 * Rule: RTS units/buildings spend camp storage. To leave a world with
 * camp loot, transfer camp → home_island (or walk home & withdraw).
 * Stealing foreign camp / hidden loot requires lockpick success.
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
  | "hidden_treasure";

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
   * Lockpick difficulty 0–100 (0 = unlocked for owner / open world chest).
   * Foreign camps and hidden treasure use >0.
   */
  lockDifficulty: number;
  /** After successful bust until owner relocks / restock */
  lockBusted?: boolean;
  /** World pin for map / stealth */
  pos?: { x: number; y: number; z: number };
  updatedAt: number;
}

const storeKey = (locationId: string) =>
  `grudge:loc-inv:v1:${locationId || "unknown"}`;

/** Canonical location ids. */
export function homeIslandLocationId(accountId = "local"): string {
  return `home:${accountId || "local"}`;
}

export function campLocationId(claimKey: string): string {
  return `camp:${claimKey || "default"}`;
}

export function boatLocationId(boatId: string): string {
  return `boat:${boatId || "default"}`;
}

export function hiddenChestLocationId(pinId: string): string {
  return `hchest:${pinId}`;
}

export function hiddenTreasureLocationId(pinId: string): string {
  return `treasure:${pinId}`;
}

export function newLocationStorage(
  locationId: string,
  kind: StorageLocationKind,
  opts?: Partial<
    Pick<
      LocationStorageState,
      "ownerAccountId" | "label" | "lockDifficulty" | "pos"
    >
  >,
): LocationStorageState {
  return {
    locationId,
    kind,
    ownerAccountId: opts?.ownerAccountId ?? null,
    label:
      opts?.label ??
      (kind === "home_island"
        ? "Home island bag"
        : kind === "camp"
          ? "Camp storage"
          : kind === "boat"
            ? "Boat hold"
            : kind === "hidden_chest"
              ? "Hidden chest"
              : "Hidden treasure"),
    resources: {},
    items: [],
    lockDifficulty: opts?.lockDifficulty ?? 0,
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
      return fallback ?? newLocationStorage(locationId, "camp");
    }
    const parsed = JSON.parse(raw) as LocationStorageState;
    return {
      locationId: parsed.locationId || locationId,
      kind: parsed.kind || "camp",
      ownerAccountId: parsed.ownerAccountId ?? null,
      label: parsed.label || "Storage",
      resources: parsed.resources || {},
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lockDifficulty: Math.max(0, Math.min(100, parsed.lockDifficulty ?? 0)),
      lockBusted: !!parsed.lockBusted,
      pos: parsed.pos,
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return fallback ?? newLocationStorage(locationId, "camp");
  }
}

export function saveLocationStorage(st: LocationStorageState): void {
  try {
    st.updatedAt = Date.now();
    localStorage.setItem(storeKey(st.locationId), JSON.stringify(st));
  } catch {
    /* quota */
  }
}

/** True when viewer may open storage without lockpick. */
export function canAccessLocationWithoutLockpick(
  st: LocationStorageState,
  viewerAccountId: string | null | undefined,
): boolean {
  if (st.lockDifficulty <= 0 || st.lockBusted) return true;
  if (!st.ownerAccountId) return st.lockDifficulty <= 0;
  if (!viewerAccountId) return false;
  return st.ownerAccountId === viewerAccountId;
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
      message: "Camp storage empty",
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
 * Home island bag is the shared account inventory (Railway when signed in).
 * Projection for UI that expects LocationStorageState.
 */
export function homeIslandAsLocation(
  accountId = "local",
): LocationStorageState {
  const inv = loadAccountInventory(accountId);
  return {
    locationId: homeIslandLocationId(accountId),
    kind: "home_island",
    ownerAccountId: accountId,
    label: "Home island bag",
    resources: { ...inv.resources },
    items: [...inv.items],
    lockDifficulty: 0,
    updatedAt: inv.updatedAt,
  };
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

/** Ensure hidden chest / treasure pin with lock difficulty. */
export function ensureHiddenLootStorage(opts: {
  pinId: string;
  kind: "hidden_chest" | "hidden_treasure";
  lockDifficulty?: number;
  label?: string;
  pos?: { x: number; y: number; z: number };
  seedLoot?: ItemInstance[];
}): LocationStorageState {
  const id =
    opts.kind === "hidden_chest"
      ? hiddenChestLocationId(opts.pinId)
      : hiddenTreasureLocationId(opts.pinId);
  let st = loadLocationStorage(
    id,
    newLocationStorage(id, opts.kind, {
      ownerAccountId: null,
      label: opts.label,
      lockDifficulty: opts.lockDifficulty ?? (opts.kind === "hidden_treasure" ? 45 : 28),
      pos: opts.pos,
    }),
  );
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

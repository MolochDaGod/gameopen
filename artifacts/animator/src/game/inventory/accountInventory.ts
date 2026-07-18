/**
 * Account inventory — single shared vault for all characters, islands,
 * instances, game modes. Used for crafting, buildings, professions.
 */

import type { AccountInventoryState, ItemInstance } from "./types";
import { newAccountInventory } from "./types";
import { batchAddAccountResources, fetchAccountResources } from "../../auth/accountBag";
import { readFleetToken } from "../../auth/fleetCore";

export function addResources(
  inv: AccountInventoryState,
  resources: Record<string, number>,
): AccountInventoryState {
  const next = {
    ...inv,
    resources: { ...inv.resources },
    items: inv.items.map((i) => ({ ...i })),
    updatedAt: Date.now(),
  };
  for (const [id, qty] of Object.entries(resources)) {
    if (!id || qty <= 0) continue;
    next.resources[id] = (next.resources[id] || 0) + Math.floor(qty);
  }
  return next;
}

export function depositInstances(
  inv: AccountInventoryState,
  items: ItemInstance[],
): AccountInventoryState {
  const res: Record<string, number> = {};
  const uniques: ItemInstance[] = [];
  for (const it of items) {
    // Materials / stackables go to resource map; unique gear stays as instances
    if (it.templateId.startsWith("wpn_") || it.templateId.startsWith("arm_")) {
      uniques.push({ ...it });
    } else {
      res[it.templateId] = (res[it.templateId] || 0) + it.qty;
    }
  }
  let next = addResources(inv, res);
  if (uniques.length) {
    next = {
      ...next,
      items: [...next.items, ...uniques],
      updatedAt: Date.now(),
    };
  }
  return next;
}

/** Pull Railway resources into local account inventory. */
export async function hydrateAccountInventory(
  inv: AccountInventoryState,
): Promise<AccountInventoryState> {
  const token = readFleetToken();
  if (!token) return inv;
  const resources = await fetchAccountResources(token);
  if (!Object.keys(resources).length) return inv;
  return {
    ...inv,
    resources: { ...inv.resources, ...resources },
    updatedAt: Date.now(),
  };
}

/** Push resource delta to Railway (debounced by caller). */
export async function pushAccountResources(
  delta: Record<string, number>,
): Promise<boolean> {
  const items = Object.entries(delta)
    .filter(([, n]) => n > 0)
    .map(([resourceId, amount]) => ({ resourceId, amount }));
  if (!items.length) return true;
  return batchAddAccountResources(items);
}

export { newAccountInventory };

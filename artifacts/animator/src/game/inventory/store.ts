/**
 * Persist character bag + account inventory.
 * Bag: per characterId localStorage (until character save API).
 * Account resources: local mirror + Railway push via accountBag.
 */

import type { AccountInventoryState, CharacterBagState, ItemInstance } from "./types";
import { emptyKeptLoadout, newAccountInventory, newCharacterBag } from "./types";
import { ensureBagSize, ensureKeptLoadout, dropCarryOnDeath } from "./characterBag";
import {
  depositInstances,
  hydrateAccountInventory,
  pushAccountResources,
} from "./accountInventory";
import {
  addToBag,
  clearDepositable,
  listDepositable,
} from "./characterBag";
import { readFleetToken } from "../../auth/fleetCore";

const bagKey = (characterId: string) =>
  `grudge:char-bag:v2:${characterId || "local"}`;
/** Legacy key — migrated on first load. */
const bagKeyV1 = (characterId: string) =>
  `grudge:char-bag:v1:${characterId || "local"}`;
const accountKey = (accountId: string) =>
  `grudge:account-inv:v1:${accountId || "local"}`;

export function loadCharacterBag(characterId: string): CharacterBagState {
  try {
    let raw = localStorage.getItem(bagKey(characterId));
    if (!raw) {
      raw = localStorage.getItem(bagKeyV1(characterId));
    }
    if (!raw) return newCharacterBag(characterId);
    const parsed = JSON.parse(raw) as CharacterBagState;
    if (!parsed?.slots?.length) return newCharacterBag(characterId);
    const migrated = ensureBagSize(
      ensureKeptLoadout({
        ...parsed,
        characterId: characterId || parsed.characterId || "local",
        kept: parsed.kept || emptyKeptLoadout(),
        consumableHotkeys: parsed.consumableHotkeys?.length
          ? parsed.consumableHotkeys
          : [null, null, null, null],
      }),
    );
    // Persist migration to v2
    saveCharacterBag(migrated);
    return migrated;
  } catch {
    return newCharacterBag(characterId);
  }
}

/**
 * Death rule: 3×3 carry empties (resources/items drop).
 * Kept 2×2 loadout (mount, boat, main hand, side arm) is held.
 */
export function applyDeathBagDrop(characterId: string): {
  bag: CharacterBagState;
  dropped: ItemInstance[];
  message: string;
} {
  const bag = loadCharacterBag(characterId);
  const { bag: next, dropped } = dropCarryOnDeath(bag);
  saveCharacterBag(next);
  const n = dropped.reduce((s, i) => s + i.qty, 0);
  return {
    bag: next,
    dropped,
    message:
      n > 0
        ? `Death · lost ${n} carry items (loadout kept)`
        : "Death · carry empty (loadout kept)",
  };
}

export function saveCharacterBag(bag: CharacterBagState): void {
  try {
    localStorage.setItem(bagKey(bag.characterId), JSON.stringify(bag));
  } catch {
    /* ignore */
  }
}

export function loadAccountInventory(accountId = "local"): AccountInventoryState {
  try {
    const raw = localStorage.getItem(accountKey(accountId));
    if (!raw) return newAccountInventory(accountId);
    const parsed = JSON.parse(raw) as AccountInventoryState;
    return {
      accountId: accountId || parsed.accountId || "local",
      resources: parsed.resources || {},
      items: Array.isArray(parsed.items) ? parsed.items : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return newAccountInventory(accountId);
  }
}

export function saveAccountInventory(inv: AccountInventoryState): void {
  try {
    localStorage.setItem(accountKey(inv.accountId), JSON.stringify(inv));
  } catch {
    /* ignore */
  }
}

/** Harvest pickup → character bag (not account until deposit). */
export function harvestIntoBag(
  characterId: string,
  templateId: string,
  qty: number,
): { bag: CharacterBagState; leftover: number; full: boolean } {
  const bag = loadCharacterBag(characterId);
  const res = addToBag(bag, templateId, qty);
  saveCharacterBag(res.bag);
  return { bag: res.bag, leftover: res.leftover, full: !res.ok };
}

/**
 * Quick deposit: bag materials → account inventory (+ Railway when signed in).
 */
export async function quickDepositAll(
  characterId: string,
  accountId = "local",
): Promise<{
  ok: boolean;
  bag: CharacterBagState;
  account: AccountInventoryState;
  deposited: ItemInstance[];
  message: string;
}> {
  const bag = loadCharacterBag(characterId);
  const deposited = listDepositable(bag);
  if (!deposited.length) {
    return {
      ok: false,
      bag,
      account: loadAccountInventory(accountId),
      deposited: [],
      message: "Bag has nothing to deposit",
    };
  }

  let account = loadAccountInventory(accountId);
  account = depositInstances(account, deposited);

  // Railway shared resources
  const delta: Record<string, number> = {};
  for (const it of deposited) {
    if (!it.templateId.startsWith("wpn_") && !it.templateId.startsWith("arm_")) {
      delta[it.templateId] = (delta[it.templateId] || 0) + it.qty;
    }
  }
  if (readFleetToken() && Object.keys(delta).length) {
    await pushAccountResources(delta);
  }

  const nextBag = clearDepositable(bag);
  saveCharacterBag(nextBag);
  saveAccountInventory(account);

  const n = deposited.reduce((s, i) => s + i.qty, 0);
  return {
    ok: true,
    bag: nextBag,
    account,
    deposited,
    message: `Deposited ${n} items to account inventory`,
  };
}

/** Refresh account inv from Railway. */
export async function syncAccountFromServer(
  accountId = "local",
): Promise<AccountInventoryState> {
  let inv = loadAccountInventory(accountId);
  inv = await hydrateAccountInventory(inv);
  saveAccountInventory(inv);
  return inv;
}

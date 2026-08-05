/**
 * Persist character bag + account inventory.
 *
 * Phase 1 law:
 *  - localStorage = cache only when signed in
 *  - stackable mats → bag qty + Railway account resources on deposit
 *  - unique gear → mint via ledgerClient (grudge_uuid); equip logs EQUIPPED
 */

import type {
  AccountInventoryState,
  CharacterBagState,
  ItemInstance,
  KeptLoadoutSlotId,
} from "./types";
import {
  emptyKeptLoadout,
  newAccountInventory,
  newCharacterBag,
  newItemInstance,
} from "./types";
import { isLedgerUniqueItem } from "./catalog";
import {
  ensureBagSize,
  ensureKeptLoadout,
  dropCarryOnDeath,
  addToBag,
  clearDepositable,
  listDepositable,
  equipBagToKept,
  unequipKeptToBag,
} from "./characterBag";
import {
  depositInstances,
  hydrateAccountInventory,
  pushAccountResources,
} from "./accountInventory";
import { readFleetToken } from "../../auth/fleetCore";
import {
  ledgerEquipChange,
  mintUniqueItemInstance,
} from "./ledgerClient";

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
        // J / H / V utility slots (length 3). Trim legacy 4-slot consumable bars.
        consumableHotkeys: (() => {
          const rawHk = parsed.consumableHotkeys ?? [];
          const three: (typeof rawHk)[number][] = [null, null, null];
          for (let i = 0; i < 3; i++) three[i] = rawHk[i] ?? null;
          return three;
        })(),
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

/**
 * Harvest / pickup → character bag.
 * Stackables only via sync path. Unique gear must use grantUniqueToBag.
 */
export function harvestIntoBag(
  characterId: string,
  templateId: string,
  qty: number,
): { bag: CharacterBagState; leftover: number; full: boolean } {
  if (isLedgerUniqueItem(templateId) && readFleetToken()) {
    // Do not client-mint production uniques; caller should await grantUniqueToBag
    console.warn(
      `[inventory] harvestIntoBag blocked unique ${templateId} while signed in — use grantUniqueToBag`,
    );
    return {
      bag: loadCharacterBag(characterId),
      leftover: qty,
      full: true,
    };
  }
  const bag = loadCharacterBag(characterId);
  const res = addToBag(bag, templateId, qty);
  saveCharacterBag(res.bag);
  return { bag: res.bag, leftover: res.leftover, full: !res.ok };
}

/**
 * Grant unique gear: Railway mint + ledger, then bag cache.
 * Guest/offline → provisional instance (not production SSOT).
 */
export async function grantUniqueToBag(opts: {
  characterId: string;
  templateId: string;
  accountId?: string | null;
  sourceType?: string;
  sourceRef?: string;
}): Promise<{
  bag: CharacterBagState;
  item: ItemInstance | null;
  ledgered: boolean;
  message: string;
}> {
  const bag = loadCharacterBag(opts.characterId);
  if (!isLedgerUniqueItem(opts.templateId)) {
    const res = addToBag(bag, opts.templateId, 1);
    saveCharacterBag(res.bag);
    const added = res.bag.slots.find(
      (s) => s.item?.templateId === opts.templateId,
    )?.item;
    return {
      bag: res.bag,
      item: added ?? null,
      ledgered: false,
      message: "Stackable added to bag",
    };
  }

  let item: ItemInstance | null = null;
  let ledgered = false;
  if (readFleetToken()) {
    item = await mintUniqueItemInstance({
      templateId: opts.templateId,
      characterId: opts.characterId,
      accountId: opts.accountId,
      sourceType: opts.sourceType || "open_grant",
      sourceRef: opts.sourceRef,
    });
    ledgered = !!item?.grudgeUuid;
    // Fail closed when signed in — never write provisional as production SSOT
    if (!item) {
      return {
        bag,
        item: null,
        ledgered: false,
        message: `Ledger mint failed for ${opts.templateId}`,
      };
    }
  } else {
    item = newItemInstance(opts.templateId, 1);
  }

  // Place instance into bag (unique does not stack)
  const empty = bag.slots.find((s) => !s.item);
  if (!empty) {
    return {
      bag,
      item: null,
      ledgered,
      message: "Bag full",
    };
  }
  empty.item = item;
  bag.updatedAt = Date.now();
  saveCharacterBag(bag);
  return {
    bag,
    item,
    ledgered,
    message: ledgered
      ? `Ledgered ${opts.templateId} · ${item.grudgeUuid}`
      : `Provisional ${opts.templateId} (guest/offline)`,
  };
}

/**
 * Equip bag → kept loadout; log EQUIPPED when instance has grudgeUuid.
 */
export async function equipFromBagWithLedger(opts: {
  characterId: string;
  bagIndex: number;
  slot: KeptLoadoutSlotId;
  accountId?: string | null;
}): Promise<{
  bag: CharacterBagState;
  ok: boolean;
  reason?: string;
  ledgered: boolean;
}> {
  let bag = loadCharacterBag(opts.characterId);
  const carry = bag.slots[opts.bagIndex]?.item;
  if (!carry) {
    return { bag, ok: false, reason: "Empty bag slot", ledgered: false };
  }

  // Signed-in + unique + provisional → remint through ledger before equip
  if (
    readFleetToken() &&
    isLedgerUniqueItem(carry.templateId) &&
    (carry.provisional || !carry.grudgeUuid)
  ) {
    const minted = await mintUniqueItemInstance({
      templateId: carry.templateId,
      characterId: opts.characterId,
      accountId: opts.accountId,
      sourceType: "open_equip_remint",
      sourceRef: opts.slot,
    });
    if (!minted) {
      return {
        bag,
        ok: false,
        reason: "Cannot equip: ledger mint failed (provisional gear)",
        ledgered: false,
      };
    }
    bag.slots[opts.bagIndex] = { index: opts.bagIndex, item: minted };
    saveCharacterBag(bag);
  }

  const prevKept = bag.kept[opts.slot];
  const res = equipBagToKept(bag, opts.bagIndex, opts.slot);
  if (!res.ok) {
    return { bag: res.bag, ok: false, reason: res.reason, ledgered: false };
  }
  saveCharacterBag(res.bag);

  let ledgered = false;
  if (prevKept?.grudgeUuid) {
    await ledgerEquipChange({
      item: prevKept,
      characterId: opts.characterId,
      accountId: opts.accountId,
      keptSlot: opts.slot,
      equip: false,
    });
  }
  const equipped = res.bag.kept[opts.slot];
  if (equipped?.grudgeUuid) {
    ledgered = await ledgerEquipChange({
      item: equipped,
      characterId: opts.characterId,
      accountId: opts.accountId,
      keptSlot: opts.slot,
      equip: true,
    });
    // Persist worn mesh refs on character UUID (appearance law)
    if (opts.characterId && !opts.characterId.startsWith("local")) {
      void import("./characterAppearance").then(({ saveCharacterSlotAppearance }) =>
        saveCharacterSlotAppearance({
          characterId: opts.characterId,
          bag: res.bag,
        }),
      );
    }
  }
  return { bag: res.bag, ok: true, ledgered };
}

/** Unequip kept → bag + UNEQUIPPED ledger. */
export async function unequipToBagWithLedger(opts: {
  characterId: string;
  slot: KeptLoadoutSlotId;
  accountId?: string | null;
  preferBagIndex?: number;
}): Promise<{ bag: CharacterBagState; ok: boolean; reason?: string; ledgered: boolean }> {
  const bag = loadCharacterBag(opts.characterId);
  const was = bag.kept[opts.slot];
  const res = unequipKeptToBag(bag, opts.slot, opts.preferBagIndex);
  if (!res.ok) {
    return { bag: res.bag, ok: false, reason: res.reason, ledgered: false };
  }
  saveCharacterBag(res.bag);
  let ledgered = false;
  if (was) {
    ledgered = await ledgerEquipChange({
      item: was,
      characterId: opts.characterId,
      accountId: opts.accountId,
      keptSlot: opts.slot,
      equip: false,
    });
  }
  return { bag: res.bag, ok: true, ledgered };
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

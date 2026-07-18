/**
 * Character bag — default 3×3 grid for heroes without a larger bag item.
 * Holds gear, harvest stacks (≤100), mission items, consumables.
 */

import { getItemTemplate, maxStackFor } from "./catalog";
import {
  type BagSlot,
  type CharacterBagState,
  type ItemInstance,
  DEFAULT_BAG_SLOTS,
  emptyBagSlots,
  newCharacterBag,
  newItemInstance,
} from "./types";

export type AddResult =
  | { ok: true; bag: CharacterBagState; leftover: number }
  | { ok: false; bag: CharacterBagState; leftover: number; reason: string };

function cloneBag(bag: CharacterBagState): CharacterBagState {
  return {
    ...bag,
    slots: bag.slots.map((s) => ({
      index: s.index,
      item: s.item ? { ...s.item } : null,
    })),
    consumableHotkeys: bag.consumableHotkeys.map((h) => (h ? { ...h } : null)),
    updatedAt: Date.now(),
  };
}

/** Count free slots. */
export function freeSlotCount(bag: CharacterBagState): number {
  return bag.slots.filter((s) => !s.item).length;
}

/** Total qty of a template in bag. */
export function countInBag(bag: CharacterBagState, templateId: string): number {
  let n = 0;
  for (const s of bag.slots) {
    if (s.item?.templateId === templateId) n += s.item.qty;
  }
  return n;
}

/**
 * Add items into the bag, stacking materials up to maxStack (100).
 * Returns leftover qty that did not fit.
 */
export function addToBag(
  bag: CharacterBagState,
  templateId: string,
  qty: number,
): AddResult {
  if (qty <= 0) return { ok: true, bag, leftover: 0 };
  const next = cloneBag(bag);
  let left = Math.floor(qty);
  const max = maxStackFor(templateId);

  // Fill existing stacks first
  for (const slot of next.slots) {
    if (left <= 0) break;
    if (!slot.item || slot.item.templateId !== templateId) continue;
    const room = max - slot.item.qty;
    if (room <= 0) continue;
    const take = Math.min(room, left);
    slot.item.qty += take;
    left -= take;
  }

  // New stacks in empty slots
  while (left > 0) {
    const empty = next.slots.find((s) => !s.item);
    if (!empty) break;
    const take = Math.min(max, left);
    empty.item = newItemInstance(templateId, take);
    left -= take;
  }

  next.updatedAt = Date.now();
  if (left > 0) {
    return { ok: false, bag: next, leftover: left, reason: "Bag full" };
  }
  return { ok: true, bag: next, leftover: 0 };
}

export function removeFromSlot(
  bag: CharacterBagState,
  index: number,
  qty = 1,
): { bag: CharacterBagState; removed: ItemInstance | null } {
  const next = cloneBag(bag);
  const slot = next.slots[index];
  if (!slot?.item) return { bag: next, removed: null };
  const take = Math.min(slot.item.qty, Math.max(1, qty));
  const removed: ItemInstance = { ...slot.item, qty: take };
  slot.item.qty -= take;
  if (slot.item.qty <= 0) slot.item = null;
  next.updatedAt = Date.now();
  return { bag: next, removed };
}

export function setSlotItem(
  bag: CharacterBagState,
  index: number,
  item: ItemInstance | null,
): CharacterBagState {
  const next = cloneBag(bag);
  if (index < 0 || index >= next.slots.length) return next;
  next.slots[index] = { index, item: item ? { ...item } : null };
  next.updatedAt = Date.now();
  return next;
}

/** Swap two bag slots (or drag rearrange). */
export function swapSlots(
  bag: CharacterBagState,
  a: number,
  b: number,
): CharacterBagState {
  const next = cloneBag(bag);
  if (a < 0 || b < 0 || a >= next.slots.length || b >= next.slots.length) return next;
  const ia = next.slots[a]!.item;
  const ib = next.slots[b]!.item;
  next.slots[a] = { index: a, item: ib };
  next.slots[b] = { index: b, item: ia };
  next.updatedAt = Date.now();
  return next;
}

/** Drag consumable from bag index → hotkey 0–3. */
export function assignConsumableHotkey(
  bag: CharacterBagState,
  bagIndex: number,
  hotkeyIndex: number,
): CharacterBagState {
  const next = cloneBag(bag);
  const slot = next.slots[bagIndex];
  if (!slot?.item) return next;
  const tpl = getItemTemplate(slot.item.templateId);
  if (tpl.kind !== "consumable") return next;
  if (hotkeyIndex < 0 || hotkeyIndex >= next.consumableHotkeys.length) return next;
  next.consumableHotkeys[hotkeyIndex] = { ...slot.item };
  next.updatedAt = Date.now();
  return next;
}

/** Use one consumable from hotkey; decrements bag stack if matching. */
export function useConsumableHotkey(
  bag: CharacterBagState,
  hotkeyIndex: number,
): {
  bag: CharacterBagState;
  used: ItemInstance | null;
  heal: number;
  stamina: number;
} {
  const next = cloneBag(bag);
  const hk = next.consumableHotkeys[hotkeyIndex];
  if (!hk) return { bag: next, used: null, heal: 0, stamina: 0 };
  const tpl = getItemTemplate(hk.templateId);
  // Consume from bag first matching stack
  const idx = next.slots.findIndex((s) => s.item?.templateId === hk.templateId);
  if (idx < 0) {
    next.consumableHotkeys[hotkeyIndex] = null;
    return { bag: next, used: null, heal: 0, stamina: 0 };
  }
  const { bag: after, removed } = removeFromSlot(next, idx, 1);
  if (!removed) return { bag: after, used: null, heal: 0, stamina: 0 };
  // Refresh hotkey qty
  const left = countInBag(after, hk.templateId);
  after.consumableHotkeys[hotkeyIndex] =
    left > 0 ? { ...hk, qty: left } : null;
  return {
    bag: after,
    used: removed,
    heal: tpl.heal ?? 0,
    stamina: tpl.stamina ?? 0,
  };
}

/** Flatten bag items for deposit (all materials + optionals). */
export function listDepositable(bag: CharacterBagState): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const s of bag.slots) {
    if (!s.item) continue;
    const tpl = getItemTemplate(s.item.templateId);
    if (tpl.kind === "material" || tpl.kind === "consumable") {
      out.push({ ...s.item });
    }
  }
  return out;
}

/** Remove all depositable stacks from bag (after successful deposit). */
export function clearDepositable(bag: CharacterBagState): CharacterBagState {
  const next = cloneBag(bag);
  for (const s of next.slots) {
    if (!s.item) continue;
    const tpl = getItemTemplate(s.item.templateId);
    if (tpl.kind === "material" || tpl.kind === "consumable") {
      s.item = null;
    }
  }
  next.updatedAt = Date.now();
  return next;
}

export function ensureBagSize(bag: CharacterBagState, slots = DEFAULT_BAG_SLOTS): CharacterBagState {
  if (bag.slots.length >= slots) return bag;
  const next = cloneBag(bag);
  while (next.slots.length < slots) {
    next.slots.push({ index: next.slots.length, item: null });
  }
  return next;
}

export { newCharacterBag, emptyBagSlots };

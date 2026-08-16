/**
 * Character bag — 2×2 kept loadout + 3×3 carry grid.
 * Carry (3×3) drops on death; kept loadout (mount/boat/main/side) does not.
 */

import { getItemTemplate, maxStackFor } from "./catalog";
import {
  type BagSlot,
  type CharacterBagState,
  type CharacterKeptLoadout,
  type ItemInstance,
  type KeptLoadoutSlotId,
  DEFAULT_BAG_SLOTS,
  emptyBagSlots,
  emptyKeptLoadout,
  KEPT_LOADOUT_ORDER,
  newCharacterBag,
  newItemInstance,
} from "./types";

export type AddResult =
  | { ok: true; bag: CharacterBagState; leftover: number }
  | { ok: false; bag: CharacterBagState; leftover: number; reason: string };

function cloneItem(item: ItemInstance | null): ItemInstance | null {
  return item ? { ...item } : null;
}

function cloneKept(kept: CharacterKeptLoadout | undefined): CharacterKeptLoadout {
  const base = emptyKeptLoadout();
  if (!kept) return base;
  for (const id of KEPT_LOADOUT_ORDER) {
    base[id] = cloneItem(kept[id] ?? null);
  }
  return base;
}

function cloneBag(bag: CharacterBagState): CharacterBagState {
  const hk = bag.consumableHotkeys ?? [];
  return {
    ...bag,
    slots: bag.slots.map((s) => ({
      index: s.index,
      item: s.item ? { ...s.item } : null,
    })),
    kept: cloneKept(bag.kept),
    // Always 3 utility slots (J / H / V)
    consumableHotkeys: [0, 1, 2].map((i) => (hk[i] ? { ...hk[i]! } : null)),
    wornBack: bag.wornBack ? { ...bag.wornBack } : null,
    updatedAt: Date.now(),
  };
}

export function sameItemInstance(
  a: ItemInstance | null | undefined,
  b: ItemInstance | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.grudgeUuid && b.grudgeUuid) return a.grudgeUuid === b.grudgeUuid;
  return a.instanceId === b.instanceId;
}

export function isWornBackItem(
  bag: CharacterBagState,
  item: ItemInstance | null | undefined,
): boolean {
  return sameItemInstance(bag.wornBack, item);
}

/** Ensure kept loadout exists (migrate old saves). */
export function ensureKeptLoadout(bag: CharacterBagState): CharacterBagState {
  if (bag.kept && typeof bag.kept === "object") {
    const next = cloneBag(bag);
    next.kept = cloneKept(bag.kept);
    return next;
  }
  return { ...cloneBag(bag), kept: emptyKeptLoadout() };
}

/**
 * Can this template go in a kept loadout slot?
 * sideArm accepts 2nd weapon OR off-hand (shield / relic / tome / staff).
 */
export function canEquipInKeptSlot(
  slot: KeptLoadoutSlotId,
  templateId: string,
): boolean {
  const tpl = getItemTemplate(templateId);
  const tags = (tpl.tags || []).map((t) => t.toLowerCase());
  const equip = tpl.equipSlot;
  if (slot === "mainHand") {
    return (
      tpl.kind === "weapon" ||
      equip === "mainHand" ||
      tags.includes("weapon") ||
      tags.includes("melee") ||
      tags.includes("ranged")
    );
  }
  if (slot === "sideArm") {
    return (
      tpl.kind === "weapon" ||
      tpl.kind === "relic" ||
      equip === "sideArm" ||
      equip === "offHand" ||
      tags.includes("weapon") ||
      tags.includes("sidearm") ||
      tags.includes("shield") ||
      tags.includes("tome") ||
      tags.includes("staff") ||
      tags.includes("relic") ||
      tags.includes("offhand")
    );
  }
  if (slot === "mount") {
    return tpl.kind === "mount" || equip === "mount" || tags.includes("mount");
  }
  if (slot === "boat") {
    return (
      tpl.kind === "boat" ||
      equip === "boat" ||
      tags.includes("boat") ||
      tags.includes("ship") ||
      tags.includes("vessel")
    );
  }
  return false;
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

/**
 * Items that can sit on J / H / V utility slots:
 * consumables, deployables (claim flag / placeables), mounts, boats.
 */
export function canAssignUtilityHotkey(templateId: string): boolean {
  const tpl = getItemTemplate(templateId);
  if (tpl.kind === "consumable") return true;
  if (tpl.kind === "mount" || tpl.kind === "boat") return true;
  const tags = tpl.tags ?? [];
  if (tags.includes("deploy") || tags.some((t) => t.startsWith("placeable:"))) return true;
  if (tpl.kind === "tool" && (tags.includes("camp") || tags.includes("claim"))) return true;
  return false;
}

/** Drag bag item → utility hotkey 0–2 (J / H / V). */
export function assignConsumableHotkey(
  bag: CharacterBagState,
  bagIndex: number,
  hotkeyIndex: number,
): CharacterBagState {
  const next = cloneBag(bag);
  const slot = next.slots[bagIndex];
  if (!slot?.item) return next;
  if (!canAssignUtilityHotkey(slot.item.templateId)) return next;
  // Ensure length 3 (J H V)
  while (next.consumableHotkeys.length < 3) next.consumableHotkeys.push(null);
  if (hotkeyIndex < 0 || hotkeyIndex >= 3) return next;
  next.consumableHotkeys[hotkeyIndex] = { ...slot.item };
  next.updatedAt = Date.now();
  return next;
}

export type UtilityUseAction = "use" | "deploy" | "summon" | "none";

export type UtilityUseResult = {
  bag: CharacterBagState;
  used: ItemInstance | null;
  action: UtilityUseAction;
  heal: number;
  stamina: number;
  /** placeable id when action is deploy (e.g. claim_flag) */
  placeableId?: string;
  /** kept loadout slot when summoning mount/boat */
  summonSlot?: KeptLoadoutSlotId;
};

/** Use one utility slot (J/H/V); consumables decrement bag, deployables keep stack until placed. */
export function useConsumableHotkey(
  bag: CharacterBagState,
  hotkeyIndex: number,
): UtilityUseResult {
  const next = cloneBag(bag);
  while (next.consumableHotkeys.length < 3) next.consumableHotkeys.push(null);
  const empty: UtilityUseResult = {
    bag: next,
    used: null,
    action: "none",
    heal: 0,
    stamina: 0,
  };
  const hk = next.consumableHotkeys[hotkeyIndex];
  if (!hk) return empty;
  const tpl = getItemTemplate(hk.templateId);
  const tags = tpl.tags ?? [];

  // Deployable / placeable — do not consume until place commits (caller begins ghost)
  if (
    tags.includes("deploy") ||
    tags.some((t) => t.startsWith("placeable:")) ||
    (tpl.kind === "tool" && (tags.includes("camp") || tags.includes("claim")))
  ) {
    const placeableId =
      tags.find((t) => t.startsWith("placeable:"))?.slice("placeable:".length) ||
      (hk.templateId === "itm_claim_flag" ? "claim_flag" : undefined);
    return {
      bag: next,
      used: { ...hk },
      action: "deploy",
      heal: 0,
      stamina: 0,
      placeableId,
    };
  }

  // Mount / boat — equip into kept loadout (summon)
  if (tpl.kind === "mount" || tpl.kind === "boat") {
    const summonSlot: KeptLoadoutSlotId = tpl.kind === "mount" ? "mount" : "boat";
    return {
      bag: next,
      used: { ...hk },
      action: "summon",
      heal: 0,
      stamina: 0,
      summonSlot,
    };
  }

  // Consumable — consume from bag stack
  const idx = next.slots.findIndex((s) => s.item?.templateId === hk.templateId);
  if (idx < 0) {
    next.consumableHotkeys[hotkeyIndex] = null;
    return { ...empty, bag: next };
  }
  const { bag: after, removed } = removeFromSlot(next, idx, 1);
  if (!removed) return { ...empty, bag: after };
  const left = countInBag(after, hk.templateId);
  after.consumableHotkeys[hotkeyIndex] = left > 0 ? { ...hk, qty: left } : null;
  return {
    bag: after,
    used: removed,
    action: "use",
    heal: tpl.heal ?? 0,
    stamina: tpl.stamina ?? 0,
  };
}

/** Clear a utility hotkey binding (does not remove bag stack). */
export function clearUtilityHotkey(
  bag: CharacterBagState,
  hotkeyIndex: number,
): CharacterBagState {
  const next = cloneBag(bag);
  while (next.consumableHotkeys.length < 3) next.consumableHotkeys.push(null);
  if (hotkeyIndex < 0 || hotkeyIndex >= 3) return next;
  next.consumableHotkeys[hotkeyIndex] = null;
  next.updatedAt = Date.now();
  return next;
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
  let next = ensureKeptLoadout(bag);
  if (next.slots.length >= slots) return next;
  next = cloneBag(next);
  while (next.slots.length < slots) {
    next.slots.push({ index: next.slots.length, item: null });
  }
  return next;
}

/**
 * On death: empty 3×3 carry slots (resources + items).
 * Kept loadout (mount / boat / main / side arm) is retained.
 */
export function dropCarryOnDeath(bag: CharacterBagState): {
  bag: CharacterBagState;
  dropped: ItemInstance[];
} {
  const next = ensureKeptLoadout(cloneBag(bag));
  const dropped: ItemInstance[] = [];
  for (const s of next.slots) {
    if (s.item) {
      dropped.push({ ...s.item });
      s.item = null;
    }
  }
  next.wornBack = null;
  next.updatedAt = Date.now();
  return { bag: next, dropped };
}

/** Set a kept loadout slot (does not validate — use equipToKept for rules). */
export function setKeptSlot(
  bag: CharacterBagState,
  slot: KeptLoadoutSlotId,
  item: ItemInstance | null,
): CharacterBagState {
  const next = ensureKeptLoadout(cloneBag(bag));
  next.kept[slot] = item ? { ...item } : null;
  next.updatedAt = Date.now();
  return next;
}

/**
 * Equip bag item → kept slot. Swaps with existing kept item into that bag index.
 */
export function equipBagToKept(
  bag: CharacterBagState,
  bagIndex: number,
  slot: KeptLoadoutSlotId,
): { bag: CharacterBagState; ok: boolean; reason?: string } {
  const next = ensureKeptLoadout(cloneBag(bag));
  const carry = next.slots[bagIndex]?.item;
  if (!carry) return { bag: next, ok: false, reason: "Empty bag slot" };
  if (!canEquipInKeptSlot(slot, carry.templateId)) {
    return { bag: next, ok: false, reason: `Cannot equip in ${slot}` };
  }
  const prev = next.kept[slot];
  next.kept[slot] = { ...carry };
  next.slots[bagIndex] = { index: bagIndex, item: prev ? { ...prev } : null };
  next.updatedAt = Date.now();
  return { bag: next, ok: true };
}

/** Unequip kept → first free bag slot (or swap if bag full fails). */
export function unequipKeptToBag(
  bag: CharacterBagState,
  slot: KeptLoadoutSlotId,
  preferBagIndex?: number,
): { bag: CharacterBagState; ok: boolean; reason?: string } {
  const next = ensureKeptLoadout(cloneBag(bag));
  const item = next.kept[slot];
  if (!item) return { bag: next, ok: false, reason: "Empty loadout slot" };

  if (
    preferBagIndex != null &&
    preferBagIndex >= 0 &&
    preferBagIndex < next.slots.length
  ) {
    const dest = next.slots[preferBagIndex]!;
    if (!dest.item) {
      dest.item = { ...item };
      next.kept[slot] = null;
      next.updatedAt = Date.now();
      return { bag: next, ok: true };
    }
    // Swap into occupied bag slot
    next.kept[slot] = dest.item ? { ...dest.item } : null;
    dest.item = { ...item };
    next.updatedAt = Date.now();
    return { bag: next, ok: true };
  }

  const empty = next.slots.find((s) => !s.item);
  if (!empty) return { bag: next, ok: false, reason: "Bag full" };
  empty.item = { ...item };
  next.kept[slot] = null;
  next.updatedAt = Date.now();
  return { bag: next, ok: true };
}

/** Swap two kept slots (e.g. main ↔ side arm weapon swap). */
export function swapKeptSlots(
  bag: CharacterBagState,
  a: KeptLoadoutSlotId,
  b: KeptLoadoutSlotId,
): CharacterBagState {
  const next = ensureKeptLoadout(cloneBag(bag));
  const ia = next.kept[a];
  const ib = next.kept[b];
  // Only swap if both empty or both would remain valid after swap
  if (ia && !canEquipInKeptSlot(b, ia.templateId)) return next;
  if (ib && !canEquipInKeptSlot(a, ib.templateId)) return next;
  next.kept[a] = ib ? { ...ib } : null;
  next.kept[b] = ia ? { ...ia } : null;
  next.updatedAt = Date.now();
  return next;
}

/** Drag: bag index ↔ kept slot. */
export function swapBagAndKept(
  bag: CharacterBagState,
  bagIndex: number,
  slot: KeptLoadoutSlotId,
): { bag: CharacterBagState; ok: boolean; reason?: string } {
  const next = ensureKeptLoadout(cloneBag(bag));
  if (bagIndex < 0 || bagIndex >= next.slots.length) {
    return { bag: next, ok: false, reason: "Bad bag index" };
  }
  const carry = next.slots[bagIndex]!.item;
  const kept = next.kept[slot];
  if (carry && !canEquipInKeptSlot(slot, carry.templateId)) {
    return { bag: next, ok: false, reason: `Cannot place in ${slot}` };
  }
  // Putting kept into bag always allowed (bag is free-form)
  next.slots[bagIndex] = { index: bagIndex, item: kept ? { ...kept } : null };
  next.kept[slot] = carry ? { ...carry } : null;
  next.updatedAt = Date.now();
  return { bag: next, ok: true };
}

export { newCharacterBag, emptyBagSlots, emptyKeptLoadout };

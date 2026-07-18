/**
 * Production inventory SSOT — character bag vs account inventory.
 *
 * Character bag (3×3 default): temporary carry — harvest, drops, equip, consume.
 * Account inventory: single shared vault across islands, modes, instances, characters.
 *
 * Materials stack to 100 in the bag before deposit. Equipment is unique instances.
 */

import { newGrudgeId, newUuid } from "@workspace/grudge-runtime";

/** Default bag grid for characters without a larger bag item. */
export const DEFAULT_BAG_COLS = 3;
export const DEFAULT_BAG_ROWS = 3;
export const DEFAULT_BAG_SLOTS = DEFAULT_BAG_COLS * DEFAULT_BAG_ROWS;

/** Stack cap for harvested materials / stackable loot in the character bag. */
export const MATERIAL_STACK_MAX = 100;

export type ItemKind =
  | "material"
  | "consumable"
  | "equipment"
  | "weapon"
  | "mission"
  | "tool"
  | "relic";

export type EquipSlot =
  | "mainHand"
  | "offHand"
  | "head"
  | "chest"
  | "legs"
  | "feet"
  | "accessory"
  | "tool";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Catalog template (authoring). Runtime holds instances. */
export interface ItemTemplate {
  id: string;
  kind: ItemKind;
  name: string;
  description?: string;
  rarity: ItemRarity;
  maxStack: number;
  icon?: string;
  /** Equip slot when kind is equipment/weapon/tool. */
  equipSlot?: EquipSlot;
  /** Weapon tier 0–5 for UUID skill tree branch. */
  weaponTier?: number;
  weaponFamily?: string;
  /** Heal amount when consumed. */
  heal?: number;
  /** Stamina restore when consumed. */
  stamina?: number;
  tags?: string[];
}

/** Runtime stack or unique item in bag / account. */
export interface ItemInstance {
  /** Unique instance id (ent_ / uuid). */
  instanceId: string;
  /** Template id (itm_ / resource slug like wood). */
  templateId: string;
  qty: number;
  /** Durability 0–100 for gear. */
  durability?: number;
  /** Bound to character (mission items). */
  bound?: boolean;
  /** Optional tier override for weapon tree. */
  tier?: number;
}

export interface BagSlot {
  /** 0-based index into the bag grid. */
  index: number;
  item: ItemInstance | null;
}

export interface CharacterBagState {
  characterId: string;
  cols: number;
  rows: number;
  slots: BagSlot[];
  /** Hotkey consumable bars (1–4 drag targets outside combat bar). */
  consumableHotkeys: (ItemInstance | null)[];
  updatedAt: number;
}

/** Shared account vault — materials as qty map + optional unique gear. */
export interface AccountInventoryState {
  accountId: string;
  /** Stacked resources (wood, ore, …) — no slot limit for vault. */
  resources: Record<string, number>;
  /** Unique equipment / mission items in vault. */
  items: ItemInstance[];
  updatedAt: number;
}

export type DepositZoneKind = "claim" | "camp" | "boat" | "storage" | "none";

export interface DepositContext {
  zone: DepositZoneKind;
  /** True when quick-deposit button should illuminate. */
  canDeposit: boolean;
  label: string;
}

/** RMB context actions on a bag item. */
export type BagItemAction =
  | "use"
  | "equip"
  | "unequip"
  | "deposit"
  | "drop"
  | "split"
  | "inspect";

export function emptyBagSlots(n = DEFAULT_BAG_SLOTS): BagSlot[] {
  return Array.from({ length: n }, (_, index) => ({ index, item: null }));
}

export function newItemInstance(
  templateId: string,
  qty = 1,
  extra?: Partial<ItemInstance>,
): ItemInstance {
  return {
    instanceId: newGrudgeId("entity"),
    templateId,
    qty: Math.max(1, Math.floor(qty)),
    ...extra,
  };
}

export function newCharacterBag(characterId: string): CharacterBagState {
  return {
    characterId: characterId || "local",
    cols: DEFAULT_BAG_COLS,
    rows: DEFAULT_BAG_ROWS,
    slots: emptyBagSlots(DEFAULT_BAG_SLOTS),
    consumableHotkeys: [null, null, null, null],
    updatedAt: Date.now(),
  };
}

export function newAccountInventory(accountId = "local"): AccountInventoryState {
  return {
    accountId,
    resources: {},
    items: [],
    updatedAt: Date.now(),
  };
}

/** Mint a weapon-tree branch id: `wpn_tree_<family>_t<tier>_<uuid>`. */
export function newWeaponTreeBranchId(family: string, tier: number): string {
  const f = family.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "weapon";
  const t = Math.max(0, Math.min(5, Math.floor(tier)));
  return `wpn_tree_${f}_t${t}_${newUuid().slice(0, 8)}`;
}

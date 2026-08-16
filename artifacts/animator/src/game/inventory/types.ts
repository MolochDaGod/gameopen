/**
 * Production inventory SSOT — character bag vs account inventory.
 *
 * Layout:
 *   · Kept loadout 2×2 (does NOT drop on death; swappable with bag):
 *       [ mount ] [ boat ]
 *       [ main  ] [ side arm / off (weapon · shield · relic · tome · staff) ]
 *   · Carry bag 3×3 (resources / items) — DROPS on death (slots empty).
 *
 * Account inventory: single shared vault across islands, modes, instances, characters.
 * Materials stack to 100 in the bag before deposit. Equipment is unique instances.
 */

import { newUuid } from "@workspace/grudge-runtime";

/** Default bag grid for characters without a larger bag item. */
export const DEFAULT_BAG_COLS = 3;
export const DEFAULT_BAG_ROWS = 3;
export const DEFAULT_BAG_SLOTS = DEFAULT_BAG_COLS * DEFAULT_BAG_ROWS;

/** Stack cap for harvested materials / stackable loot in the character bag. */
export const MATERIAL_STACK_MAX = 100;

/**
 * Kept loadout (2×2 above the 3×3). Survives death; drag-swappable with bag.
 * Display order: mount, boat on top row; mainHand, sideArm bottom row.
 */
export type KeptLoadoutSlotId = "mount" | "boat" | "mainHand" | "sideArm";

export const KEPT_LOADOUT_ORDER: readonly KeptLoadoutSlotId[] = [
  "mount",
  "boat",
  "mainHand",
  "sideArm",
] as const;

export const KEPT_LOADOUT_LABELS: Record<KeptLoadoutSlotId, string> = {
  mount: "Mount",
  boat: "Boat",
  mainHand: "Main hand",
  sideArm: "Side arm",
};

export const KEPT_LOADOUT_BLURBS: Record<KeptLoadoutSlotId, string> = {
  mount: "Mount · kept on death",
  boat: "Boat / ship · kept on death",
  mainHand: "Primary weapon (melee or ranged)",
  sideArm: "2nd weapon or off-hand (shield · relic · tome · staff)",
};

export type ItemKind =
  | "material"
  | "consumable"
  | "equipment"
  | "weapon"
  | "mission"
  | "tool"
  | "relic"
  | "mount"
  | "boat"
  | "back";

export type EquipSlot =
  | "mainHand"
  | "offHand"
  | "sideArm"
  | "mount"
  | "boat"
  | "head"
  | "chest"
  | "legs"
  | "feet"
  | "accessory"
  | "tool"
  | "back";

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
  /**
   * Runtime id. Production unique gear: equals `grudgeUuid` (ledger).
   * Stackables: `stack_<templateId>`. Guest-only provisional: `prov_…`.
   */
  instanceId: string;
  /**
   * Railway structured item UUID (slot-tier-itemId-ts-counter) when ledgered.
   * Required for equip/craft/trade of unique items when signed in.
   */
  grudgeUuid?: string;
  /**
   * True when minted client-side without ledger (guest / offline only).
   * Never treat provisional as production bag SSOT.
   */
  provisional?: boolean;
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

/**
 * Unique gear must go through /api/uuid + /api/ledger when signed in.
 * Prefix heuristics only here (avoid catalog import cycle). Prefer
 * `isLedgerUniqueItem` from catalog.ts at call sites that already load catalog.
 */
export function isLedgerUniqueTemplate(templateId: string): boolean {
  if (!templateId) return false;
  if (
    templateId.startsWith("wpn_") ||
    templateId.startsWith("arm_") ||
    templateId.startsWith("itm_back_") ||
    templateId.startsWith("bck_") ||
    templateId.startsWith("EQIP-") ||
    templateId.startsWith("ITEM-")
  ) {
    return true;
  }
  if (
    templateId.startsWith("itm_mount") ||
    templateId.startsWith("itm_boat") ||
    templateId.startsWith("tool_") ||
    templateId.includes("_tool_")
  ) {
    return true;
  }
  return false;
}

/** Stackable materials / consumables — definition id + qty, not ledger uuid. */
export function isStackableTemplate(templateId: string): boolean {
  return !isLedgerUniqueTemplate(templateId);
}

/** True when instance is production-valid for equip/craft/trade. */
export function isLedgeredInstance(item: ItemInstance | null | undefined): boolean {
  if (!item) return false;
  if (item.provisional) return false;
  const id = item.grudgeUuid || item.instanceId;
  if (!id || id.startsWith("prov_") || id.startsWith("stack_") || id.startsWith("ent_")) {
    return false;
  }
  // Structured grudge UUID: slot-tier-itemId-ts-counter (has dashes, length)
  return id.includes("-") && id.length >= 20;
}

export type CharacterKeptLoadout = Record<KeptLoadoutSlotId, ItemInstance | null>;

export interface BagSlot {
  /** 0-based index into the bag grid. */
  index: number;
  item: ItemInstance | null;
}

export interface CharacterBagState {
  characterId: string;
  cols: number;
  rows: number;
  /** 3×3 carry grid — emptied on death. */
  slots: BagSlot[];
  /**
   * 2×2 kept loadout (mount · boat · main · side arm).
   * Never dropped on death; swappable with bag / account equip.
   */
  kept: CharacterKeptLoadout;
  /**
   * Utility quick slots — J / H / V (bag → place consumables, deployables, mounts).
   * Length always 3. Legacy name `consumableHotkeys` kept for save migration.
   */
  consumableHotkeys: (ItemInstance | null)[];
  updatedAt: number;
}

/** Keyboard codes for bag utility slots (index 0=J, 1=H, 2=V). */
export const UTILITY_HOTKEY_KEYS = ["J", "H", "V"] as const;
export type UtilityHotkeyKey = (typeof UTILITY_HOTKEY_KEYS)[number];
export const UTILITY_HOTKEY_COUNT = UTILITY_HOTKEY_KEYS.length;
export const UTILITY_HOTKEY_CODES = ["KeyJ", "KeyH", "KeyV"] as const;

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

/** Albion destination for bag deposit (see locationInventory + depositZones). */
export interface DepositDestinationInfo {
  kind: string;
  locationId?: string;
  label: string;
}

export interface DepositContext {
  zone: DepositZoneKind;
  /** True when quick-deposit button should illuminate. */
  canDeposit: boolean;
  label: string;
  /** Where goods land (camp storage vs home island bag). */
  destination?: DepositDestinationInfo;
  /** Show “Send camp → home island” affordance when at own camp. */
  canSendToHome?: boolean;
}

/** RMB context actions on a bag item. */
export type BagItemAction =
  | "deploy"
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

/**
 * Build a bag row **without** Railway mint.
 *
 * - Stackables → stable `stack_<templateId>` (OK for production qty bags)
 * - Unique gear → **provisional** only (guest/offline/tests)
 *
 * Production unique gear: use `mintUniqueItemInstance` from `ledgerClient.ts`.
 * Do not treat provisional uniques as bag SSOT when signed in.
 */
export function newItemInstance(
  templateId: string,
  qty = 1,
  extra?: Partial<ItemInstance>,
): ItemInstance {
  const unique = isLedgerUniqueTemplate(templateId);
  if (unique) {
    const grudgeUuid = extra?.grudgeUuid;
    const id =
      grudgeUuid ||
      extra?.instanceId ||
      `prov_${newUuid().replace(/-/g, "").slice(0, 16)}`;
    return {
      templateId,
      qty: Math.max(1, Math.floor(qty)),
      ...extra,
      instanceId: id,
      grudgeUuid: grudgeUuid || extra?.grudgeUuid,
      provisional: !grudgeUuid,
    };
  }
  return {
    templateId,
    qty: Math.max(1, Math.floor(qty)),
    provisional: false,
    ...extra,
    instanceId: extra?.instanceId || `stack_${templateId}`,
  };
}

/** @deprecated Use mintUniqueItemInstance when signed in. Alias for tests/guest. */
export const newProvisionalItemInstance = newItemInstance;

export function emptyKeptLoadout(): CharacterKeptLoadout {
  return {
    mount: null,
    boat: null,
    mainHand: null,
    sideArm: null,
  };
}

export function newCharacterBag(characterId: string): CharacterBagState {
  const slots = emptyBagSlots(DEFAULT_BAG_SLOTS);
  // Starter: claim flag so camp can be deployed from inventory without grinding.
  slots[0] = {
    index: 0,
    item: newItemInstance("itm_claim_flag", 1, { bound: true }),
  };
  return {
    characterId: characterId || "local",
    cols: DEFAULT_BAG_COLS,
    rows: DEFAULT_BAG_ROWS,
    slots,
    kept: emptyKeptLoadout(),
    consumableHotkeys: [null, null, null],
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

/**
 * Railway UUID ledger client — production SSOT for unique item instances.
 *
 * Law (GRUDGE_IDENTITY_CONSOLIDATION Phase 1):
 *  - Stackable mats → account resources / bag qty (definition id + qty)
 *  - Unique gear/craft/equip → grudge_uuid via /api/uuid + /api/ledger/*
 *  - Open localStorage bag is **cache only** when signed in
 *
 * @see Grudge-Builder/docs/UUID_SYSTEM.md
 * @see Grudge-Builder/docs/GRUDGE_IDENTITY_CONSOLIDATION.md
 */

import { apiUrl, readFleetToken } from "../../auth/fleetCore";
import { getItemTemplate, isLedgerUniqueItem } from "./catalog";
import type { EquipSlot, ItemInstance, KeptLoadoutSlotId } from "./types";

export type LedgerEventType =
  | "CREATED"
  | "ASSIGNED"
  | "EQUIPPED"
  | "UNEQUIPPED"
  | "UPGRADED"
  | "CONSUMED"
  | "TRANSFERRED"
  | "DESTROYED"
  | "ARCHIVED";

function authHeaders(json = false): HeadersInit {
  const t = readFleetToken();
  const h: Record<string, string> = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

/** Map template → grudgeUUID slot label for generate API. */
export function slotLabelForTemplate(templateId: string): string {
  const tpl = getItemTemplate(templateId);
  const eq = tpl.equipSlot;
  if (eq === "mainHand" || eq === "sideArm") return "Weapon";
  if (eq === "offHand") return "Shield";
  if (eq === "mount") return "Item";
  if (eq === "boat") return "Item";
  if (eq === "head") return "Head";
  if (eq === "chest") return "Chest";
  if (eq === "legs") return "Legs";
  if (eq === "feet") return "Feet";
  if (
    eq === "back" ||
    tpl.kind === "back" ||
    templateId.startsWith("itm_back_") ||
    templateId.startsWith("bck_")
  ) {
    return "Back";
  }
  if (tpl.kind === "weapon") return "Weapon";
  if (tpl.kind === "tool") return "Item";
  return "Item";
}

export function tierForTemplate(templateId: string): number {
  const tpl = getItemTemplate(templateId);
  return typeof tpl.weaponTier === "number" ? tpl.weaponTier : 0;
}

/** Stable numeric itemId for generate (catalog hash, 1–9999). */
export function numericItemId(templateId: string): number {
  let h = 0;
  for (let i = 0; i < templateId.length; i++) {
    h = (h * 31 + templateId.charCodeAt(i)) >>> 0;
  }
  return (h % 9999) + 1;
}

export async function generateGrudgeUuid(opts: {
  slot: string;
  tier?: number | null;
  itemId: number;
}): Promise<string | null> {
  if (!readFleetToken()) return null;
  try {
    const res = await fetch(apiUrl("/api/uuid/generate"), {
      method: "POST",
      headers: authHeaders(true),
      credentials: "include",
      body: JSON.stringify({
        slot: opts.slot,
        tier: opts.tier ?? 0,
        itemId: opts.itemId,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      uuid?: string;
      grudgeUuid?: string;
      error?: string;
    };
    const id = data.uuid || data.grudgeUuid || null;
    if (!id && import.meta.env.DEV) {
      console.warn("[ledger] uuid/generate failed", res.status, data);
    }
    return id;
  } catch {
    return null;
  }
}

export async function logLedgerEvent(body: {
  grudgeUuid: string;
  eventType: LedgerEventType;
  accountId?: string | null;
  characterId?: string | null;
  itemId?: string;
  itemName?: string;
  itemTier?: number | null;
  itemSlot?: string;
  sourceType?: string;
  sourceRef?: string;
  relatedUuids?: string[];
  outputUuid?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (!readFleetToken() || !body.grudgeUuid || !body.eventType) return false;
  try {
    const res = await fetch(apiUrl("/api/ledger/event"), {
      method: "POST",
      headers: authHeaders(true),
      credentials: "include",
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function validateLedgerUuid(grudgeUuid: string): Promise<{
  isValid: boolean;
  exists: boolean;
  currentState?: string;
} | null> {
  if (!readFleetToken() || !grudgeUuid) return null;
  try {
    const res = await fetch(
      apiUrl(`/api/ledger/validate/${encodeURIComponent(grudgeUuid)}`),
      { headers: authHeaders(), credentials: "include" },
    );
    if (!res.ok) return null;
    return (await res.json()) as {
      isValid: boolean;
      exists: boolean;
      currentState?: string;
    };
  } catch {
    return null;
  }
}

/**
 * Mint a **unique** item instance through Railway UUID + ledger.
 * Returns null if offline/guest (caller may use provisional guest instance).
 */
export async function mintUniqueItemInstance(opts: {
  templateId: string;
  accountId?: string | null;
  characterId?: string | null;
  sourceType?: string;
  sourceRef?: string;
  qty?: number;
}): Promise<ItemInstance | null> {
  const templateId = opts.templateId;
  if (!isLedgerUniqueItem(templateId)) {
    // Stackables are not ledger-minted
    return null;
  }
  if (!readFleetToken()) return null;

  const tpl = getItemTemplate(templateId);
  const slot = slotLabelForTemplate(templateId);
  const tier = tierForTemplate(templateId);
  const itemIdNum = numericItemId(templateId);
  const grudgeUuid = await generateGrudgeUuid({
    slot,
    tier,
    itemId: itemIdNum,
  });
  if (!grudgeUuid) return null;

  const accountId = opts.accountId || undefined;
  const characterId = opts.characterId || undefined;
  const meta = {
    templateId,
    description: `Mint ${tpl.name}`,
  };

  await logLedgerEvent({
    grudgeUuid,
    eventType: "CREATED",
    accountId,
    characterId,
    itemId: templateId,
    itemName: tpl.name,
    itemTier: tier,
    itemSlot: slot,
    sourceType: opts.sourceType || "open_mint",
    sourceRef: opts.sourceRef,
    metadata: meta,
  });
  await logLedgerEvent({
    grudgeUuid,
    eventType: "ASSIGNED",
    accountId,
    characterId,
    itemId: templateId,
    itemName: tpl.name,
    itemTier: tier,
    itemSlot: slot,
    sourceType: opts.sourceType || "open_mint",
    sourceRef: opts.sourceRef,
    metadata: meta,
  });

  return {
    instanceId: grudgeUuid,
    grudgeUuid,
    templateId,
    qty: Math.max(1, Math.floor(opts.qty ?? 1)),
    provisional: false,
    tier: tier || undefined,
  };
}

/** Craft via ledger (unique inputs → unique output). */
export async function ledgerCraft(opts: {
  accountId: string;
  characterId?: string | null;
  inputUuids: string[];
  recipeId?: string;
  outputTemplateId: string;
  outputItemName?: string;
  outputItemTier?: number;
  outputItemSlot?: string;
}): Promise<{ ok: boolean; crafted?: ItemInstance; error?: string }> {
  if (!readFleetToken()) {
    return { ok: false, error: "Sign in required for ledger craft" };
  }
  if (!opts.accountId || !opts.inputUuids?.length) {
    return { ok: false, error: "accountId and inputUuids required" };
  }
  const tpl = getItemTemplate(opts.outputTemplateId);
  try {
    const res = await fetch(apiUrl("/api/ledger/craft"), {
      method: "POST",
      headers: authHeaders(true),
      credentials: "include",
      body: JSON.stringify({
        accountId: opts.accountId,
        characterId: opts.characterId,
        inputUuids: opts.inputUuids,
        recipeId: opts.recipeId,
        outputItemId: opts.outputTemplateId,
        outputItemName: opts.outputItemName || tpl.name,
        outputItemTier: opts.outputItemTier ?? tierForTemplate(opts.outputTemplateId),
        outputItemSlot:
          opts.outputItemSlot || slotLabelForTemplate(opts.outputTemplateId),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      craftedItem?: { grudgeUuid?: string; itemId?: string; itemName?: string };
    };
    if (!res.ok || !data.success || !data.craftedItem?.grudgeUuid) {
      return { ok: false, error: data.error || `craft failed ${res.status}` };
    }
    return {
      ok: true,
      crafted: {
        instanceId: data.craftedItem.grudgeUuid,
        grudgeUuid: data.craftedItem.grudgeUuid,
        templateId: data.craftedItem.itemId || opts.outputTemplateId,
        qty: 1,
        provisional: false,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "craft network error",
    };
  }
}

const KEPT_TO_EQUIP: Record<KeptLoadoutSlotId, EquipSlot | string> = {
  mainHand: "mainHand",
  sideArm: "sideArm",
  mount: "mount",
  boat: "boat",
};

/** EQUIPPED / UNEQUIPPED ledger events for a unique instance. */
export async function ledgerEquipChange(opts: {
  item: ItemInstance;
  characterId: string;
  accountId?: string | null;
  /** Kept 2×2 (mount / boat / main / side). */
  keptSlot?: KeptLoadoutSlotId;
  /** Body paperdoll slot that is not kept 2×2 (Back). */
  bodySlot?: "back";
  equip: boolean;
}): Promise<boolean> {
  const uuid = opts.item.grudgeUuid || opts.item.instanceId;
  if (!uuid || opts.item.provisional) return false;
  if (!isLedgerUniqueItem(opts.item.templateId)) return false;
  if (!readFleetToken()) return false;
  const slotKey = opts.bodySlot || opts.keptSlot;
  if (!slotKey) return false;

  const tpl = getItemTemplate(opts.item.templateId);
  const itemSlot =
    opts.bodySlot === "back"
      ? "Back"
      : String(KEPT_TO_EQUIP[opts.keptSlot!] || opts.keptSlot);
  return logLedgerEvent({
    grudgeUuid: uuid,
    eventType: opts.equip ? "EQUIPPED" : "UNEQUIPPED",
    accountId: opts.accountId,
    characterId: opts.characterId,
    itemId: opts.item.templateId,
    itemName: tpl.name,
    itemTier: opts.item.tier ?? tierForTemplate(opts.item.templateId),
    itemSlot,
    sourceType: "open_equip",
    sourceRef: slotKey,
    metadata: {
      keptSlot: opts.keptSlot,
      bodySlot: opts.bodySlot,
      templateId: opts.item.templateId,
    },
  });
}

/**
 * PATCH character appearance (mesh / skin / avatar) for one UUID slot.
 * Does not invent a second store — Railway characters row only.
 */
export async function patchCharacterAppearance(
  characterId: string,
  body: {
    model3d?: Record<string, unknown>;
    avatarUrl?: string | null;
    equipment?: Record<string, unknown> | unknown[];
    saveData?: Record<string, unknown>;
    name?: string;
  },
): Promise<boolean> {
  if (!readFleetToken() || !characterId || characterId === "local") return false;
  // Reject non-UUID guest ids
  if (characterId.startsWith("guest") || characterId.startsWith("prov_")) {
    return false;
  }
  try {
    const res = await fetch(
      apiUrl(`/api/characters/${encodeURIComponent(characterId)}`),
      {
        method: "PATCH",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify(body),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

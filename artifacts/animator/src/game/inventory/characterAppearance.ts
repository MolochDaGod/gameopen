/**
 * Per-slot character appearance save (mesh · skin · avatar edit · equipment).
 * One Railway character UUID = one independent look (4 slots × era).
 *
 * @see Grudge-Builder/docs/GRUDGE_IDENTITY_CONSOLIDATION.md §7
 */

import { patchCharacterAppearance } from "./ledgerClient";
import type { CharacterBagState, ItemInstance, KeptLoadoutSlotId } from "./types";
import { KEPT_LOADOUT_ORDER } from "./types";

export type AppearanceSaveInput = {
  characterId: string;
  /** Body kit / pipeline / skins / mesh_ids */
  model3d?: Record<string, unknown>;
  /** 2D portrait or head still URL */
  avatarUrl?: string | null;
  /** Avatar Edit head blob (voxelLook etc.) under saveData.open */
  voxelLook?: Record<string, unknown> | null;
  /** Optional display name */
  name?: string;
  /** Merge full saveData (open / realms namespaces) */
  saveDataPatch?: Record<string, unknown>;
  /** Character bag kept loadout → equipment refs for mesh hydrate */
  bag?: CharacterBagState | null;
  /** Body Back instance (not kept 2×2). Stamped on equipment.back. */
  back?: ItemInstance | null;
  /** Live play mesh_ids including `equip:back:*` when known. */
  meshIds?: string[];
};

/** Build equipment mesh refs from kept loadout (grudgeUuid + templateId). */
export function equipmentFromKept(
  bag: CharacterBagState | null | undefined,
): Record<string, { templateId: string; grudgeUuid?: string; instanceId: string }> {
  const out: Record<
    string,
    { templateId: string; grudgeUuid?: string; instanceId: string }
  > = {};
  if (!bag?.kept) return out;
  for (const slot of KEPT_LOADOUT_ORDER as KeptLoadoutSlotId[]) {
    const it = bag.kept[slot];
    if (!it) continue;
    out[slot] = {
      templateId: it.templateId,
      grudgeUuid: it.grudgeUuid,
      instanceId: it.instanceId,
    };
  }
  return out;
}

export type WornEquipRef = {
  templateId: string;
  grudgeUuid?: string;
  instanceId: string;
};

/** Body Back ref — same shape as kept slots, different persist key. */
export function equipmentBackFromItem(
  item: ItemInstance | null | undefined,
): WornEquipRef | null {
  if (!item) return null;
  return {
    templateId: item.templateId,
    grudgeUuid: item.grudgeUuid,
    instanceId: item.instanceId,
  };
}

/**
 * Persist appearance + worn equipment mesh refs to Railway for this UUID only.
 */
export async function saveCharacterSlotAppearance(
  input: AppearanceSaveInput,
): Promise<{ ok: boolean; message: string }> {
  const id = input.characterId;
  if (!id || id === "local" || id.startsWith("guest")) {
    return { ok: false, message: "Need character UUID to save appearance" };
  }

  const equipment = equipmentFromKept(input.bag);
  const backRef = equipmentBackFromItem(input.back ?? undefined);
  if (input.back !== null && backRef) equipment.back = backRef;

  const saveData: Record<string, unknown> = {
    ...(input.saveDataPatch || {}),
  };
  if (input.voxelLook != null) {
    const open =
      typeof saveData.open === "object" && saveData.open
        ? { ...(saveData.open as object) }
        : {};
    saveData.open = { ...open, voxelLook: input.voxelLook };
  }

  const model3d: Record<string, unknown> = {
    ...(input.model3d || {}),
  };
  // Always stamp mesh refs from worn unique gear when bag / back provided
  if (input.bag || backRef) {
    const meshIds = Object.values(equipment)
      .map((e) => e.templateId)
      .filter(Boolean);
    if (meshIds.length) {
      model3d.equippedMeshes = meshIds;
      model3d.equipmentSlots = equipment;
    }
  }
  if (input.meshIds?.length) {
    model3d.meshIds = input.meshIds.slice();
  }

  const body: Parameters<typeof patchCharacterAppearance>[1] = {};
  if (Object.keys(model3d).length) body.model3d = model3d;
  if (input.avatarUrl !== undefined) body.avatarUrl = input.avatarUrl;
  if (Object.keys(saveData).length) body.saveData = saveData;
  if (Object.keys(equipment).length) body.equipment = equipment;
  if (input.name) body.name = input.name;

  if (!Object.keys(body).length) {
    return { ok: false, message: "Nothing to save" };
  }

  const ok = await patchCharacterAppearance(id, body);
  return {
    ok,
    message: ok
      ? `Appearance saved for character ${id}`
      : "Appearance save failed (auth or network)",
  };
}

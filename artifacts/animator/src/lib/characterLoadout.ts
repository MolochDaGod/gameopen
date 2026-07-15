/**
 * Character loadout bridge — equipment + open-game saves for fleet characters.
 *
 * Characters live on GrudgeBuilder Postgres (`/api/characters`). Open stores a
 * namespaced blob under `saveData.open` (or `config.open`) so Warlords and other
 * clients keep their own keys.
 */
import type { WeaponId } from "../three/types";
import { WEAPONS } from "../three/arsenal";
import type { GrudgeCharacter } from "./grudgeAuth";
import { getStoredToken, apiFetch } from "./grudgeAuth";

const OPEN_SAVE_NS = "open";

export type OpenCharacterLoadout = {
  /** Primary weapon for Danger Room / brawler / playtest */
  weaponId: WeaponId;
  /** Off-hand piece (shield, etc.) or null */
  offHand: WeaponId | null;
  /** Avatar catalog id if not using grudge: race path (e.g. race-human) */
  avatarId?: string;
  /** Last mode played */
  lastMode?: string;
  /** Opaque per-mode bags (danger progress, etc.) */
  bags?: Record<string, unknown>;
  updatedAt?: number;
};

const WEAPON_SET = new Set(WEAPONS.map((w) => w.id));

function asWeaponId(v: unknown): WeaponId | null {
  if (typeof v !== "string" || !v) return null;
  return WEAPON_SET.has(v as WeaponId) ? (v as WeaponId) : null;
}

/** Deep-merge open blob from config + saveData. */
function openBlob(ch: GrudgeCharacter | null | undefined): Record<string, unknown> {
  if (!ch) return {};
  const fromSave = (ch.saveData?.[OPEN_SAVE_NS] as Record<string, unknown>) || {};
  const fromCfg = (ch.config?.[OPEN_SAVE_NS] as Record<string, unknown>) || {};
  // Also accept flat legacy keys on saveData/config
  const flat: Record<string, unknown> = {};
  for (const src of [ch.saveData, ch.config]) {
    if (!src) continue;
    if (src.weaponId) flat.weaponId = src.weaponId;
    if (src.weapon) flat.weapon = src.weapon;
    if (src.offHand !== undefined) flat.offHand = src.offHand;
    if (src.equippedWeapon) flat.weaponId = src.equippedWeapon;
  }
  return { ...fromCfg, ...fromSave, ...flat };
}

/** Resolve loadout for play — defaults to sword if nothing saved. */
export function loadoutFromCharacter(ch: GrudgeCharacter | null | undefined): OpenCharacterLoadout {
  const b = openBlob(ch);
  const weaponId =
    asWeaponId(b.weaponId) ||
    asWeaponId(b.weapon) ||
    asWeaponId(b.equippedWeapon) ||
    "sword";
  let offHand: WeaponId | null = null;
  if (b.offHand === null || b.offHand === "none" || b.offHand === "") offHand = null;
  else offHand = asWeaponId(b.offHand) || asWeaponId(b.offhand) || null;

  return {
    weaponId,
    offHand,
    avatarId: typeof b.avatarId === "string" ? b.avatarId : undefined,
    lastMode: typeof b.lastMode === "string" ? b.lastMode : undefined,
    bags: (b.bags as Record<string, unknown>) || undefined,
    updatedAt: typeof b.updatedAt === "number" ? b.updatedAt : undefined,
  };
}

/** Merge loadout into character saveData shape for API PATCH. */
export function mergeOpenSaveData(
  ch: GrudgeCharacter | null | undefined,
  patch: Partial<OpenCharacterLoadout>,
): Record<string, unknown> {
  const prev = loadoutFromCharacter(ch);
  const next: OpenCharacterLoadout = {
    ...prev,
    ...patch,
    weaponId: patch.weaponId || prev.weaponId,
    offHand: patch.offHand !== undefined ? patch.offHand : prev.offHand,
    bags: { ...(prev.bags || {}), ...(patch.bags || {}) },
    updatedAt: Date.now(),
  };
  const baseSave = { ...(ch?.saveData || {}) };
  baseSave[OPEN_SAVE_NS] = next;
  return baseSave;
}

/**
 * Persist Open loadout / bags to fleet character SSOT.
 * Uses PATCH /api/characters/:id with { saveData }.
 * No-op when guest or no token.
 */
export async function saveCharacterOpenLoadout(
  characterId: string,
  ch: GrudgeCharacter | null | undefined,
  patch: Partial<OpenCharacterLoadout>,
): Promise<boolean> {
  if (!characterId || !getStoredToken()) return false;
  const saveData = mergeOpenSaveData(ch, patch);
  try {
    const r = await apiFetch(`/api/characters/${encodeURIComponent(characterId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveData }),
    });
    if (r.ok) return true;
    // Some gateways use PUT
    const r2 = await apiFetch(`/api/characters/${encodeURIComponent(characterId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saveData }),
    });
    return r2.ok;
  } catch {
    return false;
  }
}

/** Persist a named bag (e.g. danger progress) without clobbering equipment. */
export async function saveCharacterGameBag(
  characterId: string,
  ch: GrudgeCharacter | null | undefined,
  bagKey: string,
  bag: Record<string, unknown>,
): Promise<boolean> {
  return saveCharacterOpenLoadout(characterId, ch, {
    bags: { [bagKey]: bag },
  });
}

/** Debounce timer for equip writes (shared across weapon / off-hand). */
let _loadoutSaveTimer: ReturnType<typeof setTimeout> | null = null;
/** Accumulated patch so rapid weapon+offHand swaps do not drop one side. */
let _pendingLoadout: {
  characterId: string;
  ch: GrudgeCharacter | null | undefined;
  patch: Partial<OpenCharacterLoadout>;
  onSaved?: (mergedSaveData: Record<string, unknown>) => void;
} | null = null;

/**
 * Debounced equip save for play surfaces.
 * Applies PATCH after 450ms idle so rapid gear swaps do not spam Railway.
 * Merges consecutive patches (weapon + off-hand) into one write.
 * `onSaved` runs optimistically with the merged saveData blob.
 */
export function scheduleCharacterLoadoutSave(
  characterId: string,
  ch: GrudgeCharacter | null | undefined,
  patch: Partial<OpenCharacterLoadout>,
  onSaved?: (mergedSaveData: Record<string, unknown>) => void,
): void {
  if (!characterId || !getStoredToken()) return;
  const prev = _pendingLoadout;
  const sameChar = prev && prev.characterId === characterId;
  _pendingLoadout = {
    characterId,
    // Prefer freshest character snapshot when same id
    ch: ch ?? prev?.ch,
    patch: sameChar ? { ...prev!.patch, ...patch } : { ...patch },
    onSaved: onSaved || prev?.onSaved,
  };
  if (_loadoutSaveTimer) clearTimeout(_loadoutSaveTimer);
  _loadoutSaveTimer = setTimeout(() => {
    _loadoutSaveTimer = null;
    const job = _pendingLoadout;
    _pendingLoadout = null;
    if (!job) return;
    const saveData = mergeOpenSaveData(job.ch, job.patch);
    // Optimistic local merge so re-apply on subscribe keeps new gear
    job.onSaved?.(saveData);
    void saveCharacterOpenLoadout(job.characterId, job.ch, job.patch).then((ok) => {
      if (!ok && import.meta.env.DEV) {
        console.warn("[characterLoadout] save failed for", job.characterId, job.patch);
      }
    });
  }, 450);
}

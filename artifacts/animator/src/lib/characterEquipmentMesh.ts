/**
 * Account equipment → grudge6 mesh_ids (main panel / Danger Room SSOT).
 *
 * Production contract (grudge6-modular-characters):
 *   Railway character.equipment / appearance / saveData
 *     → mesh_ids[] (or gear_preset id / class)
 *     → child-mesh visibility on race kit + race atlas texture
 *
 * Icons come from ObjectStore equipment / weapons definitions (CDN paths).
 */
import type { GrudgeCharacter } from "./grudgeAuth";
import {
  getPreset,
  RACE_GEAR_PRESETS,
  type PresetId,
  type RaceId,
} from "../three/grudge/index";
import { resolvePresetId, resolveRaceId } from "./raceModel";

import { FLEET } from "./fleet";
import { contentCandidates, fetchCatalogJson } from "./fleetSsot";
import {
  productionItemIconUrl,
  resolveProductionIconUrl,
  getProductionMediaIndex,
} from "./productionMedia";

const CDN = FLEET.assets;

export type ResolvedEquipmentVisual = {
  raceId: RaceId;
  presetId: PresetId;
  /** Child mesh names / mesh_ids to show on the race kit */
  meshIds: string[];
  /** Source of mesh list for debug HUD */
  source: "equipment.mesh_ids" | "gear_preset" | "class_preset" | "slot_map" | "default";
  /** ObjectStore / D1 gear preset id when known */
  gearPresetId?: string;
  /** Icon URLs for HUD / main panel (slot → url) */
  slotIcons: Record<string, string>;
  /** Item labels for tooltips */
  slotLabels: Record<string, string>;
};

type GearPresetRemote = {
  id?: string;
  raceId?: string;
  raceRaw?: string;
  classId?: string;
  meshIds?: string[];
  mesh_ids?: string[];
  animPack?: string;
  label?: string;
};

let remotePresetsCache: GearPresetRemote[] | null = null;
let remotePresetsPromise: Promise<GearPresetRemote[]> | null = null;

export async function loadRemoteGearPresets(force = false): Promise<GearPresetRemote[]> {
  if (remotePresetsCache && !force) return remotePresetsCache;
  if (remotePresetsPromise && !force) return remotePresetsPromise;
  remotePresetsPromise = (async () => {
    try {
      // Multi-host: info SSOT → same-origin proxy → legacy objectstore
      const j = await fetchCatalogJson<{ presets?: GearPresetRemote[] } | GearPresetRemote[]>(
        "grudge6GearPresets",
      );
      if (!j) throw new Error("gear presets miss all hosts");
      const list = Array.isArray(j) ? j : j.presets || [];
      remotePresetsCache = list;
      if (!list.length) {
        console.warn(
          "[characterEquipmentMesh] empty gear presets; tried",
          contentCandidates("grudge6-gear-presets.json").slice(0, 3),
        );
      }
      return list;
    } catch (e) {
      console.warn("[characterEquipmentMesh] gear presets fetch failed", e);
      remotePresetsCache = [];
      return [];
    } finally {
      remotePresetsPromise = null;
    }
  })();
  return remotePresetsPromise;
}

function asStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          return String(o.meshId || o.mesh_id || o.id || o.name || "");
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

/** Pull nested equipment / appearance bags from fleet character shapes. */
function equipmentBag(ch: GrudgeCharacter | null | undefined): Record<string, unknown> {
  if (!ch) return {};
  const bags: Record<string, unknown>[] = [];
  for (const src of [ch.saveData, ch.config, ch as unknown as Record<string, unknown>]) {
    if (!src || typeof src !== "object") continue;
    const s = src as Record<string, unknown>;
    if (s.equipment && typeof s.equipment === "object") bags.push(s.equipment as Record<string, unknown>);
    if (s.appearance && typeof s.appearance === "object") bags.push(s.appearance as Record<string, unknown>);
    if (s.loadout && typeof s.loadout === "object") bags.push(s.loadout as Record<string, unknown>);
    if (s.gear && typeof s.gear === "object") bags.push(s.gear as Record<string, unknown>);
    if (s.open && typeof s.open === "object") {
      const open = s.open as Record<string, unknown>;
      if (open.equipment && typeof open.equipment === "object") {
        bags.push(open.equipment as Record<string, unknown>);
      }
      if (open.meshIds || open.mesh_ids) bags.push(open);
    }
  }
  return Object.assign({}, ...bags);
}

/**
 * Resolve item icon URL (production best practice):
 *  1. Explicit iconUrl / CDN path on the item
 *  2. master-items catalog via productionMedia
 *  3. Same-origin Open icons (always deployed)
 *  4. R2 pack fallback
 * Never invent bare `icons/wcs/equipment/<slug>.png` as the only option —
 * that path 404s for most fleet item ids.
 */
function iconUrlFromItem(raw: unknown): string | null {
  if (!raw) return null;
  const sameOrigin = (rel: string) =>
    `/${rel.replace(/^\//, "")}`;
  const r2 = (rel: string) =>
    `${CDN}/${rel.replace(/^\//, "")}`;

  if (typeof raw === "string") {
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("/")) return raw; // same-origin absolute path
    if (raw.startsWith("icons/")) {
      return resolveProductionIconUrl(raw) || sameOrigin(raw);
    }
    // Catalog id / slug → production master-items when warm
    if (getProductionMediaIndex()?.itemCount) {
      return productionItemIconUrl(raw);
    }
    const bare = raw.replace(/\.png$/i, "").split("/").pop() || raw;
    return sameOrigin(`icons/${bare}.png`);
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const cand =
      o.iconUrl ||
      o.icon ||
      o.iconPath ||
      o.cdnIcon ||
      o.image ||
      o.thumbnail;
    if (typeof cand === "string" && cand) {
      if (cand.startsWith("http")) return cand;
      if (cand.startsWith("/")) return cand;
      const prod = resolveProductionIconUrl(cand);
      if (prod) return prod;
      if (cand.startsWith("icons/")) return sameOrigin(cand);
      if (cand.includes("/")) return r2(cand);
      return sameOrigin(`icons/${cand.replace(/\.png$/i, "")}.png`);
    }
    const id = o.itemId || o.id || o.slug || o.name;
    if (typeof id === "string" && id) {
      if (getProductionMediaIndex()?.itemCount) {
        return productionItemIconUrl(id);
      }
      const bare = id.replace(/\.png$/i, "").split("/").pop() || id;
      return sameOrigin(`icons/${bare}.png`);
    }
  }
  return null;
}

function labelFromItem(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return String(o.label || o.name || o.itemId || o.id || "");
  }
  return "";
}

/**
 * Map common equipment slot values → mesh name fragments for fuzzy match.
 * Used when account only stores slot item ids without mesh_ids.
 */
const SLOT_MESH_HINTS: Record<string, string[]> = {
  head: ["head"],
  helm: ["head"],
  helmet: ["head"],
  body: ["body"],
  chest: ["body"],
  armor: ["body"],
  torso: ["body"],
  arms: ["arms"],
  gloves: ["arms"],
  gauntlets: ["arms"],
  legs: ["legs"],
  pants: ["legs"],
  boots: ["legs"],
  shoulders: ["shoulder", "shoulderpads"],
  shoulder: ["shoulder", "shoulderpads"],
  shoulderpads: ["shoulder", "shoulderpads"],
  mainHand: ["weapon", "sword", "axe", "hammer", "mace", "spear", "dagger", "staff", "bow"],
  mainhand: ["weapon", "sword", "axe", "hammer", "mace", "spear", "dagger", "staff", "bow"],
  weapon: ["weapon", "sword", "axe", "hammer", "mace", "spear", "dagger", "staff", "bow"],
  rightHand: ["weapon", "sword", "axe"],
  offHand: ["shield", "weapon"],
  offhand: ["shield"],
  shield: ["shield"],
  leftHand: ["shield", "bow", "staff"],
  bow: ["bow"],
  staff: ["staff"],
  quiver: ["quiver", "xtra"],
  bag: ["bag", "xtra"],
};

function meshIdsFromSlots(eq: Record<string, unknown>, raceId: RaceId, presetId: PresetId): string[] {
  // Start from class preset so armor baseline exists
  const base = getPreset(raceId, presetId).visibleMeshes.slice();
  const baseKeys = new Set(
    base.map((n) =>
      n
        .toLowerCase()
        .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
        .replace(/units_/g, "")
        .replace(/[^a-z0-9]/g, ""),
    ),
  );

  // If slots carry explicit meshId, use them
  const explicit: string[] = [];
  for (const [slot, val] of Object.entries(eq)) {
    if (!val) continue;
    if (typeof val === "object") {
      const o = val as Record<string, unknown>;
      const mid = o.meshId || o.mesh_id || o.mesh;
      if (typeof mid === "string" && mid) explicit.push(mid);
      if (Array.isArray(o.meshIds)) explicit.push(...asStringArray(o.meshIds));
    }
    if (typeof val === "string" && /^(WK_|BRB_|ORC_|ELF_|UD_|DWF_)/i.test(val)) {
      explicit.push(val);
    }
  }
  if (explicit.length) {
    // Merge: keep non-weapon body pieces from base if not overridden
    const out = new Set(base);
    for (const m of explicit) {
      // Drop competing pieces in same slot family
      const hint = SLOT_MESH_HINTS[Object.keys(SLOT_MESH_HINTS).find((k) => m.toLowerCase().includes(k)) || ""] || [];
      if (hint.length) {
        for (const b of [...out]) {
          const bl = b.toLowerCase();
          if (hint.some((h) => bl.includes(h))) out.delete(b);
        }
      }
      out.add(m);
    }
    return [...out];
  }

  // No explicit meshes — keep class preset (true main-panel default)
  void baseKeys;
  return base;
}

function mapRemoteRace(raw: string | undefined): RaceId | null {
  if (!raw) return null;
  return resolveRaceId(raw);
}

/**
 * Synchronous resolve using local gear presets + character bags.
 * Prefer {@link resolveCharacterEquipmentVisual} for remote ObjectStore mesh_ids.
 */
export function resolveCharacterEquipmentVisualSync(
  ch: GrudgeCharacter | null | undefined,
): ResolvedEquipmentVisual {
  const raceId = resolveRaceId(ch?.raceId);
  const presetId = resolvePresetId(ch?.classId);
  const eq = equipmentBag(ch);
  const slotIcons: Record<string, string> = {};
  const slotLabels: Record<string, string> = {};

  for (const [slot, val] of Object.entries(eq)) {
    const icon = iconUrlFromItem(val);
    if (icon) slotIcons[slot] = icon;
    const lab = labelFromItem(val);
    if (lab) slotLabels[slot] = lab;
  }

  // 1) Explicit mesh_ids on equipment / appearance / open
  const direct =
    asStringArray(eq.meshIds) ||
    asStringArray(eq.mesh_ids) ||
    asStringArray((ch?.saveData as Record<string, unknown> | undefined)?.meshIds) ||
    asStringArray((ch?.config as Record<string, unknown> | undefined)?.meshIds);
  // asStringArray never returns null — fix
  const meshDirect = [
    ...asStringArray(eq.meshIds),
    ...asStringArray(eq.mesh_ids),
    ...asStringArray((eq as { meshes?: unknown }).meshes),
  ];
  if (meshDirect.length >= 3) {
    return {
      raceId,
      presetId,
      meshIds: meshDirect,
      source: "equipment.mesh_ids",
      gearPresetId: typeof eq.gearPresetId === "string" ? eq.gearPresetId : undefined,
      slotIcons,
      slotLabels,
    };
  }

  // 2) gear_preset / gearPreset id on character
  const gpId =
    (typeof eq.gearPresetId === "string" && eq.gearPresetId) ||
    (typeof eq.gear_preset === "string" && eq.gear_preset) ||
    (typeof eq.presetId === "string" && eq.presetId) ||
    undefined;
  if (gpId && remotePresetsCache?.length) {
    const hit = remotePresetsCache.find((p) => p.id === gpId || p.id?.endsWith(gpId));
    const ids = asStringArray(hit?.meshIds || hit?.mesh_ids);
    if (ids.length) {
      return {
        raceId,
        presetId: resolvePresetId(hit?.classId || presetId),
        meshIds: ids,
        source: "gear_preset",
        gearPresetId: gpId,
        slotIcons,
        slotLabels,
      };
    }
  }

  // 3) Slot-mapped equipment (main panel items) with class baseline
  const fromSlots = meshIdsFromSlots(eq, raceId, presetId);
  if (Object.keys(eq).length > 0) {
    return {
      raceId,
      presetId,
      meshIds: fromSlots,
      source: "slot_map",
      gearPresetId: gpId,
      slotIcons,
      slotLabels,
    };
  }

  // 4) Class gear preset (local SSOT)
  const preset = getPreset(raceId, presetId);
  return {
    raceId,
    presetId,
    meshIds: preset.visibleMeshes.slice(),
    source: "class_preset",
    slotIcons,
    slotLabels,
  };
}

/** Async: loads ObjectStore gear presets then resolves. */
export async function resolveCharacterEquipmentVisual(
  ch: GrudgeCharacter | null | undefined,
): Promise<ResolvedEquipmentVisual> {
  await loadRemoteGearPresets();
  const sync = resolveCharacterEquipmentVisualSync(ch);
  if (sync.source === "equipment.mesh_ids" || sync.source === "gear_preset") return sync;

  // Try match race+class against remote presets for authoritative mesh_ids
  const raceId = sync.raceId;
  const presetId = sync.presetId;
  const remote = remotePresetsCache || [];
  const hit = remote.find((p) => {
    const pr = mapRemoteRace(p.raceRaw || p.raceId);
    const pc = resolvePresetId(p.classId);
    return pr === raceId && pc === presetId;
  });
  const ids = asStringArray(hit?.meshIds || hit?.mesh_ids);
  if (ids.length >= 3) {
    return {
      ...sync,
      meshIds: ids,
      source: "gear_preset",
      gearPresetId: hit?.id || sync.gearPresetId,
    };
  }
  return sync;
}

/** Default mesh ids for a race/class without a character row. */
export function meshIdsForRaceClass(raceId: RaceId, presetId: PresetId): string[] {
  return getPreset(raceId, presetId).visibleMeshes.slice();
}

export function listLocalPresets(raceId: RaceId) {
  return RACE_GEAR_PRESETS[raceId] || [];
}

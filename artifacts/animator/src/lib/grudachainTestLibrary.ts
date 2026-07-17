/**
 * GRUDACHAIN test character library — production heroes for Open QA.
 *
 * Contract:
 *  - Characters live on Railway Postgres (`/api/characters`) under the signed-in
 *    Grudge ID account (user testing identity: GRUDACHAIN).
 *  - Mesh visibility: grudge6 race kit + mesh_ids from equipment / gear presets
 *  - Icons: productionMedia (master-items) + equipment slot icons
 *  - Portraits: characterPortrait resolver (DB avatar → race×class → CDN)
 *
 * Use this module for:
 *  - Listing / scoring test-readiness of account heroes
 *  - Applying production starter gear (edit) and PATCHing Railway
 *  - Deploying loadout into Danger Room / Explorer / Production panels
 */

import type { GrudgeCharacter } from "./grudgeAuth";
import { apiFetch, fetchCharacters, getStoredToken } from "./grudgeAuth";
import {
  resolveCharacterEquipmentVisual,
  type ResolvedEquipmentVisual,
} from "./characterEquipmentMesh";
import { resolveCharacterPortrait, type CharacterPortrait } from "./characterPortrait";
import { loadoutFromCharacter, mergeOpenSaveData, type OpenCharacterLoadout } from "./characterLoadout";
import {
  buildStartingEquipment,
  type StarterWeaponChoice,
} from "./startingEquipment";
import { resolveRaceId, resolvePresetId, resolveRaceModel } from "./raceModel";
import { warmProductionMedia, productionItemIconUrl } from "./productionMedia";

export type TestHeroReadiness = {
  ok: boolean;
  score: number; // 0–100
  flags: string[];
  missing: string[];
};

export type TestHeroCard = {
  id: string;
  name: string;
  raceId?: string;
  classId?: string;
  level?: number;
  portrait: CharacterPortrait;
  loadout: OpenCharacterLoadout;
  equipment: ResolvedEquipmentVisual;
  readiness: TestHeroReadiness;
  /** Catalog-resolved weapon icon for HUD/main panel */
  weaponIconUrl: string;
};

function scoreReadiness(
  ch: GrudgeCharacter,
  vis: ResolvedEquipmentVisual,
  portrait: CharacterPortrait,
  loadout: OpenCharacterLoadout,
): TestHeroReadiness {
  const flags: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (ch.id) {
    score += 15;
    flags.push("has-uuid");
  } else missing.push("uuid");

  if (ch.raceId || vis.raceId) {
    score += 15;
    flags.push("race");
  } else missing.push("race");

  if (ch.classId || vis.presetId) {
    score += 10;
    flags.push("class");
  } else missing.push("class");

  if (vis.meshIds.length >= 3) {
    score += 25;
    flags.push(`mesh_ids:${vis.meshIds.length}`);
  } else {
    missing.push("mesh_ids");
    if (vis.meshIds.length) score += 8;
  }

  if (vis.source === "equipment.mesh_ids" || vis.source === "gear_preset") {
    score += 10;
    flags.push(`equip-source:${vis.source}`);
  } else {
    flags.push(`equip-source:${vis.source}`);
  }

  if (Object.keys(vis.slotIcons).length > 0) {
    score += 10;
    flags.push("slot-icons");
  } else missing.push("slot-icons");

  if (loadout.weaponId && loadout.weaponId !== "none") {
    score += 10;
    flags.push(`weapon:${loadout.weaponId}`);
  } else missing.push("weapon");

  if (portrait.kind !== "default" || portrait.url) {
    score += 5;
    flags.push(`portrait:${portrait.kind}`);
  }

  return {
    ok: score >= 70 && vis.meshIds.length >= 3,
    score: Math.min(100, score),
    flags,
    missing,
  };
}

/** Build a production test card for one Railway character. */
export async function buildTestHeroCard(ch: GrudgeCharacter): Promise<TestHeroCard> {
  await warmProductionMedia();
  const [equipment] = await Promise.all([resolveCharacterEquipmentVisual(ch)]);
  const portrait = resolveCharacterPortrait(ch);
  const loadout = loadoutFromCharacter(ch);
  const readiness = scoreReadiness(ch, equipment, portrait, loadout);
  const weaponIconUrl =
    equipment.slotIcons.weapon ||
    equipment.slotIcons.mainHand ||
    productionItemIconUrl(
      loadout.weaponId === "greataxe"
        ? "t0-greataxe"
        : loadout.weaponId?.startsWith("staff")
          ? "t0-staff"
          : "t0-sword",
    );

  return {
    id: ch.id,
    name: ch.name || ch.id,
    raceId: ch.raceId || equipment.raceId,
    classId: ch.classId || equipment.presetId,
    level: ch.level,
    portrait,
    loadout,
    equipment,
    readiness,
    weaponIconUrl,
  };
}

/** List all account characters as production test cards (GRUDACHAIN roster). */
export async function listGrudachainTestLibrary(): Promise<{
  authenticated: boolean;
  cards: TestHeroCard[];
  summary: { total: number; ready: number; needsFix: number };
}> {
  const token = getStoredToken();
  if (!token) {
    return {
      authenticated: false,
      cards: [],
      summary: { total: 0, ready: 0, needsFix: 0 },
    };
  }
  await warmProductionMedia();
  const chars = await fetchCharacters();
  const cards = await Promise.all(chars.map((c) => buildTestHeroCard(c)));
  cards.sort((a, b) => b.readiness.score - a.readiness.score);
  const ready = cards.filter((c) => c.readiness.ok).length;
  return {
    authenticated: true,
    cards,
    summary: {
      total: cards.length,
      ready,
      needsFix: cards.length - ready,
    },
  };
}

/**
 * Apply production starter equipment to a character and PATCH Railway.
 * Use for fixing incomplete GRUDACHAIN test heroes.
 */
export async function repairTestHeroEquipment(
  ch: GrudgeCharacter,
  weapon: StarterWeaponChoice = "sword",
): Promise<{ ok: boolean; error?: string; character?: GrudgeCharacter }> {
  const raceHint = ch.raceId || "human";
  const starter = buildStartingEquipment(raceHint, weapon, resolveRaceModel(ch).avatarId);
  const equipment = {
    ...(typeof ch.equipment === "object" && ch.equipment ? ch.equipment : {}),
    mesh_ids: starter.mesh_ids,
    meshIds: starter.meshIds,
    gearPresetId: starter.gearPresetId,
    classId: starter.classId,
    raceId: starter.raceId,
    weapon: starter.weapon,
    mainHand: starter.mainHand,
    offhand: starter.offhand,
    chest: starter.chest,
    helmet: starter.helmet,
  };
  const saveData = mergeOpenSaveData(ch, {
    weaponId: starter.weaponId,
    offHand: starter.offHand,
    meshIds: starter.meshIds,
    gearPresetId: starter.gearPresetId,
  });
  // Also embed equipment bag under saveData for multi-client readers
  saveData.equipment = equipment;
  saveData.open = {
    ...((saveData.open as object) || {}),
    ...starter.open,
    meshIds: starter.meshIds,
  };

  try {
    const r = await apiFetch(`/api/characters/${encodeURIComponent(ch.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment,
        saveData,
        classId: starter.classId,
        raceId: resolveRaceId(raceHint),
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `PATCH ${r.status}: ${t.slice(0, 160)}` };
    }
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: true,
      character: {
        ...ch,
        classId: starter.classId,
        raceId: resolveRaceId(raceHint),
        equipment,
        saveData,
        ...(data.id ? { id: String(data.id) } : {}),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Batch-repair all heroes below readiness threshold (default 70).
 * Returns per-id results — safe for GRUDACHAIN QA sessions.
 */
export async function repairAllIncompleteTestHeroes(
  weapon: StarterWeaponChoice = "sword",
  minScore = 70,
): Promise<{ repaired: string[]; failed: { id: string; error: string }[] }> {
  const lib = await listGrudachainTestLibrary();
  const repaired: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const chars = await fetchCharacters();
  const byId = new Map(chars.map((c) => [c.id, c]));

  for (const card of lib.cards) {
    if (card.readiness.score >= minScore && card.readiness.ok) continue;
    const ch = byId.get(card.id);
    if (!ch) {
      failed.push({ id: card.id, error: "character row missing" });
      continue;
    }
    const res = await repairTestHeroEquipment(ch, weapon);
    if (res.ok) repaired.push(card.id);
    else failed.push({ id: card.id, error: res.error || "unknown" });
  }
  return { repaired, failed };
}

/** Deploy path summary for agents/UI — where this hero plays. */
export function testHeroDeployTargets(card: TestHeroCard): {
  danger: string;
  production: string;
  explorer: boolean;
  raceAvatarId: string;
} {
  const raceAvatarId = `grudge-${resolveRaceId(card.raceId || "human")}-${resolvePresetId(card.classId || "warrior")}`;
  return {
    danger: `?door=danger&characterId=${encodeURIComponent(card.id)}`,
    production: "P key · Trees / Characters tabs use same Railway row",
    explorer: card.loadout.avatarId === "explorer",
    raceAvatarId,
  };
}

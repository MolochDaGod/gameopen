/**
 * Character portrait / avatar image resolution for Grudge Open.
 *
 * Best-practice cascade (accurate art, never wrong race/class when data exists):
 *
 *  1. **DB character.avatarUrl** — Railway Postgres SSOT (custom / studio shot / AI)
 *  2. **saveData.open / config** overrides (`portraitUrl`, `avatarImage`, voxel head URL)
 *  3. **Voxel / cube-head** — dedicated voxel-head PNG (or stored head snapshot)
 *  4. **Race×class type PNG** — one portrait per model type (e.g. human knight)
 *  5. **Race PNG** — `public/races/{human|orc|elf|…}.png`
 *  6. **Fleet CDN / Warlords sprites** — last network fallbacks
 *  7. **Default** — human race PNG
 *
 * 3D models, VFX, and equipment meshes are separate concerns
 * (`resolveRaceModel`, `characterEquipmentMesh`, CDN GLB). Portraits are 2D only.
 *
 * DB fields (GrudgeBuilder `characters` table):
 *  - avatar_url / avatarUrl
 *  - race_id, class_id
 *  - model_3d.renderPipeline (grudge6 | vrm | armada_ship | sprite2d)
 *  - saveData.open.* Open-only blob
 */

import { publicUrl, FLEET } from "./fleet";
import type { GrudgeCharacter } from "./grudgeAuth";
import { resolveRaceId, resolvePresetId } from "./raceModel";
import type { PresetId, RaceId } from "../three/grudge";

/** Matches AccountPaperdoll paper race keys (UI portraits). */
export type PaperRaceKey =
  | "human"
  | "orc"
  | "elf"
  | "dwarf"
  | "barbarian"
  | "undead";

export type PortraitKind =
  | "db-avatar"
  | "open-override"
  | "voxel-head"
  | "race-class"
  | "race"
  | "cdn"
  | "default";

export interface CharacterPortrait {
  /** Best URL to use for <img src> first. */
  url: string;
  /** Ordered fallbacks for onError (do not include `url`). */
  candidates: string[];
  kind: PortraitKind;
  /** Paper race key for UI chrome tint. */
  paperRace: PaperRaceKey;
  /** True when this character should prefer voxel-head art. */
  isVoxel: boolean;
  raceId: RaceId;
  presetId: PresetId;
}

/** Race PNG file stem under public/races/ (matches shipped art). */
export function paperRacePngStem(paper: PaperRaceKey): string {
  return paper === "elf" ? "elf" : paper;
}

/** Map fleet race / baseId → paper race for portrait files. */
export function fleetRaceToPaper(raceId?: string | null): PaperRaceKey {
  if (!raceId) return "human";
  const raw = raceId.replace(/^race-/, "").toLowerCase();
  if (raw.includes("orc")) return "orc";
  if (raw.includes("undead")) return "undead";
  if (raw.includes("barb")) return "barbarian";
  if (raw.includes("dwarf")) return "dwarf";
  if (raw.includes("elf")) return "elf";
  const r = resolveRaceId(raw);
  switch (r) {
    case "orcs":
      return "orc";
    case "undead":
      return "undead";
    case "barbarians":
      return "barbarian";
    case "dwarves":
      return "dwarf";
    case "high-elves":
      return "elf";
    case "western-kingdoms":
    default:
      return "human";
  }
}

function openBlob(ch: GrudgeCharacter | null | undefined): Record<string, unknown> {
  if (!ch) return {};
  const fromSave =
    (ch.saveData?.open as Record<string, unknown>) ||
    (ch.saveData as Record<string, unknown>) ||
    {};
  const fromConfig =
    (ch.config?.open as Record<string, unknown>) ||
    (ch.config as Record<string, unknown>) ||
    {};
  return { ...fromConfig, ...fromSave };
}

function strField(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Detect voxel / cube-head / Explorer modular-head characters.
 * These must NOT show grudge6 race GLB portraits as if they were warlords meshes.
 */
export function isVoxelCharacter(ch: GrudgeCharacter | null | undefined): boolean {
  if (!ch) return false;
  const m3 = ch.model3d || (ch.config?.model3d as Record<string, unknown>) || {};
  const pipeline = String(
    (m3 as { renderPipeline?: string }).renderPipeline ||
      ch.config?.renderPipeline ||
      "",
  ).toLowerCase();
  // grudge6 / Toon RTS race kits are NEVER "voxel body" — even if a cube head
  // look was saved under saveData.open.voxelLook for modular faces.
  if (
    pipeline === "grudge6" ||
    pipeline === "rts_toon" ||
    pipeline === "toon_rts" ||
    pipeline === "fbx-atlas"
  ) {
    return false;
  }
  if (pipeline === "sprite2d" || pipeline === "voxel" || pipeline === "cube") return true;

  const open = openBlob(ch);
  // Explicit modular-head-only saves must not force Explorer cube body.
  const look = open.voxelLook as Record<string, unknown> | undefined;
  if (look?.kind === "avatarEdit" && pipeline !== "voxel" && pipeline !== "cube") {
    // Avatar Edit head on a Warlords/grudge6 character = face only.
    // Body remains grudge race kit unless avatarId/baseId is explicitly explorer.
  } else {
    if (open.voxel === true || open.kind === "voxel" || open.avatarKind === "voxel") return true;
  }
  // Do NOT treat avatarHead alone as full voxel body (legacy mistake).
  if (open.avatarKind === "cube-head" || open.bodyPipeline === "explorer") return true;

  const avatarId = String(open.avatarId || ch.config?.avatarId || "");
  // Stale avatarId:"explorer" from old Avatar Edit saves — ignore when race is a fleet warlords race
  const race = String(ch.raceId || "").toLowerCase();
  const warlordsRace =
    /human|orc|elf|dwarf|undead|barb|wk|western|high-elf|kingdom|brb|dwf|ud/i.test(race);
  if (avatarId === "explorer" && warlordsRace && pipeline !== "voxel") {
    return false;
  }
  if (avatarId.startsWith("avatar-") || avatarId.includes("voxel") || avatarId.includes("cube-head")) {
    return true;
  }
  const baseId = String(ch.config?.baseId || open.baseId || "");
  if (/voxel|cube|explorer-head|ledmask/i.test(baseId) && !warlordsRace) return true;

  return false;
}

function absOrPublic(path: string): string {
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  if (path.startsWith("/")) {
    // Absolute site path — try same-origin first
    return path;
  }
  return publicUrl(path.replace(/^\//, ""));
}

/**
 * Race PNGs actually under `public/races/*.png` (deployed).
 * Do not invent paths — first <img src> 404s show up in the console.
 */
export const SHIPPED_RACE_PNG = new Set<string>([
  "human",
  "orc",
  "elf",
  "dwarf",
  "barbarian",
  "undead",
]);

/**
 * Optional race×class portraits under `public/races/portraits/{stem}_{preset}.png`.
 * Only list files that exist in the repo — empty until art is shipped.
 * Keys: `{paperRace}_{preset}` e.g. `human_knight`, `orc_warrior`.
 */
export const SHIPPED_RACE_CLASS_PORTRAITS = new Set<string>([
  // e.g. "human_knight" when races/portraits/human_knight.png lands
]);

/** Static voxel-head art that exists under public/ (none yet → use race PNG). */
export const SHIPPED_VOXEL_PORTRAITS = new Set<string>([
  // e.g. "races/voxel-head.png"
]);

function raceClassPortraitPaths(paper: PaperRaceKey, preset: PresetId): string[] {
  const stem = paperRacePngStem(paper);
  // Preferred layout for per-model-type PNGs (only if shipped):
  //   races/portraits/{race}_{class}.png  e.g. human_knight.png
  const keys = [`${stem}_${preset}`, `${stem}-${preset}`];
  const out: string[] = [];
  for (const key of keys) {
    if (!SHIPPED_RACE_CLASS_PORTRAITS.has(key.replace(/-/g, "_")) && !SHIPPED_RACE_CLASS_PORTRAITS.has(key)) {
      continue;
    }
    out.push(`races/portraits/${key}.png`);
    out.push(`races/${key}.png`);
  }
  return out;
}

function racePortraitPaths(paper: PaperRaceKey): string[] {
  const stem = paperRacePngStem(paper);
  if (SHIPPED_RACE_PNG.has(stem)) {
    return [`races/${stem}.png`];
  }
  return ["races/human.png"];
}

/**
 * Mine-Loader Avatar Explorer race portraits (avatarbaseraces pack).
 * Hosted on mine SPA public — not Open git. Prefer absolute edge URLs.
 */
const MINE_AVATAR_RACE_PORTRAIT_BASE =
  "https://mine.grudge-studio.com/assets/models/avatarbaseraces";

function voxelRacePortraitFile(paper: PaperRaceKey): string {
  // Six races in Mine-Loader public/assets/models/avatarbaseraces/*-portrait.png
  return `${paper}-portrait.png`;
}

function voxelPortraitPaths(ch: GrudgeCharacter | null | undefined): string[] {
  const open = openBlob(ch);
  const out: string[] = [];
  const snap = strField(open, [
    "voxelHeadUrl",
    "voxelPortrait",
    "avatarHeadUrl",
    "headPortraitUrl",
    "headSnapshot",
  ]);
  if (snap) out.push(snap);

  // Avatar Explorer race PNGs (SSOT: Mine-Loader avatarbaseraces)
  const paper = fleetRaceToPaper(
    ch?.raceId ||
      (typeof open.race === "string" ? open.race : null) ||
      (typeof ch?.config?.baseId === "string" ? String(ch.config.baseId) : null),
  );
  out.push(`${MINE_AVATAR_RACE_PORTRAIT_BASE}/${voxelRacePortraitFile(paper)}`);
  out.push(`${MINE_AVATAR_RACE_PORTRAIT_BASE}/human-portrait.png`);

  // Only local paths that exist under Open public/ — avoid console 404 spam
  for (const p of [
    "races/portraits/voxel-head.png",
    "races/voxel-head.png",
    "avatar/voxel-head.png",
    "races/portraits/voxel.png",
    "races/voxel.png",
  ]) {
    if (SHIPPED_VOXEL_PORTRAITS.has(p)) out.push(p);
  }
  return out;
}

function cdnFallbacks(paper: PaperRaceKey): string[] {
  const stem = paperRacePngStem(paper);
  // Historical Warlords / fleet locations (may 404 — last resort only).
  // Never use assets.grudge-studio.com/gameopen/* (incomplete; mass 404s).
  return [
    `${FLEET.assets}/sprites/portraits/${stem}.png`,
    `${FLEET.assets}/portraits/${stem}.png`,
    `${FLEET.assets}/races/${stem}.png`,
  ];
}

/**
 * Resolve the best portrait for a fleet character (Railway / GrudaChain roster).
 */
export function resolveCharacterPortrait(
  ch: GrudgeCharacter | null | undefined,
): CharacterPortrait {
  const raceId = resolveRaceId(ch?.raceId);
  const presetId = resolvePresetId(ch?.classId);
  const paperRace = fleetRaceToPaper(
    ch?.raceId ||
      (typeof ch?.config?.baseId === "string" ? String(ch.config.baseId) : undefined),
  );
  const isVoxel = isVoxelCharacter(ch);
  const candidates: string[] = [];
  let kind: PortraitKind = "default";

  // 1) DB avatarUrl (characters.avatar_url)
  if (ch?.avatarUrl && String(ch.avatarUrl).trim()) {
    candidates.push(absOrPublic(String(ch.avatarUrl).trim()));
    kind = "db-avatar";
  }

  // 2) Open / config overrides
  const open = openBlob(ch);
  const override = strField(open, [
    "portraitUrl",
    "avatarImage",
    "avatarUrl",
    "imageUrl",
    "portrait",
  ]);
  if (override) {
    candidates.push(absOrPublic(override));
    if (kind === "default") kind = "open-override";
  }

  // 3) Voxel head art
  if (isVoxel) {
    for (const p of voxelPortraitPaths(ch)) candidates.push(absOrPublic(p));
    if (kind === "default") kind = "voxel-head";
  } else {
    // 4) Race×class type PNGs (only shipped files — no phantom 404s)
    const classPaths = raceClassPortraitPaths(paperRace, presetId);
    for (const p of classPaths) {
      candidates.push(publicUrl(p));
    }
    if (kind === "default" && classPaths.length > 0) kind = "race-class";
  }

  // 5) Race PNG (shipped under public/races/{stem}.png)
  for (const p of racePortraitPaths(paperRace)) {
    candidates.push(publicUrl(p));
  }
  if (kind === "default") kind = "race";

  // 6) CDN fallbacks
  for (const p of cdnFallbacks(paperRace)) candidates.push(p);

  // 7) Hard default
  candidates.push(publicUrl("races/human.png"));

  // Dedupe preserving order
  const seen = new Set<string>();
  const unique = candidates.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  return {
    url: unique[0] || publicUrl("races/human.png"),
    candidates: unique.slice(1),
    kind: unique[0] ? kind : "default",
    paperRace,
    isVoxel,
    raceId,
    presetId,
  };
}

/** <img onError> helper — advance through portrait.candidates. */
export function portraitOnError(
  img: HTMLImageElement,
  candidates: string[],
  stateKey = "data-portrait-i",
): void {
  const i = Number(img.getAttribute(stateKey) || "0");
  if (i >= candidates.length) return;
  img.setAttribute(stateKey, String(i + 1));
  img.src = candidates[i]!;
}

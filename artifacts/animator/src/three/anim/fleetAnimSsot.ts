/**
 * Fleet Animation SSOT — HARD contract for Open / Danger / GRUDOX / controller.
 *
 * Two rig lanes only. Never cross-bind:
 *   bip001-baked  → grudge6 / Warlords / Railway heroes
 *   mixamo-explorer → Explorer avatar / thrcc Mixamo packs
 *
 * Docs: docs/ANIMATION_FLEET_SSOT.md
 */

import type * as THREE from "three";

/** Which skeleton + clip pipeline a body uses. */
export type FleetAnimRigLane = "bip001-baked" | "mixamo-explorer";

/** Surfaces that may own a player AnimationMixer. */
export type FleetAnimSurface =
  | "danger"
  | "open-play"
  | "explorer"
  | "controller"
  | "grudox-handoff"
  | "foundry-preview"
  | "cinema";

/** Production binary + clip roots (no secondary “arena” SSOT). */
export const FLEET_ANIM_HOSTS = {
  /** Mesh / texture CDN */
  assets: "https://assets.grudge-studio.com",
  /** Baked Bip001 JSON + prod anim packages */
  prodAnims: "https://assets.grudge-studio.com/prod/anims",
  /** Canonical same-origin baked path on Open */
  bakedPrefix: "/anims/baked",
  /** Explorer Mixamo authoring / runtime FBX tree */
  explorerAnimPrefix: "/anim/animations",
  /**
   * GOLDEN play kits — Toon RTS pack only (never FBX / metaverse / races bake).
   * Same SSOT as ObjectStore js/grudge6-kit.js + GRUDGE6_Characters lab ★
   */
  grudge6Toon: "https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters",
  /** @deprecated author/compare only — not play */
  grudge6Races: "https://assets.grudge-studio.com/models/grudge6/races",
} as const;

/**
 * Race kit filenames — Toon RTS ★ play GLBs (raceId.glb on CDN pack).
 */
export const GRUDGE6_RACE_GLB = {
  "western-kingdoms": "human.glb",
  human: "human.glb",
  barbarians: "barbarian.glb",
  barbarian: "barbarian.glb",
  "high-elves": "elf.glb",
  elf: "elf.glb",
  dwarves: "dwarf.glb",
  dwarf: "dwarf.glb",
  orcs: "orc.glb",
  orc: "orc.glb",
  undead: "undead.glb",
} as const;

export type Grudge6RaceKey = keyof typeof GRUDGE6_RACE_GLB;

/** Weapon → bip001 pack id (must match grudge/anims AnimPack + content/anims). */
export const WEAPON_TO_BIP001_PACK: Record<string, string> = {
  sword: "sword_shield",
  sword_shield: "sword_shield",
  "sword-shield": "sword_shield",
  shield: "sword_shield",
  bow: "longbow",
  longbow: "longbow",
  staff: "magic",
  magic: "magic",
  unarmed: "unarmed",
  fist: "unarmed",
  spear: "polearm",
  polearm: "polearm",
  greatsword: "twohand",
  twohand: "twohand",
  "2h": "twohand",
  hammer: "hammer",
  rifle: "rifle",
  pistol: "pistol",
  crossbow: "crossbow",
  samurai: "samurai",
};

/**
 * Hosts / path fragments that must NEVER be the primary character or anim SSOT.
 * Allowed only as last-resort fallback after R2 + same-origin fail.
 */
export const FORBIDDEN_PRIMARY_HOST_FRAGMENTS = [
  "grudge-arena",
  "/cdn/assets/characters/",
  "assets.grudge-studio.com/cdn/assets/",
] as const;

/** Packs that are bip001-baked production (not Mixamo folders). */
export const BIP001_PACK_ROOTS = new Set([
  "sword_shield",
  "longbow",
  "magic",
  "unarmed",
  "polearm",
  "twohand",
  "crossbow",
  "rifle",
  "pistol",
  "samurai",
  "hammer",
  "dual_wield",
  "ghost_rider",
  "locomotion",
  "swim",
  "climb",
  "boxanimations",
]);

export interface FleetAnimContext {
  lane: FleetAnimRigLane;
  surface: FleetAnimSurface;
  /** Optional pack id for bip001 (sword_shield, …). */
  packId?: string;
  /** Race key when loading grudge6 mesh. */
  raceId?: Grudge6RaceKey | string;
}

/**
 * Resolve lane from surface + optional explicit override.
 * Danger / open-play / foundry / controller heroes → bip001.
 * Explorer only → mixamo.
 */
export function resolveFleetAnimLane(
  surface: FleetAnimSurface,
  override?: FleetAnimRigLane | null,
): FleetAnimRigLane {
  if (override) return override;
  if (surface === "explorer") return "mixamo-explorer";
  return "bip001-baked";
}

/** Canonical race GLB URL on R2 (primary mesh SSOT). */
export function grudge6RaceGlbUrl(raceId: Grudge6RaceKey | string): string {
  const file =
    GRUDGE6_RACE_GLB[raceId as Grudge6RaceKey] ??
    (String(raceId).includes("ELF") || /elf/i.test(String(raceId))
      ? "elf.glb"
      : /BRB|barb/i.test(String(raceId))
        ? "barbarian.glb"
        : /DWF|dwarf/i.test(String(raceId))
          ? "dwarf.glb"
          : /ORC|orc/i.test(String(raceId))
            ? "orc.glb"
            : /UD|undead/i.test(String(raceId))
              ? "undead.glb"
              : "human.glb");
  return `${FLEET_ANIM_HOSTS.grudge6Toon}/${file}`;
}

/**
 * Ordered mesh candidates for grudge6 — Toon RTS pack only (no FBX).
 * Arena / secondary CDN is NOT included (callers may append as last resort).
 */
export function grudge6RaceMeshCandidates(
  raceId: Grudge6RaceKey | string,
  fileName?: string,
): string[] {
  const file =
    fileName ??
    GRUDGE6_RACE_GLB[raceId as Grudge6RaceKey] ??
    "human.glb";
  // Accept legacy WK_Characters.glb filename → map to toon raceId
  const toonFile = /_Characters\.glb$/i.test(file)
    ? GRUDGE6_RACE_GLB[raceId as Grudge6RaceKey] ?? "human.glb"
    : file;
  const rel = `asset-packs/toon-rts-characters/glb/characters/${toonFile}`;
  return [
    `${FLEET_ANIM_HOSTS.assets}/${rel}`,
    `/${rel}`,
    `${FLEET_ANIM_HOSTS.grudge6Toon}/${toonFile}`,
  ];
}

/** Baked clip relative path → production URL candidates (JSON preferred). */
export function bip001BakedUrlCandidates(bakeRel: string): string[] {
  const clean = String(bakeRel || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.json$/i, "")
    .replace(/\.glb$/i, "");
  const bakedJson = `anims/baked/${clean}.json`;
  const parts = clean.split("/").filter(Boolean);
  const pack = parts[0] || "";
  const stem = parts.slice(1).join("/") || pack;
  const slug = stem.replace(/\s+/g, "-");
  const urls: string[] = [`/${bakedJson}`, `${FLEET_ANIM_HOSTS.assets}/${bakedJson}`];
  if (pack && stem) {
    urls.push(`${FLEET_ANIM_HOSTS.prodAnims}/${pack}/${slug}.json`);
    urls.push(`${FLEET_ANIM_HOSTS.prodAnims}/${pack}/${slug}.glb`);
    urls.push(`/prod/anims/${pack}/${slug}.json`);
  }
  return [...new Set(urls)];
}

/** Explorer Mixamo clip id → URL under /anim/animations. */
export function explorerMixamoUrl(catalogId: string): string {
  const id = String(catalogId || "")
    .replace(/^animations\//, "")
    .replace(/^\//, "");
  return `${FLEET_ANIM_HOSTS.explorerAnimPrefix}/${id}${id.endsWith(".fbx") ? "" : ".fbx"}`;
}

export function isForbiddenPrimaryUrl(url: string): boolean {
  const u = String(url || "");
  return FORBIDDEN_PRIMARY_HOST_FRAGMENTS.some((f) => u.includes(f));
}

/**
 * Heuristic: clip tracks look like Mixamo vs Bip001.
 * Used to refuse cross-binding at runtime.
 */
export function detectClipRigFamily(
  clip: THREE.AnimationClip | null | undefined,
): "bip001" | "mixamo" | "unknown" {
  if (!clip?.tracks?.length) return "unknown";
  let bip = 0;
  let mix = 0;
  for (const t of clip.tracks) {
    const n = t.name || "";
    if (/mixamorig/i.test(n)) mix++;
    if (/Bip001|Bip01/i.test(n)) bip++;
  }
  if (mix > bip && mix > 0) return "mixamo";
  if (bip > 0) return "bip001";
  return "unknown";
}

/**
 * Throw if a clip is clearly the wrong family for the lane.
 * Unknown is allowed (caller rematch may still succeed).
 */
export function assertClipMatchesLane(
  lane: FleetAnimRigLane,
  clip: THREE.AnimationClip,
  label = "clip",
): void {
  const fam = detectClipRigFamily(clip);
  if (lane === "bip001-baked" && fam === "mixamo") {
    throw new Error(
      `[fleetAnimSsot] ${label}: Mixamo tracks cannot bind to bip001-baked kit — bake/retarget to Bip001 first`,
    );
  }
  if (lane === "mixamo-explorer" && fam === "bip001") {
    throw new Error(
      `[fleetAnimSsot] ${label}: Bip001 tracks cannot bind to mixamo-explorer avatar without retarget`,
    );
  }
}

/** Tag mixer root so debug / audits can see lane. */
export function tagMixerRoot(
  root: THREE.Object3D,
  ctx: FleetAnimContext,
): void {
  root.userData.fleetAnimLane = ctx.lane;
  root.userData.fleetAnimSurface = ctx.surface;
  if (ctx.packId) root.userData.fleetAnimPack = ctx.packId;
  if (ctx.raceId) root.userData.fleetAnimRace = ctx.raceId;
}

/**
 * Create a fleet-tagged AnimationMixer (import THREE at call site to avoid
 * circular deps — pass constructor).
 */
export function createFleetMixer(
  root: THREE.Object3D,
  ctx: FleetAnimContext,
  AnimationMixer: new (root: THREE.Object3D) => THREE.AnimationMixer,
): THREE.AnimationMixer {
  tagMixerRoot(root, ctx);
  return new AnimationMixer(root);
}

/** Map weapon string → bip001 pack; default sword_shield. */
export function bip001PackForWeapon(weapon: string | null | undefined): string {
  const k = String(weapon || "sword_shield")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return WEAPON_TO_BIP001_PACK[k] ?? WEAPON_TO_BIP001_PACK[k.replace(/-/g, "_")] ?? "sword_shield";
}

/** Human-readable contract for logs / AI tools. */
export function fleetAnimContractSummary(): string {
  return [
    "FLEET ANIM SSOT",
    "lanes: bip001-baked | mixamo-explorer (never mix)",
    `meshes: ${FLEET_ANIM_HOSTS.grudge6Races}/{PREFIX}_Characters.glb`,
    `clips:  ${FLEET_ANIM_HOSTS.bakedPrefix}/{pack}/…json → prod/anims`,
    "explorer: /anim/animations/… Mixamo only",
    "loader: sharedGltfLoader only for fleet GLB",
    "danger binary: open.grudge-studio.com/danger",
  ].join("\n");
}

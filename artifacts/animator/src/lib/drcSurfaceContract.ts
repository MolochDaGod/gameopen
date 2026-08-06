/**
 * Open DRC surface contract — which host uses which character/anim lane.
 *
 * DRC = Danger Room Controls stack (not a URL):
 *   L0 mesh scale   — characterDeploy / grudge6Runtime SI 1.8 m
 *   L1 input        — @workspace/epicfight FLEET_COMBAT_INPUT + Controller
 *   L2 combat anim  — Bip001 baked packs (grudge/anims + fleetAnimSsot)
 *   L3 weapon skills — FleetWeaponSkill / weaponSkillPacks / content/skills
 *   L4 HUD          — ui.grudge-studio.com + CraftPix
 *
 * Lanes (fleetAnimSsot — never cross-bind):
 *   bip001-baked   — Warlords / grudge6 / Railway heroes (Danger, Brawl, Mimic, Play)
 *   mixamo-explorer — Explorer voxel + dressing Mixamo (still hydrates DRC bakes)
 *
 * Import this module; do not invent parallel combat FSMs per game.
 */

import type { AppMode } from "./openRoutes";
import type { FleetAnimRigLane } from "../three/anim/fleetAnimSsot";

export type DrcCharacterSource =
  | "grudge6-runtime" // loadGrudge6CombatRig / GrudgeAvatar
  | "explorer-mixamo" // ExplorerCharacter + fleetBakeHydrate
  | "catalog-character" // assets.ts Character GLB
  | "embed-external" // iframe / external SPA
  | "none";

export interface DrcSurfaceSpec {
  mode: AppMode;
  title: string;
  /** Primary rig lane for player body */
  lane: FleetAnimRigLane | "n/a";
  character: DrcCharacterSource;
  /** Shares Studio Controller + epicfight combat */
  usesStudioController: boolean;
  /** Danger outdoor / arena maps (same-origin allowlist or R2) */
  maps: readonly string[];
  /** Deploy surface */
  deploy: "open-spa" | "external" | "embed";
  notes: string;
}

/** Full Open mode matrix — keep in sync with openRoutes + App.tsx. */
export const DRC_SURFACE_MATRIX: readonly DrcSurfaceSpec[] = [
  {
    mode: "danger",
    title: "Danger Room",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: true,
    maps: ["danger-room", "shipwreck", "forest_mountains", "arena", "pirate", "climbing"],
    deploy: "open-spa",
    notes: "SSOT combat binary — resolveDangerPlayable → GrudgeAvatar",
  },
  {
    mode: "play",
    title: "Play map",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: true,
    maps: ["voxel-authored"],
    deploy: "open-spa",
    notes: "Same Studio as Danger; map from worldbuilder",
  },
  {
    mode: "brawl",
    title: "Ruins Brawler",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: true,
    maps: ["ruins-arena"],
    deploy: "open-spa",
    notes: "BrawlerScene + Controller + T0 skills",
  },
  {
    mode: "survival",
    title: "Agama Survival",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: true,
    maps: ["agama"],
    deploy: "open-spa",
    notes: "Same BrawlerScene path / Agama map",
  },
  {
    mode: "vox-battle",
    title: "VoxGrudge Battle",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: true,
    maps: ["br-arena"],
    deploy: "open-spa",
    notes: "BR shell on Open combat stack",
  },
  {
    mode: "mimic",
    title: "Test Dungeon",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: true,
    maps: ["vol"],
    deploy: "open-spa",
    notes: "GrudgeAvatar + sword_shield DRC pack",
  },
  {
    mode: "editor",
    title: "Dressing Room",
    lane: "mixamo-explorer",
    character: "explorer-mixamo",
    usesStudioController: true,
    maps: ["dressing-pad"],
    deploy: "open-spa",
    notes: "Explorer + optional GrudgeAvatar preview; Play uses Controller",
  },
  {
    mode: "voxel",
    title: "Worldbuilder",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: ["authored"],
    deploy: "open-spa",
    notes: "Editor only; Play handoff → danger/play Studio",
  },
  {
    mode: "genesis",
    title: "Warlord Genesis",
    lane: "bip001-baked",
    character: "embed-external",
    usesStudioController: false,
    maps: ["warcamp"],
    deploy: "embed",
    notes: "In-app canvas → warlord-genesis; fleet hero handoff",
  },
  {
    mode: "voxgrudge-native",
    title: "VoxGrudge Lab",
    lane: "mixamo-explorer",
    character: "explorer-mixamo",
    usesStudioController: false,
    maps: ["voxel-lab"],
    deploy: "open-spa",
    notes: "Lab editor; full world external",
  },
  {
    mode: "lobby",
    title: "Campfire Lobby",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: false,
    maps: ["ethereal-falls"],
    deploy: "open-spa",
    notes: "CampfireLobbyScene 4-seat preview",
  },
  {
    mode: "characters",
    title: "Characters",
    lane: "bip001-baked",
    character: "grudge6-runtime",
    usesStudioController: false,
    maps: ["ethereal-falls"],
    deploy: "open-spa",
    notes: "Same campfire stack",
  },
  {
    mode: "doors",
    title: "Library",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Steam hub — cinema backdrop only",
  },
  {
    mode: "account",
    title: "Account",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Fleet characters list — no 3D combat",
  },
  {
    mode: "zones",
    title: "GRUDOX Zones",
    lane: "n/a",
    character: "embed-external",
    usesStudioController: false,
    maps: [],
    deploy: "external",
    notes: "Launch GRUDOX / external; native brawl/danger use DRC",
  },
  {
    mode: "realms",
    title: "Realms",
    lane: "n/a",
    character: "embed-external",
    usesStudioController: false,
    maps: [],
    deploy: "external",
    notes: "Mine-Loader worlds",
  },
  {
    mode: "ui",
    title: "Create UI",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: [],
    deploy: "embed",
    notes: "ui.grudge-studio.com embed",
  },
  {
    mode: "anim",
    title: "Anim Creator",
    lane: "mixamo-explorer",
    character: "explorer-mixamo",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Pose editor — Mixamo bone names",
  },
  {
    mode: "anim-ai",
    title: "AI Animator",
    lane: "mixamo-explorer",
    character: "explorer-mixamo",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Same Anim Editor + AI panel",
  },
  {
    mode: "avatar",
    title: "Avatar Edit",
    lane: "mixamo-explorer",
    character: "explorer-mixamo",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Cube head → explorer look",
  },
  {
    mode: "ledmask",
    title: "LED Mask",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Face companion — not combat DRC",
  },
  {
    mode: "landing",
    title: "Sign in",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "Auth gate",
  },
  {
    mode: "rooms",
    title: "Rooms",
    lane: "n/a",
    character: "none",
    usesStudioController: false,
    maps: [],
    deploy: "open-spa",
    notes: "MP room list / gallery",
  },
  {
    mode: "minegrudge",
    title: "MineGrudge",
    lane: "n/a",
    character: "embed-external",
    usesStudioController: false,
    maps: [],
    deploy: "external",
    notes: "Mine-Loader handoff",
  },
] as const;

export function drcSpecForMode(mode: AppMode): DrcSurfaceSpec | undefined {
  return DRC_SURFACE_MATRIX.find((s) => s.mode === mode);
}

/** Modes that must boot GrudgeAvatar / bip001 for player combat. */
export function isBip001CombatMode(mode: AppMode): boolean {
  const s = drcSpecForMode(mode);
  return s?.lane === "bip001-baked" && s.usesStudioController;
}

/** Default Studio avatar when no fleet hero — never Mixamo explorer for DRC combat. */
export const DRC_DEFAULT_AVATAR_ID = "grudge:western-kingdoms:warrior";

/** Danger outdoor map ids (same-origin public/models/maps allowlist + chamber). */
export const DRC_DANGER_MAP_IDS = [
  "danger-room",
  "shipwreck",
  "forest_mountains",
  "arena-1v1",
  "arena-2v2",
  "arena-ffa4",
  "pirate",
  "climbing",
] as const;

// ── Warlords-era fleet (external hosts) ─────────────────────────────────────

/**
 * Production binary SSOT for all Warlords-era 3D games.
 * Mesh: R2 grudge6 race GLB · Anims: Open /anims/baked Bip001 · HUD: ui.grudge-studio.com
 */
export const WARLORDS_ERA_ASSET_SSOT = {
  meshCdn: "https://assets.grudge-studio.com",
  /** Toon RTS ★ only — never FBX / metaverse / races bake in game deploy */
  raceKit: (prefix: string) => {
    const map: Record<string, string> = {
      WK: "human",
      BRB: "barbarian",
      ELF: "elf",
      DWF: "dwarf",
      ORC: "orc",
      UD: "undead",
    };
    const id = map[String(prefix).toUpperCase()] || "human";
    return `https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/${id}.glb`;
  },
  atlasRoot: "https://assets.grudge-studio.com/textures/grudge6",
  animsBaked: "https://open.grudge-studio.com/anims/baked",
  animsBakedAlias: "https://gameopen.vercel.app/anims/baked",
  uiHydra: "https://ui.grudge-studio.com",
  pirateLobbyMesh:
    "https://assets.grudge-studio.com/models/lobby/pirate-islands/scene.glb",
  /** Never primary for Warlords hero mesh */
  forbidden: [
    "arena CDN as primary race kit",
    "Meshy / capsule heroes",
    "live Mixamo FBX on Bip001",
    "browser FBX race kits as play default",
    "models/grudge6/metaverse/* as play mesh",
    "models/grudge6/races/*_Characters.glb as play default (use Toon RTS pack)",
    "sword_shield/sword and shield run as primary loco",
    "locomotion/running as primary run (run-to-roll)",
    "threejs-rapier-react-three-controll as anim host",
    "GRUDOX / Explorer product for pirate-islands lobby",
  ],
} as const;

export type WarlordsFleetHostStatus =
  | "drc-green"
  | "drc-partial"
  | "mixamo-legacy"
  | "in-game-only"
  | "tools";

/**
 * Warlords-era library / product hosts — loaders + deploy ownership.
 * Green = grudge6 mesh + Bip001 baked + DRC-ish input; Partial = grudge6 mesh but
 * incomplete packs; Mixamo = needs DRC migration; in-game-only = Warlords client.
 */
export const WARLORDS_ERA_FLEET: readonly {
  id: string;
  title: string;
  host: string;
  deploy: string;
  mesh: "grudge6-r2" | "grudge6-via-client" | "mixed" | "n/a";
  anim: "bip001-open" | "bip001-local" | "mixamo" | "via-client" | "n/a";
  loader: string;
  status: WarlordsFleetHostStatus;
  notes: string;
}[] = [
  {
    id: "open-danger",
    title: "Open Danger Room (+ maps)",
    host: "https://open.grudge-studio.com/danger",
    deploy: "gameopen Vercel",
    mesh: "grudge6-r2",
    anim: "bip001-open",
    loader: "GrudgeAvatar / grudge6Runtime + characterDeploy + anims.ts",
    status: "drc-green",
    notes: "DRC L0–L4 SSOT binary",
  },
  {
    id: "warlords-client",
    title: "Grudge Warlords client",
    host: "https://client.grudge-studio.com/home",
    deploy: "GrudgeBuilder Vercel",
    mesh: "grudge6-via-client",
    anim: "via-client",
    loader: "SharedGltfPipeline + RACE_GRUDGE6 + bip001DrcAnims (Open baked)",
    status: "drc-green",
    notes:
      "Production heroes: grudge6 mesh + Open Bip001 packs; Mixamo GLB only fallback",
  },
  {
    id: "pirate-islands",
    title: "Pirate lobby opening + tutorial",
    host: "https://client.grudge-studio.com/island-3d?mode=lobby&map=pirate-islands",
    deploy: "Warlords client only",
    mesh: "grudge6-via-client",
    anim: "via-client",
    loader: "pirate-islands CDN GLB + grudge6 heroes",
    status: "in-game-only",
    notes: "Not GRUDOX / not Explorer / not Open tile",
  },
  {
    id: "multiverse",
    title: "Grudge Multiverse",
    host: "https://grudge-multiverse.vercel.app/",
    deploy: "grudge-multiverse Vercel + Railway rooms",
    mesh: "grudge6-r2",
    anim: "bip001-open",
    loader: "grudge6Loader + grudge6SSOT + animPackLoader (Open baked)",
    status: "drc-green",
    notes: "Stone grudge6SSOT; packs must match Open samurai 1H purge",
  },
  {
    id: "grudge-arena",
    title: "Grudge Arena",
    host: "https://grudge-arena.grudge-studio.com/",
    deploy: "grudge-arena Vercel",
    mesh: "grudge6-r2",
    anim: "bip001-local",
    loader: "createBakedGrudge6Unit + /api/assets proxy to R2",
    status: "drc-green",
    notes: "Baked Bip001 primary; arena /cdn is props — race kits via grudge6AssetUrl",
  },
  {
    id: "hero-command",
    title: "Hero Command RTS",
    host: "https://play.grudge-studio.com/",
    deploy: "hero-rts artifact Vercel",
    mesh: "grudge6-r2",
    anim: "bip001-local",
    loader: "grudge6RaceAssets + drcWeaponSkills (Digit1–6 commander)",
    status: "drc-green",
    notes: "Race kits CDN + DRC skill bar / damage layer on Open baked rels",
  },
  {
    id: "warlord-genesis",
    title: "Warlord Genesis",
    host: "https://warlord-genesis.vercel.app/lobby",
    deploy: "warlord-genesis Vercel",
    mesh: "grudge6-r2",
    anim: "bip001-open",
    loader: "Grudge6HeroRig + LOCO_BAKED_BY_PACK (Open multi-host)",
    status: "drc-green",
    notes: "Player/Enemy use grudge6 Bip001; LOCO purge samurai 1H + Open baked fetch",
  },
  {
    id: "rts-grudge",
    title: "Warlords Forge Client",
    host: "https://rts-grudge.vercel.app/",
    deploy: "RTS-Grudge Vercel",
    mesh: "mixed",
    anim: "mixamo",
    loader: "Forge/RTS shell — pair with forge + grudge6 where used",
    status: "drc-partial",
    notes: "Map tooling + PvP lobby; not full DRC combat SSOT",
  },
  {
    id: "foundry",
    title: "Character Foundry",
    host: "https://character.grudge-studio.com/",
    deploy: "Foundry Vercel",
    mesh: "grudge6-r2",
    anim: "n/a",
    loader: "create/equip → handoff to Warlords client",
    status: "tools",
    notes: "No combat DRC required; mesh must be grudge6",
  },
  {
    id: "dressing",
    title: "Open Dressing Room",
    host: "https://open.grudge-studio.com/dressing",
    deploy: "gameopen",
    mesh: "mixed",
    anim: "mixamo",
    loader: "Explorer Mixamo + optional GrudgeAvatar preview",
    status: "drc-partial",
    notes: "Authoring surface — Play handoff uses bip001 combat",
  },
] as const;

export function warlordsFleetByStatus(status: WarlordsFleetHostStatus) {
  return WARLORDS_ERA_FLEET.filter((h) => h.status === status);
}

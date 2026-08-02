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

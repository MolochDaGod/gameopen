/**
 * Production cinema recordings — SSOT for game-flow timing.
 * QA on open.grudge-studio.com surfaces only for sign-off.
 */
import type { CinemaManifest } from "./types";
import { CHARACTER_HEIGHT_M } from "../types";

/** Hero / character mesh candidates for cinema stages (fleet + local bake). */
export const CINEMA_HERO_MESHES = [
  "models/introgamer.glb",
  "models/landing/astrocreeper.glb",
  "models/astrocreeper.glb",
  "models/racalvin.glb",
  "models/karate-boss.glb",
] as const;

export const CINEMA_ARENA_MESHES = [
  "models/instarena-phyxt-fight.glb",
  "models/dungeon.glb",
  "models/dj-booth.glb",
] as const;

export const CINEMA_ISLAND_MESHES = [
  "models/worlds/small_island.glb",
  "models/worlds/sailtest.glb",
  "models/worlds/forest-map.glb",
] as const;

/** Ambient library backdrop — infinite loop behind DoorSelect. */
export const CINEMA_INTRO_DOORS: CinemaManifest = {
  id: "intro_doors",
  title: "Grudge Open — Library Chamber",
  surface: "doors",
  durationSec: 22,
  loop: true,
  skippableAfterSec: 0,
  post: "mystical",
  background: 0x05060a,
  fogDensity: 0.075,
  torch: true,
  embers: true,
  assets: [
    {
      meshKeys: [...CINEMA_HERO_MESHES],
      kind: "character",
      heightM: CHARACTER_HEIGHT_M,
      position: [0.15, 0, -0.35],
      rotationY: Math.PI * 0.12,
    },
  ],
  beats: [
    {
      t: 0,
      hold: 5.5,
      cam: { pos: [4.6, 1.35, 5.4], look: [0, 1.45, 0], fov: 48 },
      caption: "GRUDGE OPEN",
      sub: "Production library · fleet characters · live worlds",
    },
    {
      t: 5.5,
      hold: 5.5,
      cam: { pos: [-3.6, 0.95, 4.9], look: [0, 1.35, 0], fov: 46 },
      caption: "YOUR ROSTER",
      sub: "Create and select heroes at the campfire",
    },
    {
      t: 11,
      hold: 5.5,
      cam: { pos: [2.2, 2.6, 3.2], look: [0, 1.55, -0.2], fov: 42 },
      caption: "SECTORS & ISLANDS",
      sub: "Home island · sail · Hellmaw · Realms",
    },
    {
      t: 16.5,
      hold: 5.5,
      cam: { pos: [0.25, 1.15, 2.85], look: [0, 1.4, 0], fov: 44 },
      caption: "ENTER WHEN READY",
      sub: "Characters GRUDOX · open.grudge-studio.com/characters",
    },
  ],
  transitionTo: null,
  notes: ["Ambient doors backdrop", "Character inclusion production path"],
};

/**
 * Linear flow: cold open → character selection (campfire).
 * Use for first-run or explicit "Enter roster" CTA.
 */
export const CINEMA_INTRO_TO_CHARACTERS: CinemaManifest = {
  id: "intro_to_characters",
  title: "Open → Character Select",
  surface: "intro",
  durationSec: 14,
  loop: false,
  skippableAfterSec: 1.2,
  post: "mystical",
  background: 0x04060c,
  fogDensity: 0.07,
  torch: true,
  embers: true,
  assets: [
    {
      meshKeys: [...CINEMA_HERO_MESHES],
      kind: "character",
      heightM: CHARACTER_HEIGHT_M,
      position: [0, 0, 0],
      rotationY: Math.PI,
    },
  ],
  beats: [
    {
      t: 0,
      hold: 3.2,
      cam: { pos: [0.2, 1.8, 6.2], look: [0, 1.2, 0], fov: 40 },
      caption: "A LIGHT STILL BURNS",
      sub: "Your heroes wait by the falls",
      postBoost: 0.3,
    },
    {
      t: 3.2,
      hold: 3.5,
      cam: { pos: [3.8, 1.4, 4.0], look: [0, 1.35, 0], fov: 42 },
      caption: "CREATE · SELECT · DEPLOY",
      sub: "4-slot campfire · Railway roster · Avatar edit",
    },
    {
      t: 6.7,
      hold: 3.5,
      cam: { pos: [-2.8, 2.0, 3.4], look: [0, 1.5, -0.1], fov: 38 },
      caption: "CHARACTER SELECTION",
      sub: "Production surface · /characters",
      postBoost: 0.5,
    },
    {
      t: 10.2,
      hold: 3.8,
      cam: { pos: [0.1, 1.25, 2.6], look: [0, 1.45, 0], fov: 36 },
      caption: "STEP TO THE FIRE",
      sub: "Skip anytime · Continue to roster",
      waitContinue: false,
    },
  ],
  transitionTo: "characters",
  notes: ["Game-flow handoff to CampfireLobby character select/create"],
};

/** Establish shot when landing on production character select (campfire). */
export const CINEMA_CHAR_SELECT_ESTABLISH: CinemaManifest = {
  id: "char_select_establish",
  title: "Campfire Character Select — Establish",
  surface: "characters",
  durationSec: 6.5,
  loop: false,
  skippableAfterSec: 0.4,
  post: "mystical",
  background: 0x02040a,
  fogDensity: 0.04,
  torch: true,
  embers: true,
  assets: [],
  beats: [
    {
      t: 0,
      hold: 2.2,
      cam: { pos: [0, 4.8, 14], look: [0, 1.2, -3], fov: 34 },
      caption: "ETHEREAL FALLS",
      sub: "Character selection · creation · handoff",
    },
    {
      t: 2.2,
      hold: 2.2,
      cam: { pos: [5.2, 2.8, 9.5], look: [0, 1.1, 0], fov: 36 },
      caption: "FOUR SEATS",
      sub: "Pick a hero or create into an empty seat",
    },
    {
      t: 4.4,
      hold: 2.1,
      cam: { pos: [0, 3.1, 8.4], look: [0, 1.2, -4], fov: 38 },
      caption: "YOUR WARBAND",
      sub: "Play Danger · Genesis · Realms with this roster",
    },
  ],
  transitionTo: null,
  location: { pin: "ethereal_campfire", tags: ["characters", "lobby"] },
};

/** Multiplayer lobby establish. */
export const CINEMA_LOBBY: CinemaManifest = {
  id: "lobby_establish",
  title: "The Lobby — Establish",
  surface: "lobby",
  durationSec: 8,
  loop: false,
  skippableAfterSec: 0.5,
  post: "mystical",
  background: 0x070a12,
  fogDensity: 0.055,
  torch: true,
  embers: false,
  assets: [
    {
      meshKeys: [...CINEMA_ARENA_MESHES],
      kind: "shell",
      heightM: 8,
      position: [0, 0, -6],
    },
    {
      meshKeys: [...CINEMA_HERO_MESHES],
      kind: "character",
      heightM: CHARACTER_HEIGHT_M,
      position: [0, 0, 1.2],
      rotationY: Math.PI,
    },
  ],
  beats: [
    {
      t: 0,
      hold: 2.8,
      cam: { pos: [6, 3.2, 8], look: [0, 1.5, -2], fov: 40 },
      caption: "THE LOBBY",
      sub: "Matchmaking · parties · spar",
    },
    {
      t: 2.8,
      hold: 2.6,
      cam: { pos: [-4.5, 2.0, 5], look: [0, 1.4, 0], fov: 42 },
      caption: "BRING YOUR HERO",
      sub: "Roster from /characters",
    },
    {
      t: 5.4,
      hold: 2.6,
      cam: { pos: [0.5, 1.6, 4.2], look: [0, 1.3, 0], fov: 44 },
      caption: "READY UP",
      sub: "open.grudge-studio.com/lobby",
    },
  ],
  transitionTo: null,
};

/** Home island arrival cinema. */
export const CINEMA_HOME_ISLAND: CinemaManifest = {
  id: "home_island_arrive",
  title: "Home Island — Arrival",
  surface: "home_island",
  durationSec: 10,
  loop: false,
  skippableAfterSec: 0.8,
  post: "mystical",
  background: 0x0a1420,
  fogDensity: 0.028,
  torch: false,
  embers: false,
  assets: [
    {
      meshKeys: [...CINEMA_ISLAND_MESHES],
      kind: "shell",
      heightM: 40,
      position: [0, 0, 0],
    },
    {
      meshKeys: [...CINEMA_HERO_MESHES],
      kind: "character",
      heightM: CHARACTER_HEIGHT_M,
      position: [2, 0, 8],
      rotationY: -0.4,
    },
  ],
  beats: [
    {
      t: 0,
      hold: 3.2,
      cam: { pos: [28, 18, 32], look: [0, 2, 0], fov: 42 },
      caption: "HOME ISLAND",
      sub: "Your shore · harvest · sail",
    },
    {
      t: 3.2,
      hold: 3.4,
      cam: { pos: [12, 6, 16], look: [2, 1.5, 6], fov: 40 },
      caption: "LANDFALL",
      sub: "SI world · 1.8 m human yardstick",
    },
    {
      t: 6.6,
      hold: 3.4,
      cam: { pos: [4, 2.2, 12], look: [2, 1.4, 8], fov: 38 },
      caption: "BEGIN",
      sub: "Camp · claim · deploy",
    },
  ],
  transitionTo: null,
  location: { archetype: "home", tags: ["home_island", "sail"] },
};

/** Hellmaw / volcanic sector establish (world boss approach). */
export const CINEMA_HELLMAW: CinemaManifest = {
  id: "sector_hellmaw",
  title: "Hellmaw Depths — Sector Establish",
  surface: "hellmaw",
  durationSec: 11,
  loop: false,
  skippableAfterSec: 1,
  post: "mystical",
  background: 0x120808,
  fogDensity: 0.05,
  torch: true,
  embers: true,
  assets: [
    {
      meshKeys: [
        "models/bosses/shadow-flame-mantis.prod.glb",
        "models/bosses/shadow-flame-mantis.glb",
        ...CINEMA_HERO_MESHES,
      ],
      kind: "world_boss",
      heightM: 3.2,
      position: [12, 0, -8],
      rotationY: Math.PI * 0.15,
    },
  ],
  beats: [
    {
      t: 0,
      hold: 3.5,
      cam: { pos: [28, 12, 18], look: [12, 2, -8], fov: 40 },
      caption: "HELLMAW DEPTHS",
      sub: "Sector s · Legion volcanic south",
      postBoost: 0.4,
    },
    {
      t: 3.5,
      hold: 3.5,
      cam: { pos: [18, 4, 4], look: [12, 1.8, -8], fov: 36 },
      caption: "SHADOW FLAME MANTIS",
      sub: "World boss · ash ghasts · nuclear ultimate",
    },
    {
      t: 7,
      hold: 4,
      cam: { pos: [12, 2.5, 6], look: [12, 1.6, -8], fov: 34 },
      caption: "HOLD THE CALDERA",
      sub: "Allow-gate: volcanic / hellmaw / boss_event only",
    },
  ],
  transitionTo: null,
  location: {
    sectorId: "s",
    archetype: "volcanic",
    pin: "hellmaw_caldera",
    tags: ["hellmaw", "world_boss", "volcanic"],
  },
};

/** Danger Room cold open. */
export const CINEMA_DANGER: CinemaManifest = {
  id: "danger_establish",
  title: "Danger Room — Cold Open",
  surface: "danger",
  durationSec: 5.5,
  loop: false,
  skippableAfterSec: 0.3,
  post: "subtle",
  background: 0x0a0c10,
  fogDensity: 0.04,
  torch: false,
  embers: false,
  assets: [
    {
      meshKeys: [...CINEMA_HERO_MESHES],
      kind: "character",
      heightM: CHARACTER_HEIGHT_M,
      position: [0, 0, 0],
      rotationY: Math.PI,
    },
  ],
  beats: [
    {
      t: 0,
      hold: 2.5,
      cam: { pos: [3.2, 1.8, 4.5], look: [0, 1.2, 0], fov: 42 },
      caption: "DANGER ROOM",
      sub: "Train · spar · tune combat",
    },
    {
      t: 2.5,
      hold: 3,
      cam: { pos: [0, 1.5, 3.2], look: [0, 1.2, 0], fov: 40 },
      caption: "ARMED",
      sub: "Weapon packs · skills · AI",
    },
  ],
  transitionTo: null,
};

/** All production cinemas by id. */
export const PRODUCTION_CINEMAS: Record<string, CinemaManifest> = {
  [CINEMA_INTRO_DOORS.id]: CINEMA_INTRO_DOORS,
  [CINEMA_INTRO_TO_CHARACTERS.id]: CINEMA_INTRO_TO_CHARACTERS,
  [CINEMA_CHAR_SELECT_ESTABLISH.id]: CINEMA_CHAR_SELECT_ESTABLISH,
  [CINEMA_LOBBY.id]: CINEMA_LOBBY,
  [CINEMA_HOME_ISLAND.id]: CINEMA_HOME_ISLAND,
  [CINEMA_HELLMAW.id]: CINEMA_HELLMAW,
  [CINEMA_DANGER.id]: CINEMA_DANGER,
};

export function getCinema(id: string): CinemaManifest | null {
  return PRODUCTION_CINEMAS[id] ?? null;
}

/** Flow map: which cinema organizes entry into a surface. */
export const CINEMA_FLOW: Record<string, string> = {
  doors: "intro_doors",
  characters: "char_select_establish",
  lobby: "lobby_establish",
  home_island: "home_island_arrive",
  hellmaw: "sector_hellmaw",
  danger: "danger_establish",
  intro_handoff: "intro_to_characters",
};

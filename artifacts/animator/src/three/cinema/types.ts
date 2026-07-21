/**
 * Production cinema contracts — beat timelines for game-flow transitions.
 *
 * Surfaces: intro · doors · lobby · characters (select/create) · home-island · sectors.
 * Units: SI metres, Y-up, XZ ground. Human yardstick 1.8 m.
 *
 * A "recording" is a deterministic CinemaManifest (not a video file): camera keys,
 * captions, post grade, optional character/shell assets, and transition target.
 */

/** Production surfaces that may own a cinema timing sequence. */
export type CinemaSurface =
  | "intro"
  | "doors"
  | "landing"
  | "lobby"
  | "characters"
  | "home_island"
  | "sector"
  | "hellmaw"
  | "danger"
  | "boss";

/** Camera look-at key: eye + target in world metres. */
export type CinemaCamKey = {
  pos: [number, number, number];
  look: [number, number, number];
  /** Optional FOV override for this beat. */
  fov?: number;
};

/** One timed beat on the cinema timeline. */
export type CinemaBeat = {
  /** Absolute start time (seconds from sequence start). */
  t: number;
  /** Hold duration before the next beat may auto-advance (seconds). */
  hold: number;
  /** Camera key applied with smooth settle when this beat starts. */
  cam?: CinemaCamKey;
  /** On-screen caption / chapter title. */
  caption?: string;
  /** Smaller subtitle under caption. */
  sub?: string;
  /** Post-intensity nudge 0..1 (bloom/grain emphasis). */
  postBoost?: number;
  /** Optional VFX id for host systems (smoke, ember_burst, …). */
  vfx?: string;
  /** Optional one-shot SFX key for audio bus. */
  sfx?: string;
  /** When true, wait for player Continue (hold still applies as min time). */
  waitContinue?: boolean;
};

/** Optional production character/shell inclusion. */
export type CinemaAssetRef = {
  /** CDN-relative or same-origin mesh keys (first hit wins). */
  meshKeys: string[];
  /** Kind for scale: character | prop | shell | world_boss */
  kind: "character" | "prop" | "shell" | "world_boss" | "hero_stage";
  /** Target height in metres (characters default 1.8). */
  heightM?: number;
  /** World position (metres). */
  position?: [number, number, number];
  /** Yaw radians. */
  rotationY?: number;
};

export type CinemaPostGrade =
  | "mystical" /** pmndrs full grade — lobby / intro */
  | "subtle" /** gameplay-readable Studio grade */
  | "raw"; /** simple UnrealBloom only */

/** Full production cinema recording (data-driven sequence). */
export type CinemaManifest = {
  id: string;
  title: string;
  surface: CinemaSurface;
  /** Total runtime hint (max beat.t + hold); timeline may be shorter if skipped. */
  durationSec: number;
  /** Loop ambient backdrop (doors library) vs linear flow (intro → characters). */
  loop: boolean;
  /** Can skip after this many seconds (0 = immediately). */
  skippableAfterSec: number;
  post: CinemaPostGrade;
  /** Atmosphere palette */
  background: number;
  fogDensity: number;
  /** Optional torch at origin. */
  torch?: boolean;
  embers?: boolean;
  /** Characters / shells to load into the stage. */
  assets: CinemaAssetRef[];
  beats: CinemaBeat[];
  /**
   * App mode to navigate after linear complete (characters = campfire select/create).
   * Null/undefined = stay on surface (ambient).
   */
  transitionTo?: "characters" | "doors" | "lobby" | "danger" | "realms" | null;
  /** Sector / island pin metadata for world establish shots. */
  location?: {
    sectorId?: string;
    archetype?: string;
    pin?: string;
    tags?: string[];
  };
  notes?: string[];
};

export type CinemaTimelineState = {
  time: number;
  beatIndex: number;
  beat: CinemaBeat | null;
  finished: boolean;
  caption: string;
  sub: string;
  canSkip: boolean;
};

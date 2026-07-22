import * as THREE from "three";
import { DangerRoom } from "./DangerRoom";
import { asRoomPresetId, loadRoomPreset, ROOM_PRESETS, type RoomPresetId } from "./RoomPresets";
import { DUNGEON_MAPS, loadDungeonMap } from "./DungeonMaps";
import { addStudioLights, STUDIO_FOG, STUDIO_TONE_MAPPING_EXPOSURE } from "./studioLighting";
import { DjBooth } from "./DjBooth";
import { Character } from "./Character";
import { ExplorerCharacter } from "./ExplorerCharacter";
import { GrudgeAvatar } from "./grudge/GrudgeAvatar";
import { parseGrudgeAvatarId } from "../lib/raceModel";
import { resolveHudPortrait } from "../lib/hudPortrait";
import {
  isWeaponSkillSlotUnlocked,
  loadSkillUnlocks,
  applyHarvestYield,
} from "../game/harvestCatalog";
import { Controller } from "./Controller";
import {
  Recoil,
  fovKick,
  screenCenterRay,
  screenAimRay,
  AIM_SOFT_MAX,
  AIM_HARD_MAX,
  AIM_FREE_MAX,
} from "./aim/AimSystem";
import { Vfx, type TurretHandle, type TurretVariant } from "./Vfx";
import { AbilityOrchestrator } from "./abilities/abilityOrchestrator";
import { deployAbility, getAbility, kitAbility, statusAbility, vfxSkill } from "./abilities/abilityRegistry";
import { dispatchStatusRouting, routeStatusScope } from "./abilities/statusScopeRouting";
import type { AbilityDef, StatusScope } from "./abilities/abilityTypes";
import { CombatSfx } from "./audio/CombatSfx";
import { musicStation } from "./audio/musicStation";
import { MechSystem } from "./mech/MechSystem";
import { MechReconciler } from "./mech/mechReconcile";
import {
  Targets,
  type CombatTargets,
  type TargetHandle,
  type SparringContext,
  STUN_SECONDS,
  SHIELD_BREAK_SECONDS,
} from "./Targets";
import type { BearAttack } from "./bear/bearAttacks";
import { Duel } from "./Duel";
import {
  ArenaMatch,
  ARENA_MAP_PATHS,
  ASSASSINATION_MAP_PATHS,
  FFA_KILL_GOAL,
  defaultArenaLoadout,
  type ArenaMode,
  type ArenaOpponentSpec,
} from "./ArenaMatch";
import { fitForgeScene, stripHelpersCharacter } from "./helpersForge";
import { AleBot } from "./ale/AleBot";
import type { AleCameraMode, ReplayFrequency } from "./types";
import { Dungeon } from "./dungeon/Dungeon";
import { DungeonEnemies } from "./dungeon/DungeonEnemies";
import { isInWaterBand, traversalModeFor } from "./dungeon/water";
import { VoxelArena } from "./voxel/VoxelArena";
import type { VoxelMap } from "./voxel/types";
import {
  PhysicsSystem,
  createScenePhysics,
  type CharacterCapsuleKcc,
} from "./PhysicsSystem";
import {
  LocationBag,
  ScriptRunner,
  dangerRoomLocation,
  dungeonLocation,
  createSceneMeta,
  physicsDefaultsFor,
  type WorldLocation,
  type ScriptDoc,
  isScriptDoc,
} from "@workspace/grudge-runtime";
import { createMysticalComposer, type MysticalComposer } from "./fx/postfx";
import {
  aoeFalloff,
  meleeStrike,
  preferSelectedHostile,
  weaponOWR,
  classifyEngagement,
  fireComboStep,
  type RangeOutcome,
} from "./combat";
import { StatusController, STATUS_DEFS } from "./fx/StatusFx";
import { TargetIndicators, TelegraphField } from "./fx/Indicators";
import { InputState } from "./input";
import { mountWeaponModel, unmountWeapon, type MountedWeapon } from "./Weapons";
import { MaceThrowMachine, type MaceThrowEvent } from "./mace/maceThrow";
import type { FireFxParams } from "./fxSettings";
import { loadSound, saveSound, type SoundSettings } from "./soundSettings";
import { loadControls, saveControls } from "./controlsSettings";
import { getCharacter, getWeapon, weaponCombat, loadGltfFirst } from "./assets";
import { sharedGltfLoader } from "./loaders/gltf";
import { offHandEligible, getT0Skill, t0SignatureSkills, mmToMeters } from "./arsenal";
import {
  isSpearWeapon,
  spearChargePlan,
  SPEAR_COMBO_CLIPS,
  SPEAR_FINISHER_ENTRY_MM,
  spearSkillById,
  spearSignatureRows,
  type SpearSkillRuntime,
} from "./ummorpg/spearCombat";
import {
  heavyProfile,
  heavySignatureRows,
  isHeavy2hWeapon,
} from "./combat/heavyWeaponCombat";
import { ELEMENT_THEME } from "./arsenal/elements";
import { staffHoverTheme } from "./arsenal/staffHover";
import { CampBuildSystem } from "./camp/CampBuildSystem";
import { getPlaceable } from "./camp/placeables";
import { ForestWorld } from "./ForestWorld";
import {
  loadTestWorldId,
  saveTestWorldId,
  TEST_WORLDS,
  type TestWorldId,
} from "./testWorlds";
import { CampEnemySystem } from "./enemies/CampEnemySystem";
import { RaiderBoatSystem } from "./enemies/RaiderBoatSystem";
import { VolcanoWorldBossSystem } from "./boss/VolcanoWorldBossSystem";
import {
  RED_MUSHROOM_ANCHORS,
  ISLAND_EVENT_NODE_ANCHORS,
  mushroomWorldPos,
} from "../game/islandLife/catalog";
import { FabledSkyTowns } from "./fabled/FabledSkyTowns";
import { meleeStrikeFxFor } from "./combat/meleeStrikeFx";
import {
  deploySandboxVfx,
  sandboxEffectForKey,
  sandboxLabelForEffect,
} from "./fx/vfxSandboxHotkeys";
import {
  advanceBeamSession,
  beamProfileForWeapon,
  createBeamSession,
  type BeamCastProfile,
  type BeamCastSession,
  type BeamPhysicsMode,
} from "./combat/beamCast";
import {
  DODGE_CUT,
  SLIDE_CUT,
  STAMINA_COST,
  planDodge,
  FORCEFIELD_CUT,
  PARRY_CUT,
  RECOVERY_CUT,
  UTILITY_KICK_CUT,
} from "./combatCuts";
import {
  GUN_SHIELD,
  SHOTGUN,
  gunLoadout,
  isGunWeapon,
  isShotgunWeapon,
  type GunLoadout,
} from "./gunCombat";
import { XBOW, isCrossbowWeapon } from "./crossbowCombat";
import {
  aoeReticleScale,
  applyIntensity,
  cameraProfileOpts,
  rangedFireLock,
  rangedPrimaryTune,
  rangedReleaseDelay,
  resolveCameraProfileKey,
  reticleProfileForWeapon,
} from "@workspace/grudge-physics";
import {
  beginCastPlacement,
  clampAim,
  groundFromRay,
  inCone,
  type CastPlacementSession,
  type CastPlacementSpec,
} from "./castPlacement";
import {
  emptyCombatContext,
  pickStateClip,
  type CombatContextSnapshot,
  type CombatSituation,
} from "./combatContext";
import {
  multiPartFor,
  nextSkillPart,
  partForContext,
  type SkillPartDef,
  type SkillVfxOp,
} from "./skillCombos";
import {
  defaultToolForMode,
  MODE_BLURB,
  MODE_LABEL,
  nextMode,
  RADIAL_BY_MODE,
  type PlayerActivityMode,
} from "./playerMode";
import type { StaffElement } from "./types";
import { defenseClips, defenseOutcomeClip, guardedHitClip, vulnerableReactionClip } from "./arsenal/holdStyle";
import type { WeaponGroup } from "./arsenal/types";
import type { ActionKey } from "./explorer/types";
import type { VulnerableState } from "@workspace/epicfight";
import { SKILL_KIND_ICON } from "./icons";
import { PLAYER_HEADBUTT_PAYLOAD, PLAYER_HEAVY_PAYLOAD, PLAYER_STOMP_PAYLOAD, SparringCombat } from "./SparringCombat";
import { isDefended, outcomeForceScale } from "./combatModel";
import type { AttackPayload, DefensiveResult } from "@workspace/epicfight";
import { RemoteAvatar } from "./RemoteAvatar";
import type { DangerClient } from "../net/DangerClient";
import {
  STATE_REPORT_MS,
  type CombatEvent,
  type GuardState,
  type PlayerSnapshot,
  type PlayerState,
  type NpcState,
} from "@workspace/danger-net";
import {
  CHARACTER_HEIGHT_M,
  DEFAULT_EDITOR,
  type ActionSlot,
  type Avatar,
  type Difficulty,
  type DuelState,
  type EditorParams,
  type Faction,
  type HudSnapshot,
  type KickSkill,
  type KiterKit,
  type ArcaneKit,
  type TankKit,
  type SkillKind,
  type SlotBinding,
  type StatusId,
  type StrikerCombat,
  type WeaponCombat,
  type WeaponId,
} from "./types";
import { resolveSlotIconUrl, resolveSlotLocalName } from "./skillIcons";

/** localStorage key for per-character action-slot clip overrides. */
const SLOTS_KEY = "dangerroom:slots";

type SlotMap = Partial<Record<ActionSlot, string>>;

/** Action slots in HUD order, with the input that triggers them. */
const SLOT_META: { slot: ActionSlot; key: string }[] = [
  { slot: "primary", key: "LMB" },
  { slot: "fskill", key: "F" },
  { slot: "sig1", key: "1" },
  { slot: "sig2", key: "2" },
  { slot: "sig3", key: "3" },
  { slot: "sig4", key: "4" },
];

/** Seconds a combo stays chainable after a hit before resetting to hit 0. */
const COMBO_WINDOW = 0.9;

/**
 * Fraction of a swing's real clip duration the combo stays LOCKED before the
 * next hit can chain. Tying the lock to the actual clip length (instead of a
 * fixed ~0.2s) lets each swing play most of the way through — no more truncated
 * "half" hits — while still chaining responsively near the end of the motion.
 */
const COMBO_PLAYTHROUGH = 0.68;

/**
 * Grace (s) added on top of a swing's clip duration during which the next hit
 * still chains before the combo resets to hit 0. Keeps chaining forgiving once
 * the lock lifts.
 */
const COMBO_GRACE = 0.42;

/** Radius (m) an area-of-effect friendly cast splashes its buff onto nearby allies. */
const FRIENDLY_AOE_RADIUS = 6;
/** Max planar distance the Stomp finisher will leap to reach a downed enemy. */
const STOMP_REACH = 3.2;

/** Seconds the Striker kick combo stays chainable (slightly looser than the weapon combo). */
const KICK_COMBO_WINDOW = 1.0;

/** Default arcane bolt colour for a staff with no element (the plain Arcane Staff). */
const STAFF_ARCANE_COLOR = 0xb98cff;
/** Steady-poke cooldown between staff LMB bolts (seconds). */
const STAFF_BOLT_CD = 0.34;
/** Levitation float duration a staff double-jump grants (seconds). */
const STAFF_FLOAT_SECONDS = 2.0;

/**
 * Striker per-signature-skill cooldowns in seconds.
 * [sig0 Flanchet Shot, sig1 Launch Kick, sig2 Flame Tornado, sig3 Hover]
 */
const STRIKER_SIG_CD = [2.5, 5.0, 6.0, 7.0] as const;

/** Stamina costs for each Striker signature skill (parallel to STRIKER_SIG_CD). */
const STRIKER_SIG_ST = [12, 20, 25, 15] as const;

/**
 * Pistol per-slot cooldowns (Albion-style — independent, never global).
 * [0 Quick Draw, 1 Smoke Phantom, 2 Dive Kick, 3 Hexaring Beam]
 */
const PISTOL_SIG_CD = [3.0, 18.0, 7.5, 16.0] as const;

/** Stamina costs for each pistol signature skill (parallel to PISTOL_SIG_CD). */
const PISTOL_SIG_ST = [10, 22, 14, 22] as const;

/** Pistol aerial hover after backflip / dive-kick rebound (seconds). */
const PISTOL_HOVER_AIM = 0.5;

/** Independent cooldowns (s) for the Soulbinder's arcane-staff signature slots. */
const ARCANE_SIG_CD = [4.0, 7.0, 11.0, 14.0] as const;
/** Stamina costs for each arcane signature skill (parallel to ARCANE_SIG_CD). */
const ARCANE_SIG_ST = [8, 16, 20, 24] as const;

/**
 * Ice Staff tank-mage signature cooldowns (s).
 * [0 Ice Spline, 1 Ice Wall, 2 Frost Shell clone-dodge, 3 Blizzard]
 */
const ICE_SIG_CD = [2.2, 6.0, 9.0, 14.0] as const;
/** Stamina costs for each ice-staff signature skill. */
const ICE_SIG_ST = [8, 16, 20, 28] as const;
/** Enemy must be closer than this (m) for ice wall to push-then-deploy. */
const ICE_WALL_PUSH_RANGE = 3.2;
/** Base / extended ice dash-slide distances (m). */
const ICE_SLIDE_DIST = 3.6;
const ICE_SLIDE_DIST_LONG = 6.8;

/**
 * Gunblade "Tank" (Centurion) per-signature-skill cooldowns in seconds.
 * [sig0 Shield Charge, sig1 Shield Bash, sig2 Blade Flurry, sig3 Super Cannon]
 */
const TANK_SIG_CD = [6.0, 4.0, 8.0, 20.0] as const;
/** Stamina costs for each Tank signature skill (parallel to TANK_SIG_CD). */
const TANK_SIG_ST = [16, 10, 18, 30] as const;

/**
 * Flanged-Mace signature throw (slot 4): a quick throw that stuns the struck
 * target then returns to hand, or — on a re-press while the mace is out — a
 * dash-recall gap-closer. Mace-only; lives on its own per-slot cooldown.
 */
const MACE_THROW_CD = 6.0;
const MACE_THROW_ST = 16;
/** Stun duration (s) applied to the struck target. */
const MACE_THROW_STUN = 1.0;
/** Stun + light-damage radius (m) around the mace's landing point. */
const MACE_THROW_RADIUS = 2.2;
/** Modest impact damage the thrown mace deals on landing. */
const MACE_THROW_DAMAGE = 18;
/** Steel-grey tint for the mace's impact VFX. */
const MACE_THROW_COLOR = 0xc8cdd6;

/**
 * Exo-Armour Mech bespoke kit. Three abilities distinct from the pilot's on-foot
 * combat, only usable while sealed inside the armour. Parallel to `mechCds` and
 * the HUD's mech ability bar:
 *  - 0 Seismic Stomp  (F)  — close ground-pound that LAUNCHES nearby foes.
 *  - 1 Plasma Cannon  (1)  — charged forward beam blast that hits a target at range.
 *  - 2 Grapple Throw  (2)  — grab the foe in front and hurl it for an impact AoE.
 * Keys mirror the on-foot bar: F = no signatureIndex, 1/2 = signatureIndex 0/1.
 */
const MECH_ABILITIES = [
  { key: "F", name: "Seismic Stomp", icon: "charge", cd: 5.0 },
  { key: "1", name: "Plasma Cannon", icon: "scout", cd: 7.0 },
  { key: "2", name: "Grapple Throw", icon: "siege", cd: 6.0 },
] as const;

/**
 * Deployed-turret tuning. A turret stands for `TURRET_LIFE` seconds and, every
 * `TURRET_VOLLEY_GAP` seconds, fires a burst of `TURRET_VOLLEY` slow, oversized
 * bolts at the CLOSEST living enemy. The bolts travel to where the enemy was when
 * fired (no homing) at 50% of the player's bullet speed and 150% of its size, so
 * a moving target can dodge them. Deals collision damage on arrival.
 *
 * Variants:
 *  - classic (liked chassis) — skill 4 / heavy impact / kiter retreat
 *  - gameReady (animated) — skill 2 medium impact for rifle family
 */
const TURRET_LIFE = 6.0;
const TURRET_LIFE_HEAVY = 8.0;
const TURRET_LIFE_MED = 5.0;
const TURRET_VOLLEY = 3;
const TURRET_VOLLEY_GAP = 1.4;
const TURRET_BOLT_SPEED = 24; // 50% of the kiter's 48-speed primary bullet
const TURRET_BOLT_SCALE = 1.5; // 150% of the player's bolt size
const TURRET_SHOT_DAMAGE = 9;
const TURRET_SHOT_DAMAGE_HEAVY = 12;
const TURRET_COLOR = 0x8fd0ff;

/**
 * Deployed snare-field tuning. A second user of the deploy ability lifecycle (the
 * zone-control counterpart to the turret): a tar-pit zone that stands for
 * `SNARE_FIELD_LIFE` seconds and, every `SNARE_FIELD_PULSE_GAP` seconds,
 * re-snares every living enemy inside `SNARE_FIELD_RADIUS` — a movement slow plus
 * modest chip damage. The slow lasts a touch longer than a pulse gap so an enemy
 * standing in the field stays continuously snared, and is re-applied each pulse so
 * a target that just wandered in is caught and one that left is released when its
 * slow times out. The deploy schedule (life / first pulse / gap / tail) is seeded
 * + tested in the pure ability registry (`deploy:snareField`).
 */
const SNARE_FIELD_RADIUS = 3.0;
const SNARE_FIELD_SLOW_MUL = 0.4; // cut enemy approach speed to 40%
const SNARE_FIELD_SLOW_SECONDS = 1.2; // > the 0.8s pulse gap, so the snare is continuous
const SNARE_FIELD_CHIP_DAMAGE = 4;
const SNARE_FIELD_COOLDOWN = 9;

/** Themed colors for dash skills (mirrors the Vfx THEME palette). */
const SKILL_COLOR: Record<SkillKind, number> = {
  witchArrow: 0xff6a1e,
  witchMissile: 0xb070ff,
  witchDisk: 0x3dff9a,
  slash: 0x9fe8ff,
  slam: 0xffb24d,
  bolt: 0x6fd6ff,
  nova: 0xb98cff,
  muzzle: 0xfff2a8,
  thrust: 0xff6f6f,
  // Model-driven projectile/spell skills (mirror the Vfx THEME palette).
  fireDragon: 0xff6a1e,
  meteor: 0xff8a3d,
  turret: 0x8fd0ff,
  darkBlades: 0xb070ff,
  swordVolley: 0xa8e6ff,
  soul: 0x8fffe0,
  laser: 0xff5a3c,
};

/**
 * Motion-math scale: 100 motion-math units = 1 metre of body displacement. One
 * tunable knob so attack "MM" descriptors read in the same units the user spec'd.
 */
const MM_TO_M = 0.01;

/**
 * A per-attack motion descriptor in motion-math units. `peak` is the forward
 * displacement at the strike (negative = a retreating attack); when `settle` is
 * given the body springs from `peak` to `settle` afterwards:
 *   `+100`            → lunge to +1m and hold.
 *   `{ +100, -50 }`   → drive to +1m, then recoil to a net -0.5m behind start.
 *   `-50`             → strike while hopping back to -0.5m.
 */
interface MotionProfile {
  peak: number;
  settle?: number;
  /** Fraction of the dash where the strike lands. */
  impactAt: number;
}

/** Attack2 (Z): committed lunge-through that recoils behind the start. */
const ATTACK2_MOTION: MotionProfile = { peak: 100, settle: -50, impactAt: 0.45 };
/** Attack3 (X): a poke that retreats on the same beat. */
const ATTACK3_MOTION: MotionProfile = { peak: -50, impactAt: 0.5 };

/**
 * USER-DIRECTED: forward gap-closer baked into each non-opener combo swing so the
 * 3-hit chain aggressively advances INTO the enemy instead of swinging in place.
 * In motion-math units ({@link MM_TO_M}-scaled): the opener (stage 0) already
 * closes to the locked target, so this rides hits 1-2 — together they carry the
 * body ~1m+ forward across the combo. Most of the lunge is kept (only a slight
 * recoil) so the ground gained each swing isn't given back.
 */
const COMBO_ADVANCE_MM = 55;

/**
 * Fraction of a finisher swing's REAL clip length at which its hit (damage + slash
 * VFX) resolves. Big finisher clips (the dagger's double-dagger cross-stab, the
 * greatsword overhead, ...) land their blade near the END of the animation, so the
 * old fixed `dashDur * impactAt` (~90 ms) fired the hit in empty air while the swing
 * was still winding up. Timing the finisher strike to the clip lands it WITH the
 * swing. Callers clamp this to a sane window so a slow clip never feels laggy.
 */
const FINISHER_IMPACT_FRAC = 0.55;

/**
 * Top-level disposable engine. React mounts it onto a container; it owns the
 * renderer, scene, loop and all subsystems, and pushes HUD snapshots out via a
 * callback. All public mutators are safe to call from React handlers.
 */
export class Studio {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();
  /** Spatial combat SFX (impacts/whooshes/blocks + soft ambient bed). */
  private sfx: CombatSfx | null = null;
  /** Persisted sound mixer (mute + master/combat/ambient/klaxon levels). */
  private sound: SoundSettings = loadSound();
  private room: DangerRoom;
  private djBooth: DjBooth | null = null;
  private vfx: Vfx;
  private targets: CombatTargets;
  /** The Danger Room sparring population, stashed while inside the dungeon. */
  private dangerTargets: Targets | null = null;
  /** AI-vs-AI duel orchestrator (drives `targets`); null until first started. */
  private duel: Duel | null = null;
  /** Difficulty to restore when a duel stops (duels force their own tier). */
  private duelSavedDifficulty: Difficulty | null = null;
  /** Player-vs-NPC arena match (countdown → fight → result → choice). */
  private arenaMatch: ArenaMatch | null = null;
  /** Difficulty restored when an arena match ends. */
  private arenaSavedDifficulty: Difficulty | null = null;
  /** Loaded helpers-forge arena set (character stripped; hidden outside matches). */
  private arenaMapRoot: THREE.Object3D | null = null;
  private arenaMapLoading: Promise<boolean> | null = null;
  /** A.L.E. Bot: director cameras + highlights + diagnostics over the duel. */
  private ale = new AleBot();
  private status: StatusController;
  /** Under-foot target/faction discs (red hostile, green ally, blue neutral). */
  private indicators: TargetIndicators;
  /** Active AOE/boss-attack ground telegraphs (yellow-blink → red → resolve). */
  private telegraphs: TelegraphField;
  /** The active dungeon level (null in the Danger Room). */
  private dungeon: Dungeon | null = null;
  private inDungeon = false;
  /**
   * Underwater descent ambience (dungeon water band): an eased 0..1 intensity
   * that tints the scene blue, thickens the fog and emits rising bubbles while
   * the player sinks through the water, clearing on exit above or below.
   */
  private waterFx = 0;
  private bubbleAccum = 0;
  private waterFogColor = new THREE.Color(0x10465f);
  private static readonly FOG_BASE_COLOR: number = STUDIO_FOG.color;
  private static readonly FOG_BASE_NEAR: number = STUDIO_FOG.near;
  private static readonly FOG_BASE_FAR: number = STUDIO_FOG.far;
  private static readonly FOG_WATER_NEAR = 4;
  private static readonly FOG_WATER_FAR = 26;
  /**
   * The dry-fog baseline for the CURRENT location: the active room preset's
   * atmosphere while in the Danger Room, the dark dungeon tone while inside it.
   * The underwater {@link updateWaterFx} lerps from these toward the water tint,
   * so swapping the room preset re-tints the Danger Room without disturbing the
   * dungeon's look or its water-band fog restoration.
   */
  private baseFogColor = new THREE.Color(Studio.FOG_BASE_COLOR);
  private baseFogNear = Studio.FOG_BASE_NEAR;
  private baseFogFar = Studio.FOG_BASE_FAR;
  private baseBgColor = new THREE.Color(Studio.FOG_BASE_COLOR);
  /** Set while the player stands at the door portal (drives the HUD prompt). */
  private doorPrompt = false;
  /** Guards against re-triggering the async dungeon load. */
  private enteringDungeon = false;
  /** The active played voxel map (null unless launched from the Voxel Editor). */
  private arena: VoxelArena | null = null;
  private inArena = false;
  /** Guards against re-triggering the async arena load. */
  private enteringArena = false;
  private physics: PhysicsSystem | null = null;
  /**
   * Shared Danger Room player KCC (Rapier capsule on ground plane). Fleet SSOT
   * from `@workspace/grudge-physics`. Restored when leaving dungeon/arena mesh
   * collision; living NPCs stay on circle obstacles + keepRoomBounds.
   */
  private playerKcc: CharacterCapsuleKcc | null = null;
  /**
   * Uniform Warlords location + declarative scripts
   * (`@workspace/grudge-runtime`). Same bag shape for island/zone/dungeon hosts.
   */
  private locationBag = new LocationBag(dangerRoomLocation());
  private scripts = new ScriptRunner();
  readonly sceneMeta = createSceneMeta("danger-room", "Danger Room", "/danger");
  /** Shared pmndrs post-processing composer over the main scene (null = direct render). */
  private postfx: MysticalComposer | null = null;
  private input: InputState;
  /** True on touch devices: suppress pointer-lock on tap (on-screen controls). */
  private touchMode = false;
  private resizeObs: ResizeObserver | null = null;
  private character!: Avatar;
  private controller!: Controller;
  private mounted: MountedWeapon | null = null;
  /** Independent off-hand piece (Tower Shield) mounted alongside the main weapon. */
  private mountedOff: MountedWeapon | null = null;
  /**
   * Flanged-Mace signature throw (slot 4) state machine + its in-flight visual.
   * Lazily created on first use; null until then. The flying mace is a small
   * owned procedural mesh (so its live position drives the dash-recall), tracked
   * for disposal.
   */
  private maceThrow: MaceThrowMachine | null = null;
  private maceMesh: THREE.Group | null = null;
  private maceMeshGeos: THREE.BufferGeometry[] = [];
  private maceMeshMats: THREE.Material[] = [];
  private readonly maceFrom = new THREE.Vector3();
  private readonly maceTo = new THREE.Vector3();
  private readonly maceImpactPoint = new THREE.Vector3();

  /** Delayed actions (e.g. dash endpoint blast) run from the loop. */
  private pending: { t: number; fn: () => void }[] = [];
  /**
   * Data-driven ability lifecycle (cast → release → travel → impact → status).
   * A small set of representative abilities (fire-dragon sig, bow slash,
   * buff/debuff statuses) are routed through this; the rest stay on their inline
   * paths. Advanced from the main loop with the same `dt` as {@link pending}.
   */
  private readonly abilities = new AbilityOrchestrator();
  /** Set when a Skyfall launch is airborne, waiting to barrage at the apex. */
  private skyfallPending = false;
  /** Fail-safe: barrage at the latest by this time if the apex is never reported. */
  private skyfallPendingTimer = 0;
  private skyfallCooldown = 0;
  /** Aerial crash-down slam in flight (cleared on touchdown or by the fail-safe). */
  private slamPending = false;
  private slamPendingTimer = 0;
  /** Set while an aerial dagger overhead is mid-swing, awaiting its end-of-clip slash. */
  private aerialSlashPending = false;
  private aerialSlashPendingTimer = 0;

  private params: EditorParams = loadControls();
  /** Debounce handle + last-persisted zoom for cheap wheel-zoom persistence. */
  private controlsSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedCamDist = this.params.cameraDistance;
  /**
   * Global simulation time-scale. The main loop multiplies its per-frame delta by
   * this before threading it through physics, animation, combat timers and
   * scheduled hits, so 1.0 = real time and e.g. 0.25 = quarter-speed slow-motion
   * everywhere at once (rendering still runs at the real frame rate).
   */
  private timeScale = 1;
  private characterId: string;
  private weaponId: WeaponId = "sword";

  /** Persisted per-character clip overrides for the action slots. */
  private allOverrides: Record<string, SlotMap> = {};
  /** The active character's resolved (validated) overrides. */
  private overrides: SlotMap = {};
  private onHud: (h: HudSnapshot) => void;
  /** Fired after a character GLB finishes loading and is committed. */
  onCharacterLoaded: ((id: string) => void) | null = null;
  /**
   * Character bag death drop (3×3 carry empties; 2×2 loadout kept).
   * Wired from App → applyDeathBagDrop(characterId).
   */
  onPlayerDefeat: (() => void) | null = null;
  /**
   * Fired when the room's environment preset changes because of a host broadcast
   * (not a local user action). Lets the host-agnostic React UI keep its menubar
   * selection in sync with the arena every joiner is now in.
   */
  onRoomPresetChanged: ((id: RoomPresetId) => void) | null = null;
  private loadToken = 0;
  private weaponToken = 0;
  /** Off-hand slot selection (null = empty); only mounts when `offHandEligible`. */
  private offHandId: WeaponId | null = null;
  private offHandToken = 0;

  private sparring!: SparringCombat;
  /** Transient center-screen flash text (PERFECT PARRY!, SHIELD BREAK!, etc.). */
  private combatFlash = "";
  private combatFlashTimer = 0;
  /** Exo-Armour Mech Mode: suit-up transformation + rideable mech control. */
  private mech!: MechSystem;
  /** Studio-side mech reconciliation (visibility/speed/takeover-teardown glue). */
  private mechReconciler!: MechReconciler;
  /**
   * Independent cooldowns (s) for the mech's bespoke kit, parallel to
   * {@link MECH_ABILITIES}: [Seismic Stomp (F), Plasma Cannon (1), Grapple Throw (2)].
   * These are distinct from the pilot's on-foot skills and only tick/fire while
   * the player is sealed inside the armour.
   */
  private mechCds: [number, number, number] = [0, 0, 0];
  /** Tracks the airborne edge while piloting so a landing slam fires once. */
  private mechWasAirborne = false;
  private onKeyUp = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    this.handleKeyUp(e.code);
  };

  private health = 100;
  private maxHealth = 100;
  private stamina = 120;
  /** Must match the player CC maxStamina in SparringCombat so the HUD is accurate. */
  private maxStamina = 120;
  private skillCooldown = 0;
  private skillCooldownMax = 0;
  private swingTimer = 0;
  /** Slash colour of the in-progress swing, used by the clean blade-trail ribbon. */
  private swingColor = 0x9fe8ff;
  /** 3-hit melee combo state: next stage (0-2), chain window, and a brief lock. */
  private comboIndex = 0;
  private comboTimer = 0;
  private comboLock = 0;
  /** Staff ranged primary (LMB bolt) cooldown — a steady poke gate independent of
   *  the skill cooldown so you can keep firing bolts while skills recharge. */
  private staffBoltCd = 0;
  /**
   * Active beam cast session: charge ethereal → locked-aim beam line damage.
   * Direction freezes at cast start; no re-aim until done.
   */
  private beamCastSession: BeamCastSession | null = null;
  /** Soulbinder "Hot Hands" fire-combo state: next stage (0-2), window, lock. */
  private fireComboIndex = 0;
  private fireComboTimer = 0;
  private fireComboLock = 0;
  /**
   * Offense-fail recovery lock: set when the player's attack is blocked, parried
   * or dodged. While it counts down the player cannot start a new attack — they
   * lose the tempo (the "animated fail" beat) so the defender gets a real window
   * to counter or escape. Gates every offensive entrypoint (combo / stab /
   * motion / heavy).
   */
  private recoverLock = 0;
  /** Utility Kick (KeyV) cooldown so the guard-breaking kick can't be spammed. */
  private kickCd = 0;
  /**
   * Active KeyC parry session — age tracks window for success/fail, side picks
   * the best directional parry clip (left / right / front) from threat position.
   */
  private parrySession: {
    token: number;
    age: number;
    side: "left" | "right" | "front";
    /** World point of nearest threat at press (for face + rebound). */
    threat: THREE.Vector3;
  } | null = null;
  private parrySessionToken = 0;
  /**
   * Failed-parry stamina: remaining points to restore over ~2s (slow recover).
   * Natural regen is held so this is the only recovery path until cleared.
   */
  private parryFailStamRemaining = 0;
  private parryFailStamRate = 0;
  /** Combat slide (Alt) session — rear-push travel + trip volume. */
  private combatSlide: {
    token: number;
    age: number;
    life: number;
    dir: THREE.Vector3;
    hitIds: Set<number>;
  } | null = null;
  private combatSlideToken = 0;
  private slideCd = 0;
  /**
   * KeyV Shadow Kick session: OPEN = planted parry window (no move);
   * COMMIT/SHADOW = finishing the kick. Token cancels stale schedules.
   */
  private shadowKick: {
    phase: "open" | "commit" | "shadow";
    token: number;
    /** Aim dir frozen at press (XZ unit). */
    dir: THREE.Vector3;
    /** Full clip duration if known (for timing notes). */
    fullDur: number;
    openDur: number;
  } | null = null;
  private shadowKickToken = 0;
  /** KeyE forcefield guard pulse cooldown. */
  private forceFieldCd = 0;
  /** Space smash-recovery cooldown (backflip out of tumble). */
  private smashRecoverCd = 0;
  /**
   * Smash Bros–style tumble: set when launched / knocked / fallen so Space
   * performs a cut backflip recovery instead of a normal jump.
   */
  private tumbleActive = false;
  /** Throw-bomb (KeyH) cooldown so the thrown grenade can't be spammed. */
  private throwCd = 0;
  /** Heal-potion (KeyJ) cooldown so the consumable can't trivialise fights. */
  private potionCd = 0;
  /** Pending aerial-spin skill: fires a flame-slash projectile when the spin ends. */
  private spinSkill: { skill: KickSkill; pal: StrikerCombat["palette"] } | null = null;
  /** Striker 3-hit kick combo state (separate from weapon combo). */
  private kickComboIndex = 0;
  private kickComboTimer = 0;
  private kickComboLock = 0;
  /** Pistol "Kiter" primary state: rounds fired this clip + a brief fire lock. */
  private pistolShots = 0;
  private pistolLock = 0;
  /** Simplified gun ammo (pistol 5 / rifle 18). */
  private gunAmmo = 0;
  private gunClipMax = 0;
  private gunReloadT = 0;
  private gunFireLock = 0;
  /** Hold-F charge for full discharge (plasma barrel). */
  private fKeyDown = false;
  private fHoldAccum = 0;
  private gunCharging = false;
  /**
   * Casting-mouse session: ground placement for traps / AoE / walls / heals /
   * teleport, or cone footprint skills. LMB confirms · RMB/Esc cancels.
   */
  private castPlacement: CastPlacementSession | null = null;
  private castReticle: THREE.Mesh | null = null;
  /** After M3 uppercut — LMB xbow prioritizes airborne bolt for this long. */
  private airFollowT = 0;
  /**
   * Pistol hover-aim window after double-jump backflip or dive-kick rebound:
   * face target, allow LMB (and skill 3 if off CD) while floating.
   */
  private pistolHoverAimT = 0;
  /** Live combat context for multi-part skills + state-dependent anims. */
  private combatCtx: CombatContextSnapshot = emptyCombatContext();
  /** Multi-part skill chain (same slot pressed again within window). */
  private skillChainSlot = -1;
  private skillChainPart = 0;
  private skillChainWindow = 0;
  private afterDamageT = 99;
  private lastComboStage = -1;
  /** Seconds remaining of Smash-style tumble / ragdoll (for combat context). */
  private tumbleT = 0;
  /**
   * Activity mode: combat · harvest · build. **Q** cycles.
   * **X** always dodges. Hold **Tab** opens radial options for the mode.
   */
  private activityMode: import("./playerMode").PlayerActivityMode = "combat";
  private activityTool = "attack";
  private radialOpen = false;
  private radialHoldT = 0;
  private tabHoldArmed = false;
  /** Claim flag / structure placeable ghosts (build mode + Camp UI). */
  private campBuild: CampBuildSystem | null = null;
  private forestWorld: ForestWorld | null = null;
  private campEnemies: CampEnemySystem | null = null;
  private raiderBoats: RaiderBoatSystem | null = null;
  /** Hellmaw / volcanic / boss-event world boss (Shadow Flame Mantis + Ash Ghasts). */
  private volcanoBoss: VolcanoWorldBossSystem | null = null;
  private fabledSky: FabledSkyTowns | null = null;
  private testWorldId: TestWorldId = "danger-room";
  private playerXp = 0;
  private jungleBuffId: string | null = null;
  /** Cooldown gating the kiter backstep's i-frame dodge so rapid fire can't chain
   *  the invuln window into continuous immunity (dodge re-arms every 0.6s). */
  private pistolDodgeCd = 0;
  /** Camera framing, mirrored on the controller so it survives character swaps. */
  private viewMode: "third" | "first" = "third";
  /** Shared recoil model (DGS): kicks the aim on fire, decays each frame. */
  private readonly recoil = new Recoil();
  /** Live additive FOV (deg) for the sprint kick, eased toward 0 / +8. */
  private fovKickCur = 0;
  /** Crosshair spread in px (HUD), from movement + recoil bloom. */
  private aimSpread = 5;
  /** Staff reticle pulse phase 0–1 (breathe). */
  private reticlePulseT = 0;
  /**
   * Staff AoE HUD ring scale while casting placement / nova / scatter
   * (1 = idle breathe; >1 = ability radius indicator).
   */
  private reticleAoeScale = 1;
  /** Last computed OWR range band of the nearest enemy (drives the reticle ring). */
  private owrRangeState: "close" | "optimal" | "far" | "none" = "none";
  /** Lazily-created WebAudio context for the OWR edge "beep" cue. */
  private owrAudioCtx: AudioContext | null = null;
  /** Monotonic confirmed-hit counter; bumping it flashes the hit-marker. */
  private hitMarkerCount = 0;
  /** Per-signature-skill cooldowns for characters that use them (e.g. Striker). */
  private sigCooldowns: [number, number, number, number] = [0, 0, 0, 0];
  private sigCooldownMaxes: [number, number, number, number] = [0, 0, 0, 0];
  /** Sparring: player block/parry + damage-taking state. The room boots with
   *  hostile enemies (a weak-point boss, a bear, and grunts) that engage on
   *  entry; drop to "passive" in the Admin panel to make them inert again. */
  private difficulty: Difficulty = "medium";
  private blocking = false;
  /**
   * Hard FOCUS mode (RMB toggle in combat): face + lock selected target for combat MM,
   * A/D strafe, LMB = attack/combo. When false = soft lock: LMB selects only.
   */
  private locked = false;
  /**
   * Free-aim crosshair offset in NDC-ish space (0 = screen centre over the
   * fixed centre **dot**). Soft lock allows large drift; hard FOCUS is tight;
   * RMB snaps back to 0 (crosshair over the centre dot).
   */
  private aimNdcX = 0;
  private aimNdcY = 0;
  /** Harvest soft-select: world point of the node LMB selected (RMB walks to harvest). */
  private harvestSelectPos: THREE.Vector3 | null = null;
  private harvestSelectName = "";
  private harvestSelectNodeId: string | null = null;
  /** While true, auto-walk toward harvestSelectPos then swing harvest. */
  private harvestMoveActive = false;
  /** Combat-music intensity 0..1: combat events push it up, it decays between
   *  exchanges. Drives the background-music swell via {@link CombatSfx}. */
  private musicHeat = 0;
  /** Counts down after taking a hit (drives the hurt vignette). */
  private hurt = 0;
  /** Invulnerability window after respawning / a successful parry. */
  private invuln = 0;
  /** Cooldown gating the directional dodge-roll so rapid double-taps can't chain
   *  the i-frame window into continuous immunity (re-arms every 0.6s). */
  private dodgeCd = 0;
  private defeated = false;
  /** Reusable context handed to Targets.update each frame (avoids per-frame alloc). */
  private sparCtx: SparringContext;
  /** Seconds left of the Kiter Smoke Phantom invisibility + speed buff (0 = off). */
  private phantomTimer = 0;
  private raf = 0;
  private disposed = false;
  private hudAccum = 0;
  /** Throttle for the looping leg-flame / staff-disc emitter while hovering. */
  private hoverFlameAccum = 0;
  /** Cooldown gating ice-staff A/D dash-slides. */
  private iceSlideCd = 0;
  /** Last flame palette theme pushed to the VFX (avoids redundant per-frame swaps). */
  private fireThemeApplied: "fire" | "chi" = "fire";
  private fps = 60;

  // ── Multiplayer (Danger Room rooms) ────────────────────────────────────────
  /** Live relay client while inside a multiplayer room (null in solo play). */
  private net: DangerClient | null = null;
  /** Unsubscribe handles for the net listeners, cleared on detach/dispose. */
  private netUnsub: (() => void)[] = [];
  /** Remote players by id, interpolated from received snapshots. */
  private remotes = new Map<string, RemoteAvatar>();
  /** Mirrored host NPCs by id (coop non-host clients only). */
  private mirrorNpcs = new Map<string, RemoteAvatar>();
  /** Holds all networked avatars so they're disposed/cleared as a unit. */
  private remoteRoot = new THREE.Group();
  /** Accumulators throttling local state / host NPC roster broadcasts. */
  private stateAccum = 0;
  private npcAccum = 0;
  /** Scratch vector for net hit-distance tests (avoids per-call alloc). */
  private netTmp = new THREE.Vector3();

  /**
   * Free-mouse mode (F8 / \): OS cursor visible, pointer lock off.
   * Click must NOT re-grab lock until F9 / ' restores crosshair mode.
   */
  private freeMouseMode = false;
  /** Last applied dynamic camera profile key (avoid thrashing setCameraOpts). */
  private lastCamProfile: string | null = null;

  /** Toggle free OS mouse vs pointer-lock crosshair (App hotkeys F8/F9 or \ / '). */
  setFreeMouseMode(on: boolean) {
    this.freeMouseMode = on;
    if (on) {
      this.input.exitLock();
    }
  }

  get isFreeMouseMode(): boolean {
    return this.freeMouseMode;
  }

  private onClick = () => {
    this.sfx?.resume();
    // On touch devices the on-screen controls drive look, so never grab pointer
    // lock from a tap (it would hijack the look-pad / fight the joystick).
    if (this.touchMode) return;
    // App shows DangerStartScreen first — don't steal lock under the overlay.
    // After ENTER, canvas clicks re-acquire lock (sample three.js boot pattern).
    if (document.querySelector("[data-testid='danger-start-screen']")) return;
    // Free-mouse (`): keep OS cursor; only Quote re-locks for crosshair.
    if (this.freeMouseMode) return;
    if (!this.input.locked) this.input.requestLock();
  };
  private onMouseDown = (e: MouseEvent) => {
    this.sfx?.resume();
    if (!this.input.locked) return;
    // Prefight / result / choice: no offense until fighting or free roam.
    if (this.arenaMatch?.isActive && !this.arenaMatch.isFighting) return;
    if (e.button === 0) {
      // Casting-mouse: LMB confirms placement / cone cast
      if (this.castPlacement) {
        this.confirmCastPlacement();
        return;
      }
      // Harvest: LMB = soft-select harvestable / node under free-aim crosshair
      if (this.activityMode === "harvest") {
        this.selectHarvestUnderCrosshair();
        return;
      }
      // Build: LMB = place / tool
      if (this.activityMode === "build") {
        this.runActivityTool();
        return;
      }
      // Combat soft lock: LMB = select (NPC / enemy / interactable under aim)
      // Combat hard FOCUS: LMB = attack / combo toward free-aim crosshair
      if (this.locked) {
        this.attack();
      } else {
        this.selectUnderCrosshair();
      }
    } else if (e.button === 1) {
      // Middle mouse (M3): surprise uppercut / unused attack slot
      e.preventDefault();
      if (this.locked) this.doSurpriseUppercut();
    } else if (e.button === 2) {
      // Cancel placement first
      if (this.castPlacement) {
        this.cancelCastPlacement();
        return;
      }
      e.preventDefault();
      // Harvest: RMB = move to selected node and harvest it (not focus toggle)
      if (this.activityMode === "harvest") {
        this.beginHarvestMove();
        return;
      }
      // Build: RMB cancels ghost if any
      if (this.activityMode === "build" && this.campBuild?.isGhostActive) {
        this.campBuild.cancelGhost();
        this.setCombatFlash("Place cancelled", 0.4);
        return;
      }
      // Combat: sticky toggle hard FOCUS ↔ soft lock/select.
      // Not a one-shot "snap aim to middle" — focus stays until toggled off.
      // Free-aim only recenters when ENTERING focus (soft lock keeps aim free).
      this.toggleFocusMode();
    }
  };
  private onMouseUp = (_e: MouseEvent) => {
    // Focus is sticky toggle (not hold). Block is C parry / E forcefield — not RMB.
  };
  private onContextMenu = (e: MouseEvent) => e.preventDefault();
  private onResize = () => this.resize();

  constructor(container: HTMLElement, characterId: string, onHud: (h: HudSnapshot) => void) {
    this.container = container;
    this.characterId = characterId;
    this.onHud = onHud;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
    });
    // Cap DPR for stable 60 Hz ticks on high-DPI panels; keep ≥1.5 for readability.
    this.renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1), 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = STUDIO_TONE_MAPPING_EXPOSURE;
    // Correct output colour space for sRGB albedo maps (prevents washed / muddy kits).
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    // KTX2 + texture anisotropy: bind ASAP so first character/VFX loads decode well.
    void Promise.all([
      import("./loaders/gltf"),
      import("./texturePrep"),
    ]).then(([{ bindKtx2 }, { bindTextureAnisotropy }]) => {
      try {
        bindKtx2(this.renderer);
        bindTextureAnisotropy(this.renderer);
      } catch (err) {
        console.warn("[Studio] KTX2 / texture prep bind failed", err);
      }
    });

    this.scene.background = new THREE.Color(Studio.FOG_BASE_COLOR);
    this.scene.fog = new THREE.Fog(Studio.FOG_BASE_COLOR, Studio.FOG_BASE_NEAR, Studio.FOG_BASE_FAR);

    this.camera = new THREE.PerspectiveCamera(this.params.fov, 1, 0.1, 200);
    // Start ~50% closer to the room centre and aimed at the spawn point so the
    // opening view (before the async character load wires up the follow-cam)
    // frames the inside of the arena instead of staring at a far, dark wall.
    this.camera.position.set(0, 2.2, 3.5);
    this.camera.lookAt(0, 1, 0);

    this.room = new DangerRoom({ preset: loadRoomPreset() });
    this.scene.add(this.room.group);
    // Tint the scene fog + background to the active preset's mood (overrides the
    // dark base set just above). The matching ambient bed is applied once the
    // sound system exists, below.
    this.applyRoomAtmosphere(true);
    // Resident DJ in the lit alcove above the door (scenery; loads async).
    this.djBooth = new DjBooth(this.room.djBoothAnchor);
    this.scene.add(this.djBooth.group);
    void this.djBooth.load().catch((err) => console.warn("[Studio] DJ booth load failed", err));
    this.scene.add(this.remoteRoot);
    this.scene.add(this.ale.overlay);
    this.vfx = new Vfx(this.scene, this.camera);
    this.vfx.setGoreCamera(this.camera);
    this.mech = new MechSystem(this.scene);
    this.mechReconciler = new MechReconciler(this.mech, {
      spectating: () => this.spectating,
      baseSpeedMul: () => this.baseSpeedMul(),
      setSpeedMultiplier: (m) => this.controller?.setSpeedMultiplier(m),
      setPilotVisible: (v) => {
        if (this.character) this.character.root.visible = v;
      },
      anchor: () => {
        const fwd = this.controller!.forward();
        return {
          pos: this.character!.root.position,
          yaw: Math.atan2(fwd.x, fwd.z),
          speed: this.controller!.state.speed,
        };
      },
    });
    this.targets = new Targets(this.scene);
    this.campBuild = new CampBuildSystem(this.scene, {
      flash: (msg, t) => this.setCombatFlash(msg, t ?? 0.8),
      getPlayerPos: () => this.character?.root.position.clone() ?? new THREE.Vector3(),
      onAreaDamage: (pos, _radius, damage, kind) => {
        // Visual + flash; towers/traps apply pressure cue (full dummy HP hook later)
        this.vfx.burst(pos.clone().setY(pos.y + 0.6), kind === "tower" ? 0xffaa44 : 0xff5555, 14, 2.4);
        this.vfx.impact(pos.clone().setY(pos.y + 0.4), kind === "tower" ? 0xffcc66 : 0xff6666, 1.1);
        this.setCombatFlash(
          kind === "tower" ? `TOWER HIT · ${damage}` : `TRAP · ${damage}`,
          0.35,
        );
      },
      onSpawnNpc: (at, hint) => {
        this.vfx.auraRing(at.clone().setY(0.05), 0x6ee7b7, 1.2, 0.6);
        this.setCombatFlash(`NPC SLOT · ${hint}`, 0.7);
      },
    });
    // Sandbox claim so gated buildings can ghost-place without planting first
    this.campBuild.seedSandboxClaim(new THREE.Vector3(0, 0, -6));
    // Outdoor test worlds: danger-room | sailtest | forest-map | island-life
    // NOTE: Do NOT call campBuild.loadSmallIsland() on Danger Room boot —
    // production crash was `loadSmallIsland is not a function` on stale deploys
    // that mixed old Studio (sync call) with partial CampBuild. Island meshes
    // load only via ForestWorld + TEST_WORLDS (sailtest / forest-map / island-life).
    this.forestWorld = new ForestWorld(this.scene, {
      flash: (msg, t) => this.setCombatFlash(msg, t ?? 0.9),
    });
    const campCbs = {
      flash: (msg: string, t?: number) => this.setCombatFlash(msg, t ?? 0.9),
      onKill: (_e: unknown, xp: number, buffId: string | null) => {
        this.playerXp += xp;
        if (buffId) this.jungleBuffId = buffId;
        this.setCombatFlash(
          `CAMP KILL · +${xp} XP${buffId ? ` · ${buffId}` : ""} · total ${this.playerXp}`,
          1.0,
        );
      },
      damagePlayer: (amount: number, from: THREE.Vector3) => {
        this.setCombatFlash(`CAMP HIT · −${amount}`, 0.4);
        this.vfx.burst(from.clone().setY(1), 0xff5555, 8, 1.6);
      },
    };
    this.campEnemies = new CampEnemySystem(this.scene, campCbs);
    this.raiderBoats = new RaiderBoatSystem(this.scene, campCbs);
    this.volcanoBoss = new VolcanoWorldBossSystem(this.scene, this.vfx, {
      flash: campCbs.flash,
      damagePlayer: campCbs.damagePlayer,
      knockbackPlayer: (dir, speed, hop) => {
        this.controller?.applyImpulse(dir, speed, hop ?? 0.3);
      },
      onBossDeath: () => this.setCombatFlash("WORLD BOSS DOWN · Shadow Flame Mantis", 2.5),
    });
    this.fabledSky = new FabledSkyTowns(this.scene, {
      flash: (msg, t) => this.setCombatFlash(msg, t ?? 1.2),
      teleportPlayer: (pos, yaw) => {
        // Outdoor sky towns need large bounds — expand then blink
        this.controller?.setRoomBound(500);
        if (this.controller) {
          this.controller.blinkTo(pos);
        } else if (this.character) {
          this.character.root.position.copy(pos);
        }
        if (yaw != null && this.character) this.character.root.rotation.y = yaw;
      },
    });
    void this.setTestWorld(loadTestWorldId());
    this.status = new StatusController(this.scene);
    this.indicators = new TargetIndicators(this.scene);
    this.telegraphs = new TelegraphField(this.scene);
    this.targets.onDeath = (p) => {
      this.vfx.burst(p, 0xff7a8a, 40, 6);
      this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0xff5a6a, 3, 0.6);
    };
    this.targets.setDifficulty(this.difficulty);
    // The room boots NEUTRAL: nothing is seeded on entry except the player
    // (spawned below) and the resident DJ (Racalvin + his booth/lights, set up
    // above). Enemies — the yellow-bot weak-point boss, the bear, grunts and
    // training dummies — are spawned on demand from the Admin panel
    // (spawnNpc/spawnBoss) or by starting a duel, never automatically.
    this.sparCtx = {
      playerPos: new THREE.Vector3(),
      playerAlive: true,
      playerRecovering: false,
      dealToPlayer: (center, radius, damage, force, from, kind, isSkill) =>
        this.resolveOpponentStrike(center, radius, damage, force, from, kind, isSkill),
      onWindup: (pos, kind) => this.vfx.burst(pos, SKILL_COLOR[kind] ?? 0xffb24d, 6, 1.6),
      onCastCharge: (pos, kind) => {
        this.vfx.castAura(pos, SKILL_COLOR[kind] ?? 0x9fd0ff);
        this.pulseSpellPostFx(0.5);
      },
      onStrike: (center, kind, radius, isSkill) => {
        const color = SKILL_COLOR[kind] ?? 0xffb24d;
        this.vfx.impact(center, color, 1.4);
        if (isSkill) this.vfx.aoeBlast(center, color, radius);
      },
      onBearAttack: (at, attack, moment) => this.playBearAttackCue(at, attack, moment),
      onDefend: (pos, dodged) => this.vfx.burst(pos, dodged ? 0x9fe8ff : 0x6fe0ff, 10, dodged ? 3 : 2),
      telegraph: (center, radius, onResolve) => this.telegraphs.add(center, radius, onResolve),
      castSpell: (kind, from, target, onImpact) => {
        // Build a flat forward + facing quaternion from caster → target, then
        // route through the same aimed-spell VFX the player uses (homing onto the
        // aim point). The impact callback resolves the hit at the landing point.
        const fwd = target.clone().sub(from);
        fwd.y = 0;
        if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1);
        fwd.normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
        this.vfx.playSkill(kind, from.clone(), fwd, quat, target.clone(), onImpact);
      },
      deployTurret: (at, faceDir, color, life) => {
        // Standing-chassis VFX only — the host (Targets) ticks the firing,
        // faction-aware damage and lifetime; we return the early-remove disposer.
        const h = this.vfx.spawnTurret(at.clone(), faceDir.clone(), color, life, "classic");
        return () => h.dispose();
      },
      turretBolt: (from, dir, dist, color, onLand) => {
        // Slow, oversized, dodgeable bolt — same VFX the player's turret fires.
        // The bolt object is the damage producer: onLand resolves the host's
        // faction-aware AoE where it lands, so a target off the line dodges it.
        this.vfx.muzzle(from.clone(), dir.clone(), color);
        this.vfx.bolt(
          from.clone(),
          dir.clone(),
          color,
          TURRET_BOLT_SPEED,
          dist + 0.5,
          (p) => {
            this.vfx.aoeBlast(p, color, 1.0);
            onLand(p);
          },
          TURRET_BOLT_SCALE,
        );
      },
      healPlayer: (amount) => this.sparring.healPlayer(amount),
      playerHealth01: 1,
      onSkillCue: (text) => this.arenaMatch?.pushSkillCue(text),
    };
    this.setupLights();

    this.sparring = new SparringCombat({
      onPlayerStateChange: (state) => {
        // HUD flash + the heavy knock-down / stun reactions, bound to the CC's
        // vulnerable state so the real fall + kip-up (or stun) sequence plays once.
        // The lighter outcome-bound flinches below override harmlessly if both fire.
        // The loser reaction CLIP is sourced from the player's hold-style standard
        // (vulnerableReactionClip) so player and AI react from ONE source; the
        // flash + the fall→kip-up recovery sequence stay here.
        const clip = vulnerableReactionClip(this.playerGroup(), state as VulnerableState);
        if (state === "stunned") {
          this.setCombatFlash("STUNNED", 1.8);
          if (clip) this.reactWithClip(clip, 0.1);
        } else if (state === "fallen") {
          this.setCombatFlash("KNOCKED DOWN", 1.5);
          this.tumbleActive = true; // Space = smash backflip recover
          this.tumbleT = Math.max(this.tumbleT, 1.6);
          if (clip) this.reactWithClip(clip, 0.1);
          this.schedule(0.95, () => {
            if (!this.tumbleActive) return;
            this.character?.reaction?.("fallen", 0.15, true);
          });
          this.schedule(1.5, () => {
            if (!this.tumbleActive) return;
            this.playPlayerReaction("kipUp");
            this.tumbleActive = false;
            this.tumbleT = 0;
          });
        }
      },
      onDummyHitResult: (result, pos) => {
        // Health is tracked inside the sparring CombatController; we read it back
        // in the loop via getPlayerHealth() so no manual decrement here.
        // Player is the DEFENDER: the reaction clip comes from the hold-style
        // standard (defenseOutcomeClip), keyed by the player's weapon group; the
        // hit position drives the directional guarded-hit react.
        this.playPlayerDefenseReaction(result.outcome, pos);
        // Outcome-specific feedback layered on top of the category reaction.
        switch (result.outcome) {
          case "crit":
            this.setCombatFlash("CRIT HIT!", 1.0);
            break;
          case "perfectParry":
            this.setCombatFlash("PERFECT PARRY!", 1.5);
            this.triggerHitstop(0.09, 0.1);
            // Full success package: clash + rebound + stun + uppercut dash launch.
            if (pos) {
              this.onParrySuccess(pos, {
                perfect: true,
                spell: this.lastIncomingSkill,
              });
            }
            break;
          case "deflect":
            // Timed parry inside window (force held) — same counter package.
            if (pos && this.parrySession) {
              this.setCombatFlash("PARRY!", 1.1);
              this.triggerHitstop(0.06, 0.08);
              this.onParrySuccess(pos, {
                perfect: false,
                spell: this.lastIncomingSkill,
              });
            }
            break;
          case "blockStop":
            if (result.defenderReaction === "stunned") {
              // Guard broke — escalate to a wall-crash stagger.
              this.schedule(0.05, () => this.playPlayerReaction("wallCrash"));
              this.setCombatFlash("GUARD BROKEN!", 1.5);
            }
            break;
        }
      },
    });

    // Bind player-combat VFX hooks onto the current target population.
    this.wireTargetCombatHooks();

    this.input = new InputState(this.renderer.domElement);
    this.renderer.domElement.addEventListener("click", this.onClick);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keyup", this.onKeyUp);
    // Catch container resizes that don't fire a window resize (panel toggles,
    // canvas-board iframe resizing, split-view changes) so the render buffer and
    // camera aspect always track the actual canvas size.
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.container);
    }

    this.sfx = new CombatSfx(this.camera, this.scene);
    this.sfx.setMuted(this.sound.muted);
    this.sfx.setLevels(this.sound);
    // Give the ambient bed the active preset's character (tone/level/drift). The
    // bed itself starts async after the buffers load, but the profile is stored
    // and picked up when it does.
    this.applyRoomAmbience();
    // Emit the music bed spatially from the DJ booth so it reads as Racalvin's
    // live set (offset up to roughly the booth/speaker height).
    if (this.djBooth) {
      const boothPos = this.room.djBoothAnchor.clone();
      boothPos.y += 1.5;
      this.sfx.setMusicSource(boothPos);
    }

    this.loadOverrides();
    this.resize();
    void this.spawnCharacter(this.characterId);
    void this.initPhysics();
    this.initPostFx();
    this.loop();
  }

  /**
   * Bring up the fleet SSOT physics stack (@workspace/grudge-physics):
   * Rapier world + ground plane + player capsule KCC + optional mesh-bvh.
   * Same path every Warlords host should use (Danger Room, island, zone, …).
   */
  private async initPhysics() {
    try {
      const phys = physicsDefaultsFor("danger-room");
      const { physics, playerKcc } = await createScenePhysics({
        kind: "danger-room",
        ground: phys.ground,
        player: { x: 0, y: 0, z: 0 },
        meshBvh: phys.meshBvh,
        gravityY: phys.gravityY,
      });
      if (this.disposed || !physics.world) {
        physics.dispose();
        return;
      }
      this.physics = physics;
      this.playerKcc = playerKcc;
      this.applyDangerRoomCollision();
      this.locationBag.setLocation(dangerRoomLocation());
      void this.loadRuntimeScripts();
    } catch (err) {
      console.error("[Studio] physics init failed", err);
    }
  }

  /** Current Warlords WorldLocation (for HUD / multiplayer / AI tools). */
  getWorldLocation(): WorldLocation {
    const pos = this.character?.root.position;
    if (pos) {
      this.locationBag.patchPose({ x: pos.x, y: pos.y, z: pos.z });
    }
    return this.locationBag.getLocation();
  }

  /** Declarative script runner (JSON actions only — no eval). */
  getScriptRunner(): ScriptRunner {
    return this.scripts;
  }

  /**
   * Account quick-deposit zone: claim radius, camp structures, boat/sail maps.
   * Used by harvest HUD bag button illumination.
   */
  getDepositProbe(): {
    insideClaim: boolean;
    nearCamp: boolean;
    onBoat: boolean;
  } {
    const pos = this.character?.root.position;
    const insideClaim = !!(
      pos &&
      this.campBuild &&
      this.campBuild.hasClaim &&
      this.campBuild.isInsideClaim(pos)
    );
    const nearCamp = !!(this.campBuild?.hasClaim || (this.campBuild?.structures.length ?? 0) > 0);
    const roomKind = (this as { room?: { kind?: string } }).room?.kind ?? "";
    const onBoat =
      roomKind === "sail" ||
      roomKind === "sailing" ||
      /sail|boat/i.test(String(roomKind));
    return { insideClaim, nearCamp, onBoat };
  }

  /** Load content/runtime script pack when present (same shape for all scenes). */
  private async loadRuntimeScripts() {
    try {
      const res = await fetch("/content/runtime/example-danger-scripts.json");
      if (!res.ok) return;
      const pack = (await res.json()) as { scripts?: unknown[] };
      const docs = (pack.scripts ?? []).filter(isScriptDoc) as ScriptDoc[];
      this.scripts.clear();
      this.scripts.register("message", (a) => {
        const text = String(a.payload?.text ?? "");
        if (text) this.setCombatFlash(text, 2.2);
      });
      this.scripts.register("load-instance", () => {
        // Door already owns enterDungeon; portal scripts can share this handler later.
        this.tryEnterDungeonFromScript();
      });
      this.scripts.load(docs);
    } catch {
      // Optional content pack — missing file is fine in slim deploys.
    }
  }

  /** Hook for portal script → dungeon (same as door proximity enter). */
  private tryEnterDungeonFromScript() {
    if (!this.inDungeon && !this.enteringDungeon) void this.enterDungeon();
  }

  /**
   * Attach / re-attach the Danger Room player KCC with arena room bounds.
   * Call after controller recreate, exit dungeon, or physics ready.
   */
  private applyDangerRoomCollision(spawn?: THREE.Vector3) {
    if (!this.controller || !this.playerKcc) return;
    const feet =
      spawn ??
      this.character?.root.position.clone() ??
      new THREE.Vector3(0, 0, 0);
    this.playerKcc.teleportFeet(feet);
    this.controller.setCollision(this.playerKcc, spawn, { keepRoomBounds: true });
  }

  /** Knock any authored arena training bags inside `radius` of `center` (melee/skill impacts). */
  private hitBags(center: THREE.Vector3, radius: number, force: number, damage = 0) {
    this.arena?.blastBags(center, radius, force, damage);
  }

  /**
   * Bring up the shared post-processing composer (pmndrs) over the main scene.
   * Tuned SUBTLE for gameplay — clean HDR bloom + ACES with a faint vignette /
   * saturation lift — so combat stays readable; the heavier mystical grade is
   * reserved for the opening cinematic. Falls back to direct rendering (and
   * restores the renderer tone mapping) if the composer can't be built.
   */
  private initPostFx() {
    const prevTone = this.renderer.toneMapping;
    try {
      this.postfx = createMysticalComposer(this.renderer, this.scene, this.camera, {
        bloomIntensity: 0.5,
        bloomThreshold: 0.55,
        bloomRadius: 0.6,
        saturation: 0.05,
        vignetteDarkness: 0.24,
        chromatic: 0.00016,
        grain: 0.018,
      });
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) this.postfx.setSize(w, h);
    } catch (err) {
      console.warn("[Studio] post-processing init failed; using direct render", err);
      this.renderer.toneMapping = prevTone;
      this.postfx = null;
    }
  }

  /** Render one frame through the post-fx composer when present, else direct. */
  private renderFrame(dt: number) {
    if (this.postfx) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /** Spell/weapon cast: kick HDR bloom so ShaderMaterial fire/soul/dragon read. */
  pulseSpellPostFx(durationSec = 0.55) {
    this.postfx?.pulseSpell?.(durationSec);
  }

  private setupLights() {
    // Shared Danger Room base rig (see studioLighting.ts) — the same definition
    // the environment-thumbnail renderer uses, so previews can't drift. Shadows
    // are enabled here for the live scene.
    addStudioLights(this.scene, { shadows: true });
  }

  /** Account / main-panel mesh_ids applied on next grudge6 spawn. */
  private pendingMeshIds: string[] | null = null;
  private lastSpawnMeshKey = "";
  /** Mine-Loader-style body tints for procedural Explorer (tier armor). */
  private pendingExplorerTints: {
    shirt?: number;
    pants?: number;
    boot?: number;
    hat?: number;
  } | null = null;

  /**
   * Set equipment mesh_ids from fleet character (main panel SSOT).
   * Call before {@link setCharacter}; spawn re-binds atlas + child visibility.
   * If a GrudgeAvatar is already live, re-applies visibility + re-grounds feet.
   */
  setEquipmentMeshIds(ids: string[] | null | undefined): void {
    this.pendingMeshIds = ids?.length ? ids.slice() : null;
    if (this.character instanceof GrudgeAvatar) {
      this.character.setMeshIds(this.pendingMeshIds);
    }
  }

  /** Body armor tints for Explorer (Mine-Loader equipment visual). */
  setExplorerEquipmentTints(
    tints: { shirt?: number; pants?: number; boot?: number; hat?: number } | null,
  ): void {
    this.pendingExplorerTints = tints;
    if (this.character instanceof ExplorerCharacter && tints) {
      this.character.applyEquipmentTints(tints);
    }
  }

  /** Re-apply Avatar Edit face on the live Explorer (after save / import). */
  refreshExplorerHead(): boolean {
    if (this.character instanceof ExplorerCharacter) {
      return this.character.refreshAvatarHead();
    }
    return false;
  }

  private async spawnCharacter(id: string) {
    const token = ++this.loadToken;
    // A `grudge:<race>:<preset>` id selects a customizable grudge6 race kit
    // (the active fleet character's race); anything else is a catalog rig.
    const grudge = parseGrudgeAvatarId(id);
    const def = getCharacter(id);
    let next: Avatar = grudge
      ? new GrudgeAvatar(grudge.raceId, grudge.presetId, {
          meshIds: this.pendingMeshIds || undefined,
        })
      : def.procedural
        ? new ExplorerCharacter(def)
        : new Character(def);
    try {
      await next.load();
    } catch (err) {
      console.error("[Studio] character load failed", err);
      // The grudge6 race FBX can fail (asset host / CORS); fall back to the
      // procedural Explorer so the surface always has a playable avatar.
      if (!grudge) return;
      next.dispose();
      if (this.disposed || token !== this.loadToken) return;
      const exDef = getCharacter("explorer");
      next = exDef.procedural ? new ExplorerCharacter(exDef) : new Character(exDef);
      try {
        await next.load();
      } catch (err2) {
        console.error("[Studio] fallback character load failed", err2);
        return;
      }
      id = exDef.id;
    }
    // Discard stale loads — only the most recent selection may commit.
    if (this.disposed || token !== this.loadToken) {
      next.dispose();
      return;
    }
    if (this.character) {
      if (this.mounted) {
        unmountWeapon(this.mounted);
        this.mounted = null;
      }
      if (this.mountedOff) {
        unmountWeapon(this.mountedOff);
        this.mountedOff = null;
      }
      this.scene.remove(this.character.root);
      this.character.dispose();
    }
    this.character = next;
    this.character.setBlendTime(this.params.blendTime);
    this.character.setShowSkeleton(this.params.showSkeleton);
    // Terrain foot IK — Character + GrudgeAvatar (flat y=0 Danger Room floor).
    if (typeof (next as { setFootIk?: (on: boolean) => void }).setFootIk === "function") {
      (next as { setFootIk: (on: boolean) => void }).setFootIk(true);
    }
    // Reliable scene deploy: human-scale + feet grounded (Y-up / XZ ground SSOT).
    try {
      const { ensureHumanScale } = await import("./characterDeploy");
      ensureHumanScale(this.character.root);
    } catch (e) {
      console.warn("[Studio] ensureHumanScale failed", e);
    }
    // Honour the spectator invariant: a character swapped in mid-duel must stay
    // hidden (the player is a spectator until the duel stops).
    this.character.root.visible = !this.spectating;
    this.scene.add(this.character.root);
    this.characterId = id;
    if (!this.controller) {
      this.controller = new Controller(this.character, this.camera, this.input, this.params);
    } else {
      // Rebind controller to the new character.
      this.controller = new Controller(this.character, this.camera, this.input, this.params);
    }
    // Activity-aware TPS (combat action cam vs Minecraft harvest/build shoulder)
    this.applyActivityCamera(this.activityMode);
    // Free-aim reticle split: mouse → crosshair offset + residual camera look.
    this.controller.onAimLook = (dx, dy) => this.splitAimLook(dx, dy);
    // Feed the controller live Danger Room obstacle circles (corner pillars,
    // training dummies, and current opponents) so the player collides with them
    // instead of walking through. Re-set here because the controller is recreated
    // on every character swap. The dungeon/arena KCC ignores this when active.
    this.controller.setObstacles(() => {
      const npcs = this.targets instanceof Targets ? this.targets.obstacleCircles() : [];
      return [...this.room.obstacles, ...npcs];
    });
    // Re-apply shared Danger Room KCC after controller recreate (character swap).
    if (!this.inDungeon && !this.inArena) this.applyDangerRoomCollision();
    // Re-apply the camera framing (controller is rebuilt on every swap).
    this.controller.setViewMode(this.viewMode);
    this.resolveOverrides(id);
    // Reset transient Kiter phantom state so a new rig never spawns invisible.
    this.phantomTimer = 0;
    // A character swap cancels any active exo-armour (the new pilot starts unsuited).
    this.mechReconciler?.reset();
    this.mechCds = [0, 0, 0];
    this.controller.setSpeedMultiplier(1);
    // Tank/Centurion is a slow, armoured bruiser — apply its movement penalty on
    // spawn (the gunblade's signature kit + damage mitigation key off the same flag).
    if (def.tank) this.controller.setSpeedMultiplier(def.tank.moveSpeedMul);
    // Clear cross-character combat transients so the fresh rig starts ready: drop
    // any pending scheduled callbacks (decoy shots, beam ticks, kick combos) from
    // the previous character, and zero the shared per-signature + skill cooldowns
    // (the sigCooldowns array is shared, so a Gunslinger skill on cooldown would
    // otherwise block the same slot on the next character, e.g. the Striker).
    this.pending.length = 0;
    this.abilities.cancelAll();
    this.cancelMaceThrow();
    this.cancelBeamCast();
    this.shadowKick = null;
    this.aerialSlashPending = false;
    this.aerialSlashPendingTimer = 0;
    this.sigCooldowns = [0, 0, 0, 0];
    this.sigCooldownMaxes = [0, 0, 0, 0];
    this.skillCooldown = 0;
    this.skillCooldownMax = 0;
    // Characters may declare a weapon to spawn with (e.g. the Gunslinger's pistol).
    if (def.defaultWeapon) this.weaponId = def.defaultWeapon;

    // Explorer: live weapon skill tree = T0 kit signatures (HUD 1–4 + VFX kinds).
    // Ensures procedural rig always has combat skill defs even when CharacterDef
    // signatures are static demo rows.
    if (next instanceof ExplorerCharacter || def.procedural) {
      const t0 = t0SignatureSkills(this.weaponId);
      if (t0.length) {
        def.signatureSkills = t0.map((s) => ({
          label: s.label,
          clip: s.clip || "attack",
          kind: s.kind,
          mode: s.mode,
        }));
        // Keep def pointer in sync for HUD/getSlotBindings
        (next as { def: typeof def }).def = def;
      }
      if (this.pendingExplorerTints && next instanceof ExplorerCharacter) {
        next.applyEquipmentTints(this.pendingExplorerTints);
      }
      // Ensure avatar face is painted (seeded default if never saved).
      if (next instanceof ExplorerCharacter) next.refreshAvatarHead();
    }

    this.applyWeapon(this.weaponId);
    this.applyModelYaw();
    this.onCharacterLoaded?.(id);
    // Kick-style characters that declare `kickClips` get extra FBX clips injected
    // after commit (Tera-kasi pulls flip_kick/backflip/roll). The Striker declares
    // none and stays native-only, so this is a no-op for it.
    if (def.meleeStyle === "kick") {
      void this.loadKickClips(id);
    }
  }

  // ---- action-slot clip overrides ----

  private loadOverrides() {
    try {
      const raw = localStorage.getItem(SLOTS_KEY);
      this.allOverrides = raw ? JSON.parse(raw) || {} : {};
    } catch {
      this.allOverrides = {};
    }
  }

  private saveOverrides() {
    try {
      localStorage.setItem(SLOTS_KEY, JSON.stringify(this.allOverrides));
    } catch {
      /* best-effort */
    }
  }

  /** Keep only overrides whose clip still exists in the freshly loaded GLB. */
  private resolveOverrides(id: string) {
    const stored = this.allOverrides[id] ?? {};
    const valid: SlotMap = {};
    for (const { slot } of SLOT_META) {
      const clip = stored[slot];
      if (clip && this.character?.hasClip(clip)) valid[slot] = clip;
    }
    this.overrides = valid;
  }

  /** Every clip embedded in the current character's GLB. */
  clipNames(): string[] {
    return this.character?.clipNames() ?? [];
  }

  /** Default action label + clip for a slot (before any override). */
  private slotDefault(slot: ActionSlot): { label: string; clip: string } {
    const def = getCharacter(this.characterId);
    if (slot === "primary") return { label: "Primary Attack", clip: def.clips.attack ?? "" };
    if (slot === "fskill") {
      if (def.fskillKind)
        return { label: def.fskillKind === "turret" ? "Deploy Turret" : "Cast Spell", clip: def.clips.attack ?? "" };
      if (def.weaponless) return { label: "Diable Jambe", clip: def.clips.attack ?? "" };
      const w = getWeapon(this.weaponId);
      return { label: w.skillName, clip: def.clips.attack ?? "" };
    }
    const i = Number(slot.slice(3)) - 1;
    // Prefer T0 weapon kit labels (Danger Room equipment skill sheet) over
    // per-character signature kits so the bar matches equipped weapon.
    const t0 = t0SignatureSkills(this.weaponId)[i];
    const sig = def.signatureSkills[i];
    return {
      label: t0?.label ?? sig?.label ?? `Signature ${i + 1}`,
      clip: sig?.clip ?? t0?.clip ?? "",
    };
  }

  /** Resolved bindings (override or default) for every action slot. */
  getSlotBindings(): SlotBinding[] {
    const weapon = this.weaponId;
    const t0 = t0SignatureSkills(weapon);
    const unlocks = loadSkillUnlocks();
    return SLOT_META.map(({ slot, key }) => {
      const d = this.slotDefault(slot);
      const override = this.overrides[slot];
      const role =
        slot === "primary" || slot === "fskill"
          ? slot
          : (slot as "sig1" | "sig2" | "sig3" | "sig4");
      const sigIdx =
        slot === "sig1" ? 0 : slot === "sig2" ? 1 : slot === "sig3" ? 2 : slot === "sig4" ? 3 : -1;
      const masterIcon = sigIdx >= 0 ? t0[sigIdx]?.iconUrl : null;
      // resolveSlotIconUrl remaps sword/knife generic icons → warrior skill_nobg art
      const iconUrl = resolveSlotIconUrl(role, weapon, { cdnUrl: masterIcon });
      // Equipped weapon skill tree drives sig labels (T0 / master kit).
      const label =
        sigIdx >= 0 && t0[sigIdx]?.label ? t0[sigIdx]!.label : d.label;
      const locked = sigIdx >= 0 && !isWeaponSkillSlotUnlocked(sigIdx, unlocks);
      return {
        slot,
        key,
        label: locked ? `${label} 🔒` : label,
        clip: override ?? d.clip,
        custom: !!override,
        icon: resolveSlotLocalName(role, weapon),
        iconUrl,
      };
    });
  }

  /** Assign (or, with null, clear) the clip a slot triggers; persisted per character. */
  setSlotAssignment(slot: ActionSlot, clip: string | null) {
    if (clip && this.character?.hasClip(clip)) this.overrides[slot] = clip;
    else delete this.overrides[slot];
    if (Object.keys(this.overrides).length) this.allOverrides[this.characterId] = this.overrides;
    else delete this.allOverrides[this.characterId];
    this.saveOverrides();
  }

  /** Play a clip once as a live preview (used by the Animations panel). */
  previewClip(name: string) {
    this.character?.playClipOnce(name, 0.15);
  }

  /** Orient the model: per-character base offset plus the live editor offset. */
  private applyModelYaw() {
    // grudge:<race>:<preset> is not in the catalog — default art-forward +Z (yaw 0).
    const base = this.characterId.startsWith("grudge:")
      ? 0
      : (getCharacter(this.characterId).modelYaw ?? 0);
    this.character?.setModelYaw(base + this.params.modelYaw);
  }

  private applyWeapon(id: WeaponId) {
    void this.applyWeaponAsync(id);
  }

  /**
   * Equip a weapon: swap the animation set (per rig) AND mount the real GLB
   * model onto the hand bones. A token guards against overlapping async loads,
   * and a character-swap check prevents a stale mount landing on a new rig.
   */
  private ensureGunAmmo(id: WeaponId) {
    const load = gunLoadout(id);
    if (!load) {
      this.gunAmmo = 0;
      this.gunClipMax = 0;
      return;
    }
    this.gunClipMax = load.clip;
    if (this.gunAmmo <= 0 || this.gunAmmo > load.clip) this.gunAmmo = load.clip;
  }

  private async applyWeaponAsync(id: WeaponId) {
    const token = ++this.weaponToken;
    // Swapping weapons cancels any in-flight mace throw (clears the flying mesh;
    // the held weapon is about to be remounted fresh, so visibility self-heals).
    this.cancelMaceThrow();
    this.cancelBeamCast();
    // Remember the choice even for a martial artist, so it re-applies when the
    // player later switches to a weapon-capable character.
    this.weaponId = id;
    this.ensureGunAmmo(id);
    this.gunReloadT = 0;
    this.gunFireLock = 0;
    this.gunCharging = false;

    // Swap the rig's animation set (procedural Explorer maps id -> animSet clips;
    // the GLB Character has no clip-swap and ignores this).
    this.character?.setWeaponId?.(id);
    // Explorer skill tree: rebind HUD 1–4 + VFX kinds to T0 / master-weaponSkills kit.
    if (this.character instanceof ExplorerCharacter || this.character?.def?.procedural) {
      const t0 = t0SignatureSkills(id);
      if (t0.length && this.character?.def) {
        this.character.def.signatureSkills = t0.map((s) => ({
          label: s.label,
          clip: s.clip || "attack",
          kind: s.kind,
          mode: s.mode,
        }));
      }
    }
    // Show the weapon's category ready / guard pose (and draw flourish) on stance
    // entry. Procedural rig only; GLB rigs omit it and keep their own idle.
    this.character?.readyPose?.(id);

    // Clear any currently mounted model before loading the next.
    if (this.mounted) {
      unmountWeapon(this.mounted);
      this.mounted = null;
    }

    const character = this.character;
    const rightHand = character?.rightHand;
    const leftHand = character?.leftHand;
    if (!character || !rightHand || !leftHand) return;
    if (getCharacter(this.characterId).weaponless) return; // martial artist: no weapon

    // uMMORPG / grudge6 kit path: handheld weapons already live as child meshes
    // on the race FBX (mesh_ids / gear preset). Mounting a second arsenal GLB
    // doubles weapons and breaks scale. Prefer kit mesh; external GLB only when
    // kit has no weapon pieces (Explorer / catalog GLB heroes).
    const kitMeshes =
      this.pendingMeshIds ||
      (character instanceof GrudgeAvatar ? character.getMeshIds() : null) ||
      [];
    if (kitMeshes.some((n) => /weapon|sword|axe|bow|staff|spear|dagger|hammer|mace|shield|quiver/i.test(n))) {
      // Polearm / 2H grip assist: bind off-hand toward kit weapon child mesh
      if (character instanceof GrudgeAvatar) {
        let weaponMesh: THREE.Object3D | null = null;
        character.root.traverse((o) => {
          if (weaponMesh) return;
          if (/weapon|spear|axe|sword|hammer/i.test(o.name) && (o as THREE.Mesh).isMesh) {
            weaponMesh = o;
          }
        });
        character.setGripWeapon(weaponMesh, id);
      }
      this.applyOffHand();
      return;
    }

    const def = getWeapon(id);
    const mounted = await mountWeaponModel(def, rightHand, leftHand);
    // Discard if a newer weapon/character selection superseded this load.
    if (this.disposed || token !== this.weaponToken || this.character !== character) {
      unmountWeapon(mounted);
      return;
    }
    this.mounted = mounted;
    if (character instanceof GrudgeAvatar) {
      character.setGripWeapon(mounted.objects[0] ?? null, id);
    }
    // Re-evaluate the off-hand: switching mains can make a shield (in)eligible.
    this.applyOffHand();
  }

  private applyOffHand() {
    void this.applyOffHandAsync();
  }

  /**
   * Mount (or clear) the independent off-hand piece. It only appears when an
   * off-hand id is selected AND the current main weapon is `offHandEligible`
   * (single 1H / unarmed, not already dual-wielding). The off-hand def's own
   * `hand` ("left" for the Tower Shield) routes it to the correct hand bone.
   */
  private async applyOffHandAsync() {
    const token = ++this.offHandToken;
    if (this.mountedOff) {
      unmountWeapon(this.mountedOff);
      this.mountedOff = null;
    }
    const character = this.character;
    const rightHand = character?.rightHand;
    const leftHand = character?.leftHand;
    if (!character || !rightHand || !leftHand) return;
    if (getCharacter(this.characterId).weaponless) return; // martial artist: bare hands only
    const id = this.offHandId;
    if (!id || !offHandEligible(this.weaponId)) return;
    // Kit already shows shield / offhand via mesh_ids — don't double-mount.
    const kitMeshes =
      this.pendingMeshIds ||
      (character instanceof GrudgeAvatar ? character.getMeshIds() : null) ||
      [];
    if (kitMeshes.some((n) => /shield|xtra|quiver|offhand|l_hand/i.test(n))) {
      return;
    }
    const mounted = await mountWeaponModel(getWeapon(id), rightHand, leftHand);
    if (this.disposed || token !== this.offHandToken || this.character !== character) {
      unmountWeapon(mounted);
      return;
    }
    this.mountedOff = mounted;
  }

  // ---- public API (safe from React) ----

  setCharacter(id: string) {
    const meshKey = (this.pendingMeshIds || []).join("|");
    // Re-spawn when mesh_ids change even if avatar id is the same (account equip)
    if (id === this.characterId && this.character && meshKey === this.lastSpawnMeshKey) return;
    this.lastSpawnMeshKey = meshKey;
    void this.spawnCharacter(id);
  }

  setWeapon(id: WeaponId) {
    if (!this.character) {
      this.weaponId = id;
      return;
    }
    this.applyWeapon(id);
  }

  /**
   * Select (or clear with `null`) the independent off-hand piece — e.g. the Tower
   * Shield equipped alongside a single one-handed weapon. The piece only mounts
   * when the current main weapon is `offHandEligible`; the selection is retained
   * either way so it reappears when you switch back to a compatible main.
   */
  setOffHand(id: WeaponId | null) {
    this.offHandId = id;
    this.applyOffHand();
  }

  /** Current off-hand slot selection (null = empty). */
  getOffHand(): WeaponId | null {
    return this.offHandId;
  }

  /**
   * Shift+Q combat arsenal swap — main hand ↔ side arm (when both set).
   * Uses the same applyWeapon path as the Loadout UI so skills/anims stay SSOT.
   */
  swapCombatArsenal() {
    if (this.activityMode !== "combat") return;
    const side = this.offHandId;
    if (!side || side === "none" || side === this.weaponId) {
      this.setCombatFlash("No side arm to swap", 0.55);
      return;
    }
    const main = this.weaponId;
    this.setWeapon(side);
    this.setOffHand(main === "none" ? null : main);
    this.setCombatFlash(`ARMS · ${side.toUpperCase()}`, 0.65);
  }

  setParams(p: Partial<EditorParams>) {
    this.params = { ...this.params, ...p };
    this.controller?.setParams(this.params);
    this.character?.setBlendTime(this.params.blendTime);
    this.character?.setShowSkeleton(this.params.showSkeleton);
    this.applyModelYaw();
    this.room.setGridVisible(true);
    // Persist controller/camera/mouse feel so it survives reloads like every
    // other settings group (FX/sound/HUD). Explicit slider changes save now.
    this.lastSavedCamDist = this.params.cameraDistance;
    saveControls(this.params);
  }

  /**
   * Debounced persistence for settings the engine mutates outside `setParams`
   * (currently the wheel-zoomed `cameraDistance`, which the Controller writes
   * straight onto the shared params object each frame). Coalesces a burst of
   * scroll events into a single write a short while after the user stops.
   */
  private queueControlsSave() {
    if (this.controlsSaveTimer !== null) return;
    this.controlsSaveTimer = setTimeout(() => {
      this.controlsSaveTimer = null;
      this.lastSavedCamDist = this.params.cameraDistance;
      saveControls(this.params);
    }, 500);
  }

  getParams(): EditorParams {
    return { ...this.params };
  }

  /**
   * Swap the Danger Room environment preset on the fly. The room rebuilds itself
   * from the new preset; the door portal, DJ booth anchor and combat coordinates
   * are preset-independent, so dungeon entry, the resident DJ and fighting all
   * keep working. Re-shows the grid per the new preset. Persisting the choice for
   * the session is the caller's responsibility (App owns the React/storage state).
   */
  setRoomPreset(id: RoomPresetId, opts: { propagate?: boolean } = {}) {
    this.room.setPreset(id);
    // setParams' grid-visible call may not fire again, so re-assert it here
    // (gated internally by the new preset's grid opacity).
    this.room.setGridVisible(true);
    // Re-tint the scene fog/background + retune the ambient bed for the new mood.
    // Only write to the scene when actually in the Danger Room — inside the
    // dungeon the baseline stays the dungeon's dark tone until we exit.
    this.applyRoomAtmosphere(!this.inDungeon);
    this.applyRoomAmbience();
    // In a networked room the host dictates the shared environment: broadcast the
    // change so every current joiner switches arenas and late joiners inherit it
    // (the server updates the stored ContentRef). Gated to genuine user-initiated
    // changes (`propagate` defaults true) so adopting an incoming/initial preset
    // can't echo back into a loop.
    if (opts.propagate !== false && this.net?.roomCode && this.net.isHost) {
      this.net.sendPreset(id);
    }
  }

  /**
   * Adopt the active room preset's atmosphere as the Danger Room fog baseline.
   * When `applyNow` is set (i.e. we're in the Danger Room, not the dungeon) the
   * fog + background are written to the scene immediately; otherwise only the
   * stored baseline updates so {@link exitDungeon} can restore it later. Presets
   * without an `atmosphere` fall back to the original dark base tone.
   */
  private applyRoomAtmosphere(applyNow: boolean) {
    const atmo = ROOM_PRESETS[this.room.presetId].atmosphere;
    this.baseFogColor.set(atmo?.color ?? Studio.FOG_BASE_COLOR);
    this.baseFogNear = atmo?.near ?? Studio.FOG_BASE_NEAR;
    this.baseFogFar = atmo?.far ?? Studio.FOG_BASE_FAR;
    this.baseBgColor.set(atmo?.background ?? atmo?.color ?? Studio.FOG_BASE_COLOR);
    if (applyNow) this.writeBaselineFog();
  }

  /** Snap the scene fog + background to the current dry baseline (no water tint). */
  private writeBaselineFog() {
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.baseFogColor);
      this.scene.fog.near = this.baseFogNear;
      this.scene.fog.far = this.baseFogFar;
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.baseBgColor);
    }
  }

  /** Push the active room preset's ambient-bed character onto the sound system. */
  private applyRoomAmbience() {
    const amb = ROOM_PRESETS[this.room.presetId].ambience;
    if (amb) this.sfx?.setAmbientProfile(amb);
  }

  /** The currently-built Danger Room environment preset id. */
  getRoomPreset(): RoomPresetId {
    return this.room.presetId;
  }

  /**
   * Set the global simulation time-scale (1 = real time, < 1 = slow-motion). The
   * value is clamped to a sane range; the whole sim — physics, animation, combat
   * timers and scheduled hits — runs off the scaled delta from the next frame.
   */
  setTimeScale(scale: number) {
    this.timeScale = THREE.MathUtils.clamp(scale, 0.05, 4);
  }

  /** Current global simulation time-scale (1 = real time). */
  getTimeScale(): number {
    return this.timeScale;
  }

  /**
   * AAA hitstop — brief bullet-time on confirmed impact / perfect parry.
   * Layers on the existing slowmo token so it won't stick if a later event wins.
   */
  triggerHitstop(seconds = 0.07, scale = 0.12) {
    if (this.slowmoToken === 0) this.slowmoBase = this.getTimeScale();
    const tok = ++this.slowmoToken;
    this.setTimeScale(scale);
    this.schedule(seconds, () => {
      if (tok !== this.slowmoToken) return;
      this.setTimeScale(this.slowmoBase);
      this.slowmoToken = 0;
    });
  }

  /** AI / tools: face a direction and dash (unique movement request). */
  requestDash(dirX: number, dirZ: number, distance?: number) {
    if (!this.controller) return false;
    const d = new THREE.Vector3(dirX, 0, dirZ);
    if (d.lengthSq() < 1e-6) d.copy(this.controller.forward());
    d.normalize();
    const dist = distance ?? this.params.dashDistance;
    this.controller.dash(d, dist, 0.28, 0.15, 0.55);
    return true;
  }

  /** AI / tools: preview an animation clip with optional VFX flash. */
  requestAnimPreview(clip: string, withEffect = true) {
    if (!this.character) return false;
    if (!this.character.hasClip(clip)) {
      const names = this.clipNames();
      const hit = names.find((n) => n.toLowerCase().includes(clip.toLowerCase()));
      if (!hit) return false;
      clip = hit;
    }
    this.character.playClipOnce(clip, Math.max(0.05, this.params.blendTime));
    if (withEffect && this.character.root) {
      const p = this.character.root.position.clone();
      p.y += 1.1;
      this.vfx.impact(p, 0xffd080, 1.1);
    }
    return true;
  }

  /** List available animation clips for AI tools. */
  listAnimClips(): string[] {
    return this.clipNames();
  }

  /** Whether all sound (combat one-shots, ambient bed, klaxon) is muted. */
  isMuted(): boolean {
    return this.sound.muted;
  }

  /** Mute/unmute all sound and persist the choice across sessions. */
  setMuted(muted: boolean): void {
    this.sound.muted = muted;
    this.sfx?.setMuted(muted);
    musicStation.setMuted(muted);
    saveSound(this.sound);
  }

  /** Current sound mixer settings (mute + master/combat/ambient/klaxon levels). */
  soundSettings(): SoundSettings {
    return { ...this.sound };
  }

  /**
   * Set one mixer channel level (0..1) and persist it. Muting still hard-silences
   * everything; these levels are what unmuting restores.
   */
  setSoundLevel(channel: "master" | "combat" | "ambient" | "klaxon" | "music", value: number): void {
    const v = Math.max(0, Math.min(1, value));
    this.sound[channel] = v;
    this.sfx?.setLevels({ [channel]: v });
    musicStation.setLevel(this.sound.music, this.sound.master);
    saveSound(this.sound);
  }

  /** Live-tune the GPU flame system (trailing fire + impact explode). */
  setFireParams(p: FireFxParams) {
    this.vfx.setFireParams(p);
  }

  /** Fire a test impact-explode burst in front of the current character. */
  testImpactExplode() {
    if (!this.character) return;
    const p = this.character.root.position.clone();
    const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, -1);
    p.addScaledVector(fwd, 1.6);
    p.y += 1.1;
    this.vfx.impactExplode(p, this.fireThemeApplied);
  }

  attack() {
    if (!this.character) return;
    if (this.spectating) return;
    // Piloting the exo-armour: a scaled-up mech strike replaces the normal combo.
    if (this.mech.isPiloted) {
      this.doMechPunch();
      return;
    }
    // Harvest / Build: LMB runs the selected radial tool (not combat swings).
    if (this.activityMode !== "combat") {
      this.runActivityTool();
      return;
    }
    // Mid offense-fail recovery: the swing was blocked/parried/dodged and the
    // player is paying the lost-tempo beat — no new attack until it clears.
    if (this.recoverLock > 0) return;
    // Staffs are RANGED casters, not melee: the light attack fires a themed
    // spline bolt instead of a melee combo. On the ground it carries a small
    // back-step (kiting), and while airborne / floating it casts in place. This
    // runs BEFORE the air branch so a floating mage casts a bolt rather than a
    // crash-down ground slam.
    if (this.isStaffEquipped()) {
      this.doStaffBolt();
      return;
    }
    // From the air, a light attack ALWAYS becomes a crash-down ground slam
    // (explosion + force shockwave + knock-up on landing) — never a grounded
    // combo swing. (If a slam is already pending, groundSlam no-ops.)
    if (this.controller && !this.controller.state.grounded) {
      // Dagger loadout: an airborne light attack becomes an angled overhead dagger
      // slash — a diving forward strike that lands at the END of the swing — instead
      // of the generic crash-down slam. Other weapon classes keep the ground slam
      // (gated on the knife animSet + the procedural rig that ships the overhead clip).
      const airWid: WeaponId = getCharacter(this.characterId).weaponless ? "none" : this.weaponId;
      if (getWeapon(airWid).animSet === "knife" && this.character.hasClip("jumpAttack")) {
        this.aerialDaggerSlash();
        return;
      }
      this.groundSlam();
      return;
    }
    // Broadcast a swing so remote clients animate this player's attack.
    if (this.net?.roomCode) {
      this.net.sendCombat({ k: "attack", from: this.net.selfId, action: "attack" });
    }
    const def = getCharacter(this.characterId);
    if (def.meleeStyle === "kick") {
      // Striker 3-hit fire kick combo. Each hit plays a real clip plus themed VFX;
      // a brief lock stops spam from skipping stages, and the chain window resets
      // back to hit 0 when the player pauses between clicks.
      if (this.kickComboLock > 0) return;
      const stage = this.kickComboTimer > 0 ? this.kickComboIndex : 0;
      const dur = this.doKickCombo(stage);
      this.kickComboIndex = (stage + 1) % 3;
      // Lock + chain window ride the real clip length so each kick plays through.
      this.kickComboTimer = dur > 0 ? dur + COMBO_GRACE : KICK_COMBO_WINDOW;
      this.kickComboLock = dur > 0 ? dur * COMBO_PLAYTHROUGH : stage === 2 ? 0.55 : 0.3;
      return;
    }
    // Guns (simplified): LMB fires weapon — no hybrid MMA kick on primary.
    // RMB focus steers aim; clip / burst rules live in doGunFire.
    if (isGunWeapon(this.weaponId)) {
      this.doGunFire();
      return;
    }
    // Heavy Crossbow — Albion shotgun cones + melee when close / air follow-up.
    if (isCrossbowWeapon(this.weaponId)) {
      this.doCrossbowPrimary();
      return;
    }
    // Bows: LMB looses an arrow.
    if (this.isProjectileRangedWeapon(this.weaponId)) {
      this.doRangedPrimaryShot();
      return;
    }
    // Weapon characters run a 3-hit combo (spear = 4: 1_1 → 1_2 → 1_4+MM → 1_3).
    // A brief lock stops spam from skipping stages; the chain window resets to 0.
    if (this.comboLock > 0) return;
    const stage = this.comboTimer > 0 ? this.comboIndex : 0;
    const dur = this.doComboHit(stage);
    const comboLen =
      isSpearWeapon(this.weaponId) || isHeavy2hWeapon(this.weaponId) ? 4 : 3;
    this.comboIndex = (stage + 1) % comboLen;
    this.lastComboStage = stage;
    // Lock + chain window ride the real clip length so each swing plays through
    // most of the way before the next hit chains (no more truncated half-swings).
    this.comboTimer = dur > 0 ? dur + COMBO_GRACE : COMBO_WINDOW;
    this.comboLock = dur > 0 ? dur * COMBO_PLAYTHROUGH : stage === 0 ? 0.22 : 0.16;
  }

  /**
   * Camera ray through the free-aim **crosshair** (centre + aimNdc offset).
   * Centre-screen **dot** is visual-only; attacks / select / harvest use this ray.
   */
  private crosshairRay(): THREE.Ray {
    return screenAimRay(this.camera, this.aimNdcX, this.aimNdcY);
  }

  /** Max free-aim NDC by mode (soft >> hard; non-combat widest). */
  private aimMaxNdc(): number {
    if (this.activityMode !== "combat") return AIM_FREE_MAX;
    return this.locked ? AIM_HARD_MAX : AIM_SOFT_MAX;
  }

  /** RMB / mode change: snap free-aim crosshair onto the centre dot. */
  private snapAimToCenter() {
    this.aimNdcX = 0;
    this.aimNdcY = 0;
  }

  /**
   * Split mouse between free-aim reticle and camera look.
   * Soft: more reticle play; Hard FOCUS: tight reticle, little cam (lock owns yaw).
   */
  private splitAimLook(dx: number, dy: number): { camDx: number; camDy: number } {
    const max = this.aimMaxNdc();
    // Hard focus: almost all mouse → micro reticle; soft: majority reticle + some cam
    const toReticle = this.locked ? 0.92 : this.activityMode === "combat" ? 0.62 : 0.75;
    const rx = dx * toReticle;
    const ry = dy * toReticle;
    // NDC scale from pixel movement (tuned to feel responsive under pointer-lock)
    const sens = 0.00165 * (this.params.mouseSensitivity || 1);
    this.aimNdcX = THREE.MathUtils.clamp(this.aimNdcX + rx * sens, -max, max);
    this.aimNdcY = THREE.MathUtils.clamp(this.aimNdcY - ry * sens, -max, max);
    // Residual (and any push against clamp) goes to camera
    const camScale = 1 - toReticle;
    return { camDx: dx * camScale, camDy: dy * camScale };
  }

  /**
   * Pick the living target under the crosshair. The weapon's `direction` (1-100)
   * widens the soft-aim cone: 100 = generous lock-on, low = near-pixel precise.
   */
  private pickCrosshairTarget(combat: WeaponCombat): TargetHandle | null {
    const dirN = THREE.MathUtils.clamp(combat.direction, 0, 100) / 100;
    // Higher softCos = tighter cone. dirN 1 -> ~35deg wide, dirN 0 -> ~7deg tight.
    const softCos = THREE.MathUtils.lerp(0.992, 0.82, dirN);
    return this.targets.raycast(this.crosshairRay(), 18, softCos);
  }

  /** Planar (XZ) direction + distance from the character to a target. */
  private toTargetPlanar(target: TargetHandle): { dir: THREE.Vector3; dist: number } {
    const to = target.position.clone().sub(this.character.root.position);
    to.y = 0;
    const dist = to.length();
    return { dir: dist > 1e-4 ? to.multiplyScalar(1 / dist) : this.facing(), dist };
  }

  /**
   * World position the slash/swing SFX should emanate from: the weapon's blade
   * tip (its collision/damage edge) when armed, else the character's chest.
   */
  private bladeEmitPos(): THREE.Vector3 {
    const out = new THREE.Vector3();
    if (this.mounted?.tip) {
      this.mounted.tip.getWorldPosition(out);
      return out;
    }
    if (this.character) {
      out.copy(this.character.root.position);
      out.y += 1.1;
    }
    return out;
  }

  /**
   * One swing of the weapon combo. Hit 0 is a fast dash-closer (with a mesh
   * afterimage tail) that stops inside the weapon's reach band — never past it;
   * hits 1-2 are short momentum lunges, and hit 2 is a heavier finisher. Every
   * hit faces the crosshair target first, and all damage/force/reach/steer scale
   * from the weapon's combat profile.
   */
  private doComboHit(stage: number): number {
    if (!this.character || !this.controller) return 0;
    const weaponless = !!getCharacter(this.characterId).weaponless;
    const wid: WeaponId = weaponless ? "none" : this.weaponId;
    const combat = weaponCombat(wid);
    const intensityN = THREE.MathUtils.clamp(combat.intensity, 1, 100) / 100;
    const dirN = THREE.MathUtils.clamp(combat.direction, 0, 100) / 100;
    const [rMin, rMax] = combat.range;
    const origin = this.character.root.position.clone();

    // Acquire the crosshair target and steer the strike toward it (steer blend
    // scales with `direction`), then commit the body facing before striking.
    const target = this.pickCrosshairTarget(combat);
    const aim = this.controller.forward();
    const dir = aim.clone();
    let targetDist = Infinity;
    if (target) {
      const planar = this.toTargetPlanar(target);
      targetDist = planar.dist;
      const steer = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.3, 1, dirN) * this.params.attackSteer, 0, 1);
      dir.lerp(planar.dir, steer).normalize();
    }
    this.controller.faceToward(dir, 0.18);

    // State-dependent attack clip: air / after damage / enemy windup / stage,
    // then override primary, then role fallback. Air uses cut playback for snap.
    this.refreshCombatContext();
    // Spear / heavy 2H (Madarame): attack1_1 → 1_2 → 1_4(+MM) → 1_3 finisher
    const spear = isSpearWeapon(wid);
    const heavy = heavyProfile(wid);
    const fourHit = spear || !!heavy;
    const heavyClips = heavy?.comboClips;
    const stageClips: Record<number, string[]> = fourHit
      ? {
          0: [...(heavyClips?.[0] || SPEAR_COMBO_CLIPS[0] || ["attack"])],
          1: [...(heavyClips?.[1] || SPEAR_COMBO_CLIPS[1] || ["attack2"])],
          2: [...(heavyClips?.[2] || SPEAR_COMBO_CLIPS[2] || ["attack4"])],
          3: [...(heavyClips?.[3] || SPEAR_COMBO_CLIPS[3] || ["attack3"])],
        }
      : {
          0: ["meleeCombo1", "attack1", "attack"],
          1: ["meleeCombo2", "attack2", "attack"],
          2: ["meleeCombo1", "attack3", "attack2", "attack"],
        };
    const stageKey = fourHit ? Math.min(stage, 3) : Math.min(stage, 2);
    const stageList = stageClips[stageKey] ?? stageClips[0]!;
    const stateTable: Partial<Record<CombatSituation, string[]>> = {
      air: ["jumpAttack", "attack", ...stageList],
      hover: ["jumpAttack", "chargedShot", "attack", ...stageList],
      after_damage: ["attack", "blockReact", ...stageList],
      enemy_attacking: ["attack", "parryReact", ...stageList],
      parry: ["parryReact", "attack", ...stageList],
      ragdoll: ["getUp", "attack"],
      knockdown: ["getUp", "attack"],
      stunned: ["hurt", "attack"],
      after_light: stageList,
      ground: stageList,
    };
    const stateClip = pickStateClip(
      stateTable,
      this.combatCtx,
      (n) => this.character!.hasClip(n),
      stageList,
    );
    const primary = this.overrides.primary;
    const overlayName =
      primary && this.character.hasClip(primary)
        ? primary
        : stateClip && this.character.hasClip(stateClip)
          ? stateClip
          : null;
    const cstate = this.controller.state;
    const moving = cstate.grounded && cstate.speed > 0.2;
    const airish = this.combatCtx.airborne || this.combatCtx.hovering;
    let dur = 0;
    if (airish && overlayName && this.character.playClipCut) {
      dur = this.character.playClipCut(overlayName, {
        from: 0.1,
        to: 1,
        timeScale: 1.4,
        fade: 0.06,
      }) || 0;
    } else if (moving && overlayName && this.character.playClipOverlay) {
      dur = this.character.playClipOverlay(overlayName, cstate.speed);
    }
    if (dur <= 0) {
      if (overlayName) dur = this.character.playClipOnce(overlayName, 0.1);
      else if (this.character.hasRole("attack")) dur = this.character.playRoleOnce("attack", 0.1);
    }
    this.swingTimer = dur > 0 ? dur * 0.45 : 0.2;

    const color = SKILL_COLOR[getWeapon(wid).kind] ?? 0x9fe8ff;
    this.swingColor = color;
    // Spear / 2H: stage 2 = drive-in (+MM), stage 3 = finisher
    const finisher = fourHit ? stage >= 3 : stage === 2;
    const spearDriveIn = fourHit && stage === 2;
    const mmScale = heavy?.mmScale ?? 1;
    const intensityMul = heavy?.intensity ?? 1;
    const stageDash = heavy?.stageDashM;

    // Slash whoosh for THIS combo cut — emitted from the weapon's blade/edge (its
    // collision-damage part) so the cut sounds like it comes from the steel, not
    // the chest. Finishers get the heavier air-rip.
    this.sfx?.play(
      finisher || spearDriveIn ? "whooshHeavy" : "whooshLight",
      this.bladeEmitPos(),
      { volume: finisher || spearDriveIn ? 0.95 : 0.8 },
    );

    // Respect-through-range verdict: classify this swing against the OWR of both
    // fighters. A follow-up swing (stage > 0) is a COMMITTED forward lunge, so it
    // can earn a penetration reward or be punished for a mistimed gap-close. The
    // timing quality is how well the closing distance sits in the optimal band.
    const scale = CHARACTER_HEIGHT_M / 1.8;
    const attackerOWR = weaponOWR(combat, getWeapon(wid).group, scale);
    const defenderOWR = weaponOWR(undefined, "melee-1h", scale);
    const optimalMid = (attackerOWR.optimalMin + attackerOWR.optimalMax) * 0.5;
    const span = Math.max(attackerOWR.outer - attackerOWR.optimalMin, 0.5);
    const timingQuality = Number.isFinite(targetDist)
      ? 1 - THREE.MathUtils.clamp(Math.abs(targetDist - optimalMid) / span, 0, 1)
      : 0;
    const verdict = Number.isFinite(targetDist)
      ? classifyEngagement({
          dist: targetDist,
          attacker: attackerOWR,
          defender: defenderOWR,
          committedLunge: stage > 0,
          timingQuality,
        })
      : null;

    if (stage === 0) {
      // Dash-closer: bring the body to ~mid of the reach band, clamped so we stop
      // INSIDE weapon range and never blow past the target.
      const desired = THREE.MathUtils.lerp(rMin, rMax, 0.5);
      const close = Number.isFinite(targetDist)
        ? THREE.MathUtils.clamp(targetDist - desired, 0, this.params.dashDistance)
        : Math.min(rMax, this.params.dashDistance * 0.5);
      const dashDur = 0.22; // quicker than a normal swing
      const impactAt = 0.7;
      this.controller.dash(dir, close, dashDur, 0, impactAt);
      // Motion-blur tail built from the character's OWN mesh.
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(close, 0.6), color, 4, 0.3);
      this.scheduleComboHit(dashDur * impactAt, dir, rMin, rMax, intensityN, color, finisher, verdict, stage);
    } else if (spearDriveIn) {
      // Madarame attack1_4 — strong +MM gap close (scaled for axe/mace/GS)
      const baseMm = heavy
        ? (stageDash?.[2] ?? 1.35) / MM_TO_M
        : SPEAR_FINISHER_ENTRY_MM;
      const lunge = baseMm * MM_TO_M * mmScale + 0.35 * intensityN * intensityMul;
      const dashDur = heavy ? 0.28 / (heavy.timeScale || 1) : 0.26;
      const impactAt = 0.52;
      this.controller.dash(dir, lunge, dashDur, lunge * 0.1, impactAt);
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(lunge, 1.0), color, 5, 0.35);
      this.vfx.skillCharge(
        this.muzzleOrigin(dir),
        heavy?.color ?? 0x70d0ff,
        1.1,
        0.22,
      );
      // Greatsword drive-in can throw a single slash blaster (annihilate teaser)
      if (heavy?.slashProjectiles) {
        this.vfx.castSlashBlasters(this.muzzleOrigin(dir), dir, {
          color: heavy.color,
          count: 1,
          range: 11,
        });
      }
      this.scheduleComboHit(
        dashDur * impactAt,
        dir,
        rMin,
        rMax,
        intensityN * 1.1 * intensityMul,
        color,
        false,
        verdict,
        stage,
      );
    } else {
      // Forward gap-closer lunge (USER-DIRECTED): each follow-up swing drives the
      // body INTO the enemy. Base advance comes from the motion-math knobs; a small
      // intensity bonus keeps heavier weapons hitting weightier. Only a slight
      // recoil so the combo keeps the ground it gained (~1m+ across hits 1-2).
      const profileDash =
        stageDash && stage >= 0 && stage < stageDash.length
          ? stageDash[stage]!
          : undefined;
      const lunge =
        profileDash ??
        ((spear && stage === 1 ? 40 : COMBO_ADVANCE_MM) * MM_TO_M +
          0.3 * intensityN) * mmScale;
      const dashDur = heavy ? 0.2 / heavy.timeScale : 0.18;
      const impactAt = 0.5;
      this.controller.dash(dir, lunge, dashDur, lunge * 0.12, impactAt);
      // The finisher is a big committed swing whose blade lands near the END of the
      // clip; time its hit to the real clip impact (not the ~90 ms dash impact) so
      // the damage/VFX connect with the swing instead of resolving in empty air.
      const hitDelay =
        finisher && dur > 0
          ? THREE.MathUtils.clamp(dur * FINISHER_IMPACT_FRAC, 0.12, 0.7)
          : dashDur * impactAt;
      this.scheduleComboHit(hitDelay, dir, rMin, rMax, intensityN, color, finisher, verdict, stage);
    }
    return dur;
  }

  /**
   * Resolve a combo hit at the expected in-range strike spot.
   * Deterministic melee FX from {@link meleeStrikeFxFor} (weapon + stage) —
   * no random slash arcs. Weapon collider trail, projectiles, AoE, knockback/up.
   */
  private scheduleComboHit(
    delay: number,
    dir: THREE.Vector3,
    rMin: number,
    rMax: number,
    intensityN: number,
    color: number,
    finisher: boolean,
    verdict: ReturnType<typeof classifyEngagement> | null,
    stage = 0,
  ) {
    this.schedule(delay, () => {
      if (!this.character) return;
      const weaponless = !!getCharacter(this.characterId).weaponless;
      const wid: WeaponId = weaponless ? "none" : this.weaponId;
      const fx = meleeStrikeFxFor(wid, stage, {
        finisher,
        fourHit: this.playerGroup() === "polearm" || getWeapon(wid).group === "polearm",
      });
      // Shared scriptable-weapon resolution: same path the AI opponents use.
      const strike = meleeStrike(
        { intensity: intensityN * 100, direction: 0, range: [rMin, rMax] },
        { finisher, skillForce: this.params.skillForce },
      );
      // Respect-through-range + counter window
      const counter = this.respectWindow > 0;
      const dmgMul = (verdict ? verdict.damageMul : 1) * (counter ? 1.5 : 1);
      const center = this.character.root.position.clone().addScaledVector(dir, strike.reach);
      center.y += 1.0;
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, this.character.root.rotation.y, 0),
      );
      // Prefer weapon tip / hand collider for trail + arc origin
      const pose = this.colliderPose();
      let slashPos = pose ? pose.pos.clone() : center.clone();
      let slashQuat = pose ? pose.quat.clone() : quat.clone();
      if (this.mounted?.tip) {
        const tip = new THREE.Vector3();
        this.mounted.tip.getWorldPosition(tip);
        slashPos = tip;
        // Orient arc from grip→tip when tip exists
        if (this.mounted.tip.parent) {
          const base = new THREE.Vector3();
          this.mounted.tip.parent.getWorldPosition(base);
          const along = tip.clone().sub(base);
          if (along.lengthSq() > 1e-5) {
            along.normalize();
            slashQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              along,
            );
          }
        }
      }

      // ── Deterministic slash arcs (profile-driven, never random) ──
      this.vfx.playMeleeSlash(slashPos, slashQuat, fx);
      this.swingColor = fx.trailColor;
      // Extend collider trail sampling through active window
      this.swingTimer = Math.max(this.swingTimer, 0.22 + fx.trailWindow * 0.35);

      if (fx.swingAura) {
        this.vfx.castAura(slashPos, fx.trailColor);
        this.vfx.auraRing(
          new THREE.Vector3(slashPos.x, 0.06, slashPos.z),
          fx.trailColor,
          finisher || fx.kind === "finisher" ? 1.35 : 0.95,
          0.32,
        );
      }

      // ── Projectile deploy (Getsuga ice-bow slash wave / bolt along swing) ──
      if (fx.projectile && fx.projectile.kind !== "none") {
        const muzzle = this.muzzleOrigin?.(dir) ?? slashPos.clone();
        if (fx.projectile.kind === "slash_wave") {
          const contactR = fx.projectile.contactRadius ?? 0.95;
          const projDmg = strike.damage * dmgMul * 0.35;
          // Light residual along the wave; end-hit carries the full residual pack.
          const applyPathHit = (p: THREE.Vector3, radius: number, scale = 0.22) => {
            const dmg = projDmg * scale;
            this.targets.playerHit(
              p,
              radius,
              {
                force: 1,
                damage: dmg,
                poiseDamage: Math.round(4 * scale * 4),
              },
              1,
              this.sparCtx,
            );
            this.campEnemies?.damageInRadius(p, radius, dmg);
            this.raiderBoats?.damageInRadius(p, radius, dmg);
          };
          // Weapon edge for trail: grip→tip follows mounted collider
          const followWeapon = () => {
            if (this.mounted?.tip) {
              const tip = new THREE.Vector3();
              this.mounted.tip.getWorldPosition(tip);
              const base = new THREE.Vector3();
              if (this.mounted.tip.parent) {
                this.mounted.tip.parent.getWorldPosition(base);
              } else {
                base.copy(tip).addScaledVector(dir, -0.6);
              }
              return { base, tip };
            }
            const pose = this.colliderPose();
            if (pose) {
              const tip = pose.pos.clone();
              const base = tip.clone().addScaledVector(dir, -0.55);
              return { base, tip };
            }
            return null;
          };
          // Aim point: hard/soft lock, else along swing so crescent faces that way
          const lockPt = this.targets?.selectedHostilePoint?.();
          const aimPt = lockPt
            ? lockPt.clone().setY(lockPt.y + 0.2)
            : muzzle.clone().addScaledVector(dir, fx.projectile.range);
          this.vfx.getsugaSlash(muzzle, dir, {
            speed: fx.projectile.speed,
            range: fx.projectile.range,
            color: fx.projectile.color,
            // Production mesh: slashred | slashblue | slashpurple | slashyellow
            variant: fx.projectile.variant,
            aim: aimPt,
            contactRadius: contactR,
            followDuration: fx.projectile.followDuration ?? 0.1,
            followWeapon,
            tickEvery: 0.14,
            onPathTick: (p, radius) => applyPathHit(p, radius, 0.22),
            onHit: (p) => {
              this.vfx.impact(p, fx.projectile!.color, contactR);
              applyPathHit(p, contactR * 1.15, 1);
            },
          });
        } else if (fx.projectile.kind === "bolt") {
          this.vfx.bolt(
            muzzle,
            dir,
            fx.projectile.color,
            fx.projectile.speed,
            fx.projectile.range,
            (p) => {
              this.vfx.burst(p, fx.projectile!.color, 12, 2.2);
              this.targets.playerHit(
                p,
                0.55,
                {
                  force: 1,
                  damage: strike.damage * dmgMul * 0.4,
                  poiseDamage: 10,
                },
                1,
                this.sparCtx,
              );
            },
          );
        }
      }

      // Hit radius includes profile AoE bonus
      const hitRadius = strike.radius + (fx.aoeRadius > 0 ? fx.aoeRadius * 0.35 : 0);
      const payload: AttackPayload = {
        force: Math.max(finisher ? 2 : 1, fx.forceTier) as 1 | 2 | 3,
        damage: strike.damage * dmgMul,
        poiseDamage: Math.round(strike.damage * dmgMul * 0.65 + fx.knockback * 2),
      };
      const result = this.targets.playerHit(center, hitRadius, payload, strike.force, this.sparCtx);
      // Voxel/forest camp creeps + island raiders share the same melee radius
      this.campEnemies?.damageInRadius(center, hitRadius, payload.damage);
      this.raiderBoats?.damageInRadius(center, hitRadius, payload.damage);
      const landed = !result || result.outcome === "hit" || result.outcome === "crit";
      if (landed && counter) {
        this.respectWindow = 0;
        this.setCombatFlash("COUNTER!", 0.6);
      }
      if (landed) {
        this.bumpMusicHeat(finisher || fx.kind === "finisher" ? 0.45 : 0.28);
        if (fx.fireAuraScale > 0) {
          this.vfx.fireAura(center, fx.fireAuraScale, this.fireThemeApplied, {
            groundOnly: fx.kind !== "finisher" && !finisher,
          });
        }
        this.vfx.impact(center, fx.trailColor, hitRadius * (finisher ? 1.05 : 0.78));
        // Ground AoE telegraph + residual
        if (fx.aoeRadius > 0.4) {
          this.vfx.shockwave(
            new THREE.Vector3(center.x, 0.05, center.z),
            fx.aoeColor,
            fx.aoeRadius,
            0.55,
          );
          this.vfx.auraRing(
            new THREE.Vector3(center.x, 0.06, center.z),
            fx.aoeColor,
            fx.aoeRadius * 0.85,
            0.4,
          );
        }
        const grp = this.playerGroup();
        const bladed = grp === "melee-1h" || grp === "melee-2h" || grp === "polearm";
        if (finisher || fx.kind === "finisher") {
          this.sfx?.play("heavyHit", center, { volume: 1 });
          this.sfx?.play("boneBreak", center, { volume: 0.55 });
        } else {
          this.sfx?.play(bladed ? "bladeHit" : "bodyHit", center, { volume: 0.9 });
        }
        // Knock-up / launch (profile-driven)
        if (fx.knockUp > 0.5) {
          this.targets.launch(center, hitRadius * 1.15, 0, fx.knockUp);
        }
      }
      if (verdict && landed) this.applyRangeConsequence(verdict, center, fx.trailColor);
      this.hitBags(center, hitRadius, strike.force, payload.damage);
      this.netStrike(center, hitRadius, payload.damage);
    });
  }

  /**
   * Classify the nearest enemy against the player's current weapon OWR for the
   * reticle distance ring, and fire a short WebAudio "edge" beep whenever the
   * band changes — the unmissable cue that you've crossed into/out of optimal
   * range. Cheap: one nearest-target lookup + a band compare per frame.
   */
  private updateOwrRange() {
    if (!this.character) {
      this.owrRangeState = "none";
      return;
    }
    const playerPos = this.character.root.position;
    const near = this.targets.nearest(playerPos, 1);
    let state: "close" | "optimal" | "far" | "none" = "none";
    if (near.length && near[0].alive) {
      const dx = near[0].position.x - playerPos.x;
      const dz = near[0].position.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      const scale = CHARACTER_HEIGHT_M / 1.8;
      const owr = weaponOWR(weaponCombat(this.weaponId), getWeapon(this.weaponId).group, scale);
      if (dist > owr.outer * 1.6) state = "none";
      else if (dist < owr.optimalMin) state = "close";
      else if (dist > owr.optimalMax) state = "far";
      else state = "optimal";
    }
    if (state !== this.owrRangeState) {
      // Edge cue: a soft tone when you ENTER the optimal band, a duller one when
      // you slip out of it. No beep for none<->none churn.
      if (state === "optimal") this.owrEdgeBeep(880, 0.05);
      else if (this.owrRangeState === "optimal") this.owrEdgeBeep(330, 0.07);
      this.owrRangeState = state;
    }
  }

  /** Tiny self-contained WebAudio blip (no asset, no external TTS) for OWR edges. */
  private owrEdgeBeep(freq: number, dur: number) {
    try {
      type WinAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
      if (!this.owrAudioCtx) {
        const Ctor = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
        if (!Ctor) return;
        this.owrAudioCtx = new Ctor();
      }
      const ac = this.owrAudioCtx;
      if (ac.state === "suspended") void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch {
      // Audio is a non-essential cue; never let it break the frame.
    }
  }

  /** Streak of consecutive landed combo hits (drives the 3-in-a-row stun). */
  private hitStreak = 0;
  private hitStreakAt = 0;

  /**
   * Respect timer: seconds of defender advantage opened by a successful defense
   * (block / parry / dodge) against an opponent strike. While it ticks, the
   * player's next landed swing is a punishing counter (bonus damage + flash).
   */
  private respectWindow = 0;

  /**
   * Monotonic tokens so overlapping range consequences cannot restore stale
   * state: only the latest-issued restore for each effect actually fires.
   * `slowmoBase` is the time-scale captured when the FIRST slow-mo of a burst
   * began, so the final restore returns to the true pre-slow-mo value.
   */
  private slowmoToken = 0;
  private slowmoBase = 1;
  private exposeToken = 0;

  /**
   * Apply the visible consequence of an OWR verdict on a landed player strike:
   * the penetration-success slow-mo + flash, the spacing-disadvantage punish
   * read-out, and a stun reward for landing three clean hits in a row.
   */
  private applyRangeConsequence(
    verdict: { outcome: RangeOutcome; slowmo: boolean; exposeWindow: number },
    center: THREE.Vector3,
    color: number,
  ) {
    if (verdict.outcome === "penetrationSuccess" || verdict.slowmo) {
      // Brief cinematic: bullet-time + flash on a clean breach. Capture the base
      // time-scale only when no slow-mo is already running, and gate the restore
      // on a monotonic token so an overlapping breach can't get stuck in slow-mo.
      if (this.slowmoToken === 0) this.slowmoBase = this.getTimeScale();
      const tok = ++this.slowmoToken;
      this.setTimeScale(0.32);
      this.setCombatFlash("PENETRATION!", 0.9);
      this.schedule(0.18, () => {
        if (tok !== this.slowmoToken) return; // a later breach owns the restore
        this.setTimeScale(this.slowmoBase);
        this.slowmoToken = 0;
      });
    } else if (verdict.outcome === "penetrationFail") {
      // Mistimed breach: you carried THROUGH the target and left yourself open —
      // a forward momentum carry plus a temporary move-speed cap so you can't
      // instantly reposition out of the punish window the defender just earned.
      // Token-gated restore so overlapping fails can't end an expose early.
      this.setCombatFlash("OVEREXTENDED", 0.7);
      const fwd = this.controller.forward();
      this.controller.applyImpulse(fwd, 6);
      const expose = verdict.exposeWindow > 0 ? verdict.exposeWindow : 0.7;
      const tok = ++this.exposeToken;
      this.controller.setSpeedMultiplier(0.4);
      this.schedule(expose, () => {
        if (tok === this.exposeToken) this.controller.setSpeedMultiplier(this.baseSpeedMul());
      });
    } else if (verdict.outcome === "spacingDisadvantage") {
      this.setCombatFlash("BAD SPACING", 0.7);
    }

    // Reward sustained clean pressure: three clean/penetration hits in a row
    // stun the struck enemy (resets if you go quiet for >2.5 s or whiff).
    const now = this.timer.getElapsed();
    if (verdict.outcome === "clean" || verdict.outcome === "penetrationSuccess") {
      if (now - this.hitStreakAt > 2.5) this.hitStreak = 0;
      this.hitStreak += 1;
      this.hitStreakAt = now;
      if (this.hitStreak >= 3) {
        this.hitStreak = 0;
        this.setCombatFlash("STUN COMBO!", 1.0);
        this.vfx.shockwave(new THREE.Vector3(center.x, 0.05, center.z), color, 2.0, 0.45);
        this.targets.stun(center, 2.2, 1.3);
      }
    } else {
      this.hitStreak = 0;
    }
  }

  // ---- Sparring: difficulty, block/parry, taking damage, respawn ----

  /** Set the sparring difficulty (passive = inert training dummies). */
  setDifficulty(d: Difficulty) {
    this.difficulty = d;
    // While a duel is running it owns the Targets AI tier (the countdown/result
    // phases force "passive"). Route the choice to the duel + the restore-on-stop
    // value instead of writing Targets directly, which would break the freeze.
    if (this.duel?.isActive) {
      this.duelSavedDifficulty = d;
      this.duel.setDifficulty(d);
      return;
    }
    this.targets.setDifficulty(d);
  }

  /** Resize the opponent ring (1-8 fighters). */
  setOpponentCount(n: number) {
    this.targets.setCount(n);
  }

  /** Spawn one NPC of the given faction wielding `weaponId` (additive). */
  spawnNpc(weaponId: WeaponId, faction: Faction) {
    this.targets.spawn(weaponId, faction);
  }

  /**
   * Spawn a single BOSS enemy in front of the player (additive). Bosses use the
   * unified `boss` combat archetype: large health/poise and unblockable skill
   * swings (force 4 → dodge-only). Resolves through the same per-fighter
   * CombatController as every other fighter.
   */
  spawnBoss(weaponId: WeaponId) {
    if (!(this.targets instanceof Targets)) return;
    const p = this.character?.root.position ?? new THREE.Vector3();
    const angle = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(
      p.x + Math.cos(angle) * 7,
      0,
      p.z + Math.sin(angle) * 7,
    );
    this.targets.spawnAt(pos, weaponId, "enemy", { scale: 1.7, arch: "boss" });
  }

  /** Remove every spawned NPC (both factions). */
  clearNpcs() {
    this.targets.clear();
  }

  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  /**
   * Start a player-vs-NPC arena match.
   * Modes: 1v1, 2v2, or ffa4 (Assassination Grounds — first to 10 kills, 4 fighters).
   */
  startArenaMatch(mode: ArenaMode = "1v1"): boolean {
    if (this.inDungeon || this.spectating) return false;
    if (!(this.targets instanceof Targets)) return false;
    if (this.arenaMatch?.isActive) return false;

    if (!this.arenaMatch) this.arenaMatch = new ArenaMatch();
    this.arenaSavedDifficulty = this.difficulty;

    const def = defaultArenaLoadout(mode);
    const existing = this.targets.enemyLoadout();
    let enemies = def.enemies;
    if (mode === "1v1" && existing.length === 1) {
      enemies = existing.map((e) => ({
        weaponId: e.weaponId,
        boss: e.boss,
        scale: e.scale,
        role: "duelist" as const,
      }));
    }

    this.targets.clear();
    // FFA needs auto-respawn so the deathmatch continues until kill goal.
    this.targets.setAutoRespawn(mode === "ffa4");
    this.targets.setArenaSkillBoost(true);
    this.targets.setDifficulty("passive");
    this.targets.setBounds(mode === "ffa4" ? 28 : 18);

    // Wire kill credit for FFA
    if (mode === "ffa4") {
      this.targets.onDeath = (pos) => {
        if (!this.arenaMatch?.isFfa || !this.arenaMatch.isFighting) return;
        // Enemy death near player combat → player kill (training attribution).
        void pos;
        const won = this.arenaMatch.recordPlayerKill();
        if (won) {
          this.targets?.setDifficulty("passive");
          this.setCombatFlash(`FIRST TO ${FFA_KILL_GOAL} · YOU WIN`, 2);
        }
      };
    }

    const mapLabel =
      mode === "ffa4" ? "ASSASSINATION GROUNDS" : "LOADING ARENA…";
    this.setCombatFlash(mapLabel, 1.4);
    void this.ensureArenaMap(mode === "ffa4" ? "assassination" : "classic").then((ok) => {
      if (!ok) return;
      this.setCombatFlash(mode === "ffa4" ? "GROUNDS READY" : "ARENA READY", 0.55);
    });

    this.placeArenaFighters(mode, enemies, def.allies);
    this.arenaMatch.start(mode, enemies, def.allies, {
      killGoal: FFA_KILL_GOAL,
    });
    const flash =
      mode === "1v1"
        ? "ARENA 1v1"
        : mode === "2v2"
          ? "ARENA 2v2"
          : `FFA ×4 · FIRST TO ${FFA_KILL_GOAL}`;
    this.setCombatFlash(flash, 0.85);
    return true;
  }

  /** Retry the same opponent loadout after a match result. */
  arenaRetry(): void {
    if (!this.arenaMatch?.isChoice) return;
    if (!(this.targets instanceof Targets)) return;
    const pack = this.arenaMatch.retry();
    if (!pack.enemies.length) return;
    this.restorePlayerForArena();
    this.targets.clear();
    this.targets.setAutoRespawn(pack.mode === "ffa4");
    this.targets.setArenaSkillBoost(true);
    this.targets.setDifficulty("passive");
    if (pack.mode === "ffa4") {
      this.targets.onDeath = (pos) => {
        if (!this.arenaMatch?.isFfa || !this.arenaMatch.isFighting) return;
        void pos;
        const won = this.arenaMatch.recordPlayerKill();
        if (won) {
          this.targets?.setDifficulty("passive");
          this.setCombatFlash(`FIRST TO ${FFA_KILL_GOAL} · YOU WIN`, 2);
        }
      };
    }
    this.placeArenaFighters(pack.mode, pack.enemies, pack.allies);
    this.setCombatFlash("RETRY", 0.5);
  }

  /**
   * Leave the arena match: clear opponents, hide arena map, restore free roam.
   */
  arenaReturn(): void {
    if (!this.arenaMatch?.isActive) return;
    this.arenaMatch.returnToRoom();
    if (this.targets instanceof Targets) {
      this.targets.clear();
      this.targets.setAutoRespawn(true);
      this.targets.setArenaSkillBoost(false);
      this.targets.setBounds(14);
      this.targets.onDeath = null;
    }
    this.hideArenaMap();
    this.restorePlayerForArena();
    if (this.arenaSavedDifficulty) {
      this.setDifficulty(this.arenaSavedDifficulty);
      this.arenaSavedDifficulty = null;
    } else {
      this.setDifficulty(this.difficulty === "passive" ? "medium" : this.difficulty);
    }
    this.setCombatFlash("DANGER ROOM", 0.7);
  }

  /**
   * Load arena floor: classic helpers/arena3 or Ultimate Assassination Grounds.
   */
  private async ensureArenaMap(
    kind: "classic" | "assassination" = "classic",
  ): Promise<boolean> {
    // Swap map if kind changed
    if (
      this.arenaMapRoot &&
      this.arenaMapRoot.userData.arenaKind === kind
    ) {
      this.arenaMapRoot.visible = true;
      return true;
    }
    if (this.arenaMapRoot) {
      this.scene.remove(this.arenaMapRoot);
      this.arenaMapRoot = null;
    }
    if (this.arenaMapLoading) return this.arenaMapLoading;
    const paths =
      kind === "assassination"
        ? [...ASSASSINATION_MAP_PATHS, ...ARENA_MAP_PATHS]
        : [...ARENA_MAP_PATHS];
    this.arenaMapLoading = (async () => {
      try {
        const { scene } = await loadGltfFirst(paths, sharedGltfLoader(), {
          prepMaterials: true,
        });
        if (kind === "classic") {
          const stripped = stripHelpersCharacter(scene);
          fitForgeScene(scene, { maxXZ: 28 });
          scene.userData.helpersForge = true;
          scene.userData.characterStripped = stripped;
        } else {
          // Fit assassination grounds to a large fight volume
          fitForgeScene(scene, { maxXZ: 42 });
        }
        scene.name =
          kind === "assassination"
            ? "arena-map-assassination-grounds"
            : "arena-map-helpers";
        scene.userData.arenaMap = true;
        scene.userData.arenaKind = kind;
        this.scene.add(scene);
        this.arenaMapRoot = scene;
        if (this.targets instanceof Targets) {
          this.targets.setBounds(kind === "assassination" ? 28 : 16);
        }
        return true;
      } catch (err) {
        console.warn("[arena] failed to load map", paths, err);
        return false;
      } finally {
        this.arenaMapLoading = null;
      }
    })();
    return this.arenaMapLoading;
  }

  private hideArenaMap(): void {
    if (this.arenaMapRoot) this.arenaMapRoot.visible = false;
  }

  /**
   * Position player + spawn allies/enemies.
   * 1v1/2v2: west vs east. FFA: four pads (N/E/S/W).
   */
  private placeArenaFighters(
    mode: ArenaMode,
    enemies: ArenaOpponentSpec[],
    allies: ArenaOpponentSpec[],
  ): void {
    if (!(this.targets instanceof Targets)) return;
    const origin = new THREE.Vector3(0, 0, 0);

    if (mode === "ffa4") {
      // Four pads around center — player on west, AI on N/E/S
      const pads: [number, number, number][] = [
        [-8, 0, 0], // player
        [0, 0, -8],
        [8, 0, 0],
        [0, 0, 8],
      ];
      if (this.character) {
        const [x, , z] = pads[0]!;
        this.character.root.position.set(origin.x + x, 0, origin.z + z);
        this.character.root.rotation.y = Math.PI / 2;
      }
      enemies.forEach((s, i) => {
        const pad = pads[Math.min(i + 1, pads.length - 1)]!;
        const pos = new THREE.Vector3(origin.x + pad[0], 0, origin.z + pad[2]);
        // Face center
        const yaw = Math.atan2(-pad[0], -pad[2]);
        this.targets.spawnAt?.(pos, s.weaponId, "enemy", {
          scale: s.scale,
          arch: "grunt",
          reactionDelay:
            s.role === "bruiser" ? 0.07 : s.role === "skirmisher" ? 0.09 : 0.08,
        });
        void yaw;
      });
      return;
    }

    if (this.character) {
      this.character.root.position.set(origin.x - 5.5, 0, origin.z);
      this.character.root.rotation.y = Math.PI / 2;
    }

    allies.forEach((s, i) => {
      const pos = new THREE.Vector3(origin.x - 5.5, 0, origin.z + (i === 0 ? 2.2 : -2.2));
      this.targets.spawnAt?.(pos, s.weaponId, "ally", {
        scale: s.scale,
        arch: "grunt",
        reactionDelay: 0.12,
      });
    });

    enemies.forEach((s, i) => {
      const n = Math.max(1, enemies.length);
      const zOff = n === 1 ? 0 : (i - (n - 1) / 2) * 2.4;
      const pos = new THREE.Vector3(origin.x + 5.5, 0, origin.z + zOff);
      this.targets.spawnAt?.(pos, s.weaponId, "enemy", {
        scale: s.scale,
        arch: s.boss ? "boss" : "grunt",
        reactionDelay: s.role === "bruiser" ? 0.08 : s.role === "skirmisher" ? 0.1 : 0.09,
      });
    });
  }

  /** @deprecated use placeArenaFighters — kept for any external callers. */
  private respawnArenaOpponents(specs: ArenaOpponentSpec[]): void {
    this.placeArenaFighters("1v1", specs, []);
  }

  private restorePlayerForArena(): void {
    this.defeated = false;
    this.hurt = 0;
    this.invuln = 1.2;
    this.blocking = false;
    this.sparring?.resetPlayer();
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
  }

  /** Build compact health bars for the arena HUD strip. */
  private buildArenaBars(counts: { enemy: number; ally: number }) {
    const bars: Array<{
      id: string;
      name: string;
      faction: "player" | "ally" | "enemy";
      health01: number;
      dead: boolean;
    }> = [
      {
        id: "player",
        name: "You",
        faction: "player",
        health01: this.maxHealth > 0 ? Math.max(0, this.health / this.maxHealth) : 1,
        dead: this.defeated,
      },
    ];
    if (this.targets instanceof Targets) {
      const views = this.targets.fighterViews();
      let allyN = 0;
      let enemyN = 0;
      for (const v of views) {
        if (v.faction === "ally") {
          allyN += 1;
          bars.push({
            id: `ally-${v.id}`,
            name: allyN === 1 ? "Ally Healer" : `Ally ${allyN}`,
            faction: "ally",
            health01: v.maxHealth > 0 ? v.health / v.maxHealth : 0,
            dead: v.dead,
          });
        } else {
          enemyN += 1;
          bars.push({
            id: `enemy-${v.id}`,
            name: enemyN === 1 ? "Foe" : `Foe ${enemyN}`,
            faction: "enemy",
            health01: v.maxHealth > 0 ? v.health / v.maxHealth : 0,
            dead: v.dead,
          });
        }
      }
    }
    void counts;
    return bars;
  }

  arenaState() {
    return this.arenaMatch?.isActive ? this.arenaMatch.state() : null;
  }

  /**
   * Start an AI-vs-AI Explorer duel in the Danger Room: hide the player, hand the
   * arena over to the {@link Duel} orchestrator, and switch to a spectator view.
   * No-op inside the dungeon or non-Targets populations.
   */
  startDuel(teamSize = 1) {
    if (this.inDungeon) return;
    if (!(this.targets instanceof Targets)) return;
    if (!this.duel) this.duel = new Duel(this.targets);
    if (this.duel.isActive) return;
    // The player becomes a hidden spectator — tear down any active exo-armour so
    // it doesn't linger in the scene or keep the speed/visibility overrides.
    this.cancelMech();
    this.duelSavedDifficulty = this.difficulty;
    if (this.character) this.character.root.visible = false;
    this.duel.setTeamSize(teamSize);
    this.duel.start(this.difficulty === "passive" ? "hard" : this.difficulty);
    this.ale.onDuelStart(this.duel.state());
  }

  /** Stop the active duel, restore the player + the pre-duel difficulty. */
  stopDuel() {
    if (!this.duel?.isActive) return;
    this.duel.stop();
    this.ale.onDuelStop();
    if (this.character) this.character.root.visible = true;
    if (this.duelSavedDifficulty) {
      this.setDifficulty(this.duelSavedDifficulty);
      this.duelSavedDifficulty = null;
    }
  }

  /** Live duel snapshot for the HUD, or null when no duel is running. */
  duelState(): DuelState | null {
    return this.duel?.isActive ? this.duel.state() : null;
  }

  /** True while a duel is running (player is a spectator: hidden + no offense). */
  private get spectating(): boolean {
    return !!this.duel?.isActive;
  }

  /**
   * RMB sticky toggle: hard FOCUS ↔ soft lock/select.
   * FOCUS = face locked target (soft-lock retention), A/D strafe, LMB attack/combo.
   * Soft lock = selection outline, LMB selects, free walk (wide free-aim).
   * Does NOT clear on RMB release — toggles only. Not a one-shot middle snap.
   */
  private toggleFocusMode() {
    if (this.defeated) return;
    if (this.locked) this.exitHardFocus();
    else this.enterHardFocus();
  }

  private enterHardFocus() {
    const p = this.character?.root.position ?? new THREE.Vector3();
    // Prefer current soft-lock selection, else acquire under crosshair, else nearest
    let lp = this.targets.lockPoint();
    if (!lp) {
      const under = this.targets.raycast(this.crosshairRay(), 22, 0.82);
      if (under) {
        this.targets.selectUnderAim?.(this.crosshairRay(), 22, 0.82);
        lp = this.targets.lockPoint() ?? under.position.clone();
      }
    }
    if (!lp) lp = this.targets.acquireNearest(p);
    // Entering focus: optional aim recenter once (sticky mode from here)
    this.snapAimToCenter();
    if (!lp) {
      // Focus without target = free-aim combat mode (still sticky until RMB again)
      this.locked = true;
      this.controller?.setLockTarget(null);
      this.setCombatFlash("FOCUS · AIM (toggle)", 0.55);
      return;
    }
    this.locked = true;
    this.controller?.setLockTarget(lp);
    // Clamp free-aim into hard max after entering focus
    const max = AIM_HARD_MAX;
    this.aimNdcX = THREE.MathUtils.clamp(this.aimNdcX, -max, max);
    this.aimNdcY = THREE.MathUtils.clamp(this.aimNdcY, -max, max);
    this.setCombatFlash("FOCUS LOCK (toggle)", 0.45);
  }

  private exitHardFocus() {
    this.locked = false;
    this.controller?.setLockTarget(null);
    // Keep soft-lock selection outline; free-aim stays where player left it
    this.setCombatFlash("SOFT LOCK / SELECT", 0.45);
  }

  /**
   * Soft-lock / non-focus LMB: select under free-aim crosshair
   * (enemies, NPCs — red outline). Doors/menus use unlocked OS cursor.
   */
  private selectUnderCrosshair() {
    const combat = weaponCombat(this.weaponId);
    const dirN = THREE.MathUtils.clamp(combat.direction, 0, 100) / 100;
    const softCos = THREE.MathUtils.lerp(0.992, 0.78, dirN);
    const name = this.targets.selectUnderAim?.(this.crosshairRay(), 22, softCos);
    if (name) this.setCombatFlash(`SELECT · ${name}`, 0.45);
    else this.setCombatFlash("SELECT · —", 0.3);
  }

  /** Harvest LMB: soft-select Warlords harvest node under free-aim (forest/sailtest). */
  private selectHarvestUnderCrosshair() {
    const softCos = 0.85;
    const ray = this.crosshairRay();
    const caster = new THREE.Raycaster(ray.origin, ray.direction, 0.2, 32);
    // Prefer real harvest nodes (ore / flower / wood / skin)
    const node = this.forestWorld?.pickHarvest(caster, 28) ?? null;
    if (node) {
      this.harvestSelectPos = node.position.clone();
      this.harvestSelectName = `${node.kind}:${node.tool}`;
      this.harvestSelectNodeId = node.id;
      // Prefer matching production tool for the node
      if (node.tool) this.activityTool = node.tool;
      this.harvestMoveActive = false;
      this.vfx.auraRing(
        new THREE.Vector3(node.position.x, 0.08, node.position.z),
        0x7ee7a8,
        1.2,
        0.55,
      );
      this.setCombatFlash(
        `HARVEST SELECT · ${node.kind.toUpperCase()} · ${node.tool} · ×${node.remaining}`,
        0.65,
      );
      return;
    }
    const name = this.targets.selectUnderAim?.(ray, 24, softCos);
    let pos: THREE.Vector3 | null = null;
    const t = this.targets.raycast(ray, 24, softCos);
    if (t) {
      pos = t.position.clone();
      this.harvestSelectName = name || "node";
    } else if (Math.abs(ray.direction.y) > 1e-4) {
      const dist = -ray.origin.y / ray.direction.y;
      if (dist > 0.5 && dist < 28) {
        pos = ray.origin.clone().addScaledVector(ray.direction, dist);
        this.harvestSelectName = this.activityTool || "gather";
      }
    }
    if (!pos) {
      const origin = this.character?.root.position.clone() ?? new THREE.Vector3();
      const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, 1);
      pos = origin.clone().addScaledVector(fwd, 4);
      pos.y = 0;
      this.harvestSelectName = this.activityTool || "gather";
    }
    this.harvestSelectPos = pos;
    this.harvestSelectNodeId = null;
    this.harvestMoveActive = false;
    this.vfx.auraRing(new THREE.Vector3(pos.x, 0.06, pos.z), 0x7ee7a8, 1.1, 0.55);
    this.setCombatFlash(`HARVEST SELECT · ${this.harvestSelectName.toUpperCase()}`, 0.55);
  }

  /**
   * Harvest RMB: walk/dash to the LMB-selected node, then harvest (yield + swing).
   * Soft-lock style — no hard focus; free-aim snapped to centre first.
   */
  private beginHarvestMove() {
    if (!this.character || !this.controller) return;
    if (!this.harvestSelectPos) {
      // No prior select — treat as select-at-aim then go
      this.selectHarvestUnderCrosshair();
    }
    if (!this.harvestSelectPos) {
      this.setCombatFlash("HARVEST · nothing selected", 0.45);
      return;
    }
    this.harvestMoveActive = true;
    this.locked = false;
    this.controller.setLockTarget(null);
    this.setCombatFlash(`HARVEST → ${this.harvestSelectName.toUpperCase()}`, 0.5);
  }

  /** Per-frame harvest approach: dash toward node, harvest on arrival. */
  private updateHarvestMove() {
    if (!this.harvestMoveActive || !this.harvestSelectPos || !this.character || !this.controller) return;
    if (this.activityMode !== "harvest") {
      this.harvestMoveActive = false;
      return;
    }
    const origin = this.character.root.position.clone();
    const to = this.harvestSelectPos.clone().sub(origin);
    to.y = 0;
    const dist = to.length();
    if (dist < 1.6) {
      this.harvestMoveActive = false;
      this.runActivityTool();
      this.vfx.burst(this.harvestSelectPos.clone().setY(0.4), 0x7ee7a8, 16, 2.4);
      return;
    }
    const dir = to.multiplyScalar(1 / dist);
    this.controller.faceToward(dir, 0.28);
    // Short step dash toward node (repeatable until in range)
    if (!this.controller.isDashing) {
      this.controller.dash(dir, Math.min(2.4, dist - 1.2), 0.28, 0, 0.55);
    }
  }

  /**
   * Pure guard (no focus). Used by radial "block" / forcefield — not RMB.
   */
  private startBlock() {
    if (this.defeated) return;
    this.blocking = true;
    this.sparring?.startBlock();
  }
  private endBlock() {
    this.blocking = false;
    this.sparring?.endBlock();
    // Do NOT clear hard focus — focus is independent of guard
  }

  /**
   * Touch hold-block (shield / guard). Distinct from focus (RMB) and parry (C).
   * Legacy name kept; prefer {@link touchGuard}.
   */
  touchBlock(on: boolean) {
    this.touchGuard(on);
  }

  /** Touch: hold for pure guard (E forcefield / sparring block). */
  touchGuard(on: boolean) {
    if (on) this.startBlock();
    else this.endBlock();
  }

  /** Touch: tap for combat parry window (KeyC). */
  touchParry() {
    if (this.activityMode === "combat") this.doParry();
  }

  /** Touch: sticky hard-focus / soft-lock toggle (RMB). */
  touchFocus() {
    this.toggleFocusMode();
  }

  /** Touch: hold crouch/sneak when the active character supports it. */
  setTouchCrouch(on: boolean) {
    const anyChar = this.character as { animator?: { setCrouch?: (v: boolean) => void } } | null;
    anyChar?.animator?.setCrouch?.(on);
    // Also latch as a move-speed hint via sprint flag inverted when crouching
    // (Controller reads touchSprint; crouch is animation-side only today).
    if (on) this.input.touchSprint = false;
  }

  /** Touch: set activity mode (combat / harvest / build). */
  touchSetActivityMode(mode: import("./playerMode").PlayerActivityMode) {
    this.setActivityMode(mode);
  }

  /** Touch: cycle combat → harvest → build. */
  touchCycleActivityMode() {
    this.cycleActivityMode();
  }

  /** Touch: harvest tool id (axe/pick/sickle/…) or combat skill index. */
  touchActivityTool(toolId: string) {
    if (this.activityMode === "harvest" || this.activityMode === "build") {
      this.runActivityTool(toolId);
    }
  }

  /** Touch: dodge roll (KeyX). */
  touchDodge() {
    this.performTimedDodgeRoll();
  }

  /**
   * (Re)bind the player-combat VFX hooks onto the current {@link CombatTargets}
   * population. Called after construction and after every danger⇄dungeon swap so
   * impact/reaction VFX keep firing through the shared CombatTargets surface, and
   * the population can resolve the player's defensive exchanges against its CC.
   */
  private wireTargetCombatHooks(): void {
    this.targets.setPlayerCC(this.sparring?.playerCC ?? null);
    this.targets.onPlayerHit = (result, pos) => {
      switch (result.outcome) {
        case "perfectParry":
          // Enemy perfect-parried the player → the player is the loser. Hardest
          // fail: a hard backward recoil + the long wall-crash stagger leave the
          // player wide open for the longest beat.
          this.setCombatFlash("PARRIED!", 1.2);
          this.sfx?.play("block", pos, { volume: 1, rate: 0.85 });
          this.blockShield(pos, true);
          this.vfx.parryClash(pos);
          this.vfx.burst(pos, 0xffe0a0, 40, 6);
          this.vfx.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), 0xffd060, 2.5, 0.5);
          this.playPlayerReaction("wallCrash");
          this.recoverFromFail(0.95, -2.6, pos);
          break;
        case "deflect":
          // Blade rang off the enemy's guard — a clean stance recoil, short beat.
          this.sfx?.play("block", pos, { volume: 0.85, rate: 1.1 });
          this.blockShield(pos);
          this.vfx.parryClash(pos, 0xbcd0ff);
          this.vfx.burst(pos, 0x88aaff, 20, 3.5);
          this.setCombatFlash("DEFLECTED", 0.7);
          this.reactWithClip(defenseClips(this.playerGroup()).parry, 0.1);
          this.recoverFromFail(0.45, -1.6, pos);
          break;
        case "blockStop":
          // Enemy soaked the hit on its guard. Shield-break (their guard breaks)
          // is GOOD for the player — no recovery; a plain block costs a short beat.
          this.sfx?.play("block", pos, { volume: 0.95 });
          this.blockShield(pos, result.defenderReaction === "stunned");
          this.vfx.burst(pos, 0xaaccff, 18, 3);
          if (result.defenderReaction === "stunned") {
            this.setCombatFlash("SHIELD BREAK!", 1.5);
          } else {
            this.setCombatFlash("BLOCKED", 0.7);
            this.reactWithClip(defenseClips(this.playerGroup()).parry, 0.1);
            this.recoverFromFail(0.4, -1.4, pos);
          }
          break;
        case "dodgeEvade":
          // Enemy slipped the swing — the player over-commits forward into the
          // empty space they just vacated.
          this.vfx.burst(pos, 0x80ff80, 14, 2.5);
          this.setCombatFlash("WHIFF", 0.7);
          this.reactWithClip(defenseClips(this.playerGroup()).stumble, 0.08);
          this.recoverFromFail(0.5, 1.3, pos);
          break;
        case "dodgePunish":
          // Enemy dodged inside the punish window — heavier stumble, longest
          // open window of the avoid outcomes.
          this.setCombatFlash("PUNISH!", 1.0);
          this.vfx.burst(pos, 0x80ff80, 22, 4);
          this.reactWithClip(defenseClips(this.playerGroup()).stumble, 0.08);
          this.recoverFromFail(0.8, 1.7, pos);
          break;
        case "crit":
          this.setCombatFlash("CRIT!", 0.9);
          this.vfx.fireAura(pos, 1.25, this.fireThemeApplied);
          this.vfx.impact(pos, 0xff6040, 1.6);
          break;
        case "hit":
          this.vfx.fireAura(pos, 0.8, this.fireThemeApplied, { groundOnly: true });
          this.vfx.impact(pos, 0xff8060, 1.05);
          break;
      }
    };
    this.targets.onEnemyState = (pos, state) => {
      if (state === "stagger") {
        this.vfx.burst(pos, 0xff9040, 14, 3);
        this.vfx.impact(pos, 0xff7040, 1.1);
      } else if (state === "stunned") {
        this.setCombatFlash("STUNNED!", 1.5);
        this.vfx.burst(pos, 0xffaa40, 26, 5);
        this.vfx.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), 0xff8020, 1.8, 0.4);
        this.vfx.impact(pos, 0xffaa40, 1.35);
      } else if (state === "fallen") {
        this.setCombatFlash("KNOCKED DOWN!", 1.5);
        this.vfx.burst(pos, 0xffd060, 32, 6);
        this.vfx.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), 0xff6000, 2.5, 0.5);
        this.vfx.impact(pos, 0xaa2020, 1.7);
      }
    };
  }

  /**
   * Resolve an opponent's strike against the player through the SINGLE combat
   * authority: the player's CombatController applies block/parry/dodge mitigation,
   * health/poise/stamina, and the attacker's reaction internally based on the
   * player's current defensive input. We only add physics recoil + hurt VFX and
   * relay the resolved {@link DefensiveResult} back to the attacker.
   */
  /**
   * Per-attack presentation cue for the heavy bear's three moves, keyed off the
   * attack's {@link BearAttack.impactTier}. `"swing"` plays the wind-up whoosh as
   * the body motion kicks off (lighter air for the jab, heavier for the chop/
   * pound); `"land"` plays the impact at the hit point — the slam (AoE) lands a
   * heavier thud + a bone-snap + a ground shockwave, the swipe/maul a lighter
   * body/heavy hit. Keeps the slam unmistakably the biggest blow.
   */
  private playBearAttackCue(at: THREE.Vector3, attack: BearAttack, moment: "swing" | "land"): void {
    const heavy = attack.impactTier !== "light";
    if (moment === "swing") {
      this.sfx?.play(heavy ? "whooshHeavy" : "whooshLight", at, {
        volume: heavy ? 0.85 : 0.7,
        rate: heavy ? 0.85 : 1.1,
      });
      return;
    }
    if (attack.impactTier === "slam") {
      this.sfx?.play("heavyHit", at, { volume: 1, rate: 0.78 });
      this.sfx?.play("boneBreak", at, { volume: 0.5 });
      this.vfx.shockwave(
        new THREE.Vector3(at.x, 0.05, at.z),
        0xffb24d,
        Math.max(2, attack.radiusBonus + 1.4),
        0.55,
      );
    } else if (attack.impactTier === "heavy") {
      this.sfx?.play("heavyHit", at, { volume: 0.85 });
    } else {
      this.sfx?.play("bodyHit", at, { volume: 0.8 });
    }
  }

  /** Origin of the most recent incoming strike, for directional guard reacts. */
  private lastStrikeFrom: THREE.Vector3 | null = null;
  /** True when the latest resolved strike was a skill/spell (for parry rebound). */
  private lastIncomingSkill = false;

  private resolveOpponentStrike(
    center: THREE.Vector3,
    radius: number,
    damage: number,
    force: number,
    from: THREE.Vector3,
    kind: SkillKind,
    isSkill: boolean,
  ): DefensiveResult | null {
    if (!this.character || this.defeated || this.invuln > 0) return null;
    const chest = this.character.root.position.clone();
    chest.y += 1.0;
    const falloff = aoeFalloff(chest.distanceTo(center), radius);
    if (falloff < 0) return null;

    // ── Shadow Kick smart-parry (KeyV open window) ─────────────────────────
    // During the planted open of Utility Kick, any melee hit that would land
    // is converted into a teleport-behind finish (no damage taken).
    if (this.shadowKick?.phase === "open" && this.isMeleeIncoming(kind, isSkill, force)) {
      this.lastStrikeFrom = from.clone();
      const parry = this.resolveShadowKickParry(from, center, damage * falloff);
      this.respectWindow = Math.max(this.respectWindow, 0.55);
      this.bumpMusicHeat(0.45);
      return parry;
    }

    // Distance-scaled defensive safety: holding guard from your own optimal
    // spacing is safer than eating a blow point-blank inside your guard. Scale
    // the incoming damage by where the attacker sits in the PLAYER's defensive
    // OWR — only while actually blocking (a raw hit takes the full blow).
    let safetyMul = 1;
    if (this.blocking) {
      const scale = CHARACTER_HEIGHT_M / 1.8;
      const defOWR = weaponOWR(weaponCombat(this.weaponId), getWeapon(this.weaponId).group, scale);
      const planar = Math.hypot(chest.x - from.x, chest.z - from.z);
      if (planar < defOWR.optimalMin) safetyMul = 1.2; // crowded — guard is worse
      else if (planar <= defOWR.optimalMax) safetyMul = 0.8; // ideal spacing — safest
      else safetyMul = 0.9; // at reach — still fairly safe
    }

    // Tank/Centurion armour: a flat incoming-damage cut (tankier), plus an extra
    // mitigation step while actively guarding (a sturdier shield). Pure data on
    // the character def — the player's max HP itself stays owned by SparringCombat.
    const cdef = getCharacter(this.characterId);
    let charMul = 1;
    if (cdef.tank) {
      charMul = cdef.tank.damageTakenMul;
      if (this.blocking) charMul *= cdef.tank.blockDamageMul;
    }

    const payload: AttackPayload = {
      force: isSkill ? 2 : 1,
      damage: damage * falloff * safetyMul * charMul,
      poiseDamage: Math.round(damage * falloff * safetyMul * charMul * 0.6),
    };
    // Stash the attacker origin so the defender's guarded-hit react can be
    // directional (chest is the player's own position — useless for side math).
    this.lastStrikeFrom = from.clone();
    this.lastIncomingSkill = !!isSkill;
    const hadParrySession = !!this.parrySession;
    const result = this.sparring.resolvePlayerDefense(payload, chest);

    // Failed / late parry → full damage already applied; slow stamina recover 2s
    if (
      hadParrySession &&
      (result.outcome === "hit" || result.outcome === "crit")
    ) {
      this.onParryFail(chest);
    }
    // Spell rebound is included in onParrySuccess when perfect/deflect fires

    // Respect timer: a successful defense (block / parry / dodge) opens a brief
    // defender-advantage window — the player's next swing lands as a counter.
    if (isDefended(result.outcome)) this.respectWindow = 0.4;

    // Physics recoil scaled by the resolved outcome (0 on a clean parry/dodge).
    const push = chest.clone().sub(from);
    push.y = 0;
    if (push.lengthSq() < 1e-4) push.set(0, 0, 1);
    push.normalize();
    const recoil = outcomeForceScale(result.outcome) * force;
    // Block forcefield + bounce-back: a BIG hit or combo finisher (isSkill, or a
    // heavy physical blow) soaked on a RAISED guard clashes against a hex
    // force-field that pops up around the blocker and shoves them apart with a
    // long, LOW-friction slide. `push` (chest − attacker) is the separation
    // normal — the vector "raycast" from the attack line into the guard sphere —
    // so the blocker slides straight back off the shield instead of soaking it
    // in place. Normal-weight hits keep the original short recoil.
    const bigBlocked = this.blocking && isDefended(result.outcome) && (isSkill || force >= 8);
    if (bigBlocked) {
      // The shield-flash VFX is fired from playPlayerDefenseReaction (synced to
      // the block SFX) so a guarded hit shows exactly one shield; here we keep
      // only the bounce-back impulse — the blocker slides off the guard.
      this.controller?.applyImpulse(push, Math.max(recoil, 7) * 0.7, 0.6, 2.5);
    } else if (recoil > 0) {
      this.controller?.applyImpulse(push, recoil * 0.5, recoil > 8 ? 1.5 : 0);
    }

    if (!isDefended(result.outcome)) {
      this.hurt = 0.5;
      // Taking a blow drives the combat-music bed hardest — the fight is on.
      this.bumpMusicHeat(0.5);
      // Fire-aura damage indication (skill prefab castAura + flame + impactExplode).
      const dmgScale = isSkill ? 1.35 : recoil > 8 ? 1.15 : 0.85;
      this.vfx.fireAura(chest, dmgScale, this.fireThemeApplied);
      this.vfx.impact(chest, SKILL_COLOR[kind] ?? 0xff5a6a, 0.7);
      // Take-hit locomotion: Documents knocked-up / hit-on-side-of-head pack.
      //  - skill / strong launch → knockedUp or knockedUpBack
      //  - heavy body hit → bigBlow
      //  - medium / default → hitHead (side-of-head flinch)
      if (isSkill || recoil >= 10) {
        // Prefer knock-up-and-back when shove has clear planar direction
        const planar = Math.hypot(push.x, push.z);
        if (planar > 0.4 || recoil >= 12) this.playPlayerReaction("knockedUpBack");
        else this.playPlayerReaction("knockedUp");
      } else if (recoil > 8) {
        // Heavy body hit — prefer Agony writhe when available, else bigBlow
        if (this.character?.hasClip?.("agony")) this.playPlayerReaction("agony");
        else this.playPlayerReaction("bigBlow");
      } else {
        this.playPlayerReaction("hitHead");
      }
    } else {
      // A blocked/parried/dodged blow still means an active exchange.
      this.bumpMusicHeat(0.3);
    }
    // In pvp, death is server-authoritative (driven by snapshots / death events);
    // don't let the local CC's health trigger a defeat.
    if (this.net?.mode !== "pvp" && this.sparring.getPlayerHealth() <= 0) this.defeatPlayer();
    return result;
  }

  private defeatPlayer(auto = true) {
    if (this.defeated) return;
    this.defeated = true;
    this.blocking = false;
    // Carry bag drops resources/items; kept loadout (main/side/mount/boat) stays.
    try {
      this.onPlayerDefeat?.();
    } catch {
      /* bag hook optional */
    }
    // Death drops any in-flight mace throw (restore the held weapon for respawn).
    this.cancelMaceThrow();
    // Drop any RMB lock stance so a desynced mouse state can't leave the camera
    // glued to an enemy through the defeat/respawn beat.
    this.locked = false;
    this.controller?.setLockTarget(null);
    const p = this.character.root.position.clone();
    p.y += 1.0;
    this.vfx.nova(p, 0xff5a6a);
    this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0xff5a6a, 3.2, 0.7);
    // Arena match owns death → classic ends match; FFA respawns via update tick.
    if (this.arenaMatch?.isFighting) {
      this.playPlayerReaction("knockedOut");
      // Classic 1v1/2v2: stay down until result. FFA: update loop restores.
      if (!this.arenaMatch.isFfa) return;
      return; // still skip free-roam schedule; FFA restore is in arena update
    }
    // In pvp the server owns the respawn timer (we restore on its respawn event /
    // authoritative alive flag), so skip the local auto-respawn schedule.
    if (!auto) return;
    // Play the knocked-out reaction on defeat (falls back to fallDown if the rig
    // lacks the clip) so death reads as a real KO, not a frozen pose. Local-only:
    // the reaction schedules its own getUp, which must NOT run for pvp deaths
    // where the server drives respawn (handled above by the auto=false return).
    this.playPlayerReaction("knockedOut");
    // Respawn after a beat: heal, brief i-frames.
    this.schedule(1.4, () => {
      if (this.arenaMatch?.isActive) return; // arena owns restore on retry/return
      this.health = this.maxHealth;
      this.stamina = this.maxStamina;
      this.invuln = 1.6;
      this.defeated = false;
      this.hurt = 0;
      // Dying in the dungeon ejects the player back to the Danger Room (which
      // restores collision, water band, traversal mode, and the sparring
      // population, and drops the player back into the arena healed).
      if (this.inDungeon) {
        this.exitDungeon();
      }
    });
  }

  /**
   * Play an appropriate reaction clip on the current character with the full
   * required vocabulary:
   *
   *   stumble      — a quick flinch (hurt role; fast fade so it doesn't lock pose)
   *   hitHead      — same flinch but harder (hurt role; slower fade for dramatics)
   *   stunned      — staggered stumble + a short stun hold (hurt × 2, spaced 0.3s)
   *   fallen       — tip-over stumble (hurt with slowest fade; simulates falling)
   *   wallCrash    — perfect-parry receiver: hurt with max blend time (~60-frame
   *                  equivalent at ~0.55 s), then a delayed "get up" hurt 1.5 s later
   *   getUp        — delayed recovery after fall (hurt role, slow fade)
   *   parryReact   — the parrier's stance snap (block role, else hurt fallback)
   */
  /** The player's currently-equipped weapon hold-style group. */
  private playerGroup(): WeaponGroup | undefined {
    return getWeapon(this.weaponId)?.group;
  }

  /**
   * Play a category-resolved reaction CLIP on the player rig. The clip key comes
   * from the hold-style standard ({@link defenseOutcomeClip} / {@link
   * vulnerableReactionClip} / {@link defenseClips}) so player and AI react from
   * ONE source. GLB rigs without `reaction` fall back to the generic hurt role.
   * Returns true when the procedural reaction path was taken.
   */
  private reactWithClip(clip: ActionKey, fade: number, hold = false): boolean {
    const c = this.character;
    if (!c) return false;
    if (c.reaction) {
      c.reaction(clip, fade, hold);
      return true;
    }
    if (c.hasRole("hurt")) c.playRoleOnce("hurt", fade);
    return false;
  }

  /**
   * Player-as-DEFENDER reaction to a resolved {@link DefensiveResult.outcome}.
   * The clip is sourced from the player's hold-style standard, so a knockdown
   * outcome (the category `fall` clip) also schedules a get-up beat.
   */
  /**
   * Pop the hex force-field shield at a guarded exchange, synced 1:1 with the
   * block SFX so a shield shows on exactly the frame the block sound plays.
   * `center` is the guard's chest-height world point; `big` widens + lengthens
   * the flash for heavy / shield-breaking blows.
   */
  private blockShield(center: THREE.Vector3, big = false): void {
    const p = center.clone();
    // Bigger, longer hex forcefield on guard so block reads like Smash shield.
    this.vfx.forceField(
      () => p,
      big ? 1.65 : 1.35,
      big ? 0.62 : 0.48,
      big ? 0x88f0ff : 0x66e0ff,
    );
    if (big) {
      this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0x7ad8ff, 1.8, 0.35);
      this.vfx.burst(p, 0xa8ecff, 12, 2.2);
    }
  }

  private playPlayerDefenseReaction(outcome: DefensiveResult["outcome"], pos?: THREE.Vector3): void {
    const g = this.playerGroup();
    // A hit soaked on a RAISED guard (blocked / deflected) plays a DIRECTIONAL
    // guarded-hit react keyed off where the blow landed relative to the player's
    // facing — the guard snaps to the struck side, then `holdClip()` blends it
    // back into the held block pose while the block is still held.
    if ((outcome === "blockStop" || outcome === "deflect") && this.blocking) {
      const clip = guardedHitClip(g, this.hitSide(this.lastStrikeFrom ?? pos));
      this.reactWithClip(clip, 0.08);
      this.sfx?.play("block", pos ?? this.character?.root.position ?? new THREE.Vector3(), {
        volume: 0.95,
        rate: outcome === "deflect" ? 1.1 : 1,
      });
      // Shield flash around the PLAYER's guard, synced to the block sound above.
      const center = (this.character?.root.position.clone() ?? pos?.clone() ?? new THREE.Vector3());
      center.y += 1.0;
      this.blockShield(center, outcome === "blockStop");
      return;
    }
    const clip = defenseOutcomeClip(g, outcome);
    const knockdown = clip === defenseClips(g).fall;
    this.reactWithClip(clip, knockdown ? 0.12 : 0.08, knockdown);
    if (knockdown) this.schedule(1.4, () => this.playPlayerReaction("getUp"));
  }

  /**
   * Which side of the player's guard an incoming hit landed on, from the player's
   * facing: a blow off to the left/right plays the directional guard react, a
   * head-on blow plays the frontal one. Defaults to a frontal hit when the
   * position or facing is unavailable.
   */
  private hitSide(pos?: THREE.Vector3): "left" | "right" | "front" {
    if (!pos || !this.character) return "front";
    const fwd = this.controller?.forward();
    if (!fwd) return "front";
    const to = pos.clone().sub(this.character.root.position);
    to.y = 0;
    if (to.lengthSq() < 1e-4) return "front";
    // Player-right basis = (-fwd.z, 0, fwd.x). Positive dot ⇒ hit on the right.
    const dot = to.x * -fwd.z + to.z * fwd.x;
    const lateral = dot / Math.hypot(to.x, to.z);
    if (lateral > 0.35) return "right";
    if (lateral < -0.35) return "left";
    return "front";
  }

  private playPlayerReaction(
    kind:
      | "stumble"
      | "hitHead"
      | "stunned"
      | "fallen"
      | "knockBack"
      | "launched"
      | "knockedUp"
      | "knockedUpBack"
      | "bigBlow"
      | "agony"
      | "knockedOut"
      | "wallCrash"
      | "getUp"
      | "kipUp"
      | "parryReact",
  ) {
    const c = this.character;
    if (!c) return;
    // Procedural rig (Danger Room): play the REAL reaction clip with a per-kind
    // crossfade so each reads distinctly. GLB rigs lack `reaction` and fall back
    // to the generic hurt role (and, where available, a named clip).
    const react = (key: string, fade: number, hold = false): boolean => {
      if (c.reaction) {
        c.reaction(key, fade, hold);
        return true;
      }
      if (c.hasRole("hurt")) c.playRoleOnce("hurt", fade);
      return false;
    };
    /** Launch chain: knock-up clip → falling idle → fallen hold → kip-up. */
    const playLaunch = (upKey: "knockedUp" | "knockedUpBack" | "uppercutLaunch") => {
      this.tumbleActive = true;
      this.tumbleT = Math.max(this.tumbleT, 1.75);
      if (!react(upKey, 0.08)) {
        if (!react("uppercutLaunch", 0.08)) react("fallDown", 0.08);
      }
      // Apex: airborne falling idle (Documents Falling Idle)
      this.schedule(0.45, () => {
        if (!this.tumbleActive) return;
        this.character?.reaction?.("fallingIdle", 0.12);
      });
      this.schedule(1.05, () => {
        if (!this.tumbleActive) return;
        this.character?.reaction?.("fallen", 0.15, true);
      });
      this.schedule(1.6, () => {
        if (!this.tumbleActive) return;
        this.playPlayerReaction("kipUp");
        this.tumbleActive = false;
        this.tumbleT = 0;
      });
    };
    switch (kind) {
      case "stumble":
        // Light take-hit — prefer side-of-head flinch over generic stumble
        if (!react("hitHead", 0.08)) react("stumble", 0.07);
        break;
      case "hitHead":
        // Documents Hit On Side Of Head.fbx
        if (!react("hitHead", 0.1)) react("stumble", 0.08);
        break;
      case "stunned":
        react("stunned", 0.1);
        break;
      case "fallen":
        // Tip over — Space can smash-recover; auto get-up still scheduled as backup.
        this.tumbleActive = true;
        this.tumbleT = Math.max(this.tumbleT, 1.5);
        react("fallDown", 0.12);
        this.schedule(1.4, () => {
          if (!this.tumbleActive) return;
          this.playPlayerReaction("getUp");
          this.tumbleActive = false;
          this.tumbleT = 0;
        });
        break;
      case "knockBack":
        // Shoved hard onto the back — Smash tumble; Space = cut backflip recover.
        this.tumbleActive = true;
        this.tumbleT = Math.max(this.tumbleT, 1.6);
        if (!react("flyingBack", 0.1)) react("fallDown", 0.12);
        this.schedule(0.95, () => {
          if (!this.tumbleActive) return;
          this.character?.reaction?.("fallen", 0.15, true);
        });
        this.schedule(1.5, () => {
          if (!this.tumbleActive) return;
          this.playPlayerReaction("kipUp");
          this.tumbleActive = false;
          this.tumbleT = 0;
        });
        break;
      case "knockedUp":
        // Documents knocked up.fbx
        playLaunch("knockedUp");
        break;
      case "knockedUpBack":
        // Documents knocked up and back.fbx
        playLaunch("knockedUpBack");
        break;
      case "launched":
        // Popped into the air — prefer knocked-up pack, then uppercut launch.
        playLaunch("knockedUp");
        break;
      case "bigBlow":
        // Heavy body blow that staggers but keeps the fighter on their feet.
        if (!react("bigBlow", 0.1)) react("stumble", 0.08);
        break;
      case "agony":
        // Documents Agony.fbx — sustained pain writhe (heavy non-launch hit)
        if (!react("agony", 0.12)) {
          if (!react("bigBlow", 0.1)) react("hitHead", 0.1);
        }
        break;
      case "knockedOut":
        // Full collapse: knock-out drop, hold the grounded pose, then a slow get-up.
        if (!react("knockedOut", 0.12, true)) react("fallDown", 0.12);
        this.schedule(2.0, () => this.playPlayerReaction("getUp"));
        break;
      case "wallCrash": {
        if (c.reaction) {
          c.reaction("wallCrash", 0.4);
        } else {
          // GLB fallback: try a named clip ("wall_crash" / "Wall Crash"), else hurt.
          const hasWallCrash = c.hasClip("wall_crash") || c.hasClip("Wall Crash");
          if (hasWallCrash) c.playClipOnce(c.hasClip("wall_crash") ? "wall_crash" : "Wall Crash", 0.55);
          else if (c.hasRole("hurt")) c.playRoleOnce("hurt", 0.55);
        }
        this.schedule(1.8, () => this.playPlayerReaction("getUp"));
        break;
      }
      case "getUp":
        if (c.reaction) {
          c.reaction("getUp", 0.2);
        } else {
          const hasGetUp = c.hasClip("get_up") || c.hasClip("Get Up");
          if (hasGetUp) c.playClipOnce(c.hasClip("get_up") ? "get_up" : "Get Up", 0.22);
          else if (c.hasRole("hurt")) c.playRoleOnce("hurt", 0.18);
        }
        break;
      case "kipUp":
        react("kipUp", 0.18);
        break;
      case "parryReact":
        if (c.reaction) c.reaction("parryReact", 0.1);
        else if (c.hasRole("block")) c.playRoleOnce("block", 0.1);
        else if (c.hasRole("hurt")) c.playRoleOnce("hurt", 0.12);
        break;
    }
  }

  /**
   * Apply the player's offense-fail recovery after a swing was blocked, parried
   * or dodged: lock out offense for `lock` seconds (the lost-tempo beat that
   * hands the defender a window) and shove the body along/against the swing line
   * for a subtle physical read. Positive `lunge` over-commits FORWARD (whiffed
   * into empty air); negative recoils BACKWARD (rang off a guard). The reaction
   * clip is played by the caller so each outcome reads distinctly.
   */
  private recoverFromFail(lock: number, lunge: number, hitPos: THREE.Vector3) {
    this.recoverLock = Math.max(this.recoverLock, lock);
    // Break the combo chain so the next press starts a fresh stage-0 swing.
    this.comboTimer = 0;
    this.fireComboTimer = 0;
    this.fireComboIndex = 0;
    this.comboLock = Math.max(this.comboLock, lock);
    if (lunge !== 0 && this.controller && this.character) {
      // Recoil along the actual attack line: player → defender at impact. This is
      // correct for every offense path (combo/stab/motion/heavy/skill) without
      // tracking a per-path swing vector.
      const dir = hitPos.clone().sub(this.character.root.position);
      dir.y = 0;
      if (dir.lengthSq() < 1e-4) dir.copy(this.facing());
      dir.normalize();
      if (lunge < 0) dir.negate();
      this.controller.applyImpulse(dir, Math.abs(lunge), 0);
    }
  }

  /** Show a brief center-screen combat flash label. */
  /** Public flash for HUD / bag / production UI. */
  flashMessage(text: string, duration = 1.4) {
    this.setCombatFlash(text, duration);
  }

  private setCombatFlash(text: string, duration = 1.4) {
    this.combatFlash = text;
    this.combatFlashTimer = duration;
  }

  /**
   * Unified blast helper: routes the player's skill damage through the focused
   * enemy's CombatController (parry/block/dodge + damage applied internally) with
   * lighter AoE splash to others in range. Returns the focused {@link
   * DefensiveResult} (or null when nothing was in reach — then it fell back to a
   * plain blast) so callers can add extra VFX.
   */
  private sparringBlast(
    center: THREE.Vector3,
    radius: number,
    damage: number,
    force: number,
    poiseDamageRatio = 0.65,
  ): DefensiveResult | null {
    const payload: AttackPayload = {
      force: force >= this.params.skillForce ? 2 : 1,
      damage,
      poiseDamage: Math.round(damage * poiseDamageRatio),
    };
    // A skill/AoE blast is a heavy offensive beat — swell the combat music.
    this.bumpMusicHeat(0.4);
    return this.targets.playerHit(center, radius, payload, force, this.sparCtx);
  }

  /**
   * Player's heavy "R" shield-break skill when a target is nearby.
   * Routes through the sparring model (force-3 + shieldBreak:true) so a
   * blocking dummy gets stunned, opening a 2-second guaranteed crit window.
   */
  private doHeavyAttack() {
    if (!this.character || !this.controller) return;
    // The pistol Kiter's heavy is a tactical retreat + turret drop, not a slam.
    if (getCharacter(this.characterId).kiter && this.weaponId === "pistol") {
      this.doKiterRetreat();
      return;
    }
    if (this.skyfallCooldown > 0 || this.recoverLock > 0) return;
    // From the air, the heavy ALWAYS becomes a targeted crash-down slam.
    if (!this.controller.state.grounded) {
      this.groundSlam();
      return;
    }

    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    if (!picked) {
      // No close target — fall through to skyfall.
      this.skyfall();
      return;
    }

    const dir = this.steerToward(aim, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.22);
    if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);

    const reach = THREE.MathUtils.clamp(picked.dist - 0.9, 0.4, cfg.maxReach);
    const color = 0xff8040;
    const endpoint = origin.clone().addScaledVector(dir, reach);
    this.vfx.dashStreak(origin, endpoint, color);
    this.controller.dash(dir, reach, 0.24, reach * 0.3, 0.5);

    this.abilities.cast(kitAbility("heavyAttack", "slam", color, 0.12), {
      onImpact: () => {
        if (!this.character) return;
        const hitPos = this.character.root.position.clone().addScaledVector(dir, reach * 0.7);
        hitPos.y += 1.0;
        // Heavy shield-break (force-3 + shieldBreak) resolved through the focused
        // enemy's CC: a blocking enemy gets stunned, opening a crit window.
        const result = this.targets.playerHit(
          picked.position,
          2.5,
          PLAYER_HEAVY_PAYLOAD,
          this.params.skillForce * 0.9,
          this.sparCtx,
        );
        if (result && result.outcome === "blockStop" && result.defenderReaction === "stunned") {
          this.vfx.aoeBlast(hitPos, 0xff4400, 2.5);
          this.vfx.burst(hitPos, 0xff7030, 50, 7);
          this.vfx.shockwave(new THREE.Vector3(hitPos.x, 0.05, hitPos.z), 0xff5500, 2.0, 0.45);
        } else if (!result || result.outcome === "hit" || result.outcome === "crit") {
          this.vfx.aoeBlast(hitPos, color, 2.2);
          this.vfx.burst(hitPos, 0xff9050, 36, 6);
        } else {
          this.vfx.burst(hitPos, 0x88aaff, 20, 3.5);
        }
      },
    });

    this.skyfallCooldown = 2.0;
    this.stamina = Math.max(0, this.stamina - 18);
  }

  /**
   * The pistol Kiter's "R": optimal evasive movement directly away from the
   * closest enemy (keeping the gun trained on them) with a brief i-frame slip,
   * and a turret left behind to cover the ground just vacated.
   */
  private doKiterRetreat() {
    if (!this.character || !this.controller) return;
    if (this.skyfallCooldown > 0 || this.recoverLock > 0) return;
    const playerPos = this.character.root.position.clone();
    const enemy = this.targets.nearest(playerPos, 1).find((h) => h.alive);
    const away = new THREE.Vector3();
    if (enemy) {
      away.copy(playerPos).sub(enemy.position).setY(0);
      if (away.lengthSq() < 1e-4) away.copy(this.facing()).negate().setY(0);
      away.normalize();
      const toEnemy = enemy.position.clone().sub(playerPos).setY(0);
      if (toEnemy.lengthSq() > 1e-4) this.controller.faceToward(toEnemy.normalize(), 0.3);
    } else {
      away.copy(this.facing()).negate().setY(0).normalize();
    }
    // Leave the turret where we stand BEFORE sliding away, so it screens the
    // retreat, then slip back with a short i-frame window.
    this.deployTurret(playerPos);
    this.controller.dash(away, 4.0, 0.3, 0, 0.6);
    this.invuln = Math.max(this.invuln, 0.3);
    if (this.character.hasClip("airDodge")) this.character.playClipOnce("airDodge", 0.1);
    this.skyfallCooldown = 6.0;
    this.stamina = Math.max(0, this.stamina - 20);
  }

  /**
   * Deploy a stationary turret at `at`. It stands for a few seconds and, each
   * volley gap, fires a burst of slow, oversized bolts at the closest living
   * enemy. Used by Archmage F, Kiter retreat, and gun skill 2 / 4.
   *
   * @param opts.variant  classic (heavy / skill 4) | gameReady (animated skill 2)
   * @param opts.color    gun / skill accent color
   * @param opts.life     stand time (s)
   * @param opts.damage   per-bolt damage
   * @param opts.heavy    slightly larger bolts + more volleys
   */
  private deployTurret(
    at: THREE.Vector3,
    faceDir?: THREE.Vector3,
    opts?: {
      variant?: TurretVariant;
      color?: number;
      life?: number;
      damage?: number;
      heavy?: boolean;
      scale?: number;
    },
  ) {
    if (!this.character) return;
    const base = at.clone();
    base.y = 0;
    const facing = faceDir ?? this.facing();
    const variant = opts?.variant ?? "classic";
    const color = opts?.color ?? TURRET_COLOR;
    const life = opts?.life ?? (opts?.heavy ? TURRET_LIFE_HEAVY : TURRET_LIFE);
    const damage = opts?.damage ?? (opts?.heavy ? TURRET_SHOT_DAMAGE_HEAVY : TURRET_SHOT_DAMAGE);
    const boltScale = opts?.scale ?? (opts?.heavy ? 1.75 : TURRET_BOLT_SCALE);
    const volleys = opts?.heavy ? 4 : TURRET_VOLLEY;
    const gap = opts?.heavy ? 1.2 : TURRET_VOLLEY_GAP;

    let handle: TurretHandle | null = null;
    // Deploy entity lifecycle — same as before, but volleys sample live muzzle +
    // attack anim so bullets release on the attack pose.
    this.abilities.cast(
      deployAbility("turret", "turret", color, {
        life,
        firstTick: 0.45,
        interval: gap,
        tail: 0.35,
      }),
      {
        onDeploy: () => {
          handle = this.vfx.spawnTurret(base, facing, color, life, variant);
        },
        onTick: () => this.fireTurretVolleyFrom(handle, color, damage, boltScale, volleys),
        onExpire: () => {
          handle?.playDestroy();
          // Allow destroy clip a beat, then dispose
          this.schedule(0.35, () => handle?.dispose());
        },
      },
    );
  }

  /**
   * Fire a turret volley: aim chassis/barrel at nearest enemy, play attack anim,
   * then release bolts from the live muzzle (synced to attack wind-up).
   */
  private fireTurretVolleyFrom(
    handle: TurretHandle | null,
    color: number,
    damage: number,
    boltScale: number,
    volleyCount: number,
  ) {
    if (this.disposed) return;
    const fallbackMuz = this.character
      ? this.character.root.position.clone().setY(this.character.root.position.y + 1.1)
      : new THREE.Vector3();
    const seed = handle?.alive ? handle.muzzleWorld() : fallbackMuz;
    const enemy = this.targets.nearest(seed, 1).find((h) => h.alive);
    if (!enemy) return;

    // Aim before the burst so the barrel points at the target
    const aimPt = enemy.position.clone();
    aimPt.y += 0.95;
    handle?.aimAt(aimPt);
    handle?.playAttack();

    // Attack anim lead-in (~0.12s) then each bolt of the volley
    const attackLead = 0.12;
    for (let i = 0; i < volleyCount; i++) {
      this.schedule(attackLead + i * 0.16, () => {
        if (this.disposed) return;
        const e = enemy.alive ? enemy : this.targets.nearest(seed, 1).find((h) => h.alive);
        if (!e) return;
        const aim = e.position.clone();
        aim.y += 0.9;
        handle?.aimAt(aim);
        const muzzle = handle?.alive ? handle.muzzleWorld() : seed.clone();
        const dir = aim.clone().sub(muzzle);
        const dist = dir.length();
        if (dist < 1e-3) return;
        dir.multiplyScalar(1 / dist);
        this.vfx.muzzle(muzzle.clone(), dir, color);
        this.vfx.chargedBolt(
          muzzle.clone(),
          dir,
          color,
          TURRET_BOLT_SPEED,
          dist + 0.5,
          (p) => {
            this.vfx.aoeBlast(p, color, 1.0);
            this.vfx.fireAura(p, 0.7, this.fireThemeApplied);
            this.targets.blast(p, 1.0, damage, this.params.skillForce * 0.4);
          },
          boltScale,
        );
      });
    }
  }

  /** Legacy entry — classic chassis at player feet (kiter / archmage). */
  private fireTurretVolley(muzzle: THREE.Vector3) {
    // Keep for any residual callers: aimless fallback bolt spray from a point.
    if (this.disposed) return;
    const enemy = this.targets.nearest(muzzle, 1).find((h) => h.alive);
    if (!enemy) return;
    for (let i = 0; i < TURRET_VOLLEY; i++) {
      this.schedule(i * 0.16, () => {
        if (this.disposed) return;
        const e = enemy.alive ? enemy : this.targets.nearest(muzzle, 1).find((h) => h.alive);
        if (!e) return;
        const aim = e.position.clone();
        aim.y += 0.9;
        const dir = aim.clone().sub(muzzle);
        const dist = dir.length();
        if (dist < 1e-3) return;
        dir.multiplyScalar(1 / dist);
        this.vfx.muzzle(muzzle.clone(), dir, TURRET_COLOR);
        this.vfx.bolt(
          muzzle.clone(),
          dir,
          TURRET_COLOR,
          TURRET_BOLT_SPEED,
          dist + 0.5,
          (p) => {
            this.vfx.aoeBlast(p, TURRET_COLOR, 1.0);
            this.targets.blast(p, 1.0, TURRET_SHOT_DAMAGE, this.params.skillForce * 0.4);
          },
          TURRET_BOLT_SCALE,
        );
      });
    }
  }

  /**
   * Deploy a stationary snare field at `at`. It stands for a few seconds and, each
   * pulse, re-snares every living enemy inside it (a movement slow + modest chip
   * damage) — a persistent zone-control gadget, the support counterpart to the
   * turret. Like the turret it is a deployed entity (not a one-shot cast), so it
   * runs through the ability lifecycle's deploy phase: it shares the same timing +
   * `cancelAll` teardown, and `abilities.update` runs with the same `dt` adjacent
   * to `updatePending` so each pulse fires on the frame the schedule reaches. The
   * deploy schedule (life / first pulse / gap / tail) is seeded + tested in the
   * pure ability registry. onDeploy marks the zone, each onTick re-acquires every
   * enemy in range and snares them, onExpire fades the marker. Used by the LED
   * Monk's F-skill.
   */
  private deploySnareField(at: THREE.Vector3) {
    if (!this.character) return;
    const base = at.clone();
    base.y = 0;
    const def =
      getAbility("deploy:snareField") ??
      deployAbility("snareField", "nova", 0x86e3a0, { life: 6.0, firstTick: 0.4, interval: 0.8, tail: 0.4 });
    this.abilities.cast(def, {
      onDeploy: () => this.spawnSnareFieldVfx(base, def.color),
      onTick: () => this.pulseSnareField(base, def.color),
      onExpire: () => {
        if (this.disposed) return;
        this.vfx.shockwave(new THREE.Vector3(base.x, 0.05, base.z), def.color, SNARE_FIELD_RADIUS, 0.5);
      },
    });
  }

  /** Mark a freshly deployed snare field with a settling ground ring + aura. */
  private spawnSnareFieldVfx(base: THREE.Vector3, color: number) {
    if (this.disposed) return;
    this.vfx.auraRing(base.clone().setY(0.06), color, SNARE_FIELD_RADIUS, 1.0);
    this.vfx.shockwave(new THREE.Vector3(base.x, 0.06, base.z), color, SNARE_FIELD_RADIUS, 0.6);
  }

  /** One snare pulse: slow + chip every living enemy currently inside the field. */
  private pulseSnareField(base: THREE.Vector3, color: number) {
    if (this.disposed) return;
    // Re-acquire + re-snare every pulse: an enemy that just stepped in is caught,
    // and one that left is released when its (slightly-longer-than-a-pulse) slow
    // times out, so the field keeps exactly whoever is standing in it snared.
    this.targets.slowArea(base, SNARE_FIELD_RADIUS, SNARE_FIELD_SLOW_MUL, SNARE_FIELD_SLOW_SECONDS);
    this.targets.blast(base, SNARE_FIELD_RADIUS, SNARE_FIELD_CHIP_DAMAGE, this.params.skillForce * 0.15);
    // Telegraph the pulse: a quick ground ring + a few rising motes.
    this.vfx.shockwave(new THREE.Vector3(base.x, 0.06, base.z), color, SNARE_FIELD_RADIUS * 0.9, 0.4);
    this.vfx.burst(base.clone().setY(0.3), color, 14, SNARE_FIELD_RADIUS);
  }

  /**
   * Aerial crash-down. From the air, lunge toward the soft-locked enemy then drop
   * hard; the on-land hook (consumeSlamLanded) detonates a ground explosion that
   * knocks nearby enemies UP and OUT. Returns false if a slam is already pending
   * so callers can fall through to the normal grounded attack.
   */
  private groundSlam(): boolean {
    if (!this.character || !this.controller) return false;
    // Mutually exclusive with the aerial dagger overhead so two airborne attacks
    // can never both resolve from one jump.
    if (this.slamPending || this.aerialSlashPending) return false;
    this.slamPending = true;
    this.slamPendingTimer = 1.5;
    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(aim, origin, picked, cfg.steer);
    if (picked && picked.dist > 1.0) {
      const close = THREE.MathUtils.clamp(picked.dist - 1.0, 0, this.params.dashDistance * 1.5);
      if (close > 0.2) this.controller.dash(dir, close, 0.18, 0, 0.6);
    }
    this.controller.faceToward(dir, 0.3);
    if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.08);
    this.controller.slamDown(28);
    return true;
  }

  /**
   * Ground explosion fired the instant a slam touches down: layered shockwaves +
   * spark burst + themed explosion, plus a force wave that deals heavy radial
   * damage (blast-back) and pops every nearby enemy upward (knock-up).
   */
  private doSlamImpact() {
    if (!this.character) return;
    const chi = this.fireThemeApplied === "chi";
    const color = chi ? 0x7fd0ff : 0xffb24d;
    const p = this.character.root.position.clone();
    const ground = new THREE.Vector3(p.x, 0.05, p.z);
    const radius = 4.2;
    this.vfx.aoeBlast(p.clone().add(new THREE.Vector3(0, 0.4, 0)), color, radius);
    this.vfx.shockwave(ground, color, radius * 1.4, 0.7);
    this.vfx.shockwave(ground, 0xffffff, radius * 0.7, 0.4);
    this.vfx.burst(p.clone().add(new THREE.Vector3(0, 0.3, 0)), color, 60, radius * 2);
    this.vfx.impactExplode(p, this.fireThemeApplied);
    // Force wave: heavy radial damage + knock-up across the blast radius.
    this.sparringBlast(p, radius, 30, this.params.skillForce * 1.6);
    this.targets.launch(p, radius, 0, 9);
    this.hitBags(p, radius, this.params.skillForce * 1.6, 30);
    this.netStrike(p, radius, 30);
  }

  /**
   * Arm one hotbar slot only (Albion-style). Never touches other slots or F-skill CD.
   */
  private armSigSlot(idx: number, cd: number, staminaCost = 16) {
    if (idx < 0 || idx > 3) return;
    this.sigCooldowns[idx] = cd;
    this.sigCooldownMaxes[idx] = cd;
    this.stamina = Math.max(0, this.stamina - staminaCost);
  }

  /** Refresh combat context for state-dependent skills / clips. */
  private refreshCombatContext() {
    const cs = this.controller?.state;
    const pState = this.sparring?.getPlayerState?.() ?? "idle";
    let enemyAttacking = false;
    let enemyVulnerable = false;
    try {
      const ecv = this.targets.focusedCombatView?.(
        this.character?.root.position ?? new THREE.Vector3(),
      );
      if (ecv) {
        const st = String(ecv.state ?? "");
        enemyAttacking = st === "windup" || st === "attack" || st === "active";
        enemyVulnerable =
          st === "stunned" || st === "fallen" || st === "stagger" || st === "recover";
      }
    } catch {
      /* optional */
    }
    this.combatCtx = {
      airborne: cs ? !cs.grounded : false,
      grounded: cs?.grounded ?? true,
      hovering: this.controller?.isHovering ?? false,
      playerState: String(pState),
      blocking: this.blocking,
      afterDamageT: this.afterDamageT,
      tumbleT: this.tumbleT > 0 ? this.tumbleT : this.tumbleActive ? 0.5 : 0,
      lastComboStage: this.lastComboStage,
      lastSkillSlot: this.skillChainSlot,
      skillPart: this.skillChainPart,
      skillPartWindow: this.skillChainWindow,
      enemyAttacking,
      enemyVulnerable,
    };
  }

  /**
   * Multi-part skill (2–3 stages). Returns true if a multi-part skill handled
   * this press. Arms full CD only when the chain ends (last part or window).
   */
  private tryMultiPartSkill(slot: number): boolean {
    const skill = multiPartFor(this.weaponId, slot);
    if (!skill || !this.character || !this.controller) return false;

    this.refreshCombatContext();
    const partIdx = nextSkillPart(
      skill,
      this.skillChainSlot,
      this.skillChainPart,
      this.skillChainWindow,
      slot,
    );
    // If starting fresh but slot on CD, fail
    if (partIdx === 0 && this.sigCooldowns[slot]! > 0 && this.skillChainWindow <= 0) {
      return false;
    }

    const part = partForContext(skill, partIdx, this.combatCtx);
    this.executeSkillPart(part, slot);

    const isLast = partIdx >= skill.parts.length - 1 || part.window <= 0;
    if (isLast) {
      this.armSigSlot(slot, skill.cooldown, 14 + partIdx * 4);
      this.skillChainSlot = -1;
      this.skillChainPart = 0;
      this.skillChainWindow = 0;
    } else {
      this.skillChainSlot = slot;
      this.skillChainPart = partIdx;
      this.skillChainWindow = part.window;
      // Don't arm full CD mid-chain — only a tiny global-less lock via comboLock
      this.comboLock = Math.max(this.comboLock, 0.12);
    }
    const chainTag =
      skill.parts.length > 1
        ? ` ${partIdx + 1}/${skill.parts.length}${isLast ? "" : " ›"}`
        : "";
    this.setCombatFlash(`${part.label.toUpperCase()}${chainTag}`, 0.5);
    return true;
  }

  /** Play state-dependent clip + VFX + hit for one skill part. */
  private executeSkillPart(part: SkillPartDef, slot: number) {
    if (!this.character || !this.controller) return;
    this.refreshCombatContext();

    const clip = pickStateClip(
      part.clips,
      this.combatCtx,
      (n) => this.character!.hasClip(n),
      part.fallbackClips,
    );
    if (clip) {
      if (this.character.playClipCut && (this.combatCtx.airborne || this.combatCtx.hovering)) {
        this.character.playClipCut(clip, { from: 0.12, to: 1, timeScale: 1.45, fade: 0.06 });
      } else {
        this.character.playClipOnce(clip, 0.1);
      }
    }

    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 12;
    if (target) {
      const p = this.toTargetPlanar(target);
      dir = p.dir.clone();
      dist = p.dist;
    }
    this.controller.faceToward(dir, 0.22);

    if (part.dash && part.dash !== 0) {
      const d = dir.clone();
      if (part.dash < 0) d.negate();
      const absDash = Math.abs(part.dash);
      // Short free-flight for big leaps (three-player-controller fly mode, timed)
      const airish =
        absDash >= 2.8 ||
        this.combatCtx.airborne ||
        this.combatCtx.hovering ||
        /leap|fly|soar|sky|hover|dive|air/i.test(clip ?? "");
      if (airish) {
        this.controller.startSkillFlight({
          duration: Math.min(0.7, 0.28 + absDash * 0.055),
          speed: 7 + absDash * 0.75,
          launch: absDash * 0.9,
        });
      } else {
        this.controller.dash(d, absDash, 0.22, 0.05, 0.45);
      }
    }
    if (part.hop) this.controller.hop(part.hop);

    const cast = part.castTime ?? 0;
    const run = () => {
      if (this.disposed || !this.character || !this.controller) return;
      this.runSkillVfx(part.vfx, dir, dist, target?.position ?? null);
      const origin = this.character.root.position.clone().addScaledVector(dir, 1.2);
      origin.y += 1.0;
      const radius = part.radius ?? 1.6;
      const force = this.params.skillForce * (part.forceMul ?? 1);
      this.targets.blast(origin, radius, part.damage, force, this.sparCtx);
      if (part.shieldBreak) this.targets.shieldBreak(origin, radius, 2.5);
      if (part.launch) this.targets.launch(origin, radius, part.damage * 0.3, 7);
      this.vfx.fireAura(origin, 0.75 + part.part * 0.15, this.fireThemeApplied);
    };
    // Beam-only parts: full charge → locked beam session (no re-aim).
    const hasBeam = part.vfx.some((op) => op.op === "beam");
    const onlyBeam =
      hasBeam &&
      part.vfx.every(
        (op) =>
          op.op === "beam" ||
          op.op === "charge" ||
          op.op === "castAura" ||
          op.op === "hexaring",
      );
    if (onlyBeam && cast > 0.02) {
      const base = beamProfileForWeapon(this.weaponId);
      let chargeCol = base.chargeColor;
      let beamLife = base.beamLife;
      let beamLen = base.length;
      for (const op of part.vfx) {
        if (op.op === "charge") chargeCol = op.color;
        if (op.op === "beam") {
          chargeCol = op.color;
          if (op.life != null) beamLife = op.life;
          if (op.length != null) beamLen = op.length;
        }
      }
      this.startBeamCast({
        profileOverride: {
          ...base,
          castTime: cast,
          beamLife,
          length: beamLen,
          color: chargeCol,
          chargeColor: chargeCol,
          damagePerTick: Math.max(8, part.damage * 0.35),
        },
        dir,
      });
      void slot;
      return;
    }

    if (cast > 0.02) {
      // Charge telegraph at muzzle — color from first charge/bolt op if present
      const m = this.muzzleOrigin(dir);
      let chargeCol = 0x9fd8ff;
      for (const op of part.vfx) {
        if (op.op === "charge" || op.op === "bolt" || op.op === "beam") {
          chargeCol = op.color;
          break;
        }
      }
      // Ethereal spin charge when a beam is in the recipe
      if (hasBeam) {
        this.vfx.beamChargeUp(() => this.muzzleOrigin(dir), chargeCol, cast + 0.05);
      } else {
        this.vfx.skillCharge(m, chargeCol, 1 + part.part * 0.25, cast + 0.12);
      }
      this.schedule(cast, run);
    } else {
      run();
    }
    void slot;
  }

  /** Execute a VFX recipe list for a skill part (charge / bolt / beam / …). */
  private runSkillVfx(
    ops: SkillVfxOp[],
    dir: THREE.Vector3,
    dist: number,
    targetPos: THREE.Vector3 | null,
  ) {
    if (!this.character || !this.controller) return;
    const origin = this.muzzleOrigin(dir);
    const aimDir = targetPos
      ? targetPos.clone().sub(origin).setY(0).normalize()
      : dir.clone();
    if (aimDir.lengthSq() < 1e-4) aimDir.copy(dir);

    for (const op of ops) {
      switch (op.op) {
        case "muzzle":
          this.vfx.muzzle(origin, aimDir, op.color ?? 0xfff2a8);
          break;
        case "charge":
          this.vfx.skillCharge(origin, op.color, op.scale ?? 1, 0.4);
          break;
        case "castAura":
          this.vfx.castAura(origin, op.color);
          break;
        case "bolt": {
          const range = op.range ?? Math.min(28, dist + 4);
          const speed = op.speed ?? 48;
          const col = op.color;
          const sc = op.scale ?? 1;
          const onHit = (p: THREE.Vector3) => {
            this.vfx.fireAura(p, 0.85, this.fireThemeApplied);
            this.targets.blast(p, 1.0, 12, this.params.skillForce * 0.5, this.sparCtx);
          };
          if (op.charged) this.vfx.chargedBolt(origin, aimDir, col, speed, range, onHit, sc);
          else this.vfx.bolt(origin, aimDir, col, speed, range, onHit, sc);
          break;
        }
        case "beam": {
          // Multi-part beam: freeze aim at this frame; multi-shader locked beam.
          // Prefer full session when no active cast; otherwise fire locked burst.
          const profile = beamProfileForWeapon(this.weaponId);
          const lockedDir = aimDir.clone().setY(0);
          if (lockedDir.lengthSq() < 1e-4) lockedDir.copy(dir).setY(0);
          lockedDir.normalize();
          const len = op.length ?? profile.length;
          const life = op.life ?? profile.beamLife;
          const radius = profile.radius;
          const origin = this.muzzleOrigin(lockedDir);
          this.vfx.lockedBeam({
            origin,
            dir: lockedDir,
            color: op.color ?? profile.color,
            coreColor: profile.coreColor,
            length: len,
            life,
            radius,
          });
          // Tick line damage + physics on the frozen aim
          const ticks = Math.max(3, Math.ceil(life / Math.max(0.05, profile.tickInterval)));
          for (let i = 0; i < ticks; i++) {
            this.schedule(i * (life / ticks), () => {
              if (this.disposed || !this.character) return;
              this.applyBeamLineTick(
                origin.clone(),
                lockedDir,
                len,
                radius,
                profile.damagePerTick,
                profile.physics,
                profile.knockback,
                profile.knockUp,
                op.color ?? profile.color,
              );
            });
          }
          break;
        }
        case "hexaring":
          this.vfx.hexaring(() => this.muzzleOrigin(this.controller!.forward()), op.color, op.life ?? 0.8);
          break;
        case "fireAura":
          this.vfx.fireAura(origin, op.scale ?? 1, this.fireThemeApplied);
          break;
        case "aoeBlast":
          this.vfx.aoeBlast(origin, op.color, op.radius);
          break;
        case "shockwave":
          this.vfx.shockwave(new THREE.Vector3(origin.x, 0.05, origin.z), op.color, op.radius, 0.45);
          break;
        case "slash": {
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            aimDir.clone().setY(0).normalize(),
          );
          this.vfx.slashArc(origin.clone().setY(1.1), q, op.color);
          break;
        }
        case "afterimage":
          this.vfx.afterimage(
            this.character.root,
            this.character.root.position.clone(),
            aimDir,
            1.5,
            op.color,
            4,
            0.28,
          );
          break;
        case "slashBlaster": {
          const range = op.range ?? Math.min(18, dist + 6);
          this.vfx.castSlashBlasters(origin, aimDir, {
            color: op.color,
            count: op.count ?? 3,
            range,
            onHit: (p) => {
              this.targets.blast(p, 1.4, 18, this.params.skillForce * 0.7, this.sparCtx);
              this.vfx.fireAura(p, 0.9, this.fireThemeApplied);
            },
          });
          break;
        }
        case "popAoE":
          this.vfx.popAoE(origin, op.color, op.radius);
          this.targets.blast(
            origin,
            op.radius,
            22,
            this.params.skillForce * 1.1,
            this.sparCtx,
          );
          break;
        default:
          break;
      }
    }
  }

  /** Trigger the equipped weapon's signature skill (or a character signature). */
  useSkill(signatureIndex?: number) {
    if (!this.character) return false;
    if (this.spectating) return false;
    // Skills only fire in combat mode (Q to return from harvest/build).
    if (this.activityMode !== "combat") {
      this.setCombatFlash(`${MODE_LABEL[this.activityMode]} · LMB tool / hold Tab`, 0.5);
      return false;
    }
    // Piloting the exo-armour: the skill bar fires the mech's bespoke kit
    // (Stomp on F, Plasma Cannon on 1, Grapple Throw on 2) instead of the pilot's.
    if (this.mech.isPiloted) {
      return this.doMechSkill(signatureIndex);
    }
    // Skills are offense too — a blocked/parried/dodged swing taxes them as well,
    // so the defender's counter window can't be skill-cancelled out of.
    if (this.recoverLock > 0) return false;
    const def = getCharacter(this.characterId);
    const isSig = signatureIndex != null;

    // Weapon-combat skill tree gates slots 1–4 (equipped kit still sets anims/VFX).
    if (isSig && !isWeaponSkillSlotUnlocked(signatureIndex!)) {
      this.setCombatFlash("SKILL LOCKED · unlock in P · Skill trees", 0.7);
      return false;
    }

    // ── Albion-style: each of 1–4 has its OWN cooldown. F uses skillCooldown only.
    // Never gate all skills on a single timer (production bug fix).
    // Multi-part chains: same slot may re-press inside window even if CD not armed yet.
    if (isSig) {
      // Mid-chain re-presses stay live even if a partial CD was armed elsewhere.
      const chaining =
        this.skillChainSlot === signatureIndex && this.skillChainWindow > 0;
      if (!chaining && this.sigCooldowns[signatureIndex!]! > 0) return false;
      // Multi-part skill combos (2–3 stages) take priority when defined.
      if (this.tryMultiPartSkill(signatureIndex!)) return true;
    } else if (this.skillCooldown > 0) {
      return false;
    }

    // Striker (pure martial artist): each sig has its own independent cooldown.
    if (def.meleeStyle === "kick") {
      return this.doKickSig(isSig ? signatureIndex! : 0);
    }

    // Pistol: full 1–4 kit (skill 3 = dive kick). Other guns: skill 3 vault.
    // Slot 0 multi-part (charge→fan→beam) is handled by tryMultiPartSkill above.
    // Turret deploys: rifle skill 2 = animated game-ready (medium); hunter skill 4
    // = classic heavy chassis; pistol skill 4 can also drop classic heavy.
    if (isGunWeapon(this.weaponId) && isSig) {
      if (this.weaponId === "pistol") {
        return this.doPistolSig(signatureIndex!, def.kiter ?? {
          kickRange: 2.2,
          clipSize: 5,
          shotDamage: 15,
          blastDamage: 28,
          blastRadius: 2.4,
          kickDamage: 22,
          backstep: 1.6,
        });
      }
      // Shotgun kit: slot 1 multiparts handled above; slot 1 fallback slug;
      // slot 2 vault; slot 3 dragon breath. Rifle/sniper turrets as before.
      if (isShotgunWeapon(this.weaponId)) {
        if (signatureIndex === 1) return this.doShotgunSlug();
        if (signatureIndex === 2) return this.doGunVault();
        if (signatureIndex === 3) return this.doShotgunDragonBreath();
      }
      // Rifle skill 2 (slot 1) — medium animated turret
      if (this.weaponId === "rifle" && signatureIndex === 1) {
        return this.doGunDeployTurret("gameReady");
      }
      // Sniper (hunter-rifle) skill 2 — marked slug
      if (this.weaponId === "hunter-rifle" && signatureIndex === 1) {
        return this.doSniperMarkedShot();
      }
      // Sniper skill 4 + rifle skill 4 — heavy classic turret
      if (
        (this.weaponId === "hunter-rifle" || this.weaponId === "rifle") &&
        signatureIndex === 3
      ) {
        return this.doGunDeployTurret("classic");
      }
      if (signatureIndex === 2) return this.doGunVault();
    }
    // Heavy Crossbow skill kit (Albion-style shotgun / trap / barrage).
    // Slot 0 multi-part handled above; 1–3 stay bespoke.
    if (isCrossbowWeapon(this.weaponId) && isSig) {
      return this.doCrossbowSig(signatureIndex!);
    }

    // Arcane Staff "Soulbinder": four bespoke soul/void signature skills, each
    // with its own independent cooldown — bypass the shared skillCooldown gate
    // like the kick + kiter kits do.
    if (def.arcane && this.weaponId === "staff" && isSig) {
      return this.doArcaneSig(signatureIndex!, def.arcane);
    }

    // Gunblade "Tank" (Centurion): four bespoke shield/cannon signature skills,
    // each with its own independent cooldown — bypass the shared skillCooldown
    // gate like the kick / kiter / arcane kits do.
    if (def.tank && this.weaponId === "gunblade" && isSig) {
      return this.doTankSig(signatureIndex!, def.tank);
    }

    // Flanged Mace signature (slot 4): throw → stun → recall, or a dash-recall
    // gap-closer on a re-press while the mace is out. Mace-only; other weapons'
    // slot 4 is unchanged. Bypasses the shared skillCooldown gate — it uses its
    // own per-slot cooldown like the bespoke kits.
    if (this.weaponId === "mace" && isSig && signatureIndex === 3) {
      return this.doMaceThrow();
    }

    // Arcane Staff "Soulbinder": the F key (no signature slot) channels a chained
    // "Hot Hands" fire spell-combo with its own combo lock — bypass the shared
    // skillCooldown gate like the sig kits do.
    if (def.arcane && this.weaponId === "staff" && !isSig) {
      return this.doFireCombo();
    }

    // Ice Staff tank-mage kit (no hover float): 1 spline, 2 wall, 3 frost shell,
    // 4 blizzard. Independent per-slot CDs — same pattern as Soulbinder / Tank.
    if (this.isIceStaff() && isSig) {
      return this.doIceSig(signatureIndex!);
    }

    // Staff ranged AOE kit (every staff EXCEPT Arcane Soulbinder + Ice Staff):
    // slot 1 = locked beam cast; slot 2 scatter; slot 3 nova.
    // F key (no sig) = locked multi-shader beam (charge → line damage).
    if (
      this.isStaffEquipped() &&
      !(def.arcane && this.weaponId === "staff") &&
      !this.isIceStaff()
    ) {
      if (!isSig) return this.doStaffBeamCast();
      if (isSig && signatureIndex === 0) return this.doStaffBeamCast(0);
      if (isSig && signatureIndex === 1) return this.doStaffScatter();
      if (isSig && signatureIndex === 2) return this.doStaffNova();
    }

    // Wand / tome: beam cast as primary skill path (2H casting VFX).
    if ((this.weaponId === "wand" || this.weaponId === "tome") && !isSig) {
      return this.doStaffBeamCast();
    }
    if ((this.weaponId === "wand" || this.weaponId === "tome") && isSig && signatureIndex === 0) {
      return this.doStaffBeamCast(0);
    }

    // Elemental Staff: per-slot CD when signature; F-skill uses skillCooldown only.
    // Laser-themed elements route through locked beam instead of tracking cast.
    {
      const wElement = getWeapon(this.weaponId).element;
      if (wElement && !(this.isIceStaff() && isSig)) {
        const theme = ELEMENT_THEME[wElement];
        if (theme.projectile === "laser" || wElement === "storm" || wElement === "fire") {
          // Beam cast with element tint (storm launch / fire explode profiles)
          return this.doStaffBeamCast(isSig ? signatureIndex! : undefined);
        }
        return this.doElementalCast(wElement, isSig ? signatureIndex! : undefined);
      }
    }

    const slot: ActionSlot = isSig ? (`sig${signatureIndex! + 1}` as ActionSlot) : "fskill";
    const override = this.overrides[slot];

    const fwd = this.facing();
    const origin = this.character.root.position.clone();
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.character.root.rotation.y, 0));

    // Signature slot (1-4): T0 weapon kit — **per-slot cooldown only** (not global).
    if (isSig) {
      // Slot 1 on bows = primary projectile (no extra skill CD — fire rate uses comboLock).
      if (signatureIndex === 0 && this.isProjectileRangedWeapon(this.weaponId) && !isGunWeapon(this.weaponId) && !isCrossbowWeapon(this.weaponId)) {
        this.doRangedPrimaryShot();
        return true;
      }
      // uMMORPG SPEAR: dedicated charge / lunge / vault gap-close path
      if (isSpearWeapon(this.weaponId)) {
        return this.doSpearSignature(signatureIndex!, override ?? null);
      }
      // Heavy 2H: greataxe / hammer2h / greatsword (Madarame + annihilate GS dash)
      if (isHeavy2hWeapon(this.weaponId)) {
        return this.doHeavy2hSignature(signatureIndex!, override ?? null);
      }
      const t0 = getT0Skill(this.weaponId, signatureIndex!);
      const sig = def.signatureSkills[signatureIndex!];
      const clip = override ?? sig?.clip;
      // Nothing assigned to this slot and no native signature — no-op.
      if (!clip && !sig && !t0) return false;
      const dur = clip && this.character.hasClip(clip) ? this.character.playClipOnce(clip, 0.12) : 0;
      const kind = t0?.kind ?? sig?.kind ?? "slash";
      const mode = t0?.mode ?? sig?.mode;
      // Motion-math: +MM gap-close toward aim, −MM kite/backstep (ref sheet 2).
      const mm = t0?.mm ?? 0;
      if (this.controller && Math.abs(mm) >= 20) {
        const dist = Math.abs(mmToMeters(mm)) * 0.9;
        const dir = fwd.clone();
        if (mm < 0) dir.negate();
        this.controller.dash(dir, dist, 0.22, dist * 0.15, 0.45);
      }
      if (mode === "dash") {
        this.doDashSkill(kind, origin, fwd, dur);
      } else {
        const aimed =
          kind === "fireDragon" ||
          kind === "meteor" ||
          kind === "darkBlades" ||
          kind === "swordVolley" ||
          kind === "soul" ||
          kind === "laser";
        const picked = aimed ? this.pickTargetInFront(origin, fwd, 22, -0.2) : null;
        const pose = this.colliderPose() ?? undefined;
        if (aimed) {
          const def2: AbilityDef =
            kind === "fireDragon"
              ? getAbility("fireDragonSig") ?? vfxSkill(kind, SKILL_COLOR[kind], { target: "aimed", travel: "dragon", maxFlight: 3 })
              : vfxSkill(kind, SKILL_COLOR[kind], {
                  target: "aimed",
                  ...(kind === "darkBlades" ? { travel: "darkBlades" as const, maxFlight: 3 } : {}),
                });
          this.abilities.cast(def2, {
            onCast: () => this.vfx.playSkill(kind, origin, fwd, quat, picked?.position, undefined, pose),
          });
        } else {
          this.vfx.playSkill(kind, origin, fwd, quat, picked?.position, undefined, pose);
        }
      }
      // Per-slot only — never skillCooldown (that was locking the whole bar).
      const cd = Math.max(0.8, t0?.cooldown ?? 1.6);
      this.armSigSlot(signatureIndex!, cd, 16);
      return true;
    }

    // Deployable-gadget F-skill: a character can bind a persistent autonomous
    // entity (snare field, etc.) to the F key — dropped at the caster's feet
    // instead of the weapon swing, unless a slot override wins. Like the turret
    // it is a real deployed entity, routed through the ability lifecycle's deploy
    // phase rather than the cosmetic-only Vfx path.
    if (def.gadget && !override) {
      if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);
      if (def.gadget === "snareField") {
        // Aim it where the casting hand POINTS (ground-projected) when the rig is
        // collider-bound, else flat body facing — matching the turret deploy — and
        // stand it a fixed distance ahead so it never drops on top of the caster.
        const pose = this.colliderPose();
        const ground = (pose ? pose.aim : fwd).clone().setY(0);
        if (ground.lengthSq() < 1e-4) ground.set(0, 0, 1);
        ground.normalize();
        const baseAt = origin.clone().addScaledVector(ground, 2.2);
        this.deploySnareField(baseAt);
      }
      this.skillCooldownMax = SNARE_FIELD_COOLDOWN;
      this.skillCooldown = this.skillCooldownMax;
      this.stamina = Math.max(0, this.stamina - 18);
      return true;
    }

    // Caster F-skill: a character can bind its 5th spell (no signature slot) to
    // the F key — cast it directly (no weapon swing), unless an override wins.
    if (def.fskillKind && !override) {
      if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);
      if (def.fskillKind === "turret") {
        // The turret is a real deployed entity (it shoots enemies), so route it
        // through the Studio rather than the cosmetic-only Vfx muzzle flash.
        // Collider-bound (opt-in): aim it where the casting hand POINTS
        // (ground-projected) so it matches the Skill Lab; else flat body facing.
        // We keep the original standing distance (2.2m ahead of the body) so
        // gameplay balance is preserved — only the deploy DIRECTION follows the
        // hand. Anchoring on the hand's own ground position could drop the turret
        // on top of the caster, so we project from the body along the hand aim.
        const pose = this.colliderPose();
        const ground = (pose ? pose.aim : fwd).clone().setY(0);
        if (ground.lengthSq() < 1e-4) ground.set(0, 0, 1);
        ground.normalize();
        const baseAt = origin.clone().addScaledVector(ground, 2.2);
        this.deployTurret(baseAt, ground);
        this.skillCooldownMax = 8;
      } else {
        // Data-driven path: a caster F-skill is a pure-VFX instant cast (the
        // spell visuals are owned by the Vfx subsystem). Routed through the
        // orchestrator so it shares the lifecycle + cancelAll teardown; playSkill
        // fires synchronously inside cast(), identical to the inline call.
        const fk = def.fskillKind;
        this.abilities.cast(vfxSkill(fk, SKILL_COLOR[fk]), {
          onCast: () => this.vfx.playSkill(fk, origin, fwd, quat, undefined, undefined, this.colliderPose() ?? undefined),
        });
        this.skillCooldownMax = 2.2;
      }
      this.skillCooldown = this.skillCooldownMax;
      this.stamina = Math.max(0, this.stamina - 18);
      return true;
    }

    // F skill — weapon skill, or an assigned clip overriding the default swing.
    const w = getWeapon(this.weaponId);
    // USER-DIRECTED bow special: its F-skill is a quick lunging melee SLASH that
    // SLOWS whatever it hits (a faster variant of the greatsword slide-attack).
    // Unlike the generic VFX-only F-skill it lunges, lands a real hit and applies
    // a movement-slow debuff at the strike point. An assigned override still wins.
    if (this.weaponId === "bow" && !override) {
      return this.doBowSlash(origin, fwd, quat);
    }
    // Javelin: the F-skill THROWS a real javelin projectile (additive trail) that
    // deals impact damage where it lands — instead of the generic VFX-only cast.
    if (this.weaponId === "javelin" && !override) {
      return this.doJavelinThrow(origin, fwd);
    }
    // 2H cast / scythe / laser-kind weapons: locked multi-shader beam (charge → line).
    if (
      !override &&
      (this.weaponId === "scythe" ||
        w.kind === "laser" ||
        w.kind === "soul" ||
        (isHeavy2hWeapon(this.weaponId) && w.kind === "nova"))
    ) {
      return this.doStaffBeamCast();
    }
    // Dual Weapon Combo F-skill — sword+dagger, dual daggers, 2H melee skills.
    if (!override && this.canUseDualWeaponCombo(this.weaponId)) {
      return this.doDualWeaponComboSkill();
    }
    if (override && this.character.hasClip(override)) this.character.playClipOnce(override, 0.1);
    else if (this.character.hasClip("skill")) this.character.playClipOnce("skill", 0.1);
    else if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);
    // Data-driven path: the generic weapon F-skill is a pure-VFX instant cast,
    // routed through the orchestrator (shared lifecycle + cancelAll teardown).
    // playSkill fires synchronously inside cast(), identical to the inline call.
    this.abilities.cast(vfxSkill(w.kind, SKILL_COLOR[w.kind]), {
      onCast: () => this.vfx.playSkill(w.kind, origin, fwd, quat, undefined, undefined, this.colliderPose() ?? undefined),
    });
    this.skillCooldownMax = w.cooldown;
    this.skillCooldown = w.cooldown;
    this.stamina = Math.max(0, this.stamina - 15);
    return true;
  }

  /**
   * Weapons that play Dual Weapon Combo.fbx as F skill:
   * dual daggers, sword+dagger, and two-handed melee skills.
   */
  private canUseDualWeaponCombo(weaponId: WeaponId): boolean {
    return (
      weaponId === "dagger" ||
      weaponId === "sword" ||
      weaponId === "greatsword" ||
      weaponId === "greataxe" ||
      weaponId === "hammer2h" ||
      isHeavy2hWeapon(weaponId)
    );
  }

  /**
   * F-skill: Dual Weapon Combo flurry — plays dualWeaponCombo/skill clip with
   * multi-hit slash VFX + blast. Used by daggers, sword+dagger, and 2H kits.
   */
  private doDualWeaponComboSkill(): boolean {
    if (!this.character || !this.controller) return false;
    if (this.skillCooldown > 0) return false;
    const combat = weaponCombat(this.weaponId);
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const target = this.pickCrosshairTarget(combat);
    let dir = fwd.clone();
    if (target) {
      const p = this.toTargetPlanar(target);
      dir = p.dir.clone();
    }
    this.controller.faceToward(dir, 0.22);

    // Prefer dualWeaponCombo → skill → attack
    let dur = 0;
    if (this.character.hasClip("dualWeaponCombo")) {
      dur = this.character.playClipOnce("dualWeaponCombo", 0.1);
    } else if (this.character.hasClip("skill")) {
      dur = this.character.playClipOnce("skill", 0.1);
    } else if (this.character.hasRole("attack")) {
      dur = this.character.playRoleOnce("attack", 0.1);
    }
    if (dur <= 0) dur = 0.85;

    const color = 0xffd080;
    this.vfx.afterimage(this.character.root, origin, dir, 1.4, color, 6, 0.28);
    this.vfx.dashStreak(
      origin.clone().setY(0.2),
      origin.clone().addScaledVector(dir, 1.6).setY(0.2),
      color,
    );
    // Short advance into the flurry
    this.controller.dash(dir, 1.35, Math.min(0.35, dur * 0.4), 0.05, 0.45);

    // Multi-hit along the combo (3 ticks)
    const hits = 3;
    const dmg = Math.round(18 + combat.intensity * 0.35);
    for (let i = 0; i < hits; i++) {
      const t = dur * (0.28 + i * 0.22);
      this.schedule(t, () => {
        if (this.disposed || !this.character) return;
        const pos = this.character.root.position.clone().addScaledVector(dir, 1.1);
        pos.y += 1.0;
        this.vfx.slashArc(pos, this.character.root.quaternion, color);
        this.vfx.impact(pos, color, 1.4);
        this.targets.blast(pos, 1.8, dmg, this.params.skillForce * 0.9, this.sparCtx);
        if (i === hits - 1) {
          this.vfx.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), color, 2.2, 0.4);
          this.targets.shieldBreak(pos, 2.0, 1.4);
        }
      });
    }
    this.sfx?.play("whooshHeavy", origin, { volume: 0.75, rate: 1.05 });
    this.setCombatFlash("DUAL WEAPON COMBO", 0.55);
    this.skillCooldownMax = Math.max(getWeapon(this.weaponId).cooldown, 1.4);
    this.skillCooldown = this.skillCooldownMax;
    this.stamina = Math.max(0, this.stamina - 16);
    this.bumpMusicHeat(0.35);
    return true;
  }

  /**
   * Opt-in (`CharacterDef.colliderVfx`): derive the swinging hand's world frame
   * so combat skill VFX emit from the hand (position + 3D angle), matching the
   * Dressing Room Skill Lab's `slashFromCollider` preview. Returns null — i.e.
   * unchanged flat-facing behavior — when the flag is off or no hand is present.
   *
   * The aim direction is taken from the hand's ORIENTATION, not its displacement:
   * each local axis is projected through the hand quaternion and the one pointing
   * most outward from the chest is chosen, so rotating the hand in place re-aims
   * the cast (mirrors EditorScene.playVfx). The chest->hand vector only
   * disambiguates which axis/sign reads as "forward" (bone conventions vary).
   */
  private colliderPose(): { pos: THREE.Vector3; quat: THREE.Quaternion; aim: THREE.Vector3 } | null {
    if (!this.character) return null;
    if (!getCharacter(this.characterId).colliderVfx) return null;
    const hand = this.character.rightHand;
    if (!hand) return null;
    hand.updateWorldMatrix(true, false);
    const pos = hand.getWorldPosition(new THREE.Vector3());
    const quat = hand.getWorldQuaternion(new THREE.Quaternion());
    const chest = this.character.root.position.clone();
    chest.y += 1.0;
    const ref = pos.clone().sub(chest);
    if (ref.lengthSq() > 1e-5) ref.normalize();
    else ref.copy(this.facing());
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];
    const aim = new THREE.Vector3();
    let bestDot = -Infinity;
    for (const ax of axes) {
      ax.applyQuaternion(quat);
      const d = ax.dot(ref);
      if (d > bestDot) {
        bestDot = d;
        aim.copy(ax);
      }
    }
    aim.normalize();
    return { pos, quat, aim };
  }

  /**
   * Heavy 2H signature (greataxe / hammer2h / greatsword).
   * Madarame clips with per-weapon MM/intensity; greatsword uses annihilate-style
   * slide dash + slash blasters + Pop AoE.
   */
  private doHeavy2hSignature(slotIndex: number, clipOverride: string | null): boolean {
    if (!this.character || !this.controller) return false;
    const profile = heavyProfile(this.weaponId);
    if (!profile) return false;
    const rows = heavySignatureRows(this.weaponId);
    const row = rows[Math.max(0, Math.min(3, slotIndex))];
    if (!row) return false;

    // Skill 3 — Fire Tornado (harvest cast → ground-skimming AoE path)
    if (row.skillId === "fire_tornado" || row.kind === "fireTornado" || slotIndex === 2) {
      return this.doHeavy2hFireTornado(slotIndex, row, profile, clipOverride);
    }

    // Prefer multi-part chains when defined (jump / slide / aoe)
    if (this.tryMultiPartSkill(slotIndex)) return true;

    const clipName = clipOverride || row.clip;
    let dur = 0;
    if (this.character.hasClip(clipName)) {
      dur = this.character.playClipOnce(clipName, 0.1);
    } else if (this.character.hasClip("attack")) {
      dur = this.character.playClipOnce("attack", 0.1);
    }

    // Playback intensity — slower = heavier
    if (dur > 0 && profile.timeScale !== 1 && this.character.setOverdrive) {
      // no-op if not GrudgeAvatar; Character uses clip timeScale elsewhere
    }

    const fwd = this.facing();
    const origin = this.character.root.position.clone();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange + 4, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.2);

    const dashM =
      row.dashM ??
      Math.abs(row.mm) * MM_TO_M * profile.mmScale * profile.skillDashMul;
    const isDash = row.mode === "dash" || dashM >= 1.0;
    const isJump = /jump/i.test(row.label) || /jump/i.test(clipName);
    const isSlide = /slide|dash/i.test(row.label);
    const isAoe = row.kind === "nova" || /aoe|whirl|apocalypse|cataclysm/i.test(row.label);

    const muzzle = this.muzzleOrigin(dir);
    this.vfx.skillCharge(muzzle, profile.color, 1.15, 0.2);

    if (isJump) {
      this.controller.hop?.(0.9);
    }

    const runImpact = () => {
      if (this.disposed || !this.character || !this.controller) return;
      const pos = this.character.root.position.clone();
      const strike = pos.clone().addScaledVector(dir, 1.5);
      strike.y += 1.0;
      const radius = (isAoe ? 3.2 : 2.2) * profile.aoeMul;
      const dmg = (row.damage ?? 45) * profile.intensity;
      this.targets.blast(strike, radius, dmg, this.params.skillForce * profile.intensity, this.sparCtx);
      if (row.blasters || profile.slashProjectiles) {
        this.vfx.castSlashBlasters(muzzle, dir, {
          color: profile.color,
          count: profile.blasterCount,
          range: isSlide ? 16 : 12,
          onHit: (p) => {
            this.targets.blast(p, 1.5, dmg * 0.45, this.params.skillForce * 0.8, this.sparCtx);
          },
        });
      }
      if (isAoe) {
        this.vfx.popAoE(strike, profile.color, radius);
      }
      this.vfx.playSkill(row.kind, pos, dir, this.character.root.quaternion, picked?.position ?? null);
      this.setCombatFlash(row.label.toUpperCase(), 0.45);
    };

    if (isDash && dashM >= 0.8) {
      let dist = dashM;
      if (picked) dist = THREE.MathUtils.clamp(picked.dist - 1.1, 1.0, dashM);
      const endpoint = origin.clone().addScaledVector(dir, dist);
      const dashDur = isSlide ? 0.38 : 0.3;
      this.controller.dash(dir, dist, dashDur, dist * 0.08, 0.5);
      this.vfx.dashStreak(origin, endpoint, profile.color);
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(dist, 1.2), profile.color, 6, 0.4);
      this.schedule(dashDur * 0.5, runImpact);
    } else {
      if (dashM > 0.2) this.controller.dash(dir, dashM, 0.2, dashM * 0.12, 0.45);
      this.schedule(0.12, runImpact);
    }

    this.armSigSlot(slotIndex, Math.max(0.9, row.cooldown), 12);
    void dur;
    return true;
  }

  /**
   * 2H skill 3 — Fire Tornado.
   * Cast anim: harvest (dig-and-plant-seeds). Projectile: stylized fire tornado
   * launched from weapon toward target, ground contact, ~2 m tall, AoE along path.
   */
  private doHeavy2hFireTornado(
    slotIndex: number,
    row: ReturnType<typeof heavySignatureRows>[number],
    profile: NonNullable<ReturnType<typeof heavyProfile>>,
    clipOverride: string | null,
  ): boolean {
    if (!this.character || !this.controller) return false;

    // Harvest cast animation (farming dig-and-plant) with fuzzy + melee fallbacks
    const harvestClips = [
      clipOverride,
      row.clip,
      "harvest",
      "dig-and-plant-seeds",
      "DigAndPlantSeeds",
      "castSpell",
      "magicArea",
      "attack",
    ].filter(Boolean) as string[];
    let castDur = 0.55;
    let played = false;
    for (const c of harvestClips) {
      if (this.character.hasClip(c)) {
        castDur = Math.max(0.35, this.character.playClipOnce(c, 0.12) || 0.55);
        played = true;
        break;
      }
    }
    if (!played && typeof this.character.clipNames === "function") {
      const fuzzy = this.character
        .clipNames()
        .find((n) => /harvest|dig|plant|farm|water|gather|seed/i.test(n));
      if (fuzzy) {
        castDur = Math.max(0.35, this.character.playClipOnce(fuzzy, 0.12) || 0.55);
        played = true;
      }
    }
    if (!played && this.character.hasClip("attack")) {
      castDur = Math.max(0.35, this.character.playClipOnce("attack", 0.12) || 0.55);
    }

    const fwd = this.facing();
    const origin = this.character.root.position.clone();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange + 8, cfg.minDot * 0.85);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.25);

    const muzzle = this.muzzleOrigin(dir);
    // Weapon glow charge during harvest cast
    this.vfx.skillCharge(muzzle, 0xff5510, 1.35, Math.min(0.45, castDur * 0.55));
    this.setCombatFlash("FIRE TORNADO", 0.55);

    const dmg = (row.damage ?? 50) * profile.intensity;
    const pathRadius = 1.85 * profile.aoeMul;
    const releaseT = Math.min(0.42, castDur * 0.55);

    this.schedule(releaseT, () => {
      if (this.disposed || !this.character) return;
      const launch = this.muzzleOrigin(dir);
      // Drop to ground contact from weapon tip
      const groundLaunch = launch.clone();
      groundLaunch.y = Math.max(0.08, origin.y + 0.05);
      const aimDir = picked
        ? picked.position.clone().sub(groundLaunch).setY(0)
        : dir.clone().setY(0);
      if (aimDir.lengthSq() < 1e-6) aimDir.copy(dir).setY(0);
      aimDir.normalize();

      this.vfx.castFireTornado(groundLaunch, aimDir, {
        color: 0xff5510,
        heightM: 2.0,
        speed: 11,
        range: 14,
        tickEvery: 0.11,
        onPathTick: (p) => {
          // AoE corridor in front of caster along the tornado path
          this.targets.blast(
            p,
            pathRadius,
            dmg * 0.28,
            this.params.skillForce * 0.55 * profile.intensity,
            this.sparCtx,
          );
        },
        onHit: (p) => {
          this.targets.blast(
            p,
            pathRadius * 1.35,
            dmg * 0.85,
            this.params.skillForce * profile.intensity,
            this.sparCtx,
          );
          this.vfx.popAoE(p, 0xff5510, pathRadius * 1.2);
        },
      });
    });

    this.armSigSlot(slotIndex, Math.max(1.0, row.cooldown), 12);
    return true;
  }

  /**
   * uMMORPG SPEAR signature (1–4): Madarame polearm clip + charge/lunge dash +
   * telegraph VFX. Slot map: thrust · piercing lunge · vault charge · dragontail.
   * Gap-closers use Controller.dash with skill-authored distances (3–6.5m).
   */
  private doSpearSignature(slotIndex: number, clipOverride: string | null): boolean {
    if (!this.character || !this.controller) return false;
    const rows = spearSignatureRows();
    const row = rows[Math.max(0, Math.min(3, slotIndex))]!;
    const skill: SpearSkillRuntime | null =
      spearSkillById(row.skillId || null) ||
      ({
        id: row.skillId || `spear_slot_${slotIndex}`,
        name: row.label,
        description: "",
        clip: row.clip,
        kind: row.kind,
        mm: row.mm,
        mode: row.mode || "default",
        motion: row.mode === "dash" ? "charge" : "none",
        dashM: row.dashM ?? Math.abs(mmToMeters(row.mm)),
        dashDur: row.dashDur ?? 0.28,
        castTime: row.castTime ?? 0.12,
        cooldown: row.cooldown,
        damage: row.damage ?? 45,
        range: 4,
        stamina: 6,
        vfxColor: row.vfxColor ?? 0x90d0ff,
        hitWindow: row.hitWindow ?? [0.28, 0.55],
      } as SpearSkillRuntime);

    const clipName = clipOverride || skill.clip || "thrust";
    let dur = 0;
    if (this.character.hasClip(clipName)) {
      dur = this.character.playClipOnce(clipName, 0.1);
    } else if (this.character.hasClip("attack")) {
      dur = this.character.playClipOnce("attack", 0.1);
    } else if (this.character.hasRole?.("attack")) {
      dur = this.character.playRoleOnce?.("attack", 0.1) ?? 0;
    }

    // Grip assist already bound on weapon equip (kit spear mesh / arsenal).
    // isOneShotActive ramps strength during this attack.

    const fwd = this.facing();
    const origin = this.character.root.position.clone();
    const plan = spearChargePlan(skill);
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, Math.max(cfg.acqRange, skill.range + 2), cfg.minDot);
    let dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.2);

    // Charge telegraph at spear tip / hand
    const muzzle = this.muzzleOrigin(dir);
    if (plan.telegraph > 0.05) {
      this.vfx.skillCharge(muzzle, plan.chargeColor, 1.15 + slotIndex * 0.1, plan.telegraph + 0.08);
    }

    const runImpact = () => {
      if (this.disposed || !this.character || !this.controller) return;
      const pos = this.character.root.position.clone();
      const strike = pos.clone().addScaledVector(dir, 1.4);
      strike.y += 1.0;
      const radius =
        skill.motion === "vault" || skill.kind === "nova"
          ? 2.4 + slotIndex * 0.2
          : skill.motion === "throw"
            ? 1.1
            : 1.65;
      const dmg = skill.damage * (0.85 + this.params.skillForce * 0.02);
      this.targets.blast(strike, radius, dmg, this.params.skillForce * 0.9, this.sparCtx);
      this.vfx.playSkill(skill.kind, pos, dir, this.character.root.quaternion, picked?.position ?? null);
      if (skill.motion === "throw" || skill.kind === "bolt") {
        this.vfx.skillCharge(muzzle, plan.chargeColor, 0.8, 0.2);
      }
      this.setCombatFlash(skill.name.toUpperCase(), 0.45);
    };

    if (plan.isGapClose && plan.distance >= 0.8) {
      // Cap dash toward locked target so we don't overshoot
      let dist = plan.distance;
      if (picked) {
        dist = THREE.MathUtils.clamp(picked.dist - 1.15, 0.9, plan.distance);
      }
      const endpoint = origin.clone().addScaledVector(dir, dist);
      this.controller.dash(dir, dist, plan.duration, dist * 0.08, plan.impactAt);
      this.vfx.dashStreak(origin, endpoint, plan.chargeColor);
      this.schedule(Math.max(plan.telegraph, plan.duration * plan.impactAt), runImpact);
    } else if (skill.motion === "throw") {
      // Javelin / phantom — ranged poke with keep-distance backstep optional
      if (skill.mm < -40) {
        this.controller.dash(dir.clone().negate(), 0.45, 0.16, 0, 0.5);
      }
      this.vfx.playSkill("bolt", origin, dir, this.character.root.quaternion, picked?.position ?? null);
      this.schedule(Math.max(0.12, skill.castTime), runImpact);
    } else {
      // Short thrust advance
      if (plan.distance > 0.15) {
        this.controller.dash(dir, plan.distance, plan.duration, plan.distance * 0.12, 0.45);
      }
      this.schedule(Math.max(0.08, skill.castTime), runImpact);
    }

    const cd = Math.max(0.7, skill.cooldown || row.cooldown || 1.5);
    this.armSigSlot(slotIndex, cd, 8 + skill.stamina);
    void dur;
    return true;
  }

  /**
   * A dash signature: ease the body forward (spline motion) while the real skill
   * clip plays, then land an AoE at the strike point. The blast fires on impact
   * (mid-lunge), not when the slide ends, so the hit reads with the animation.
   */
  private doDashSkill(kind: SkillKind, origin: THREE.Vector3, fwd: THREE.Vector3, clipDur = 0) {
    // Apply the character's direction-assist + dash-rating: acquire a target in
    // the assist cone, steer toward it, and scale the lunge distance by rating.
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    const dist = picked
      ? THREE.MathUtils.clamp(picked.dist - 1.0, 0.6, cfg.maxReach)
      : cfg.maxReach;
    // Tie the slide to the real clip so the body and the animation stay in sync.
    const dur = THREE.MathUtils.clamp(clipDur > 0 ? clipDur * 0.5 : 0.42, 0.3, 0.7);
    const impactAt = 0.55;
    const endpoint = origin.clone().addScaledVector(dir, dist);
    endpoint.x = THREE.MathUtils.clamp(endpoint.x, -15, 15);
    endpoint.z = THREE.MathUtils.clamp(endpoint.z, -15, 15);
    const color = SKILL_COLOR[kind];
    this.controller?.dash(dir, dist, dur, 0, impactAt);
    this.vfx.dashStreak(origin, endpoint, color);
    // Data-driven path: the dash/streak/cooldown stay inline; only the delayed
    // AoE blast moves into the orchestrator's impact phase. The wind-up duration
    // is the runtime slide delay, so the impact lands at exactly the same time
    // the legacy `schedule(dur * impactAt, …)` fired (orchestrator.update runs
    // adjacent to updatePending with the same dt). cancelAll covers teardown.
    const base = getAbility("dashSkill");
    const def2: AbilityDef = base
      ? { ...base, kind, color, cast: { ...base.cast, duration: dur * impactAt } }
      : { id: "dashSkill", name: "Dash Skill", kind, color, target: "aimed", cast: { duration: dur * impactAt } };
    this.abilities.cast(def2, {
      onImpact: () => {
        const center = endpoint.clone();
        center.y += 1.0;
        this.vfx.aoeBlast(center, color, this.params.aoeRadius);
        this.sparringBlast(center, this.params.aoeRadius, 45, this.params.skillForce);
      },
    });
  }

  /**
   * USER-DIRECTED bow F-skill: a quick lunging melee SLASH that SLOWS its victim.
   * Plays the slash clip, lunges toward an assist-cone target, and on impact lands
   * a single hit + applies a movement-slow debuff (slower than a full dash skill's
   * AoE, focused on the slow utility). Read as a faster slide-attack slash.
   */
  private doBowSlash(origin: THREE.Vector3, fwd: THREE.Vector3, quat: THREE.Quaternion): boolean {
    if (!this.character) return false;
    const SLASH_CLIP = "animations/sword/great-sword-slide-attack";
    const RADIUS = 2.0;
    const DAMAGE = 22;
    const SLOW_MUL = 0.45; // approach speed cut to 45% while slowed
    const SLOW_SECONDS = 3.0;
    // Play the slash; "quicker" via a slightly faster fade-in than the heavy slide.
    const dur = this.character.hasClip(SLASH_CLIP)
      ? this.character.playClipOnce(SLASH_CLIP, 0.08)
      : this.character.hasRole("attack")
        ? this.character.playRoleOnce("attack", 0.08)
        : 0.4;
    // Lunge toward an assist-cone target (mirrors doDashSkill's steering).
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    const dist = picked
      ? THREE.MathUtils.clamp(picked.dist - 1.0, 0.6, cfg.maxReach)
      : Math.min(cfg.maxReach, 3.5);
    const slideDur = THREE.MathUtils.clamp(dur > 0 ? dur * 0.45 : 0.34, 0.24, 0.55);
    const impactAt = 0.55;
    const endpoint = origin.clone().addScaledVector(dir, dist);
    endpoint.x = THREE.MathUtils.clamp(endpoint.x, -15, 15);
    endpoint.z = THREE.MathUtils.clamp(endpoint.z, -15, 15);
    const color = SKILL_COLOR.slash;
    this.controller?.dash(dir, dist, slideDur, 0, impactAt);
    this.vfx.dashStreak(origin, endpoint, color);
    // Data-driven path (proof migration): the orchestrator owns the wind-up →
    // impact lifecycle. The cast clip + lunge + streak fire here (the cast phase,
    // already played above), and the impact phase lands the hit + slow debuff at
    // the same delay the legacy `schedule(slideDur * impactAt, …)` used.
    const base = getAbility("bowSlash");
    const def2: AbilityDef = base
      ? { ...base, cast: { ...base.cast, duration: slideDur * impactAt } }
      : { id: "bowSlash", name: "Bow Slash", kind: "slash", color, target: "aimed", cast: { duration: slideDur * impactAt } };
    this.abilities.cast(def2, {
      onImpact: () => {
        const center = endpoint.clone();
        center.y += 1.0;
        this.vfx.playSkill("slash", center, fwd, quat);
        this.sparringBlast(center, RADIUS, DAMAGE, this.params.skillForce);
        this.targets.slowArea(center, RADIUS, SLOW_MUL, SLOW_SECONDS);
      },
    });
    this.skillCooldownMax = Math.max(getWeapon(this.weaponId).cooldown, 1.2);
    this.skillCooldown = this.skillCooldownMax;
    this.stamina = Math.max(0, this.stamina - 15);
    return true;
  }

  /**
   * Javelin F-skill: hurl the javelin as a real projectile toward an assist-cone
   * target (or straight ahead). The thrown javelin.glb flies with an additive
   * trail and lands a sharp single-point blast where it impacts.
   */
  private doJavelinThrow(origin: THREE.Vector3, fwd: THREE.Vector3): boolean {
    if (!this.character) return false;
    const DAMAGE = 32;
    const RADIUS = 1.5;
    // Wind-up/release pose: the dedicated throw clip if present, else the generic
    // attack role (both no-op cleanly on rigs lacking either).
    if (this.character.hasClip("throw")) this.character.playClipOnce("throw", 0.1);
    else if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);
    // Lead toward an assist-cone target so the throw tracks an enemy in front.
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    // Launch from the throwing hand (chest height) along the aim line.
    const from = origin.clone();
    from.y += 1.2;
    const color = SKILL_COLOR[getWeapon(this.weaponId).kind] ?? 0x9fe8ff;
    this.vfx.castJavelin(from, dir, color, (p) => {
      this.sparringBlast(p, RADIUS, DAMAGE, this.params.skillForce);
    });
    this.skillCooldownMax = Math.max(getWeapon(this.weaponId).cooldown, 1.2);
    this.skillCooldown = this.skillCooldownMax;
    this.stamina = Math.max(0, this.stamina - 15);
    return true;
  }

  // ----------------------------------------------------------- Simplified guns

  /** Poll F-hold for charge/reload and tick gun timers. */
  private updateGunInput(dt: number) {
    if (!isGunWeapon(this.weaponId)) {
      this.fKeyDown = false;
      this.fHoldAccum = 0;
      this.gunCharging = false;
      return;
    }
    if (this.gunReloadT > 0) this.gunReloadT = Math.max(0, this.gunReloadT - dt);
    if (this.gunFireLock > 0) this.gunFireLock = Math.max(0, this.gunFireLock - dt);

    const held = this.input.down("KeyF");
    const load = gunLoadout(this.weaponId);
    if (!load) return;

    if (held) {
      this.fKeyDown = true;
      this.fHoldAccum += dt;
      if (this.fHoldAccum >= load.chargeTime * 0.3) {
        this.gunCharging = true;
        // Plasma charge build-up on the barrel (skill fire-aura language)
        if (this.controller && Math.floor(this.fHoldAccum * 12) !== Math.floor((this.fHoldAccum - dt) * 12)) {
          const dir = this.controller.forward();
          const m = this.muzzleOrigin(dir);
          this.vfx.burst(m, load.plasmaColor, 5, 1.4);
          this.vfx.castAura(m, load.plasmaColor);
        }
      }
    } else if (this.fKeyDown) {
      this.handleKeyUp("KeyF");
    }
  }

  /**
   * Play the shooting animation on every shot occurrence.
   * Moving + grounded → upper-body overlay (legs keep strafe/walk/run);
   * standing / air → full-body chargedShot cut timed to the bullet release.
   */
  private playGunShootAnim(releaseLead = 0.06): number {
    if (!this.character || !this.controller) return 0;
    const names = ["chargedShot", "attack", "rangedAttack", "shoot"];
    let name: string | null = null;
    for (const n of names) {
      if (this.character.hasClip(n)) {
        name = n;
        break;
      }
    }
    if (!name) {
      if (this.character.hasRole("attack")) return this.character.playRoleOnce("attack", 0.08);
      return 0;
    }
    const cs = this.controller.state;
    const moving = cs.grounded && cs.speed > 0.25;
    if (moving && this.character.playClipOverlay) {
      const dur = this.character.playClipOverlay(name, Math.min(1, 0.55 + cs.speed * 0.08));
      if (dur > 0) return dur;
    }
    if (this.character.playClipCut) {
      const dur = this.character.playClipCut(name, {
        from: releaseLead,
        to: 1,
        timeScale: 1.55,
        fade: 0.05,
      });
      if (dur > 0) return dur;
    }
    return this.character.playClipOnce(name, 0.08);
  }

  /**
   * Shotgun LMB — spend one shell, fan pellets in a cone. Close-range bonus.
   * Anim leads pellet release for production gun feel.
   */
  private doShotgunPrimary(load: GunLoadout) {
    if (!this.character || !this.controller) return;
    const combat = weaponCombat("shotgun");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = SHOTGUN.range;
    if (target) {
      const planar = this.toTargetPlanar(target);
      dir = planar.dir.clone();
      dist = planar.dist;
      if (this.locked) this.controller.setLockTarget(target.position);
    }
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    this.controller.faceToward(dir, 0.28);
    this.playGunShootAnim(0.08);

    const close =
      Number.isFinite(dist) && dist < SHOTGUN.closeRange ? SHOTGUN.closeMul : 1;
    const dmg = Math.round(load.damage * close);
    const origin = this.muzzleOrigin(dir);
    this.gunFireLock = load.fireLock;

    this.schedule(0.08, () => {
      if (this.disposed || !this.character || this.gunAmmo <= 0) return;
      this.gunAmmo -= 1;
      this.recoil.kick(0.05, 0.04);
      this.vfx.muzzle(origin, dir, load.color);
      this.vfx.skillCharge(origin, load.color, 0.85, 0.2);
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < SHOTGUN.pellets; i++) {
        const yaw = (Math.random() * 2 - 1) * SHOTGUN.halfAngle;
        const pitch = (Math.random() * 2 - 1) * SHOTGUN.halfAngle * 0.55;
        const pdir = dir
          .clone()
          .applyAxisAngle(up, yaw)
          .applyAxisAngle(dir.clone().cross(up).normalize(), pitch)
          .normalize();
        const range = THREE.MathUtils.clamp(SHOTGUN.range, 4, 12);
        this.vfx.chargedBolt(
          origin.clone(),
          pdir,
          load.color,
          40 + Math.random() * 8,
          range,
          (p) => {
            this.vfx.impact(p, load.color, 0.85);
            this.targets.blast(
              p,
              0.75,
              dmg,
              this.params.skillForce * GUN_SHIELD.hitForceMul * SHOTGUN.forceMul,
              this.sparCtx,
            );
          },
          0.7 + Math.random() * 0.25,
        );
      }
      this.sfx?.play("whooshHeavy", origin, { volume: 0.75, rate: 0.85 });
      // Small pushback on self for weight
      this.controller?.applyImpulse(dir.clone().negate(), 1.2, 0.15, 2);
    });
  }

  /** Shotgun skill 2 — single heavy slug (shield break + launch). */
  private doShotgunSlug(): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    if (this.sigCooldowns[1]! > 0) return false;
    const load = gunLoadout("shotgun");
    if (!load) return false;
    const combat = weaponCombat("shotgun");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 14;
    if (target) {
      const p = this.toTargetPlanar(target);
      dir = p.dir.clone();
      dist = p.dist;
    }
    this.controller.faceToward(dir, 0.22);
    this.playGunShootAnim(0.05);
    const color = load.plasmaColor;
    this.vfx.skillCharge(this.muzzleOrigin(dir), color, 1.25, 0.35);
    this.schedule(0.2, () => {
      if (this.disposed || !this.character) return;
      const origin = this.muzzleOrigin(dir);
      this.vfx.muzzle(origin, dir, color);
      this.vfx.chargedBolt(origin, dir, color, 46, Math.min(16, dist + 2), (p) => {
        this.vfx.aoeBlast(p, color, 1.6);
        this.vfx.fireAura(p, 1.15, this.fireThemeApplied);
        this.targets.blast(p, 1.4, Math.round(load.damage * 4.2), this.params.skillForce * 1.35, this.sparCtx);
        this.targets.shieldBreak(p, 1.6, GUN_SHIELD.utilityBreakSec);
        this.targets.launch(p, 1.5, load.damage, 7);
      }, 1.55);
    });
    this.armSigSlot(1, 6.5, 16);
    this.setCombatFlash("SLUG", 0.45);
    return true;
  }

  /** Shotgun skill 4 — Dragon Breath: wide fire cone + aura. */
  private doShotgunDragonBreath(): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    if (this.sigCooldowns[3]! > 0) return false;
    const load = gunLoadout("shotgun");
    if (!load) return false;
    const dir = this.controller.forward().clone().setY(0).normalize();
    this.controller.faceToward(dir, 0.2);
    this.playGunShootAnim(0.05);
    const color = 0xff5020;
    this.vfx.skillCharge(this.muzzleOrigin(dir), color, 1.45, 0.4);
    this.schedule(0.25, () => {
      if (this.disposed || !this.character || !this.controller) return;
      const origin = this.muzzleOrigin(dir);
      this.vfx.muzzle(origin, dir, color);
      this.vfx.fireAura(origin, 1.3, this.fireThemeApplied);
      // Fan of charged bolts + frontal blast
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = -4; i <= 4; i++) {
        const pdir = dir.clone().applyAxisAngle(up, i * 0.09).normalize();
        this.vfx.chargedBolt(origin.clone(), pdir, color, 32, 7.5, (p) => {
          this.vfx.fireAura(p, 0.9, this.fireThemeApplied);
          this.targets.blast(p, 1.1, Math.round((load.damage || 8) * 1.8), this.params.skillForce * 0.9, this.sparCtx);
        }, 1.1);
      }
      const cone = origin.clone().addScaledVector(dir, 3.2);
      cone.y = origin.y;
      this.vfx.aoeBlast(cone, color, 3.0);
      this.vfx.shockwave(new THREE.Vector3(cone.x, 0.05, cone.z), 0xff7040, 3.2, 0.5);
      this.targets.blast(cone, 3.0, Math.round(load.damage * 3.5), this.params.skillForce * 1.4, this.sparCtx);
      this.targets.shieldBreak(cone, 3.2, GUN_SHIELD.utilityBreakSec);
    });
    this.armSigSlot(3, 11, 22);
    this.setCombatFlash("DRAGON BREATH", 0.6);
    return true;
  }

  /** Sniper skill 2 — marked charged slug. */
  private doSniperMarkedShot(): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    if (this.sigCooldowns[1]! > 0) return false;
    const load = gunLoadout("hunter-rifle");
    if (!load) return false;
    const combat = weaponCombat("hunter-rifle");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 30;
    if (target) {
      const p = this.toTargetPlanar(target);
      dir = p.dir.clone();
      dist = p.dist;
    }
    this.controller.faceToward(dir, 0.25);
    this.playGunShootAnim(0.04);
    const color = load.plasmaColor;
    this.vfx.skillCharge(this.muzzleOrigin(dir), color, 1.3, 0.35);
    this.vfx.hexaring(() => this.muzzleOrigin(dir), color, 0.55);
    this.schedule(0.22, () => {
      if (this.disposed || !this.character) return;
      const origin = this.muzzleOrigin(dir);
      this.vfx.muzzle(origin, dir, color);
      this.vfx.chargedBolt(origin, dir, 0xffe080, 62, Math.min(34, dist + 4), (p) => {
        this.vfx.fireAura(p, 1.2, this.fireThemeApplied);
        this.vfx.impact(p, color, 1.5);
        this.targets.blast(p, 1.1, Math.round(load.damage * 2.2), this.params.skillForce * 0.85, this.sparCtx);
      }, 1.4);
    });
    this.armSigSlot(1, 7, 14);
    this.setCombatFlash("MARKED", 0.45);
    return true;
  }

  /**
   * Deploy a gun-family turret at the player (slightly ahead).
   * skill 2 / medium → gameReady animated; skill 4 / heavy → classic chassis.
   */
  private doGunDeployTurret(variant: TurretVariant): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    const load = gunLoadout(this.weaponId);
    const color = load?.plasmaColor ?? load?.color ?? TURRET_COLOR;
    const heavy = variant === "classic";
    const slot = heavy ? 3 : 1;
    if (this.sigCooldowns[slot]! > 0) return false;

    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    if (target) dir = this.toTargetPlanar(target).dir.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    this.controller.faceToward(dir, 0.2);

    // Deploy cast pose (not a shoot — place gadget)
    if (this.character.hasClip("cast")) this.character.playClipOnce("cast", 0.1);
    else this.playGunShootAnim(0.1);

    const at = this.character.root.position.clone().addScaledVector(dir, 1.4);
    at.y = 0;
    this.vfx.skillCharge(at.clone().setY(0.6), color, heavy ? 1.4 : 1.1, 0.4);
    this.vfx.hexaring(() => at.clone().setY(0.4), color, 0.6);

    this.schedule(0.28, () => {
      if (this.disposed) return;
      this.deployTurret(at, dir, {
        variant,
        color,
        life: heavy ? TURRET_LIFE_HEAVY : TURRET_LIFE_MED,
        damage: heavy ? TURRET_SHOT_DAMAGE_HEAVY : TURRET_SHOT_DAMAGE,
        heavy,
        scale: heavy ? 1.7 : 1.35,
      });
    });

    this.armSigSlot(slot, heavy ? 12 : 8.5, heavy ? 22 : 16);
    this.setCombatFlash(heavy ? "HEAVY TURRET" : "TURRET", 0.55);
    return true;
  }

  /**
   * LMB gun fire — focus steers aim (RMB lock / soft-lock target).
   * Pistol: 1 bullet. Rifle: 3-round burst. Sniper: 1 hard shot.
   * Shotgun: cone pellets. Empty → auto-reload.
   * Every shot plays a shoot anim; bullets release on the attack pose lead.
   */
  private doGunFire() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.recoverLock > 0 || this.gunFireLock > 0 || this.gunReloadT > 0) return;
    const load = gunLoadout(this.weaponId);
    if (!load) return;

    if (this.gunAmmo <= 0) {
      this.sfx?.play("whooshLight", this.character.root.position, { volume: 0.35, rate: 1.6 });
      this.doGunReload();
      return;
    }

    if (isShotgunWeapon(this.weaponId)) {
      this.doShotgunPrimary(load);
      return;
    }

    const combat = weaponCombat(this.weaponId);
    // Soft-lock / focus (RMB lock steers body via Controller.setLockTarget)
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 26;
    if (target) {
      const planar = this.toTargetPlanar(target);
      dir = planar.dir.clone();
      dist = planar.dist;
      if (this.locked) this.controller.setLockTarget(target.position);
    } else {
      const ray = this.crosshairRay();
      dir.copy(ray.direction);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.copy(this.controller.forward());
      dir.normalize();
    }
    this.controller.faceToward(dir, 0.28);

    // Shoot anim once for the press; each bullet also re-triggers a light overlay
    // so burst fire reads as continuous shooting while strafing.
    this.playGunShootAnim(0.08);

    const burst = Math.min(load.burst, this.gunAmmo);
    // Bullet release lead matches cut into chargedShot attack portion
    const releaseLead = 0.07;
    for (let i = 0; i < burst; i++) {
      this.schedule(releaseLead + i * 0.07, () => {
        if (this.disposed || !this.character || this.gunAmmo <= 0) return;
        // Re-aim each round at live target for strafe tracking
        let d = dir.clone();
        let di = dist;
        const t = this.pickCrosshairTarget(combat);
        if (t) {
          const p = this.toTargetPlanar(t);
          d = p.dir.clone();
          di = p.dist;
          this.controller?.faceToward(d, 0.2);
        }
        if (i > 0) this.playGunShootAnim(0.12);
        this.fireOneGunRound(load, d, di, false);
      });
    }
    this.gunFireLock = load.fireLock;
  }

  /** Tap F — reload cylinder / magazine. */
  private doGunReload() {
    const load = gunLoadout(this.weaponId);
    if (!load || !this.character) return;
    if (this.gunReloadT > 0) return;
    if (this.gunAmmo >= load.clip) return;
    this.gunReloadT = load.reloadTime;
    this.gunAmmo = 0; // chamber open
    if (this.character.hasClip("reload")) this.character.playClipOnce("reload", 0.1);
    else if (this.character.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.12);
    this.setCombatFlash("RELOAD", 0.5);
    this.schedule(load.reloadTime, () => {
      if (this.disposed) return;
      this.gunAmmo = load.clip;
      this.setCombatFlash(`${load.clip} RDS`, 0.4);
    });
  }

  /**
   * Hold-F full discharge: pistol dumps remaining cylinder; rifle dumps remaining
   * magazine as a plasma-charged volley. Barrel charge VFX while held.
   */
  private doGunFullDischarge() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.gunReloadT > 0) return;
    const load = gunLoadout(this.weaponId);
    if (!load) return;
    if (this.gunAmmo <= 0) {
      this.doGunReload();
      return;
    }

    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 28;
    if (target) {
      const planar = this.toTargetPlanar(target);
      dir = planar.dir.clone();
      dist = planar.dist;
    }
    this.controller.faceToward(dir, 0.2);
    this.playGunShootAnim(0.05);

    const n = this.gunAmmo;
    const gap = this.weaponId === "pistol" ? 0.08 : 0.05;
    for (let i = 0; i < n; i++) {
      this.schedule(0.08 + i * gap, () => {
        if (this.disposed || !this.character || this.gunAmmo <= 0) return;
        if (i % 2 === 0) this.playGunShootAnim(0.14);
        this.fireOneGunRound(load, dir, dist, true);
      });
    }
    this.gunFireLock = Math.max(load.fireLock, n * gap + 0.2);
    this.setCombatFlash(this.weaponId === "pistol" ? "CYLINDER DUMP" : "FULL AUTO", 0.7);
    this.bumpMusicHeat(0.35);
  }

  /** Single bullet / tracer with shield + reflect resolution. */
  private fireOneGunRound(
    load: GunLoadout,
    dir: THREE.Vector3,
    dist: number,
    special: boolean,
  ) {
    if (!this.character || !this.controller || this.gunAmmo <= 0) return;
    this.gunAmmo -= 1;
    const color = special ? load.plasmaColor : load.color;
    const origin = this.muzzleOrigin(dir);
    const range = THREE.MathUtils.clamp(dist + 2, 4, 36);
    const speed = special ? 58 : 52;
    const dmg = special ? Math.round(load.damage * 1.15) : load.damage;

    this.recoil.kick(special ? 0.04 : 0.022, special ? 0.035 : 0.018);
    this.vfx.muzzle(origin, dir, color);
    if (special) {
      this.vfx.skillCharge(origin, load.plasmaColor, 1.1, 0.25);
      this.vfx.burst(origin, load.plasmaColor, 10, 2.2);
    }

    // Enhanced charged slug vs plain bolt
    const onHit = (p: THREE.Vector3) => {
      this.resolveGunBulletImpact(p, origin, dmg, special, load);
    };
    if (special) {
      this.vfx.chargedBolt(origin, dir, color, speed, range, onHit, 1.35);
    } else {
      this.vfx.chargedBolt(origin, dir, color, speed, range, onHit, 1.05);
    }
    this.sfx?.play("whooshHeavy", origin, { volume: special ? 0.7 : 0.45, rate: special ? 0.9 : 1.15 });
  }

  /** Impact: gunHit → forcefield / reflect / fire-aura damage. */
  private resolveGunBulletImpact(
    p: THREE.Vector3,
    from: THREE.Vector3,
    damage: number,
    special: boolean,
    load: GunLoadout,
  ) {
    const force = this.params.skillForce * GUN_SHIELD.hitForceMul * (special ? 1.25 : 1);
    const gunHit = this.targets.gunHit?.bind(this.targets);
    if (!gunHit) {
      this.targets.blast(p, 1.15, damage, force, this.sparCtx);
      this.vfx.fireAura(p, special ? 1.1 : 0.8, this.fireThemeApplied);
      return;
    }
    const res = gunHit(p, 1.15, damage, force, {
      hitsToBreak: GUN_SHIELD.hitsToBreak,
      shieldMul: GUN_SHIELD.damageMul,
      ctx: this.sparCtx,
    });

    if (res.outcome === "miss") {
      this.vfx.impact(p, load.color, 0.7);
      return;
    }
    const hitPos = res.pos ?? p;

    if (res.outcome === "reflect") {
      // Parry sends the round back at the shooter
      this.setCombatFlash("REFLECT!", 0.55);
      this.vfx.parryClash(hitPos, 0xffe8a0);
      this.vfx.forceField(() => hitPos.clone(), 1.0, 0.25, 0xfff0c0);
      const back = from.clone().sub(hitPos);
      back.y = 0;
      if (back.lengthSq() < 1e-4) back.copy(this.controller?.forward().negate() ?? new THREE.Vector3(0, 0, 1));
      back.normalize();
      this.vfx.bolt(hitPos.clone().setY(hitPos.y + 0.2), back, 0xff8866, 46, 22, (rp) => {
        this.vfx.fireAura(rp, 0.9, this.fireThemeApplied);
        // Chip the player when their own round comes home
        if (this.character && rp.distanceTo(this.character.root.position) < 1.6) {
          this.hurt = 0.4;
          this.controller?.applyImpulse(back, 5, 0.8, 4);
          this.vfx.fireAura(this.character.root.position.clone().setY(1), 1.0, this.fireThemeApplied);
        }
      }, 1.0);
      return;
    }

    if (res.outcome === "block") {
      this.vfx.forceField(() => hitPos.clone(), 1.2, 0.28, 0x66e0ff);
      this.vfx.impact(hitPos, 0x88d0ff, 0.9);
      this.sfx?.play("block", hitPos, { volume: 0.55, rate: 1.3 });
      return;
    }

    if (res.outcome === "shieldBreak") {
      this.setCombatFlash("SHIELD DOWN!", 0.8);
      this.vfx.forceField(() => hitPos.clone(), 1.5, 0.4, 0xffaa60);
      this.vfx.fireAura(hitPos, 1.2, this.fireThemeApplied);
      this.vfx.shockwave(new THREE.Vector3(hitPos.x, 0.05, hitPos.z), 0xff9040, 2.0, 0.4);
      return;
    }

    // Clean hit / crit
    this.vfx.fireAura(hitPos, special ? 1.15 : 0.85, this.fireThemeApplied);
    this.vfx.impact(hitPos, load.color, special ? 1.4 : 1.1);
    if (res.outcome === "crit") this.triggerHitstop(0.06, 0.12);
  }

  /**
   * Skill 3 — combat vault: dash away + hop up, keep focus lock if engaged,
   * longbow dive / airDodge animation. Optional parting shot mid-air.
   */
  private doGunVault(): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    if (this.sigCooldowns[2]! > 0) return false;

    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    let away = this.controller.forward().clone().negate();
    if (target) {
      away = this.toTargetPlanar(target).dir.clone().negate();
    }
    away.y = 0;
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.normalize();

    // Face target while vaulting away (focus lock keeps camera)
    if (target) this.controller.faceToward(this.toTargetPlanar(target).dir, 0.15);
    if (this.locked && target) this.controller.setLockTarget(target.position);

    // Animation: dive / air dodge / roll
    const vaultClips = ["standing-dodge-backward", "airDodge", "dodgeB", "roll", "chargedShot"];
    let animDur = 0;
    for (const n of vaultClips) {
      if (!this.character.hasClip(n)) continue;
      if (this.character.playClipCut) {
        animDur = this.character.playClipCut(n, { from: 0.1, to: 1, timeScale: 1.5, fade: 0.06 });
      }
      if (animDur <= 0) animDur = this.character.playClipOnce(n, 0.08);
      if (animDur > 0) break;
    }

    this.controller.hop(4.2);
    this.controller.dash(away, 4.5, Math.max(0.32, animDur * 0.55), 0, 0.35);
    this.vfx.afterimage(this.character.root, this.character.root.position.clone(), away, 3.5, 0x9ef0ff, 6, 0.4);
    this.invuln = Math.max(this.invuln, 0.35);

    // Parting shot at apex if we have ammo — shoot anim + timed release
    this.schedule(0.18, () => {
      if (this.disposed || this.gunAmmo <= 0) return;
      const load = gunLoadout(this.weaponId);
      if (!load || !this.controller) return;
      let dir = this.controller.forward().clone();
      let dist = 22;
      if (target) {
        const planar = this.toTargetPlanar(target);
        dir = planar.dir.clone();
        dist = planar.dist;
      }
      this.playGunShootAnim(0.1);
      this.schedule(0.06, () => {
        if (this.disposed || this.gunAmmo <= 0) return;
        this.fireOneGunRound(load, dir, dist, false);
      });
    });

    this.sigCooldowns[2] = 6.5;
    this.sigCooldownMaxes[2] = 6.5;
    this.stamina = Math.max(0, this.stamina - 14);
    this.setCombatFlash("VAULT", 0.45);
    return true;
  }

  /**
   * M3 — surprise uppercut / unused attack slot.
   * Guns: MMA kick → uppercut launch (shield break). Melee: uppercut or motion attack.
   */
  private doSurpriseUppercut() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.controller.isBusy || this.recoverLock > 0) return;
    if (!this.spendPhysicalStamina(STAMINA_COST.uppercut, "uppercut")) return;

    const combat = weaponCombat(isGunWeapon(this.weaponId) ? "pistol" : this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    if (target) dir = this.toTargetPlanar(target).dir.clone();
    this.controller.faceToward(dir, 0.25);

    // Prefer uppercut clip (unused in many kits), then mmaKick, then motion attack
    let clipDur = 0;
    if (this.character.hasClip("uppercut")) {
      clipDur = this.character.playClipCut
        ? this.character.playClipCut("uppercut", { from: 0.25, to: 1, timeScale: 1.7, fade: 0.05 })
        : this.character.playClipOnce("uppercut", 0.08);
    } else if (this.character.hasClip("mmaKick")) {
      clipDur = this.character.playClipOnce("mmaKick", 0.08);
    } else if (this.character.hasClip("jumpAttack")) {
      clipDur = this.character.playClipOnce("jumpAttack", 0.08);
    }

    if (clipDur <= 0 && !isGunWeapon(this.weaponId)) {
      this.motionAttack(ATTACK3_MOTION);
      return;
    }
    if (clipDur <= 0) clipDur = 0.35;

    this.controller.dash(dir, 1.4, Math.min(0.28, clipDur * 0.5), 0.1, 0.45);
    this.controller.hop(2.2);
    this.vfx.afterimage(this.character.root, this.character.root.position.clone(), dir, 1.2, 0xfff2a8, 4, 0.28);

    this.abilities.cast(kitAbility("surpriseUppercut", "slam", 0xfff2a8, clipDur * 0.45), {
      onImpact: () => {
        if (!this.character) return;
        const c = this.character.root.position.clone().addScaledVector(dir, 1.2);
        c.y += 1.1;
        // Shield break + launch (opens gun / xbow follow-ups)
        this.targets.shieldBreak(c, 2.4, GUN_SHIELD.utilityBreakSec);
        this.targets.launch(c, 2.2, 22, 8.5);
        this.targets.kickStagger(c, 2.0, this.params.skillForce * 1.3, GUN_SHIELD.utilityBreakSec, this.character.root.position);
        this.vfx.fireAura(c, 1.2, this.fireThemeApplied);
        this.vfx.burst(c, 0xfff2a8, 22, 4);
        this.vfx.shockwave(new THREE.Vector3(c.x, 0.05, c.z), 0xffd080, 2.0, 0.4);
        this.setCombatFlash("UPPERCUT!", 0.55);
        // Xbow / gun: LMB bolt prioritizes airborne targets briefly
        this.airFollowT = XBOW.airFollowWindow;
      },
    });
    this.stamina = Math.max(0, this.stamina - 10);
  }

  // ----------------------------------------------------------- Casting mouse

  /** Enter ground-placement mode for a skill (trap / AoE / wall / heal / teleport). */
  private startCastPlacement(spec: CastPlacementSpec) {
    if (!this.character || !this.controller) return;
    this.cancelCastPlacement();
    const o = this.character.root.position;
    const f = this.controller.forward();
    this.castPlacement = beginCastPlacement(
      spec,
      { x: o.x, y: o.y, z: o.z },
      { x: f.x, z: f.z },
    );
    this.ensureCastReticle();
    this.setCombatFlash("PLACE · LMB", 0.8);
  }

  private ensureCastReticle() {
    if (this.castReticle) return;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x66e0ff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.95, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06;
    this.scene.add(mesh);
    this.castReticle = mesh;
  }

  private updateCastPlacement(dt: number) {
    const s = this.castPlacement;
    if (!s || !this.character) return;

    // Live ground aim from camera center ray
    const ray = this.crosshairRay();
    const g = groundFromRay(ray.origin, ray.direction);
    if (g) {
      const live = this.character.root.position;
      const clamped = clampAim(s, g.x, g.z, { x: live.x, z: live.z });
      s.aimX = clamped.x;
      s.aimZ = clamped.z;
    }

    // Reticle
    if (this.castReticle) {
      const mat = this.castReticle.material as THREE.MeshBasicMaterial;
      mat.color.setHex(s.color);
      const r = Math.max(0.6, s.kind === "cone" ? s.radius * 0.25 : s.radius * 0.55);
      this.castReticle.scale.setScalar(r);
      this.castReticle.position.set(s.aimX, 0.06, s.aimZ);
      this.castReticle.visible = true;
      mat.opacity = 0.4 + Math.sin(performance.now() * 0.008) * 0.15;
    }

    // Confirmed cast wind-up
    if (s.confirmed) {
      s.confirmElapsed += dt;
      if (s.confirmElapsed >= s.castTime) {
        this.resolveCastPlacement(s);
        this.cancelCastPlacement();
      }
    }
  }

  private confirmCastPlacement() {
    const s = this.castPlacement;
    if (!s || s.confirmed) return;
    s.confirmed = true;
    s.confirmElapsed = 0;
    // Freeze origin at confirm for non-placement cones that used live aim
    if (s.freezeOrigin && this.character && this.controller) {
      const o = this.character.root.position;
      const f = this.controller.forward();
      s.originX = o.x;
      s.originY = o.y;
      s.originZ = o.z;
      const fl = Math.hypot(f.x, f.z) || 1;
      s.faceX = f.x / fl;
      s.faceZ = f.z / fl;
    }
    this.vfx.castAura(
      new THREE.Vector3(s.aimX, 0.2, s.aimZ),
      s.color,
    );
    if (this.character?.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.1);
    else if (this.character?.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);
    this.setCombatFlash("CASTING…", s.castTime);
  }

  private cancelCastPlacement() {
    this.castPlacement = null;
    if (this.castReticle) this.castReticle.visible = false;
  }

  private resolveCastPlacement(s: CastPlacementSession) {
    const ground = new THREE.Vector3(s.aimX, 0.05, s.aimZ);
    switch (s.kind) {
      case "trap":
        this.resolveXbowTrap(s, ground);
        break;
      case "aoe":
      case "heal":
        this.vfx.auraRing(ground, s.color, s.radius, 0.7);
        this.vfx.fireAura(ground.clone().setY(0.8), 1.0, this.fireThemeApplied);
        this.targets.blast(ground, s.radius, 24, this.params.skillForce * 0.9);
        if (s.kind === "heal") this.applyStatus("regen");
        break;
      case "turret":
        this.vfx.castTurret(
          ground.clone().setY(0.5),
          new THREE.Vector3(s.faceX, 0, s.faceZ),
          s.color,
        );
        this.setCombatFlash("TURRET", 0.6);
        break;
      case "wall":
        this.vfx.iceWall(
          ground.clone().add(new THREE.Vector3(-s.faceZ, 0, s.faceX).multiplyScalar(1.8)),
          ground.clone().add(new THREE.Vector3(s.faceZ, 0, -s.faceX).multiplyScalar(1.8)),
          s.color,
          3.5,
        );
        break;
      case "teleport":
        if (this.character) {
          this.vfx.burst(this.character.root.position.clone().setY(1), s.color, 16, 3);
          this.character.root.position.set(s.aimX, 0, s.aimZ);
          this.controller?.hop(0.15);
          this.vfx.burst(new THREE.Vector3(s.aimX, 1, s.aimZ), s.color, 16, 3);
        }
        break;
      case "cone":
        this.resolveConeBlast(
          s.originX,
          s.originZ,
          s.faceX,
          s.faceZ,
          s.radius,
          s.coneHalfDeg ?? 28,
          14,
          s.color,
          true,
        );
        break;
      default:
        break;
    }
  }

  private resolveXbowTrap(s: CastPlacementSession, ground: THREE.Vector3) {
    // Delayed trap: blink telegraph then blast + stun + shield break
    this.vfx.auraRing(ground, s.color, s.radius, 0.9);
    this.telegraphs.add(ground, s.radius, () => {
      if (this.disposed) return;
      this.vfx.aoeBlast(ground, s.color, s.radius);
      this.vfx.fireAura(ground.clone().setY(0.6), 1.1, this.fireThemeApplied);
      this.targets.blast(ground, s.radius, XBOW.trapDamage, this.params.skillForce * 1.2);
      this.targets.shieldBreak(ground, s.radius, GUN_SHIELD.utilityBreakSec);
      this.markStun(ground, s.radius, 1.2);
    });
    this.setCombatFlash("CALTROPS", 0.55);
  }

  // ----------------------------------------------------------- Heavy Crossbow

  /**
   * LMB primary: close = rifle melee bash; after uppercut = air bolt;
   * else Albion shotgun cone from cast-start footprint (short cast, dodgeable).
   */
  private doCrossbowPrimary() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.recoverLock > 0 || this.comboLock > 0) return;

    const combat = weaponCombat("crossbow");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 12;
    if (target) {
      const planar = this.toTargetPlanar(target);
      dir = planar.dir.clone();
      dist = planar.dist;
    }
    this.controller.faceToward(dir, 0.25);

    // Air follow-up bolt after M3 uppercut
    if (this.airFollowT > 0) {
      this.doCrossbowAirBolt(dir, target);
      this.comboLock = 0.28;
      return;
    }

    // Close-range rifle melee
    if (target && dist <= XBOW.meleeRange) {
      this.doCrossbowMelee(dir);
      this.comboLock = 0.4;
      return;
    }

    // Shotgun cone — freeze origin at cast start, resolve after short cast
    const o = this.character.root.position.clone();
    const fx = dir.x;
    const fz = dir.z;
    this.vfx.castAura(o.clone().setY(0.15), XBOW.coneColor);
    this.vfx.auraRing(new THREE.Vector3(o.x, 0.05, o.z), XBOW.coneColor, XBOW.coneRange * 0.35, XBOW.castTime + 0.1);
    if (this.character.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.08);
    else if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.08);

    this.comboLock = XBOW.fireLock;
    this.schedule(XBOW.castTime, () => {
      if (this.disposed) return;
      this.resolveConeBlast(
        o.x,
        o.z,
        fx,
        fz,
        XBOW.coneRange,
        XBOW.coneHalfDeg,
        XBOW.pelletDamage,
        XBOW.coneColor,
        true,
      );
    });
    this.bumpMusicHeat(0.12);
  }

  /** Close-range stock bash (rifle melee anims). */
  private doCrossbowMelee(dir: THREE.Vector3) {
    if (!this.character || !this.controller) return;
    let dur = 0;
    if (this.character.hasClip("mmaKick")) dur = this.character.playClipOnce("mmaKick", 0.08);
    else if (this.character.hasClip("attack1")) dur = this.character.playClipOnce("attack1", 0.08);
    else if (this.character.hasRole("attack")) dur = this.character.playRoleOnce("attack", 0.08);
    this.controller.dash(dir, 0.7, 0.18, 0, 0.5);
    this.abilities.cast(kitAbility("xbowMelee", "slam", XBOW.boltColor, dur > 0 ? dur * 0.4 : 0.16), {
      onImpact: () => {
        if (!this.character) return;
        const c = this.character.root.position.clone().addScaledVector(dir, 1.1);
        c.y += 1.0;
        this.targets.blast(c, XBOW.meleeRange, XBOW.meleeDamage, this.params.skillForce * 1.2);
        this.targets.shieldBreak(c, XBOW.meleeRange, GUN_SHIELD.utilityBreakSec);
        this.vfx.impact(c, XBOW.boltColor, 1.6);
        this.vfx.shockwave(new THREE.Vector3(c.x, 0.05, c.z), 0xffd080, 1.5, 0.35);
      },
    });
  }

  /** Follow-up bolt to airborne / launched enemies after uppercut. */
  private doCrossbowAirBolt(dir: THREE.Vector3, target: { position: THREE.Vector3 } | null) {
    if (!this.character || !this.controller) return;
    // Prefer nearest downed / launched enemy
    const air = this.targets.nearestDownedPoint?.(this.character.root.position, 14);
    let aim = dir.clone();
    let to = this.character.root.position.clone().addScaledVector(dir, 16);
    to.y = 2.5;
    if (air) {
      to.copy(air);
      to.y += 1.2;
      aim = to.clone().sub(this.character.root.position).normalize();
    } else if (target) {
      to.copy(target.position);
      to.y += 1.6;
      aim = to.clone().sub(this.character.root.position).normalize();
    }
    this.controller.faceToward(new THREE.Vector3(aim.x, 0, aim.z).normalize(), 0.2);
    if (this.character.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.08);
    const origin = this.muzzleOrigin(aim);
    this.vfx.muzzle(origin, aim, XBOW.chargeColor);
    this.vfx.bolt(origin, aim, XBOW.chargeColor, 48, 22, (p) => {
      this.vfx.fireAura(p, 1.15, this.fireThemeApplied);
      this.targets.blast(p, 1.4, XBOW.chargeDamage, this.params.skillForce * 1.1);
      this.targets.launch(p, 1.6, 8, 4);
    }, 1.1);
    this.setCombatFlash("AIR BOLT", 0.4);
  }

  /** F — magical charged bolt with barrel VFX. */
  private doCrossbowChargedBolt() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.comboLock > 0 || this.skillCooldown > 0) return;
    const combat = weaponCombat("crossbow");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = 20;
    if (target) {
      const p = this.toTargetPlanar(target);
      dir = p.dir.clone();
      dist = p.dist;
    }
    this.controller.faceToward(dir, 0.22);
    if (this.character.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.1);
    const origin = this.muzzleOrigin(dir);
    this.vfx.castAura(origin, XBOW.chargeColor);
    this.vfx.burst(origin, XBOW.chargeColor, 12, 2.5);
    this.schedule(XBOW.chargeTime * 0.45, () => {
      if (this.disposed || !this.character) return;
      const o = this.muzzleOrigin(dir);
      this.vfx.muzzle(o, dir, XBOW.chargeColor);
      this.vfx.bolt(o, dir, XBOW.chargeColor, 40, Math.min(28, dist + 4), (p) => {
        this.vfx.aoeBlast(p, XBOW.chargeColor, 2.2);
        this.vfx.fireAura(p, 1.25, this.fireThemeApplied);
        this.targets.blast(p, 2.2, XBOW.chargeDamage, this.params.skillForce * XBOW.knockForceMul);
      }, 1.2);
    });
    this.skillCooldown = 1.2;
    this.skillCooldownMax = 1.2;
    this.comboLock = 0.5;
  }

  private doCrossbowSig(idx: number): boolean {
    if (idx < 0 || idx > 3) return false;
    if (this.sigCooldowns[idx]! > 0) return false;
    switch (idx) {
      case 0:
        // Scatter — wider shotgun cone (placement-frozen origin)
        return this.doXbowConeSkill(0, XBOW.coneRange + 1, XBOW.coneHalfDeg + 6, XBOW.pelletDamage + 2, XBOW.castTime, 4.5);
      case 1:
        return this.doXbowConeSkill(1, XBOW.explosiveRange, XBOW.explosiveHalfDeg, XBOW.explosiveDamage, XBOW.explosiveCast, 7.0, true);
      case 2:
        // Caltrop trap — casting mouse ground placement
        this.startCastPlacement({
          kind: "trap",
          skillId: "xbow_caltrop",
          slot: 2,
          maxRange: XBOW.trapRange,
          radius: XBOW.trapRadius,
          castTime: XBOW.trapCast,
          color: 0xffd24a,
          freezeOrigin: false,
        });
        this.sigCooldowns[2] = 9;
        this.sigCooldownMaxes[2] = 9;
        this.stamina = Math.max(0, this.stamina - 16);
        return true;
      case 3:
        // Skill 4 — Skyfall Barrage: 2s channel, 5 smaller R-special skyfall bolts
        return this.doXbowSkyfallBarrage();
      default:
        return false;
    }
  }

  /**
   * Crossbow skill 4: channel ~2s while aiming, then fire 5 smaller skyfall
   * strikes (same VFX as R special, scaled down) at the target location.
   * Bolts stagger across the channel so the barrage reads as a sustained cast.
   */
  private doXbowSkyfallBarrage(): boolean {
    if (!this.character || !this.controller) return false;
    const combat = weaponCombat("crossbow");
    const target = this.pickCrosshairTarget(combat);
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward().clone();
    let aim = fwd.clone();
    let impact = origin.clone().addScaledVector(fwd, 12);
    impact.y = 0.45;
    if (target) {
      const planar = this.toTargetPlanar(target);
      aim = planar.dir.clone();
      impact.copy(target.position);
      impact.y = Math.max(0.4, target.position.y);
    }
    this.controller.faceToward(aim, 0.22);

    // Channel pose
    if (this.character.hasClip("magicChannel")) this.character.playClipOnce("magicChannel", 0.12);
    else if (this.character.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.1);
    else if (this.character.hasClip("castSpell")) this.character.playClipOnce("castSpell", 0.1);
    else if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);

    const color = XBOW.barrageColor;
    const count = XBOW.barrageCount;
    const channel = XBOW.barrageChannel;
    const scale = XBOW.barrageScale;
    const token = this.weaponToken;

    // Charge telegraph at aim point
    this.vfx.castAura(impact.clone().setY(0.2), color);
    this.vfx.auraRing(new THREE.Vector3(impact.x, 0.06, impact.z), color, XBOW.barrageAoe * 1.4, channel);
    this.vfx.skillCharge(this.muzzleOrigin(aim), color, 1.2, Math.min(0.55, channel * 0.35));
    this.setCombatFlash("SKYFALL BARRAGE", 1.2);

    // Fire 5 smaller skyfall bolts staggered over the 2s channel
    for (let i = 0; i < count; i++) {
      const t = (channel * (i + 0.35)) / count;
      this.schedule(t, () => {
        if (this.disposed || token !== this.weaponToken || !this.character) return;
        // Soft re-aim at lock if still alive; else frozen impact
        let to = impact.clone();
        if (target && target.alive) {
          to.copy(target.position);
          to.y = Math.max(0.4, target.position.y);
        } else {
          // Scatter slightly around original aim for multi-shot coverage
          const ang = (i / count) * Math.PI * 2;
          const r = 0.55 + (i % 2) * 0.35;
          to.x += Math.cos(ang) * r;
          to.z += Math.sin(ang) * r;
        }
        const head = this.character.root.position.clone();
        head.y += 4.2 + i * 0.25;
        head.x += (Math.random() - 0.5) * 1.2;
        head.z += (Math.random() - 0.5) * 1.2;
        this.vfx.skyfallStrike(
          head,
          to,
          color,
          XBOW.barrageRise,
          (p) => {
            if (this.disposed) return;
            this.vfx.aoeBlast(p, color, XBOW.barrageAoe);
            this.vfx.burst(p, 0xd8b8ff, 18, XBOW.barrageAoe * 1.4);
            this.sparringBlast(p, XBOW.barrageAoe, XBOW.barrageDamage, this.params.skillForce * 0.85);
          },
          scale,
        );
      });
    }

    this.sigCooldowns[3] = XBOW.barrageCd;
    this.sigCooldownMaxes[3] = XBOW.barrageCd;
    this.stamina = Math.max(0, this.stamina - 22);
    this.comboLock = Math.max(this.comboLock, 0.35);
    this.bumpMusicHeat(0.35);
    return true;
  }

  private doXbowConeSkill(
    slot: number,
    range: number,
    halfDeg: number,
    dmg: number,
    cast: number,
    cd: number,
    explosive = false,
  ): boolean {
    if (!this.character || !this.controller) return false;
    const o = this.character.root.position.clone();
    const f = this.controller.forward().clone();
    this.vfx.castAura(o.clone().setY(0.15), explosive ? XBOW.chargeColor : XBOW.coneColor);
    this.vfx.auraRing(new THREE.Vector3(o.x, 0.05, o.z), XBOW.coneColor, range * 0.4, cast + 0.12);
    if (this.character.hasClip("chargedShot")) this.character.playClipOnce("chargedShot", 0.1);
    else if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);

    this.schedule(cast, () => {
      if (this.disposed) return;
      this.resolveConeBlast(o.x, o.z, f.x, f.z, range, halfDeg, dmg, explosive ? XBOW.chargeColor : XBOW.coneColor, true, explosive);
    });
    this.sigCooldowns[slot] = cd;
    this.sigCooldownMaxes[slot] = cd;
    this.stamina = Math.max(0, this.stamina - (10 + slot * 4));
    return true;
  }

  /**
   * Resolve shotgun / sweeping cone from a **frozen** cast footprint.
   * Enemies that left the cone before resolve take nothing (dodgeable).
   */
  private resolveConeBlast(
    ox: number,
    oz: number,
    faceX: number,
    faceZ: number,
    range: number,
    halfDeg: number,
    damage: number,
    color: number,
    knock = true,
    explosive = false,
  ) {
    const origin = new THREE.Vector3(ox, 0.2, oz);
    this.vfx.muzzle(origin.clone().setY(1.2), new THREE.Vector3(faceX, 0, faceZ), color);
    // Visual cone spray — pellets
    const pellets = explosive ? 7 : XBOW.pellets;
    for (let i = 0; i < pellets; i++) {
      const t = pellets === 1 ? 0 : (i / (pellets - 1)) * 2 - 1;
      const ang = (t * halfDeg * Math.PI) / 180;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const dx = faceX * cos - faceZ * sin;
      const dz = faceX * sin + faceZ * cos;
      const dir = new THREE.Vector3(dx, 0.05, dz).normalize();
      const end = origin.clone().addScaledVector(dir, range * (0.75 + Math.random() * 0.25));
      end.y = 0.9;
      this.vfx.bolt(origin.clone().setY(1.15), dir, color, 55, range, (p) => {
        this.vfx.impact(p, color, 0.9);
      }, 0.7);
    }

    // Damage anyone still inside the cast footprint cone
    let hits = 0;
    for (const h of this.targets.nearest(origin, 12)) {
      const p = h.position;
      if (!inCone(ox, oz, faceX, faceZ, p.x, p.z, range, halfDeg)) continue;
      hits++;
      const center = p.clone();
      center.y += 0.9;
      this.targets.blast(center, 1.1, damage, this.params.skillForce * (knock ? XBOW.knockForceMul : 0.5));
      this.vfx.fireAura(center, explosive ? 1.1 : 0.75, this.fireThemeApplied);
      if (explosive) {
        this.vfx.aoeBlast(center, color, 1.8);
        this.targets.shieldBreak(center, 1.6, 2.0);
      }
    }
    this.vfx.shockwave(new THREE.Vector3(ox, 0.05, oz), color, range * 0.45, 0.4);
    if (hits > 0) this.triggerHitstop(0.05, 0.1);
    this.sfx?.play("whooshHeavy", origin, { volume: 0.7 });
  }

  // ----------------------------------------------------------- Pistol Kiter kit (legacy specials)

  /** Muzzle world position (weapon tip / hand IK if mounted, else fist-height). */
  private muzzleOrigin(dir: THREE.Vector3): THREE.Vector3 {
    const pos = new THREE.Vector3();
    if (this.mounted?.tip) {
      this.mounted.tip.getWorldPosition(pos);
      // Nudge slightly along aim so tracers leave the bore, not the grip
      const aim = dir.clone();
      aim.y = 0;
      if (aim.lengthSq() > 1e-6) {
        aim.normalize();
        pos.addScaledVector(aim, 0.06);
      }
    } else if (this.character) {
      // Prefer right-hand bone world pose when the tip socket is missing
      const hand = this.character.rightHand;
      if (hand) {
        hand.getWorldPosition(pos);
        const aim = dir.clone();
        if (aim.lengthSq() < 1e-6) aim.set(0, 0, 1);
        aim.normalize();
        pos.addScaledVector(aim, 0.28);
        pos.y += 0.05;
      } else {
        pos.copy(this.character.root.position);
        pos.y += 1.3;
        pos.addScaledVector(dir, 0.4);
      }
    }
    return pos;
  }

  /**
   * True for weapons whose LMB / slot-1 should fire a real projectile:
   * bows → arrow, guns → bullet. Staffs keep their own bolt path.
   */
  private isProjectileRangedWeapon(id: WeaponId): boolean {
    const w = getWeapon(id);
    if (w.group !== "ranged") return false;
    return (
      id === "bow" ||
      id === "crossbow" ||
      id === "pistol" ||
      id === "rifle" ||
      id === "hunter-rifle" ||
      id === "shotgun"
    );
  }

  /** Bow / crossbow = arrow; pistols / rifles = bullet. */
  private rangedProjectileKind(id: WeaponId): "arrow" | "bullet" {
    if (id === "bow" || id === "crossbow") return "arrow";
    return "bullet";
  }

  /**
   * Primary ranged fire for bows (and non-gun ranged fallbacks).
   * Anim first → release at intensity peak → projectile along free-aim ray.
   * Timing SSOT: {@link rangedPrimaryTune} / {@link applyIntensity}.
   */
  private doRangedPrimaryShot() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.recoverLock > 0) return;
    if (this.comboLock > 0) return;

    const wid = this.weaponId;
    const tune = applyIntensity(rangedPrimaryTune(wid), weaponCombat(wid).intensity);
    const combat = weaponCombat(wid);
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    let dist = tune.range;
    if (target) {
      const planar = this.toTargetPlanar(target);
      dir = planar.dir.clone();
      dist = planar.dist;
    } else {
      const ray = this.crosshairRay();
      dir.copy(ray.direction);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.copy(this.controller.forward());
      dir.normalize();
    }
    this.controller.faceToward(dir, 0.28);

    // Play shoot anim; measure duration for release + fire-lock alignment
    let clipDur = 0;
    for (const name of tune.clips) {
      if (name === "attack" && this.character.hasRole("attack")) {
        clipDur = this.character.playRoleOnce("attack", 0.08);
        if (clipDur > 0) break;
      }
      if (!this.character.hasClip(name)) continue;
      // Prefer cut into the attack portion for snappy bow/gun feel
      if (this.character.playClipCut && (name === "shooting-arrow" || name === "chargedShot")) {
        clipDur = this.character.playClipCut(name, {
          from: Math.min(0.12, tune.releaseLead * 0.4),
          to: 1,
          timeScale: tune.kind === "arrow" ? 1.15 : 1.4,
          fade: 0.06,
        });
        if (clipDur > 0) break;
      }
      clipDur = this.character.playClipOnce(name, 0.08);
      if (clipDur > 0) break;
    }

    const releaseAt = rangedReleaseDelay(tune, clipDur);
    const fireLock = rangedFireLock(tune, clipDur);
    this.comboLock = fireLock;
    this.comboTimer = fireLock + 0.06;

    const token = this.weaponToken;
    const aimDir = dir.clone();
    const softTarget = target;
    this.schedule(releaseAt, () => {
      if (this.disposed || token !== this.weaponToken || !this.character || !this.controller) return;
      // Re-sample aim at release so strafing mid-draw still lands
      let d = aimDir.clone();
      let di = dist;
      const t = this.pickCrosshairTarget(combat);
      if (t) {
        const p = this.toTargetPlanar(t);
        d = p.dir.clone();
        di = p.dist;
        this.controller.faceToward(d, 0.18);
      } else {
        const ray = this.crosshairRay();
        d.copy(ray.direction);
        d.y = 0;
        if (d.lengthSq() < 1e-6) d.copy(this.controller.forward());
        d.normalize();
      }
      const origin = this.muzzleOrigin(d);
      const range = softTarget || t
        ? THREE.MathUtils.clamp(di + 1.5, 4, tune.range + 4)
        : tune.range;
      this.recoil.kickPitchYaw(tune.recoil.pitch, tune.recoil.yaw);
      this.vfx.muzzle(origin, d, tune.color);
      const onHit = (p: THREE.Vector3) => {
        this.vfx.impact(p, tune.color, tune.kind === "arrow" ? 1.05 : 1.2);
        this.targets.blast(
          p,
          tune.kind === "arrow" ? 0.9 : 0.8,
          tune.damage,
          this.params.skillForce * (tune.kind === "arrow" ? 0.48 : 0.52),
        );
        if (t || softTarget) this.triggerHitstop(0.04, 0.1);
      };
      if (tune.visual === "arrow") {
        // Mesh arrow (projectilebomb pack) with bolt fallback inside castWitchArrow
        this.vfx.castWitchArrow(origin, d, tune.color, onHit);
      } else if (tune.visual === "slug") {
        this.vfx.chargedBolt(origin, d, tune.color, tune.speed, range, onHit, tune.scale);
      } else {
        this.vfx.bolt(origin, d, tune.color, tune.speed, range, onHit, tune.scale);
      }
      this.sfx?.play(
        tune.kind === "arrow" ? "whooshLight" : "whooshHeavy",
        origin,
        { volume: 0.58, rate: tune.kind === "arrow" ? 1.05 : 1.2 },
      );
    });
    this.bumpMusicHeat(0.08);
  }

  /**
   * Pistol "Kiter" primary fire. Proximity-adaptive: with a target inside
   * `kickRange` it becomes a close MMA kick (parry/stun); otherwise it shoots a
   * bullet and back-steps away (gunslinger mobility). A `clipSize`-round clip
   * reloads automatically, and the final round is a colorful explosive bullet.
   */
  private doPistolPrimary(kit: KiterKit) {
    if (!this.character || !this.controller || this.pistolLock > 0) return;
    const combat = weaponCombat("pistol");
    const target = this.pickCrosshairTarget(combat);
    let dist = Infinity;
    let dir = this.controller.forward();
    if (target) {
      const planar = this.toTargetPlanar(target);
      dist = planar.dist;
      dir = planar.dir.clone();
    }
    // Always face where we're firing (so the backstep reads as a kiter backpedal).
    this.controller.faceToward(dir, 0.3);

    if (target && dist <= kit.kickRange) {
      this.doPistolKick(kit, dir);
      this.pistolLock = 0.42;
    } else {
      this.doPistolShot(kit, dir, target, dist);
      this.pistolLock = 0.18;
    }
  }

  /** Close-quarters MMA kick: a short step-in strike with knockback + stun flash. */
  private doPistolKick(kit: KiterKit, dir: THREE.Vector3) {
    if (!this.character || !this.controller) return;
    const dur = this.character.playClipOnce("mmaKick", 0.1);
    this.controller.dash(dir, 0.5, 0.18, 0, 0.5);
    this.abilities.cast(kitAbility("pistolKick", "slam", 0xfff2a8, dur > 0 ? dur * 0.4 : 0.18), {
      onImpact: () => {
        if (!this.character) return;
        const center = this.character.root.position.clone().addScaledVector(dir, kit.kickRange * 0.7);
        center.y += 1.0;
        this.targets.blast(center, kit.kickRange + 0.4, kit.kickDamage, this.params.skillForce * 1.5);
        this.targets.shieldBreak(center, kit.kickRange + 0.6, GUN_SHIELD.utilityBreakSec);
        this.vfx.impact(center, 0xfff2a8, kit.kickRange + 0.6);
        this.vfx.shockwave(new THREE.Vector3(center.x, 0.05, center.z), 0xffe08a, 1.6, 0.4);
      },
    });
  }

  /**
   * Fire one ranged round toward the aimed target (or crosshair), then back-step
   * away. Ordinary rounds are precise tracers; the final round of the clip is an
   * explosive colorful bullet with an AoE blast, after which the clip reloads.
   */
  private doPistolShot(kit: KiterKit, dir: THREE.Vector3, target: TargetHandle | null, dist: number) {
    if (!this.character || !this.controller) return;
    this.pistolShots += 1;
    const explosive = this.pistolShots >= kit.clipSize;
    const color = explosive ? 0xff8a3c : 0xfff2a8;
    // Recoil kick (decays over the next frames) + hit-marker on a confirmed target.
    this.recoil.kick(explosive ? 0.05 : 0.025, explosive ? 0.05 : 0.025);
    if (target) {
      this.hitMarkerCount += 1;
      this.triggerHitstop(0.055, 0.14);
    }

    // Shoot anim on every round; bullet releases after a short attack lead.
    this.playGunShootAnim(explosive ? 0.05 : 0.08);
    this.schedule(0.07, () => {
      if (this.disposed || !this.character) return;
      const origin = this.muzzleOrigin(dir);
      this.vfx.burst(origin, color, explosive ? 16 : 9, 3);
      const range = target ? THREE.MathUtils.clamp(dist + 0.3, 2, 24) : 24;
      const speed = explosive ? 34 : 48;
      this.vfx.chargedBolt(origin, dir, color, speed, range, (p) => {
        if (explosive) {
          this.vfx.aoeBlast(p, color, kit.blastRadius);
          this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0xff5a2a, kit.blastRadius, 0.5);
          this.vfx.fireAura(p, 1.1, this.fireThemeApplied);
          this.targets.blast(p, kit.blastRadius, kit.blastDamage, this.params.skillForce * 1.6);
        } else {
          this.vfx.impact(p, color, 1.4);
          this.vfx.fireAura(p, 0.7, this.fireThemeApplied);
          this.targets.blast(p, 0.8, kit.shotDamage, this.params.skillForce * 0.5);
        }
      }, explosive ? 1.35 : 1.05);
    });

    // Kiter mobility: reverse-motion-math back-step away from the aim line after
    // firing. The hop grants a brief i-frame window so the backpedal reads as a
    // real evasive dodge (the kiter's shoot-and-slip fantasy) rather than a
    // cosmetic shuffle. A cooldown gates the i-frames so rapid fire (re-fire lock
    // is only 0.18s) can't chain the 0.22s window into continuous immunity — the
    // dodge covers one backstep, then there's a real vulnerable beat before it
    // re-arms. Only the ranged backstep dodges, never the close-range MMA kick.
    this.controller.dash(dir.clone().negate(), kit.backstep, 0.22, 0, 0.5);
    if (this.pistolDodgeCd <= 0) {
      this.invuln = Math.max(this.invuln, 0.22);
      this.pistolDodgeCd = 0.6;
    }
    if (explosive) this.pistolShots = 0;
  }

  // ------------------------------------------------- Kiter signature skills (1-4)

  /**
   * Stun every living target within `radius` of `center` for real (they freeze +
   * skip reactions) and float the matching stun-star VFX above each, timed to the
   * same duration so the cosmetic marks line up with the status timer.
   */
  private markStun(center: THREE.Vector3, radius: number, seconds = STUN_SECONDS) {
    this.targets.stun(center, radius, seconds);
    for (const h of this.targets.nearest(center, 8)) {
      if (h.position.distanceTo(center) <= radius) {
        const p = h.position.clone();
        p.y += 1.0;
        this.vfx.stunMark(p, 0xffe24a, seconds);
      }
    }
  }

  /** Dispatch pistol signature skills — each slot has its own CD only. */
  private doPistolSig(idx: number, kit: KiterKit): boolean {
    if (idx < 0 || idx > 3) return false;
    if (this.sigCooldowns[idx]! > 0) return false;
    switch (idx) {
      case 0:
        return this.doPistolSig0(kit);
      case 1:
        return this.doPistolSig1(kit);
      case 2:
        // Skill 3 — diving kick → rebound backflip + 0.5s hover aim
        return this.doPistolDiveKick(kit);
      case 3:
        return this.doPistolSig3(kit);
      default:
        return false;
    }
  }

  private armSig(idx: number) {
    this.armSigSlot(idx, PISTOL_SIG_CD[idx]!, PISTOL_SIG_ST[idx]!);
  }

  /**
   * Pistol double-jump: cut backflip away from target, then 0.5s hover with
   * pistol aimed at the enemy (LMB free to fire).
   */
  private doPistolAirBackflip() {
    if (!this.character || !this.controller) return;
    const combat = weaponCombat("pistol");
    const target = this.pickCrosshairTarget(combat);
    let away = this.controller.forward().clone().negate();
    let face = this.controller.forward().clone();
    if (target) {
      const to = this.toTargetPlanar(target);
      face = to.dir.clone();
      away = to.dir.clone().negate();
    }
    away.y = 0;
    face.y = 0;
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    if (face.lengthSq() < 1e-4) face.set(0, 0, -1);
    away.normalize();
    face.normalize();

    // Cut backflip (fast)
    let flipDur = 0;
    if (this.character.hasClip("backflip") && this.character.playClipCut) {
      flipDur = this.character.playClipCut("backflip", {
        from: 0.12,
        to: 1,
        timeScale: 1.85,
        fade: 0.04,
      });
    } else if (this.character.hasClip("backflip")) {
      flipDur = this.character.playClipOnce("backflip", 0.06);
    } else if (this.character.hasClip("airDodge")) {
      flipDur = this.character.playClipOnce("airDodge", 0.06);
    }
    if (flipDur <= 0) flipDur = 0.38;

    this.controller.faceToward(away, 0.1);
    this.controller.backflip(Math.min(0.48, flipDur), 2.0);
    this.controller.dash(away, 3.2, Math.min(0.35, flipDur * 0.7), 0, 0.4);
    this.vfx.afterimage(this.character.root, this.character.root.position.clone(), away, 2.8, 0xfff2a8, 5, 0.32);
    this.invuln = Math.max(this.invuln, 0.28);

    // End with 0.5s hover aimed at enemy
    this.schedule(Math.min(0.42, flipDur * 0.85), () => {
      if (this.disposed || !this.controller || !this.character) return;
      const apex = Math.max(1.8, this.character.root.position.y + 0.35);
      this.controller.startHover(apex, PISTOL_HOVER_AIM);
      this.pistolHoverAimT = PISTOL_HOVER_AIM;
      this.controller.faceToward(face, 0.2);
      if (target && this.locked) this.controller.setLockTarget(target.position);
      this.setCombatFlash("AIM", 0.4);
    });
  }

  /**
   * Skill 3 — diving kick into target, then rebound into the same backflip +
   * 0.5s hover aim (LMB or skill 3 again if off CD).
   */
  private doPistolDiveKick(kit: KiterKit): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    if (this.sigCooldowns[2]! > 0) return false;

    const combat = weaponCombat("pistol");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward().clone();
    if (target) dir = this.toTargetPlanar(target).dir.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();

    this.controller.faceToward(dir, 0.2);
    // Dive anim
    let diveDur = 0;
    const diveClips = ["standing-dodge-forward", "airDodge", "mmaKick", "jumpAttack", "roll"];
    for (const n of diveClips) {
      if (!this.character.hasClip(n)) continue;
      if (this.character.playClipCut) {
        diveDur = this.character.playClipCut(n, { from: 0.15, to: 1, timeScale: 1.7, fade: 0.05 });
      }
      if (diveDur <= 0) diveDur = this.character.playClipOnce(n, 0.07);
      if (diveDur > 0) break;
    }
    if (diveDur <= 0) diveDur = 0.32;

    const diveDist = target
      ? THREE.MathUtils.clamp(this.toTargetPlanar(target).dist - 0.5, 2.5, 7.5)
      : 4.5;
    this.controller.hop(1.6);
    this.controller.dash(dir, diveDist, Math.min(0.38, diveDur * 0.65), 0.15, 0.55);
    this.vfx.afterimage(this.character.root, this.character.root.position.clone(), dir, diveDist * 0.7, 0xffe080, 6, 0.35);
    this.invuln = Math.max(this.invuln, 0.32);

    // Kick impact mid-dive
    this.abilities.cast(kitAbility("pistolDiveKick", "slam", 0xfff2a8, diveDur * 0.5), {
      onImpact: () => {
        if (!this.character) return;
        const c = this.character.root.position.clone().addScaledVector(dir, 0.9);
        c.y += 0.9;
        this.targets.blast(c, kit.kickRange + 0.8, kit.kickDamage * 1.15, this.params.skillForce * 1.5);
        this.targets.shieldBreak(c, kit.kickRange + 1.0, GUN_SHIELD.utilityBreakSec);
        this.vfx.impact(c, 0xfff2a8, 2.0);
        this.vfx.shockwave(new THREE.Vector3(c.x, 0.05, c.z), 0xffd080, 2.2, 0.4);
        this.vfx.fireAura(c, 0.9, this.fireThemeApplied);
      },
    });

    // Rebound: same backflip + hover aim as double-jump
    this.schedule(Math.min(0.4, diveDur * 0.75), () => {
      if (this.disposed || !this.controller || !this.character) return;
      this.doPistolAirBackflip();
    });

    this.armSig(2);
    this.setCombatFlash("DIVE KICK", 0.5);
    return true;
  }

  /** Sig 1 — Quick Draw: a quick three-round fan at the crosshair target. */
  private doPistolSig0(kit: KiterKit): boolean {
    if (!this.character || !this.controller) return false;
    const combat = weaponCombat("pistol");
    const target = this.pickCrosshairTarget(combat);
    let dir = this.controller.forward();
    let dist = 22;
    if (target) {
      const planar = this.toTargetPlanar(target);
      dir = planar.dir.clone();
      dist = planar.dist;
    }
    this.controller.faceToward(dir, 0.2);
    this.playGunShootAnim(0.08);
    for (let i = 0; i < 3; i++) {
      this.abilities.cast(kitAbility("pistolQuickDraw", "bolt", 0xfff2a8, 0.08 + i * 0.12), {
        onImpact: () => {
          if (!this.character) return;
          this.playGunShootAnim(0.14);
          const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - 1) * 0.08).normalize();
          const origin = this.muzzleOrigin(d);
          this.vfx.muzzle(origin, d, 0xfff2a8);
          const range = THREE.MathUtils.clamp(dist + 1, 3, 24);
          this.vfx.chargedBolt(origin, d, 0xfff2a8, 50, range, (p) => {
            this.vfx.impact(p, 0xfff2a8, 1.3);
            this.vfx.fireAura(p, 0.75, this.fireThemeApplied);
            this.targets.blast(p, 0.9, kit.shotDamage, this.params.skillForce * 0.5);
          }, 1.05);
        },
      });
    }
    this.armSig(0);
    return true;
  }

  /**
   * Sig 2 — Smoke Phantom: drop a smoke decoy that fires ~3 shots over 2s, vanish
   * (invisible) with +100% move speed for ~4s, and unleash a pistol-whip →
   * uppercut close combo on the nearest target.
   */
  private doPistolSig1(kit: KiterKit): boolean {
    if (!this.character || !this.controller) return false;
    const decoyPos = this.character.root.position.clone();
    this.vfx.smokeClone(decoyPos, 2.2);
    this.vfx.shockwave(new THREE.Vector3(decoyPos.x, 0.05, decoyPos.z), 0x8893a6, 2.2, 0.5);

    // Phantom: invisible + double speed for ~4s (restored by the loop timer).
    this.character.root.visible = false;
    this.controller.setSpeedMultiplier(2);
    this.phantomTimer = 4;

    // Decoy auto-fires three shots over ~2s toward the nearest target.
    for (let i = 0; i < 3; i++) {
      this.abilities.cast(kitAbility("pistolPhantomShot", "bolt", 0xc8d4e6, 0.3 + i * 0.6), {
        onImpact: () => {
          const near = this.targets.nearest(decoyPos, 1)[0];
          const muzzle = decoyPos.clone();
          muzzle.y += 1.3;
          const dir = near
            ? near.position.clone().sub(muzzle).normalize()
            : this.facing();
          this.vfx.muzzle(muzzle, dir, 0xc8d4e6);
          const range = near
            ? THREE.MathUtils.clamp(near.position.distanceTo(muzzle) + 0.5, 3, 24)
            : 18;
          this.vfx.bolt(muzzle, dir, 0xc8d4e6, 48, range, (p) => {
            this.vfx.impact(p, 0xc8d4e6, 1.2);
            this.targets.blast(p, 0.8, kit.shotDamage, this.params.skillForce * 0.4);
          });
        },
      });
    }

    // Pistol-whip → uppercut close combo on the nearest target.
    const near = this.targets.nearest(this.character.root.position, 1)[0];
    const cdir = near ? this.toTargetPlanar(near).dir.clone() : this.facing();
    this.controller.faceToward(cdir, 0.2);
    const d1 = this.character.playClipOnce("pistolWhip", 0.1);
    this.abilities.cast(kitAbility("pistolWhip", "slam", 0xc8d4e6, d1 > 0 ? d1 * 0.4 : 0.18), {
      onImpact: () => {
        if (!this.character) return;
        const c = this.character.root.position.clone().addScaledVector(cdir, kit.kickRange * 0.7);
        c.y += 1.0;
        this.targets.blast(c, kit.kickRange + 0.5, kit.kickDamage, this.params.skillForce * 1.2);
        this.vfx.impact(c, 0xc8d4e6, kit.kickRange + 0.6);
        this.markStun(c, kit.kickRange + 0.6);
        // Uppercut finisher launches the target up.
        this.character.playClipOnce("uppercut", 0.1);
        this.abilities.cast(kitAbility("pistolUppercut", "slam", 0xfff2a8, 0.18), {
          onImpact: () => {
            if (!this.character) return;
            const u = this.character.root.position.clone().addScaledVector(cdir, kit.kickRange * 0.6);
            u.y += 1.2;
            this.targets.launch(u, kit.kickRange + 0.4, kit.kickDamage, 8);
            this.vfx.burst(u, 0xfff2a8, 24, 4);
          },
        });
      },
    });

    this.armSig(1);
    return true;
  }

  /**
   * Legacy bear-trap (still available via utility KeyH bomb style kits).
   * Skill slot 3 is now {@link doGunVault} for all guns.
   */
  private doPistolSig2(kit: KiterKit): boolean {
    if (!this.character || !this.controller) return false;
    this.character.playClipOnce("mmaKick", 0.1);
    const target = this.pickCrosshairTarget(weaponCombat("pistol"));
    const from = this.muzzleOrigin(this.controller.forward());
    let to: THREE.Vector3;
    if (target) {
      to = target.position.clone();
      to.y = 0.2;
    } else {
      to = this.character.root.position.clone().addScaledVector(this.facing(), 6);
      to.y = 0.2;
      to.x = THREE.MathUtils.clamp(to.x, -14, 14);
      to.z = THREE.MathUtils.clamp(to.z, -14, 14);
    }
    this.vfx.thrownProp("models/props/bear-trap.glb", from, to, 0xc0c8d4, (p) => {
      this.vfx.aoeBlast(p, 0xffd24a, kit.blastRadius * 0.8);
      this.targets.blast(p, kit.blastRadius * 0.8, kit.kickDamage, this.params.skillForce * 0.8);
      this.markStun(p, kit.blastRadius * 0.8);
      // Gunner utility breaks enemy forcefields
      this.targets.shieldBreak(p, kit.blastRadius * 0.8, GUN_SHIELD.utilityBreakSec);
    });
    this.armSig(2);
    return true;
  }

  /**
   * Sig 4 — Hexaring Beam: leap and float (~2.5s), charge ethereal rings, then
   * fire a **locked-aim** multi-shader plasma beam (no re-aim once cast starts).
   * Line damage + launch/stun physics via the shared beam session.
   */
  private doPistolSig3(kit: KiterKit): boolean {
    if (!this.character || !this.controller) return false;
    if (this.beamCastSession) return false;
    this.playGunShootAnim(0.06);
    this.controller.startHover(2.4, 2.5);

    // Freeze aim at cast start (hard rule: no re-aim once casting)
    const lockedDir = this.resolveBeamAimDir();
    this.controller.faceToward(lockedDir, 0.22);
    const muzzleGetter = () => this.muzzleOrigin(lockedDir);

    // Spinning hexarings at the muzzle during charge + beam.
    this.vfx.hexaring(muzzleGetter, 0x9fd8ff, 2.0);
    this.abilities.cast(kitAbility("pistolHexBurst", "laser", 0x9fd8ff, 0.0), {
      onImpact: () => this.vfx.burst(muzzleGetter(), 0x9fd8ff, 16, 2),
    });
    this.abilities.cast(kitAbility("pistolHexBurst", "laser", 0x9fd8ff, 0.25), {
      onImpact: () => this.vfx.burst(muzzleGetter(), 0x9fd8ff, 16, 2),
    });

    const gunProfile = beamProfileForWeapon("pistol");
    const profile: BeamCastProfile = {
      ...gunProfile,
      castTime: 0.5,
      beamLife: 1.5,
      length: 22,
      radius: 0.38,
      damagePerTick: Math.max(10, kit.shotDamage * 0.85),
      tickInterval: 0.12,
      color: 0x9fd8ff,
      coreColor: 0xffffff,
      chargeColor: 0x9fd8ff,
      physics: "launch",
      knockback: 2.6,
      knockUp: 4.2,
    };
    this.startBeamCast({ profileOverride: profile, dir: lockedDir, skipAnim: true });
    this.armSig(3);
    return true;
  }

  // ------------------------------------------------ Arcane Staff (Soulbinder) kit

  /** Arm an arcane signature slot: set its cooldown (for the HUD) + spend stamina. */
  private armArcaneSig(idx: number) {
    this.sigCooldowns[idx] = ARCANE_SIG_CD[idx];
    this.sigCooldownMaxes[idx] = ARCANE_SIG_CD[idx];
    this.stamina = Math.max(0, this.stamina - ARCANE_SIG_ST[idx]);
  }

  /** Dispatch a Soulbinder arcane-staff signature skill (slot 0-3). */
  private doArcaneSig(idx: number, kit: ArcaneKit): boolean {
    if (idx < 0 || idx > 3) return false;
    if (this.sigCooldowns[idx] > 0) return false;
    switch (idx) {
      case 0:
        return this.doArcaneStep(kit);
      case 1:
        return this.doArcaneSouls(kit);
      case 2:
        return this.doArcaneJaunt(kit);
      case 3:
        return this.doArcaneNova(kit);
      default:
        return false;
    }
  }

  /** Sig 1 — Soul Step: a quick spectral backstep that wisps the caster away. */
  private doArcaneStep(kit: ArcaneKit): boolean {
    if (!this.character || !this.controller) return false;
    const color = SKILL_COLOR.soul;
    const back = this.facing().negate();
    const origin = this.character.root.position.clone();
    origin.y += 1.0;
    this.character.playClipOnce("backJump", 0.1);
    this.vfx.smokePop(origin, color, 1.1);
    this.vfx.puff(origin, color, 14, 1.2);
    this.controller.dash(back, kit.backstep, 0.42, 0, 0.5);
    this.armArcaneSig(0);
    return true;
  }

  /**
   * Sig 2 — Soul Release: launch a fan of homing soul bolts. Each seeks a nearby
   * living target (homing burst + AoE on impact); with no targets in range the
   * souls drift out in a forward fan and burst where they land.
   */
  private doArcaneSouls(kit: ArcaneKit): boolean {
    if (!this.character || !this.controller) return false;
    const color = SKILL_COLOR.soul;
    this.character.playClipOnce("magicAttack", 0.12);
    const center = this.character.root.position.clone();
    const fwd = this.facing();
    const muzzle = () => {
      // Collider-bound (opt-in via colliderVfx): stream the souls from the
      // swinging casting hand's world pose; else a chest-height body point. The
      // souls still home onto their targets — only the launch origin moves.
      const pose = this.colliderPose();
      if (pose) return pose.pos.clone();
      const m = this.character!.root.position.clone();
      m.y += 1.3;
      return m;
    };
    const seekable = this.targets
      .nearest(center, kit.soulCount)
      .filter((h) => h.alive && h.position.distanceTo(center) <= 18);
    const onHit = (p: THREE.Vector3) => {
      this.vfx.aoeBlast(p, color, kit.soulRadius);
      this.sparringBlast(p, kit.soulRadius, kit.soulDamage, this.params.skillForce * 0.7);
    };
    for (let i = 0; i < kit.soulCount; i++) {
      this.abilities.cast(kitAbility("arcaneSoul", "soul", color, i * 0.1), {
        onImpact: () => {
          if (!this.character || this.disposed) return;
          const from = muzzle();
          const tgt = seekable.length ? seekable[i % seekable.length] : undefined;
          if (tgt && tgt.alive) {
            this.vfx.castSoulAt(from, tgt.position.clone(), color, onHit);
          } else {
            const spread = (i - (kit.soulCount - 1) / 2) * 0.22;
            const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread).normalize();
            this.vfx.castSoul(from, dir, color, onHit);
          }
        },
      });
    }
    this.armArcaneSig(1);
    return true;
  }

  /**
   * Sig 3 — Void Jaunt: drop a cluster of timed soul-bombs at the launch point,
   * then blink the caster backward out of danger. The bombs detonate after
   * `bombDelay`s, blasting everything still standing in the vacated spot.
   */
  private doArcaneJaunt(kit: ArcaneKit): boolean {
    if (!this.character || !this.controller) return false;
    const color = SKILL_COLOR.soul;
    const origin = this.character.root.position.clone();
    this.character.playClipOnce("longBackJump", 0.1);

    // Lob the bombs from the caster's hand to a small ring around the launch point.
    const hand = origin.clone();
    hand.y += 1.2;
    for (let i = 0; i < kit.bombCount; i++) {
      const ang = (i / Math.max(1, kit.bombCount)) * Math.PI * 2;
      const spread = kit.bombCount > 1 ? 1.1 : 0;
      const to = origin.clone().add(new THREE.Vector3(Math.cos(ang) * spread, 0.15, Math.sin(ang) * spread));
      to.x = THREE.MathUtils.clamp(to.x, -14, 14);
      to.z = THREE.MathUtils.clamp(to.z, -14, 14);
      this.vfx.thrownProp("models/props/soul-bomb.glb", hand, to, color, (p) => {
        // Fuse telegraph (a slow soul ring) that resolves into the detonation.
        this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), color, kit.bombRadius * 0.6, kit.bombDelay);
        this.abilities.cast(kitAbility("arcaneSoulBomb", "soul", color, kit.bombDelay), {
          onImpact: () => {
            if (this.disposed) return;
            this.vfx.aoeBlast(p, color, kit.bombRadius);
            this.sparringBlast(p, kit.bombRadius, kit.bombDamage, this.params.skillForce * 1.2);
          },
        });
      });
    }

    // Blink backward out of the blast zone, with a soul-wisp at both endpoints.
    const dest = origin.clone().addScaledVector(this.facing().negate(), kit.blinkDist);
    this.abilities.cast(kitAbility("arcaneJaunt", "soul", color, 0.12), {
      onImpact: () => {
        if (!this.controller || !this.character || this.disposed) return;
        const from = this.character.root.position.clone();
        from.y += 1.0;
        this.vfx.smokePop(from, color, 1.3);
        this.controller.blinkTo(dest);
        const land = this.character.root.position.clone();
        land.y += 1.0;
        this.vfx.smokePop(land, color, 1.3);
        this.vfx.puff(land, color, 16, 1.3);
        this.controller.faceToward(this.facing(), 0.3);
      },
    });
    this.armArcaneSig(2);
    return true;
  }

  /**
   * Sig 4 — Soul Nova: a spectral detonation around the caster — an outward soul
   * shockwave that blasts every nearby target. The kit's panic / finisher button
   * for when foes close the gap.
   */
  private doArcaneNova(kit: ArcaneKit): boolean {
    if (!this.character || !this.controller) return false;
    const color = SKILL_COLOR.soul;
    this.character.playClipOnce("magicArea", 0.12);
    this.abilities.cast(kitAbility("arcaneNova", "nova", color, 0.18), {
      onImpact: () => {
        if (!this.character || this.disposed) return;
        const c = this.character.root.position.clone();
        this.vfx.aoeBlast(c, color, kit.novaRadius);
        const up = c.clone();
        up.y += 1.0;
        this.vfx.burst(up, color, 34, kit.novaRadius);
        this.sparringBlast(c, kit.novaRadius, kit.novaDamage, this.params.skillForce * 1.4);
      },
    });
    this.armArcaneSig(3);
    return true;
  }

  // -------------------------------------------------------------- Elemental cast

  /**
   * Element-flavored staff cast. Every elemental staff (fire / ice / storm /
   * nature / holy) shares the proven caster feel but launches its OWN themed
   * homing projectile that, on impact, blasts the area + applies the element's
   * status — burn / freeze / shock / poison for the offensive schools, or a
   * self-regen for holy. Driven entirely by the equipped weapon's `element`
   * data (see `arsenal/elements.ts`), so any character wielding the staff casts.
   */
  /**
   * Elemental staff cast. `slot` set (0–3) → that hotbar slot only.
   * `slot` omitted (F-skill) → skillCooldown only.
   */
  private doElementalCast(element: StaffElement, slot?: number): boolean {
    if (!this.character || !this.controller) return false;
    if (slot != null) {
      if (this.sigCooldowns[slot]! > 0) return false;
    } else if (this.skillCooldown > 0) {
      return false;
    }
    const theme = ELEMENT_THEME[element];
    const color = theme.color;
    const origin = this.character.root.position.clone();
    const fwd = this.facing();
    if (this.character.hasClip(theme.castClip)) this.character.playClipOnce(theme.castClip, 0.12);
    const muzzle = () => {
      const pose = this.colliderPose();
      if (pose) return pose.pos.clone();
      const m = this.character!.root.position.clone();
      m.y += 1.3;
      return m;
    };
    const picked = this.pickTargetInFront(origin, fwd, 22, -0.2);
    const onHit = (p: THREE.Vector3) => {
      if (this.disposed) return;
      this.vfx.aoeBlast(p, color, 2.0);
      this.sparringBlast(p, 2.0, 26, this.params.skillForce * 0.9);
      this.applyStatusScoped(theme.status, theme.scope);
    };
    this.abilities.cast(kitAbility(`elem:${element}`, "bolt", color, 0), {
      onImpact: () => {
        if (!this.character || this.disposed) return;
        const from = muzzle();
        const to = picked ? picked.position.clone() : from.clone().addScaledVector(fwd, 16);
        switch (theme.projectile) {
          case "dragon":
            this.vfx.castDragonAt(from, to, color, onHit);
            break;
          case "darkBlades":
            this.vfx.castDarkBladesAt(from, to, color, onHit);
            break;
          case "laser":
            this.vfx.castLaserAt(from, to, color, onHit);
            break;
          case "soul":
            this.vfx.castSoulAt(from, to, color, onHit);
            break;
        }
      },
    });
    if (slot != null) this.armSigSlot(slot, 1.4, 18);
    else {
      this.skillCooldownMax = 1.4;
      this.skillCooldown = 1.4;
      this.stamina = Math.max(0, this.stamina - 18);
    }
    return true;
  }

  // ------------------------------------------------------------------ Staff kit

  /** True while the equipped weapon is a staff (the `magic` weapon group). */
  private isStaffEquipped(): boolean {
    return getWeapon(this.weaponId).group === "magic";
  }

  /** True while wielding the Ice Staff tank-mage kit. */
  private isIceStaff(): boolean {
    return this.weaponId === "staffIce" || getWeapon(this.weaponId).element === "ice";
  }

  /** Themed bolt/blast colour for the equipped staff (element tint, else arcane). */
  private staffColor(): number {
    const el = getWeapon(this.weaponId).element;
    return el ? ELEMENT_THEME[el].color : STAFF_ARCANE_COLOR;
  }

  /** Casting-hand world muzzle (collider-bound when available) else chest height. */
  private staffMuzzle(): THREE.Vector3 {
    const pose = this.colliderPose();
    if (pose) return pose.pos.clone();
    const m = this.character!.root.position.clone();
    m.y += 1.3;
    return m;
  }

  // ─────────────────────────────────────────────── Locked Beam Cast system

  /** Cancel in-flight beam cast (weapon swap / death / character change). */
  private cancelBeamCast() {
    this.beamCastSession = null;
  }

  /**
   * Resolve frozen aim at cast start: hard-lock target if any, else soft aim /
   * crosshair planar, else controller forward. Y is flattened for ground beams.
   */
  private resolveBeamAimDir(): THREE.Vector3 {
    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    if (target) {
      const planar = this.toTargetPlanar(target);
      if (planar.dir.lengthSq() > 1e-4) return planar.dir.clone().setY(0).normalize();
    }
    if (this.controller) {
      const f = this.controller.forward().clone().setY(0);
      if (f.lengthSq() > 1e-4) return f.normalize();
    }
    return new THREE.Vector3(0, 0, 1);
  }

  /**
   * Start a beam cast: ethereal charge VFX + cast clip, freeze aim, then beam
   * fires at end of castTime. No re-aim / re-face while session is live.
   */
  private startBeamCast(opts?: {
    profileOverride?: BeamCastProfile;
    dir?: THREE.Vector3;
    skipAnim?: boolean;
  }): boolean {
    if (!this.character || !this.controller || this.disposed) return false;
    if (this.beamCastSession && this.beamCastSession.phase !== "done") return false;
    if (this.recoverLock > 0) return false;

    const profile = opts?.profileOverride ?? beamProfileForWeapon(this.weaponId);
    const dir = (opts?.dir ?? this.resolveBeamAimDir()).clone().setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();

    // Lock facing once — hold this through charge + beam
    this.controller.faceToward(dir, 0.25);

    const origin = this.muzzleOrigin(dir);
    const token = this.weaponToken;
    this.beamCastSession = createBeamSession(
      profile,
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: 0, z: dir.z },
      token,
    );

    // Cast animation (prefer profile clips)
    if (!opts?.skipAnim) {
      let played = false;
      for (const name of profile.castAnims) {
        if (this.character.hasClip(name)) {
          this.character.playClipOnce(name, 0.1);
          played = true;
          break;
        }
      }
      if (!played && this.character.hasRole("attack")) {
        this.character.playRoleOnce("attack", 0.1);
      }
    }

    // Spinning ethereal charge at muzzle (tracks hand while charged)
    const chargeDir = dir.clone();
    this.vfx.beamChargeUp(
      () => this.muzzleOrigin(chargeDir),
      profile.chargeColor,
      profile.castTime + 0.08,
    );
    this.sfx?.play("whooshLight", origin, { volume: 0.55 });
    this.setCombatFlash(profile.label.toUpperCase(), profile.castTime + 0.15);
    // Light stamina tax on cast start
    this.stamina = Math.max(0, this.stamina - 8);
    // Soft lock combo / recovery so cast can't be cancelled into melee mid-charge
    this.comboLock = Math.max(this.comboLock, profile.castTime * 0.85);
    return true;
  }

  /**
   * Per-frame beam session: hold facing, fire multi-shader beam at cast end,
   * tick cylinder damage + physics (stun / launch / explode / ragdoll).
   */
  private updateBeamCast(dt: number) {
    const session = this.beamCastSession;
    if (!session) return;
    if (session.token !== this.weaponToken || this.disposed || !this.character || !this.controller) {
      this.beamCastSession = null;
      return;
    }

    const lockedDir = new THREE.Vector3(session.dir.x, 0, session.dir.z);
    if (lockedDir.lengthSq() < 1e-4) lockedDir.set(0, 0, 1);
    lockedDir.normalize();
    // No re-aim: re-face locked dir every frame so movement doesn't pivot the cast
    this.controller.faceToward(lockedDir, 0.35);

    // Keep origin tracking hand for VFX while charge; damage uses frozen origin+dir
    const muzzle = this.muzzleOrigin(lockedDir);
    session.origin = { x: muzzle.x, y: muzzle.y, z: muzzle.z };

    const { enteredBeam, shouldTick, done } = advanceBeamSession(session, dt);

    if (enteredBeam) {
      const p = session.profile;
      // Release / beam pose
      for (const name of p.releaseAnims) {
        if (this.character.hasClip(name)) {
          this.character.playClipOnce(name, 0.08);
          break;
        }
      }
      const origin = new THREE.Vector3(session.origin.x, session.origin.y, session.origin.z);
      this.vfx.lockedBeam({
        origin,
        dir: lockedDir,
        color: p.color,
        coreColor: p.coreColor,
        length: p.length,
        life: p.beamLife,
        radius: p.radius,
      });
      // Muzzle flare + tip impact telegraph
      this.vfx.muzzle(origin, lockedDir, p.coreColor);
      this.vfx.burst(origin, p.color, 12, 1.6);
      this.sfx?.play("whooshHeavy", origin, { volume: 0.75 });
      // Immediate first damage tick on release
      this.applyBeamLineTick(
        origin,
        lockedDir,
        p.length,
        p.radius,
        p.damagePerTick,
        p.physics,
        p.knockback,
        p.knockUp,
        p.color,
      );
    }

    if (shouldTick) {
      const p = session.profile;
      const origin = new THREE.Vector3(session.origin.x, session.origin.y, session.origin.z);
      this.applyBeamLineTick(
        origin,
        lockedDir,
        p.length,
        p.radius,
        p.damagePerTick,
        p.physics,
        p.knockback,
        p.knockUp,
        p.color,
      );
    }

    if (done) this.beamCastSession = null;
  }

  /**
   * Line-cylinder damage tick: 0.1–1 m radius along frozen dir.
   * Physics: stun / launch / explode / ragdoll for enemies, NPCs, bosses.
   */
  private applyBeamLineTick(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    damage: number,
    physics: BeamPhysicsMode,
    knockback: number,
    knockUp: number,
    color: number,
  ) {
    if (!this.targets.beamCylinder) {
      // Fallback path if host lacks beamCylinder
      const tip = origin.clone().addScaledVector(dir, length * 0.7);
      this.targets.blast(tip, Math.max(0.6, radius * 1.5), damage, this.params.skillForce * 0.5, this.sparCtx);
      if (physics === "stun") {
        this.targets.stun(tip, radius * 2, STUN_SECONDS);
        this.targets.reactAt(tip, "stunned");
      } else if (physics === "launch" || physics === "ragdoll" || physics === "explode") {
        this.targets.launch(tip, radius * 2.2, damage * 0.3, Math.max(6, knockUp));
      }
      this.vfx.fireAura(tip, 0.65, this.fireThemeApplied);
      return;
    }

    const hits = this.targets.beamCylinder(
      origin,
      dir,
      length,
      radius,
      damage,
      this.params.skillForce * 0.55,
      { mode: physics, knockback, knockUp },
      this.sparCtx,
    );

    // Visual feedback along the beam spine
    if (hits > 0) {
      const mid = origin.clone().addScaledVector(dir, length * 0.45);
      mid.y += 0.2;
      if (physics === "explode") {
        this.vfx.aoeBlast(mid, color, radius * 2.4);
        this.vfx.shockwave(new THREE.Vector3(mid.x, 0.05, mid.z), color, radius * 3, 0.4);
      } else if (physics === "stun") {
        this.vfx.stunMark(mid, 0xffe24a, STUN_SECONDS * 0.6);
      } else {
        this.vfx.fireAura(mid, 0.7, this.fireThemeApplied);
        this.vfx.burst(mid, color, 4, 1.1);
      }
    }
  }

  /**
   * Staff / wand / tome / 2H cast skill: charge → locked beam.
   * Used by F-skill and signature slots that route to beam.
   */
  private doStaffBeamCast(slot?: number): boolean {
    if (!this.character || !this.controller) return false;
    if (this.beamCastSession) return false;
    if (slot != null) {
      if (this.sigCooldowns[slot]! > 0) return false;
    } else if (this.skillCooldown > 0) {
      return false;
    }
    const profile = beamProfileForWeapon(this.weaponId);
    // Tint profile with equipped staff element colour when present
    const el = getWeapon(this.weaponId).element;
    const tinted: BeamCastProfile = el
      ? {
          ...profile,
          color: ELEMENT_THEME[el].color,
          chargeColor: ELEMENT_THEME[el].color,
        }
      : profile;
    if (!this.startBeamCast({ profileOverride: tinted })) return false;
    // Elemental status rides the first beam tick window (hostile school / holy self).
    if (el) {
      const theme = ELEMENT_THEME[el];
      this.schedule(tinted.castTime + 0.05, () => {
        if (this.disposed) return;
        this.applyStatusScoped(theme.status, theme.scope);
      });
    }
    if (slot != null) {
      this.armSigSlot(slot, Math.max(1.6, tinted.castTime + tinted.beamLife + 0.4), 20);
    } else {
      this.skillCooldownMax = Math.max(1.5, tinted.castTime + tinted.beamLife + 0.35);
      this.skillCooldown = this.skillCooldownMax;
    }
    return true;
  }

  /**
   * Staff LMB primary: a themed spline bolt at the crosshair target (Part 3b).
   * On the ground it carries a short kiting BACK-STEP (Part 3a); while airborne /
   * floating it casts in place (Part 3e — the double-jump levitation cast). Gated
   * by its own light cooldown so it's a steady ranged poke, not a melee combo.
   */
  private doStaffBolt() {
    if (!this.character || !this.controller) return;
    if (this.staffBoltCd > 0) return;
    const tune = applyIntensity(
      rangedPrimaryTune(this.weaponId),
      weaponCombat(this.weaponId).intensity,
    );
    this.staffBoltCd = Math.max(STAFF_BOLT_CD, tune.fireLock * 0.9);
    const color = this.staffColor() || tune.color;
    const grounded = this.controller.state.grounded;

    const combat = weaponCombat(this.weaponId);
    const origin = this.character.root.position.clone();
    const target = this.pickCrosshairTarget(combat);
    const fwd = this.controller.forward();
    let aimDir = fwd.clone();
    if (target) {
      const planar = this.toTargetPlanar(target);
      aimDir = planar.dir.clone();
    }
    this.controller.faceToward(aimDir, 0.2);

    if (grounded) {
      const back = aimDir.clone().multiplyScalar(-1);
      this.controller.dash(back, 1.4, 0.26, 0, 0.5);
    }

    let clipDur = 0;
    for (const name of tune.clips) {
      if (!this.character.hasClip(name)) continue;
      clipDur = this.character.playClipOnce(name, 0.1);
      if (clipDur > 0) break;
    }
    this.sfx?.play("whooshLight", this.staffMuzzle(), { volume: 0.55 });
    // Pulse ring slightly larger while casting primary bolt
    this.reticleAoeScale = Math.max(this.reticleAoeScale, 1.15);

    const releaseAt = rangedReleaseDelay(tune, clipDur);
    const token = this.weaponToken;
    this.schedule(releaseAt, () => {
      if (this.disposed || token !== this.weaponToken || !this.character) return;
      const from = this.staffMuzzle();
      const live = this.pickCrosshairTarget(combat);
      const to = live
        ? live.position.clone()
        : origin.clone().addScaledVector(this.controller?.forward() ?? fwd, tune.range * 0.75).setY(from.y);
      const onHit = (p: THREE.Vector3) => {
        if (this.disposed) return;
        this.vfx.aoeBlast(p, color, 1.2);
        this.sparringBlast(p, 1.2, tune.damage, this.params.skillForce * 0.5);
      };
      this.vfx.splineStrike(from, to, color, onHit);
      this.recoil.kickPitchYaw(tune.recoil.pitch, tune.recoil.yaw);
      this.reticleAoeScale = 1;
    });
    this.stamina = Math.max(0, this.stamina - 4);
  }

  /**
   * Staff signature (slot 2): an AOE spline BARRAGE with scatter (Part 3c). Fires
   * a fan of themed spline bolts that rain onto SCATTERED points around the aim
   * target, each detonating its own small blast — area denial / multi-hit.
   */
  private doStaffScatter(): boolean {
    if (!this.character || !this.controller) return false;
    if (this.sigCooldowns[1]! > 0) return false;
    const color = this.staffColor();
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const picked = this.pickTargetInFront(origin, fwd, 22, -0.2);
    const center = picked ? picked.position.clone() : origin.clone().addScaledVector(fwd, 12);
    center.y = 0;
    if (this.character.hasClip("magicArea")) this.character.playClipOnce("magicArea", 0.12);

    const BOLTS = 6;
    const SCATTER = 2.6;
    // Staff reticle expands into scatter AoE radius indicator
    this.reticleAoeScale = aoeReticleScale(SCATTER);
    const token = this.weaponToken;
    for (let i = 0; i < BOLTS; i++) {
      const ang = (i / BOLTS) * Math.PI * 2 + Math.random() * 0.6;
      const r = SCATTER * (0.35 + Math.random() * 0.65);
      const to = center.clone();
      to.x += Math.cos(ang) * r;
      to.z += Math.sin(ang) * r;
      const onHit = (p: THREE.Vector3) => {
        if (this.disposed) return;
        this.vfx.aoeBlast(p, color, 1.6);
        this.sparringBlast(p, 1.6, 14, this.params.skillForce * 0.7);
      };
      this.schedule(i * 0.07, () => {
        if (this.disposed || token !== this.weaponToken) return;
        this.vfx.splineStrike(this.staffMuzzle(), to, color, onHit);
      });
    }
    this.schedule(0.55, () => {
      if (token === this.weaponToken) this.reticleAoeScale = 1;
    });
    this.armSigSlot(1, 2.6, 24);
    return true;
  }

  /**
   * Staff signature (slot 3): a caster-centred NOVA — an AOE pushback + stun
   * around the mage (Part 3d). Knocks back and stuns every nearby foe, buying
   * space for the ranged kit.
   */
  private doStaffNova(): boolean {
    if (!this.character || !this.controller) return false;
    if (this.sigCooldowns[2]! > 0) return false;
    const color = this.staffColor();
    const center = this.character.root.position.clone();
    const RADIUS = this.params.aoeRadius * 1.2;
    if (this.character.hasClip("magicArea")) this.character.playClipOnce("magicArea", 0.12);
    this.reticleAoeScale = aoeReticleScale(RADIUS);
    this.vfx.aoeBlast(center, color, RADIUS);
    this.sparringBlast(center, RADIUS, 22, this.params.skillForce * 1.6);
    this.markStun(center, RADIUS);
    this.schedule(0.45, () => {
      this.reticleAoeScale = 1;
    });
    this.armSigSlot(2, 3.2, 28);
    return true;
  }

  // -------------------------------------------------------------- Ice Staff kit

  private armIceSig(idx: number) {
    this.sigCooldowns[idx] = ICE_SIG_CD[idx]!;
    this.sigCooldownMaxes[idx] = ICE_SIG_CD[idx]!;
    this.stamina = Math.max(0, this.stamina - ICE_SIG_ST[idx]!);
  }

  /** Dispatch Ice Staff tank-mage signatures (slots 1–4 / index 0–3). */
  private doIceSig(idx: number): boolean {
    if (idx < 0 || idx > 3) return false;
    if (this.sigCooldowns[idx]! > 0) return false;
    switch (idx) {
      case 0:
        return this.doIceSplineAttack();
      case 1:
        return this.doIceWall();
      case 2:
        return this.doIceCloneShell();
      case 3:
        return this.doIceBlizzard();
      default:
        return false;
    }
  }

  /**
   * Slot 1 — Ice Spline: high arc frost bolt via {@link Vfx.splineStrike}.
   * Freezes on impact.
   */
  private doIceSplineAttack(): boolean {
    if (!this.character || !this.controller) return false;
    const color = this.staffColor();
    const origin = this.character.root.position.clone();
    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    const fwd = this.controller.forward();
    let aimDir = fwd.clone();
    if (target) {
      const planar = this.toTargetPlanar(target);
      aimDir = planar.dir.clone();
    }
    this.controller.faceToward(aimDir, 0.2);
    if (this.character.hasClip("magicAttack")) this.character.playClipOnce("magicAttack", 0.1);
    else if (this.character.hasClip("attack")) this.character.playClipOnce("attack", 0.1);

    const from = this.staffMuzzle();
    const to = target
      ? target.position.clone().setY(Math.max(0.6, target.position.y))
      : origin.clone().addScaledVector(fwd, 18).setY(from.y);
    const onHit = (p: THREE.Vector3) => {
      if (this.disposed) return;
      this.vfx.frostGround(p, 1.8, color, 0.7);
      this.vfx.aoeBlast(p, color, 1.5);
      this.sparringBlast(p, 1.6, 22, this.params.skillForce * 0.7);
      this.applyStatusScoped("frozen", "hostile");
    };
    this.vfx.splineStrike(from, to, color, onHit);
    this.sfx?.play("whooshLight", from, { volume: 0.7 });
    this.armIceSig(0);
    return true;
  }

  /**
   * Slot 2 — Ice Wall between caster and enemy.
   * If the foe is inside {@link ICE_WALL_PUSH_RANGE}, shove them first, then
   * deploy the wall in front of the caster with a small push AoE.
   */
  private doIceWall(): boolean {
    if (!this.character || !this.controller) return false;
    const color = this.staffColor();
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const picked = this.pickTargetInFront(origin, fwd, 22, -0.15);
    const enemyPos = picked
      ? picked.position.clone()
      : origin.clone().addScaledVector(fwd, 5);
    enemyPos.y = 0;
    origin.y = 0;

    const toEnemy = new THREE.Vector3(enemyPos.x - origin.x, 0, enemyPos.z - origin.z);
    const dist = toEnemy.length();
    const dir = dist > 1e-3 ? toEnemy.normalize() : fwd.clone();

    if (this.character.hasClip("magicArea")) this.character.playClipOnce("magicArea", 0.12);
    else if (this.character.hasClip("magicAttack")) this.character.playClipOnce("magicAttack", 0.1);

    if (picked && dist < ICE_WALL_PUSH_RANGE) {
      // Close-range: knock foe away, then wall deploys in front of caster.
      this.sparringBlast(enemyPos, 1.4, 18, this.params.skillForce * 1.8);
      this.vfx.frostGround(enemyPos, 1.6, color, 0.5);
      const wallA = origin.clone().addScaledVector(dir, 1.1);
      const wallB = origin.clone().addScaledVector(dir, 1.1 + 0.01);
      // Orient wall perpendicular to push direction via two points along facing.
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      this.vfx.iceWall(
        wallA.clone().addScaledVector(side, -1.6),
        wallA.clone().addScaledVector(side, 1.6),
        color,
        3.4,
      );
      // Small frontal AoE damage on deploy
      const front = origin.clone().addScaledVector(dir, 1.4);
      this.sparringBlast(front, 1.8, 14, this.params.skillForce * 1.1);
      this.vfx.shockwave(front.setY(0.05), color, 2.0, 0.4);
    } else {
      // Standard: wall midway between caster and enemy (or ahead if no target).
      const mid = origin.clone().lerp(enemyPos, picked ? 0.5 : 0.55);
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      this.vfx.iceWall(
        mid.clone().addScaledVector(side, -2.0),
        mid.clone().addScaledVector(side, 2.0),
        color,
        3.6,
      );
      this.sparringBlast(mid, 1.5, 12, this.params.skillForce * 0.85);
      this.vfx.frostGround(mid, 2.0, color, 0.55);
    }
    this.sfx?.play("heavyHit", origin, { volume: 0.45, rate: 1.3 });
    this.armIceSig(1);
    return true;
  }

  /**
   * Slot 3 — Frost Shell: leave a frozen copy of the caster, dodge backward,
   * shell casts a spline ice attack then detonates ground frost (freeze AoE).
   */
  private doIceCloneShell(): boolean {
    if (!this.character || !this.controller) return false;
    const color = this.staffColor();
    const shellPos = this.character.root.position.clone();
    shellPos.y = 0;
    const fwd = this.controller.forward();
    const back = fwd.clone().multiplyScalar(-1);

    // Frozen shell stays behind
    this.vfx.frozenShell(shellPos, color, 2.6);
    this.vfx.frostGround(shellPos, 1.2, color, 0.45);

    // Caster back-dodges / slides away
    this.controller.dash(back, 4.2, 0.38, 0, 0.55);
    this.controller.faceToward(fwd, 0.15);
    if (this.character.hasClip("dodge")) this.character.playClipOnce("dodge", 0.08);
    else if (this.character.hasClip("roll")) this.character.playClipOnce("roll", 0.08);
    else if (this.character.hasClip("walk")) {
      /* motion from dash alone */
    }

    const combat = weaponCombat(this.weaponId);
    const target = this.pickCrosshairTarget(combat);
    const to = target
      ? target.position.clone()
      : shellPos.clone().addScaledVector(fwd, 14).setY(1.2);
    const token = this.weaponToken;

    // Shell casts spline after a beat, then explodes frost
    this.schedule(0.35, () => {
      if (this.disposed || token !== this.weaponToken) return;
      const from = shellPos.clone().setY(1.35);
      this.vfx.splineStrike(from, to.clone().setY(Math.max(0.5, to.y)), color, (p) => {
        if (this.disposed) return;
        this.vfx.frostGround(p, 1.6, color, 0.6);
        this.sparringBlast(p, 1.5, 20, this.params.skillForce * 0.75);
        this.applyStatusScoped("frozen", "hostile");
      });
    });
    this.schedule(1.15, () => {
      if (this.disposed || token !== this.weaponToken) return;
      this.vfx.frostGround(shellPos, 3.4, color, 1.0);
      this.vfx.aoeBlast(shellPos.clone().setY(0.4), color, 3.2);
      this.sparringBlast(shellPos, 3.2, 28, this.params.skillForce * 1.25);
      this.applyStatusScoped("frozen", "hostile");
      this.markStun(shellPos, 2.8, 1.2);
    });

    this.armIceSig(2);
    return true;
  }

  /**
   * Slot 4 — Blizzard: sustained frost field, periodic freeze + damage ticks.
   */
  private doIceBlizzard(): boolean {
    if (!this.character || !this.controller) return false;
    const color = this.staffColor();
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const picked = this.pickTargetInFront(origin, fwd, 24, -0.2);
    const center = picked
      ? picked.position.clone()
      : origin.clone().addScaledVector(fwd, 8);
    center.y = 0;

    if (this.character.hasClip("magicArea")) this.character.playClipOnce("magicArea", 0.12);
    else if (this.character.hasClip("magicAttack")) this.character.playClipOnce("magicAttack", 0.1);

    const token = this.weaponToken;
    this.vfx.blizzardField(center, 7.2, color, 3.6, (p, i) => {
      if (this.disposed || token !== this.weaponToken) return;
      this.sparringBlast(p, 6.5, 10 + i * 2, this.params.skillForce * 0.55);
      if (i % 2 === 0) this.applyStatusScoped("frozen", "hostile");
    });
    this.sfx?.play("whooshHeavy", center, { volume: 0.55, rate: 0.85 });
    this.armIceSig(3);
    return true;
  }

  /**
   * Ice staff grounded mobility: dash then slide. `extended` (AAA/DDD) travels
   * farther and holds the slide recovery longer.
   */
  private doIceSlideDash(side: "L" | "R", extended: boolean) {
    if (!this.character || !this.controller) return;
    if (this.iceSlideCd > 0 || this.controller.isBusy) return;
    if (!this.controller.isGrounded) return;

    const fwd = this.controller.forward();
    // Camera-right for lateral; combine with slight forward so slide feels committed.
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();
    const lat = side === "R" ? right : right.clone().multiplyScalar(-1);
    const dir = lat.clone().addScaledVector(fwd, 0.35).normalize();

    const dist = extended ? ICE_SLIDE_DIST_LONG : ICE_SLIDE_DIST;
    const dur = extended ? 0.55 : 0.36;
    this.controller.dash(dir, dist, dur, 0, 0.7);
    this.controller.faceToward(dir, 0.12);

    // Prefer dedicated slide/dodge clips; fall back to roll/walk.
    const slideClips = extended
      ? ["slide", "roll", "dodge", "run"]
      : ["slide", "dodge", "roll", "run"];
    for (const name of slideClips) {
      if (this.character.hasClip(name)) {
        this.character.playClipOnce(name, 0.08);
        break;
      }
    }
    // Frost trail under the slide path
    const origin = this.character.root.position.clone();
    this.vfx.frostGround(origin, extended ? 1.6 : 1.1, this.staffColor(), 0.4);
    this.schedule(dur * 0.75, () => {
      if (this.disposed || !this.character) return;
      this.vfx.frostGround(this.character.root.position.clone(), 1.0, this.staffColor(), 0.35);
      // End-of-slide pose: re-trigger slide if available for the "slide out"
      if (this.character.hasClip("slide")) this.character.playClipOnce("slide", 0.1);
      else if (this.character.hasClip("crouch")) this.character.playClipOnce("crouch", 0.1);
    });

    this.iceSlideCd = extended ? 1.1 : 0.55;
    this.stamina = Math.max(0, this.stamina - (extended ? 14 : 8));
  }

  // ------------------------------------------------------------------- Tank kit

  private armTankSig(idx: number) {
    this.sigCooldowns[idx] = TANK_SIG_CD[idx];
    this.sigCooldownMaxes[idx] = TANK_SIG_CD[idx];
    this.stamina = Math.max(0, this.stamina - TANK_SIG_ST[idx]);
  }

  /** Dispatch a Tank/Centurion gunblade signature skill (slot 0-3). */
  private doTankSig(idx: number, kit: TankKit): boolean {
    if (idx < 0 || idx > 3) return false;
    if (this.sigCooldowns[idx] > 0) return false;
    switch (idx) {
      case 0:
        return this.doTankCharge(kit);
      case 1:
        return this.doTankBash(kit);
      case 2:
        return this.doTankFlurry(kit);
      case 3:
        return this.doTankCannon(kit);
      default:
        return false;
    }
  }

  /**
   * Sig 1 — Shield Charge: a committed forward shield-bash dash that closes onto
   * the aimed target, knocking back + stunning everything in the impact zone.
   */
  private doTankCharge(kit: TankKit): boolean {
    if (!this.character || !this.controller) return false;
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.2);
    if (this.character.hasClip("dashAttack")) this.character.playClipOnce("dashAttack", 0.1);

    const dist = picked
      ? THREE.MathUtils.clamp(picked.dist - 1.0, 1.5, kit.chargeDistance)
      : kit.chargeDistance;
    const color = SKILL_COLOR.slam;
    const endpoint = origin.clone().addScaledVector(dir, dist);
    this.vfx.dashStreak(origin, endpoint, color);
    this.controller.dash(dir, dist, 0.34, dist * 0.12, 0.8);

    this.abilities.cast(kitAbility("tankCharge", "slam", color, 0.26), {
      onImpact: () => {
        if (!this.character || this.disposed) return;
        const hit = this.character.root.position.clone().addScaledVector(dir, kit.chargeRadius * 0.6);
        const flat = new THREE.Vector3(hit.x, 0.05, hit.z);
        this.vfx.aoeBlast(hit, color, kit.chargeRadius);
        this.vfx.shockwave(flat, color, kit.chargeRadius, 0.4);
        this.sparringBlast(hit, kit.chargeRadius, kit.chargeDamage, this.params.skillForce * 1.6);
        this.markStun(hit, kit.chargeRadius);
      },
    });
    this.armTankSig(0);
    return true;
  }

  /**
   * Sig 2 — Shield Bash: a fast point-blank scutum slam in front of the tank that
   * staggers (stuns) and shoves back anything pressing the guard.
   */
  private doTankBash(kit: TankKit): boolean {
    if (!this.character || !this.controller) return false;
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.22);
    if (this.character.hasClip("stab")) this.character.playClipOnce("stab", 0.1);
    this.controller.dash(dir, 1.2, 0.18, 1.2 * 0.3, 0.6);

    const color = SKILL_COLOR.thrust;
    this.abilities.cast(kitAbility("tankBash", "thrust", color, 0.12), {
      onImpact: () => {
        if (!this.character || this.disposed) return;
        const hit = this.character.root.position.clone().addScaledVector(dir, kit.bashRadius * 0.7);
        hit.y += 1.0;
        this.vfx.impact(hit, color, 1.4);
        this.vfx.burst(hit, color, 24, kit.bashRadius * 2);
        this.sparringBlast(hit, kit.bashRadius, kit.bashDamage, this.params.skillForce * 1.2);
        this.markStun(hit, kit.bashRadius);
      },
    });
    this.armTankSig(1);
    return true;
  }

  /**
   * Sig 3 — Blade Flurry: a committed sword+shield flurry of `flurryHits` rapid
   * cuts driven by the sword combo clips, each resolving a forward AoE swing.
   */
  private doTankFlurry(kit: TankKit): boolean {
    if (!this.character || !this.controller) return false;
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.2);
    const color = SKILL_COLOR.slash;
    const clips = ["comboHit1", "comboHit2", "comboHit3", "attack4"];
    const gap = 0.16;

    for (let i = 0; i < kit.flurryHits; i++) {
      this.abilities.cast(kitAbility("tankFlurry", "slash", color, i * gap), {
        onImpact: () => {
          if (!this.character || !this.controller || this.disposed) return;
          const swing = clips[i % clips.length];
          if (this.character.hasClip(swing)) this.character.playClipOnce(swing, 0.08);
          // A small forward step on each cut so the flurry presses the target.
          this.controller.dash(dir, 0.9, gap, 0, 0.5);
          const hit = this.character.root.position.clone().addScaledVector(dir, kit.flurryRadius * 0.6);
          hit.y += 1.0;
          this.vfx.impact(hit, color, 1.1);
          this.vfx.burst(hit, color, 14, kit.flurryRadius * 1.6);
          this.sparringBlast(hit, kit.flurryRadius, kit.flurryDamage, this.params.skillForce * 0.8);
        },
      });
    }
    this.armTankSig(2);
    return true;
  }

  /**
   * Sig 4 — Super Cannon: the gunblade's capstone. A brief brace/charge windup,
   * then a heavy beam fired straight from the barrel that detonates in a big AoE
   * blast at the first target it reaches (or the end of its range).
   */
  private doTankCannon(kit: TankKit): boolean {
    if (!this.character || !this.controller) return false;
    const cfg = this.assistConfig();
    const origin = this.character.root.position.clone();
    const fwd = this.controller.forward();
    const picked = this.pickTargetInFront(origin, fwd, kit.cannonRange, -0.2);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.25);
    if (this.character.hasClip("skill")) this.character.playClipOnce("skill", 0.12);

    const color = SKILL_COLOR.laser;
    // Charge telegraph at the muzzle during the windup.
    const windup = 0.45;
    const chargeAt = this.muzzleOrigin(dir);
    this.vfx.shockwave(new THREE.Vector3(chargeAt.x, 0.05, chargeAt.z), color, 2.0, windup);

    this.abilities.cast(kitAbility("tankCannon", "laser", color, windup), {
      onImpact: () => {
        if (!this.character || this.disposed) return;
        const muzzle = this.muzzleOrigin(dir);
        this.vfx.muzzle(muzzle, dir, color);
        const range = picked
          ? THREE.MathUtils.clamp(picked.dist + 1, 4, kit.cannonRange)
          : kit.cannonRange;
        // A fat, fast beam that blasts a big AoE where it lands.
        this.vfx.bolt(muzzle, dir, color, 90, range, (p) => {
          this.vfx.aoeBlast(p, color, kit.cannonRadius);
          this.vfx.burst(p, color, 48, kit.cannonRadius * 1.8);
          this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), color, kit.cannonRadius, 0.5);
          this.sparringBlast(p, kit.cannonRadius, kit.cannonDamage, this.params.skillForce * 2);
        });
      },
    });
    this.armTankSig(3);
    return true;
  }

  // ---------------------------------------------------------------- Striker kit

  /**
   * The Striker's 3-hit LMB fire combo, driven by the per-stage `kick.combo[]`
   * config in assets.ts (single source of truth for clip + tuning). Each step
   * names a real GLB clip and carries reach / bounce / force / radius / damage
   * plus optional `lift` (pop the target up) and `hop` (self bounce-away). The
   * stage-specific fire VFX flavour stays here (cosmetic only). Stage 0 = bounce
   * kick up, 1 = fire-foot downward strike, 2 = spinning finisher + cone flame.
   */
  private doKickCombo(stage: number): number {
    if (!this.character || !this.controller) return 0;
    const combo = getCharacter(this.characterId).kick?.combo ?? [];
    const step = combo[Math.min(stage, combo.length - 1)];
    if (!step) return 0;
    const last = stage >= combo.length - 1;

    const cfg = this.assistConfig();
    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(aim, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.20);

    // Per-stage clip from config; fall back to the attack role when the rig is
    // missing that native GLB clip so the strike still animates.
    let dur = 0;
    if (step.clip && this.character.hasClip(step.clip)) dur = this.character.playClipOnce(step.clip, 0.1);
    else if (this.character.hasRole("attack")) dur = this.character.playRoleOnce("attack", 0.1);

    // Reach: close to the picked target, else the step's nominal reach (config).
    const reach = picked
      ? THREE.MathUtils.clamp(picked.dist - 0.9, 0.4, cfg.maxReach)
      : Math.min(step.reach, cfg.maxReach);

    // Lunge in over a slice of the clip, springing back by `bounce` of reach.
    const impactAt = last ? 0.50 : 0.45;
    const lungeDur = THREE.MathUtils.clamp(dur > 0 ? dur * 0.5 : 0.4, 0.22, 0.58);
    this.controller.dash(dir, reach, lungeDur, reach * step.bounce, impactAt);
    // Self bounce-away (flaming-foot hop) at takeoff if the step asks for it.
    if (step.hop) this.controller.hop(step.hop);

    const facing = this.facing();
    this.abilities.cast(kitAbility("kickCombo", "slam", 0xff6020, lungeDur * impactAt), {
      onImpact: () => {
        if (!this.character) return;
        const hit = this.character.root.position.clone().addScaledVector(dir, reach * 0.6);
        // Stage-specific fire VFX flavour (cosmetic; numeric tuning is config-driven).
        if (stage === 0) {
          hit.y += 1.2;
          this.vfx.burst(hit, 0xffe0a0, 22, 4.5);
          this.vfx.impact(hit, 0xffcc70, 1.6);
        } else if (!last) {
          hit.y += 0.7;
          this.vfx.legFlame(hit);
          this.vfx.burst(hit, 0xff6820, 28, 5);
          this.vfx.impact(hit, 0xff8030, 1.9);
        } else {
          hit.y += 1.0;
          this.vfx.legFlame(hit);
          this.vfx.coneFlame(hit, facing);
          this.vfx.burst(hit, 0xff5010, 40, 7);
          this.vfx.impact(hit, 0xff6020, 2.4);
          this.vfx.impactExplode(hit, this.kickChi ? "chi" : "fire");
        }
        // Damage + knockback from config; `lift` pops the struck target upward.
        this.sparringBlast(hit, step.radius, step.damage, this.params.skillForce * step.force);
        this.hitBags(hit, step.radius, this.params.skillForce * step.force, step.damage);
        if (step.lift) this.targets.launch(hit, step.radius, 0, step.lift);
        if (picked) this.controller?.faceToward(dir, 0.25);
      },
    });
    return dur;
  }

  /** Per-sig cooldown for the active kick character (falls back to the Striker baseline). */
  private kickSigCd(i: number): number {
    return getCharacter(this.characterId).kick?.skills[i]?.cooldown ?? STRIKER_SIG_CD[i];
  }

  /** True when the active kick character uses the electric "chi" VFX theme (Tera-kasi). */
  private get kickChi(): boolean {
    return getCharacter(this.characterId).kick?.fx === "chi";
  }

  /**
   * Dispatcher for all four Striker signature skills. Each has its own cooldown
   * so they can be used independently; `idx 0` is also the F-key action.
   */
  private doKickSig(idx: number): boolean {
    if (idx < 0 || idx > 3) return false;
    if (this.sigCooldowns[idx] > 0) return false;
    switch (idx) {
      case 0: return this.doKickSig0();
      case 1: return this.doKickSig1();
      case 2: return this.doKickSig2();
      case 3: return this.doKickSig3();
      default: return false;
    }
  }

  /** Sig 0 — Flanchet Shot: quick bolt-kick toward the aimed target. */
  private doKickSig0(): boolean {
    if (!this.character || !this.controller) return false;
    const clip = "Flanchet Shot";
    if (this.character.hasClip(clip)) this.character.playClipOnce(clip, 0.1);
    else if (this.character.hasRole("attack")) this.character.playRoleOnce("attack", 0.1);
    const fwd = this.facing();
    const origin = this.character.root.position.clone();
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.character.root.rotation.y, 0));
    // Short lunge + bolt VFX for the "shooting kick" feel.
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, fwd, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(fwd, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.18);
    this.controller.dash(dir, Math.min(1.8, cfg.maxReach), 0.25, 0.8, 0.45);
    this.vfx.playSkill("bolt", origin, fwd, quat);
    if (this.kickChi) this.vfx.lightning(origin.clone().add(new THREE.Vector3(0, 1.0, 0)), 1.1);
    this.sigCooldowns[0] = this.kickSigCd(0);
    this.sigCooldownMaxes[0] = this.kickSigCd(0);
    this.stamina = Math.max(0, this.stamina - STRIKER_SIG_ST[0]);
    return true;
  }

  /**
   * Sig 1 — Launch Kick: a high rising kick that launches the target upward,
   * followed by a snap-back procedural backflip with afterimage blur.
   */
  private doKickSig1(): boolean {
    if (!this.character || !this.controller) return false;
    const origin = this.character.root.position.clone();
    const cfg = this.assistConfig();
    const aim = this.controller.forward();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(aim, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.20);

    let dur = 0;
    if (this.character.hasClip("Have a Taste")) dur = this.character.playClipOnce("Have a Taste", 0.1);
    else if (this.character.hasRole("attack")) dur = this.character.playRoleOnce("attack", 0.1);

    const reach = picked
      ? THREE.MathUtils.clamp(picked.dist - 0.8, 0.5, cfg.maxReach)
      : Math.min(2.4, cfg.maxReach);
    const lungeDur = THREE.MathUtils.clamp(dur > 0 ? dur * 0.45 : 0.38, 0.22, 0.52);

    // Lunge into the target with no bounce (body stays put for the backflip).
    this.controller.dash(dir, reach, lungeDur, 0, 0.42);

    const color = SKILL_COLOR["slam"];
    this.vfx.dashStreak(origin, origin.clone().addScaledVector(dir, reach), color);

    this.abilities.cast(kitAbility("kickLaunch", "slam", color, lungeDur * 0.42), {
      onImpact: () => {
        if (!this.character || !this.controller) return;
        const hit = this.character.root.position.clone().addScaledVector(dir, reach * 0.5);
        hit.y += 1.4; // high kick
        this.vfx.legFlame(hit);
        this.vfx.burst(hit, 0xff9030, 32, 6);
        this.vfx.impact(hit, 0xff7020, 2.2);
        if (this.kickChi) this.vfx.lightning(hit, 1.3);
        // Upward launch force on targets.
        this.sparringBlast(hit, 2.2, 38, this.params.skillForce * 1.4);
        // Snap the body back with an afterimage blur (procedural backflip).
        const backDir = dir.clone().negate();
        this.vfx.afterimage(this.character.root, this.character.root.position.clone(), backDir, 2.0, 0xff9040, 5, 0.42);
        this.controller.dash(backDir, 1.6, 0.24, 0, 1.0);
      },
    });

    this.sigCooldowns[1] = this.kickSigCd(1);
    this.sigCooldownMaxes[1] = this.kickSigCd(1);
    this.stamina = Math.max(0, this.stamina - STRIKER_SIG_ST[1]);
    return true;
  }

  /**
   * Sig 2 — Flame Tornado: spin with a flaming leg, then fire a wide flame-slash
   * at the crosshair target. From the ground the body launches upward first;
   * from hover (or while already airborne) the spin fires immediately without a
   * re-launch, so skills 1/2/3 are all usable during hover as intended.
   */
  private doKickSig2(): boolean {
    if (!this.character || !this.controller) return false;
    const cs = this.controller.state;
    const hovering = this.controller.isHovering;
    // Usable from ground OR while hovering; blocked during a normal jump arc
    // so the player can't chain-fire it by double-jumping then pressing 3.
    if (!cs.grounded && !hovering) return false;

    let dur = 0;
    if (this.character.hasClip("Diable Jambe")) dur = this.character.playClipOnce("Diable Jambe", 0.1);
    else if (this.character.hasRole("attack")) dur = this.character.playRoleOnce("attack", 0.1);
    void dur; // timing is procedural; clip drives the joint animation

    // Ground activation gets a full upward launch; hover stays airborne.
    if (cs.grounded) {
      this.controller.skyLaunch(this.params.jumpHeight * 0.75);
    }

    // Leg-flame bursts during the rise/spin sell the tornado silhouette.
    const spinDur = hovering ? 0.8 : 1.4; // faster fire when already aloft
    for (let i = 0; i < 5; i++) {
      this.abilities.cast(kitAbility("kickTornadoFlame", "slash", 0xff6020, i * (spinDur / 5)), {
        onImpact: () => {
          if (!this.character) return;
          const pos = this.character.root.position.clone();
          pos.y += 0.6;
          this.vfx.legFlame(pos);
          this.vfx.burst(pos, 0xff6020, 8, 2.5);
        },
      });
    }

    // At the apex/spin-end, fire the flame-slash toward the soft-aimed target.
    // Use the crosshair ray + soft-aim acquisition (same pipeline as combat) so
    // the projectile tracks the aimed enemy rather than flying off-axis.
    this.abilities.cast(kitAbility("kickTornadoFire", "slash", 0xff6020, spinDur), {
      onImpact: () => {
        if (!this.character) return;
        const fireOrigin = this.character.root.position.clone();
        fireOrigin.y += 1.1;
        // Soft-aim: try to resolve a crosshair target, fall back to camera ray.
        const ray = this.crosshairRay();
        const softCos = 0.82; // ~35 deg cone — generous lock-on
        const target = this.targets.raycast(ray, 20, softCos);
        let fireDir: THREE.Vector3;
        if (target) {
          // Aim at the resolved target's centre.
          fireDir = target.position.clone().sub(fireOrigin).normalize();
        } else {
          // No target in cone — fly along camera ray direction.
          fireDir = ray.direction.clone().normalize();
        }
        this.vfx.flameSlash(fireOrigin, fireDir, (hitPos) => {
          this.vfx.burst(hitPos, 0xff5010, 40, 7);
          this.vfx.shockwave(new THREE.Vector3(hitPos.x, 0.05, hitPos.z), 0xff6020, 3.5, 0.6);
          if (this.kickChi) this.vfx.lightning(hitPos.clone().add(new THREE.Vector3(0, 0.8, 0)), 1.4);
          this.sparringBlast(hitPos, 3.0, 50, this.params.skillForce * 1.5);
        });
        this.vfx.coneFlame(fireOrigin, fireDir);
      },
    });

    this.sigCooldowns[2] = this.kickSigCd(2);
    this.sigCooldownMaxes[2] = this.kickSigCd(2);
    this.stamina = Math.max(0, this.stamina - STRIKER_SIG_ST[2]);
    return true;
  }

  /**
   * Sig 3 — Hover: hop backward ~1.5 m, then levitate ~2 m above the floor for
   * ~2.2 seconds. During hover the player keeps one mid-air jump (to exit) and
   * can still fire sigs 0-2. Landing triggers the roll-out recovery.
   */
  private doKickSig3(): boolean {
    if (!this.character || !this.controller) return false;
    const backDir = this.facing().negate();
    // Quick backward hop before the levitation begins.
    this.controller.dash(backDir, 1.5, 0.22, 0, 1.0);
    this.abilities.cast(kitAbility("kickHover", "slam", 0xff9030, 0.22), {
      onImpact: () => {
        if (!this.controller || this.disposed) return;
        this.controller.startHover(2.0, 2.2);
        if (this.character) {
          const pos = this.character.root.position.clone();
          pos.y += 0.3;
          this.vfx.burst(pos, 0xff9030, 20, 4);
          this.vfx.shockwave(new THREE.Vector3(pos.x, 0.05, pos.z), 0xff6020, 2.0, 0.45);
          if (this.kickChi) this.vfx.lightning(pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 1.2);
        }
      },
    });
    this.sigCooldowns[3] = this.kickSigCd(3);
    this.sigCooldownMaxes[3] = this.kickSigCd(3);
    this.stamina = Math.max(0, this.stamina - STRIKER_SIG_ST[3]);
    return true;
  }

  /**
   * Load a kick-style character's extra FBX clips and inject them into the rig's
   * action map under synthetic `striker:*` names, keyed off `CharacterDef.kickClips`
   * (Tera-kasi pulls the reserved flip_kick.fbx as its combo opener). Characters
   * without `kickClips` (the Striker) stay native-only and skip this entirely. Runs
   * after the GLB is committed; falls back gracefully if any clip fails to load.
   */
  private async loadKickClips(id: string) {
    const char = this.character;
    if (!char || this.disposed) return;
    const def = getCharacter(id);
    const clips = def.kickClips;
    if (!clips || clips.length === 0) return;
    const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
    const base = (import.meta.env.BASE_URL as string) ?? "/animator/";
    const baseTrimmed = base.replace(/\/$/, "");
    const loader = new FBXLoader();
    await Promise.all(
      clips.map(async ({ name, file }) => {
        try {
          const group = await loader.loadAsync(`${baseTrimmed}/${file.replace(/^\//, "")}`);
          const clip = group.animations[0];
          if (clip && char === this.character && !this.disposed) {
            // Character has no public addClip — escape to any so FBX clip
            // registration still works at runtime while keeping other code typed.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.character as unknown as any).addClip?.(name, clip);
          }
        } catch {
          // Clip missing or FBX failed — fallback GLB clips are used instead.
        }
      }),
    );
  }

  /**
   * Striker's foot-fighting move: face the best target in view, play the REAL
   * attack/skill clip (joint motion), lunge the body in along an eased spline,
   * land the hit at the strike point, then spring back like a ninja (bounce).
   * No canned/forced animation — the clip drives the body. Returns clip length.
   */
  private doKickLunge(opts: {
    clip?: string;
    damage: number;
    force: number;
    radius: number;
    kind?: SkillKind;
  }): number {
    if (!this.character || !this.controller) return 0;
    const origin = this.character.root.position.clone();
    // Aim down the camera, but steer the lunge toward a target using the
    // character's direction-assist (cone width + snap blend).
    const cfg = this.assistConfig();
    const aim = this.controller.forward();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(aim, origin, picked, cfg.steer);

    // Real clip drives the joints; fall back to the attack role if it's missing.
    let dur = 0;
    if (opts.clip && this.character.hasClip(opts.clip)) dur = this.character.playClipOnce(opts.clip, 0.1);
    else if (this.character.hasRole("attack")) dur = this.character.playRoleOnce("attack", 0.1);

    // Reach toward the target (stop just short), else a short committed step.
    // Dash rating scales how far the lunge commits (cfg.maxReach).
    const reach = picked
      ? THREE.MathUtils.clamp(picked.dist - 0.9, 0.4, cfg.maxReach)
      : Math.min(2.2, cfg.maxReach);
    // Lunge timed to the clip so spline + joint motion stay in lockstep.
    const lungeDur = THREE.MathUtils.clamp(dur > 0 ? dur * 0.55 : 0.4, 0.26, 0.6);
    const impactAt = 0.45;
    const bounce = reach * 0.78; // spring most of the way back -> ninja recoil
    this.controller.dash(dir, reach, lungeDur, bounce, impactAt);

    const strike = origin.clone().addScaledVector(dir, reach);
    const color = opts.kind ? SKILL_COLOR[opts.kind] : 0xffe6a8;
    this.vfx.dashStreak(origin, strike, color);

    this.abilities.cast(kitAbility("kickLunge", opts.kind ?? "slam", color, lungeDur * impactAt), {
      onImpact: () => {
        const hit = strike.clone();
        hit.y += 1.0;
        if (opts.kind) {
          // Signature flavor (bolt shot / slam shock / arc) layered on the kick.
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(dir.x, dir.z), 0));
          const skillOrigin = this.character ? this.character.root.position.clone() : strike.clone();
          this.vfx.playSkill(opts.kind, skillOrigin, dir, q);
        }
        this.vfx.burst(hit, 0xfff0c6, 26, 5);
        this.vfx.shockwave(new THREE.Vector3(hit.x, 0.05, hit.z), color, opts.radius, 0.42);
        this.targets.blast(hit, opts.radius, opts.damage, opts.force);
      },
    });
    return dur;
  }

  /**
   * Resolve the active character's attack-assist tuning into concrete steering
   * numbers. `directionAssist` (0-100) widens the acquisition cone and the snap
   * blend toward a target; `dashRating` (0-100) scales how far a strike lunges
   * (50 = the editor's Dash Distance, 100 = double).
   */
  /**
   * The current character's baseline move-speed multiplier — the value any
   * transient speed change (expose slow, phantom buff) must restore TO, not a
   * bare `1`. The Tank/Centurion is permanently slow, so resetting to 1 would
   * silently strip its identity after a recovery window.
   */
  private baseSpeedMul(): number {
    return getCharacter(this.characterId).tank?.moveSpeedMul ?? 1;
  }

  private assistConfig() {
    const def = getCharacter(this.characterId);
    const assist = THREE.MathUtils.clamp(def.directionAssist ?? 50, 0, 100) / 100;
    const dash = THREE.MathUtils.clamp(def.dashRating ?? 50, 0, 100) / 100;
    return {
      // 0 -> no steer (pure camera aim); 1 -> snap onto the target. Scaled live by
      // the editor's Attack Steer knob so auto-aim strength is tunable at runtime.
      steer: THREE.MathUtils.clamp(assist * this.params.attackSteer, 0, 1),
      // 0 -> narrow ~32deg cone; 1 -> wide 90deg cone (never acquires behind).
      minDot: THREE.MathUtils.lerp(0.85, 0.0, assist),
      // Acquisition reach grows a little with assist.
      acqRange: (this.params.dashDistance + 2.5) * (0.6 + 0.8 * assist),
      // 0.5 rating -> 1x Dash Distance; 1.0 -> 2x.
      maxReach: Math.max(1.2, this.params.dashDistance * dash * 2),
    };
  }

  /** Steer `base` toward the picked target by the assist blend (in place safe). */
  private steerToward(
    base: THREE.Vector3,
    origin: THREE.Vector3,
    picked: { position: THREE.Vector3 } | null,
    steer: number,
  ): THREE.Vector3 {
    const dir = base.clone();
    if (picked && steer > 0) {
      const to = picked.position.clone().sub(origin);
      to.y = 0;
      if (to.lengthSq() > 1e-4) dir.lerp(to.normalize(), steer).normalize();
    }
    return dir;
  }

  /**
   * Soulbinder "Hot Hands": a chained fire spell-combo on the F key. Each press
   * within the window advances an escalating 3-stage chain — an ember fireball, a
   * flame dragon, then a meteor finisher that LAUNCHES the target — all locked
   * onto the aimed/selected hostile and resolving with growing knockback force.
   * The casting hand blazes (`hotHands`) on every cast. Gated by its own combo
   * lock + stamina (not the shared skillCooldown), so the chain reads as a fluid
   * channel. Tuning is the pure `fireComboStep`; this only orchestrates it.
   */
  private doFireCombo(): boolean {
    if (!this.character || !this.controller) return false;
    if (this.fireComboLock > 0 || this.recoverLock > 0) return false;
    if (this.stamina < 12) return false;

    const stage = this.fireComboTimer > 0 ? this.fireComboIndex : 0;
    const step = fireComboStep(stage);
    const color = SKILL_COLOR.fireDragon;
    const origin = this.character.root.position.clone();
    const fwd = this.facing();

    // @target: pickTargetInFront prefers the Tab-selected red hostile, else the
    // nearest in the forward cone.
    const picked = this.pickTargetInFront(origin, fwd, 24, -0.2);
    const aimDir = picked
      ? picked.position.clone().sub(origin).setY(0).normalize()
      : fwd;
    if (picked) this.controller.faceToward(aimDir, 0.25);

    // Cast clip (no-ops on rigs lacking it) + the blazing casting hand.
    const dur = this.character.hasClip("magicAttack")
      ? this.character.playClipOnce("magicAttack", 0.12)
      : 0;
    const pose = this.colliderPose();
    const from = pose ? pose.pos.clone() : origin.clone().setY(origin.y + 1.3);
    this.vfx.hotHands(from, color, step.handScale);

    // The point the spell flies toward (locked target, else a point ahead).
    const to = picked
      ? picked.position.clone().setY(picked.position.y + 1.0)
      : origin.clone().addScaledVector(aimDir, 12).setY(origin.y + 1.0);

    // Resolve one impact: AoE blast VFX + escalating knockback force, plus a
    // vertical launch on the finisher.
    const resolve = (p: THREE.Vector3) => {
      this.vfx.aoeBlast(p, color, step.radius);
      this.sparringBlast(p, step.radius, step.damage, this.params.skillForce * step.forceMul);
      if (step.launch > 0) this.targets.launch(p, step.radius, 0, step.launch);
    };

    // Data-driven path: the spell VFX launch routes through the orchestrator
    // (shared lifecycle + cancelAll teardown), mirroring the caster F-skill.
    // The projectile arc + impact resolution are owned by the Vfx subsystem (the
    // `resolve` onHit callback), so the cast is instant (duration 0) and `onCast`
    // fires synchronously inside `cast()` — identical to the inline launch.
    const fireKind: SkillKind = stage === 2 ? "meteor" : "fireDragon";
    this.abilities.cast(vfxSkill(fireKind, color, { target: "aimed" }), {
      onCast: () => {
        if (stage === 0) {
          this.vfx.castDragonAt(from, to, color, resolve);
        } else if (stage === 1) {
          this.vfx.flameCone(from, aimDir, color, 4);
          this.vfx.castDragonAt(from, to, color, resolve);
        } else {
          this.vfx.coneFlame(from, aimDir);
          this.vfx.castMeteor(from, aimDir, color, resolve, to);
        }
      },
    });

    // Advance the chain. The finisher resets it and imposes a longer recovery
    // lock so the whole combo can't be re-fired instantly.
    this.stamina = Math.max(0, this.stamina - 12);
    if (step.finisher) {
      this.fireComboIndex = 0;
      this.fireComboTimer = 0;
      this.fireComboLock = dur > 0 ? Math.max(dur, 0.9) : 0.9;
    } else {
      this.fireComboIndex = stage + 1;
      this.fireComboTimer = (dur > 0 ? dur : 0.5) + COMBO_WINDOW;
      this.fireComboLock = dur > 0 ? dur * COMBO_PLAYTHROUGH : 0.3;
    }
    return true;
  }

  /** Nearest living target within `maxDist` and inside the forward cone (dot >= minDot). */
  private pickTargetInFront(
    origin: THREE.Vector3,
    fwd: THREE.Vector3,
    maxDist: number,
    minDot: number,
  ): { position: THREE.Vector3; dist: number } | null {
    // Honor the Tab-selected hostile (red target) first: an offensive ability
    // locks onto it even if it's outside the aim cone or another enemy is nearer,
    // as long as it's within the ability's acquisition range. Cone/nearest below
    // is the fallback only when no red target is selected or it's out of range.
    const sel = this.targets.selectedHostilePoint?.() ?? null;
    if (sel) {
      const to = sel.clone().sub(origin);
      to.y = 0;
      const d = to.length();
      if (preferSelectedHostile(d, maxDist)) return { position: sel, dist: d };
    }
    const cands = this.targets.nearest(origin, 6);
    for (const h of cands) {
      const to = h.position.clone().sub(origin);
      to.y = 0;
      const d = to.length();
      if (d < 1e-3 || d > maxDist) continue;
      to.normalize();
      if (to.dot(fwd) >= minDot) return { position: h.position.clone(), dist: d };
    }
    return null;
  }

  /**
   * Skyfall special: leap up with a twist-flip + taunt, then at the apex summon
   * energy ABOVE the player that arcs up and rains down onto nearby targets.
   * Castable from the ground OR mid-air (the "2nd jump" launch).
   */
  skyfall() {
    if (!this.character || !this.controller) return;
    if (this.skyfallCooldown > 0 || this.skyfallPending) return;
    this.skyfallCooldown = 3.5;
    this.skyfallPending = true;
    this.skyfallPendingTimer = 1.5;
    // Twist-flip launch straight up; the taunt clip (when the rig has one) plays
    // over the rising flip so the body taunts and flips at the same time.
    this.controller.skyLaunch(this.params.jumpHeight * 1.5);
    const taunt = this.character.clipNames().find((n) => /taunt|cheer|victory|provoke|flex|wave|dance/i.test(n));
    if (taunt) this.character.playClipOnce(taunt, 0.12);
    // Charge flare around the player as the leap begins.
    const center = this.character.root.position.clone();
    center.y += 1.1;
    this.vfx.burst(center, 0xd8b8ff, 40, this.params.aoeRadius * 2);
  }

  private fireSkyfall() {
    const player = this.character.root.position.clone();
    // Energy gathers in a node ABOVE the player's head, then bolts spring up from
    // it, arc higher, and dive onto each target (rise -> fall, per the reference).
    const source = player.clone();
    source.y += 5.2;
    this.vfx.aoeBlast(source, 0xb98cff, this.params.aoeRadius * 1.2);
    this.vfx.burst(source, 0xd8b8ff, 56, this.params.aoeRadius * 2);
    const bolts = Math.max(1, Math.round(this.params.skyfallBolts));
    const targets = this.targets.nearest(player, bolts);
    for (let i = 0; i < bolts; i++) {
      const tgt = targets[i];
      let to: THREE.Vector3;
      if (tgt) {
        to = tgt.position.clone();
      } else {
        // No target — strike a random nearby ground point.
        const ang = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 6;
        to = new THREE.Vector3(player.x + Math.cos(ang) * r, 0.5, player.z + Math.sin(ang) * r);
        to.x = THREE.MathUtils.clamp(to.x, -14, 14);
        to.z = THREE.MathUtils.clamp(to.z, -14, 14);
      }
      const from = source.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1, (Math.random() - 0.5) * 1.5));
      const rise = 4 + Math.random() * 3;
      this.schedule(i * 0.08, () => {
        this.vfx.skyfallStrike(from, to, 0xb98cff, rise, (p) => {
          this.vfx.aoeBlast(p, 0xb98cff, this.params.aoeRadius * 1.4);
          this.vfx.burst(p, 0xd8b8ff, 64, this.params.aoeRadius * 2.2);
          this.sparringBlast(p, this.params.aoeRadius * 1.15, 60, this.params.skillForce);
        });
      });
    }
  }

  /** Run `fn` after `delay` seconds (driven by the main loop). */
  private schedule(delay: number, fn: () => void) {
    this.pending.push({ t: delay, fn });
  }

  private updatePending(dt: number) {
    if (this.pending.length === 0) return;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.pending.splice(i, 1);
        p.fn();
      }
    }
  }

  private facing(): THREE.Vector3 {
    const y = this.character.root.rotation.y;
    return new THREE.Vector3(Math.sin(y), 0, Math.cos(y)).normalize();
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    // Container is hidden/zero-sized (e.g. behind a full-screen panel): skip so we
    // don't allocate a 0×0 buffer or divide by zero on the aspect.
    if (w === 0 || h === 0) return;
    // Re-apply DPR every resize: it changes when the window moves between displays
    // or the user zooms, and a stale ratio renders blurry or oversized.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postfx?.setSize(w, h);
  }

  /**
   * Underwater ambience while sinking through the dungeon's water band: ease a
   * 0..1 factor toward 1 in water / 0 out, then lerp the scene fog + background
   * from the base dark tone toward a murky blue and thicken the fog so the
   * descent reads as a real underwater section. A slow rising bubble stream is
   * emitted around the player while submerged. Everything clears smoothly on
   * exit above or below the band (and is snapped to base when leaving the dungeon).
   */
  private updateWaterFx(dt: number, inWater: boolean) {
    const target = inWater ? 1 : 0;
    // ~0.4s ease either direction so the tint fades rather than snaps.
    this.waterFx += (target - this.waterFx) * Math.min(1, dt * 6);
    if (this.waterFx < 0.001) this.waterFx = 0;
    const k = this.waterFx;
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.copy(this.baseFogColor).lerp(this.waterFogColor, k);
      fog.near = THREE.MathUtils.lerp(this.baseFogNear, Studio.FOG_WATER_NEAR, k);
      fog.far = THREE.MathUtils.lerp(this.baseFogFar, Studio.FOG_WATER_FAR, k);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.baseBgColor).lerp(this.waterFogColor, k);
    }
    // Rising bubbles around the player while genuinely submerged.
    if (inWater && this.character) {
      this.bubbleAccum += dt;
      const interval = 0.16;
      while (this.bubbleAccum >= interval) {
        this.bubbleAccum -= interval;
        this.vfx.bubbles(this.character.root.position);
      }
    } else {
      this.bubbleAccum = 0;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const raw = Math.min(this.timer.getDelta(), 0.05);
    // One global time-scale slows (or restores) the whole simulation: physics,
    // animation, combat timers and scheduled hits all run off this scaled delta.
    // The A.L.E. Bot layers its own slow-mo beat on top during highlights so the
    // user's manual time-scale slider stays independent.
    const dt = raw * this.timeScale * this.ale.timeScale();
    const t = this.timer.getElapsed();
    // FPS tracks the real frame rate, independent of the simulation time-scale.
    this.fps += (1 / Math.max(raw, 0.0001) - this.fps) * 0.1;

    // ── Instant replay ──
    // While an instant replay is playing, live combat is frozen: the A.L.E. Bot
    // re-poses the recorded fighters in slow-mo and drives the camera, fully
    // decoupled from the duel/AI/physics, then we render & resume below.
    if (this.ale.isReplaying) {
      const rdt = raw * this.timeScale;
      const views = this.targets instanceof Targets ? this.targets.fighterViews() : [];
      this.ale.updateReplay(rdt, views);
      this.ale.applyCamera(this.camera);
      this.renderFrame(rdt);
      this.hudAccum += rdt;
      if (this.hudAccum >= 0.1) {
        this.hudAccum = 0;
        this.pushHud();
      }
      return;
    }

    this.room.update(t);
    // Prefer live CPT RAC / radio pulse so the booth dances to real tracks.
    this.djBooth?.update(dt, this.sfx?.getMusicPulse() ?? null);
    // Door portal prompt: lit only in the Danger Room while standing at the arch.
    this.doorPrompt =
      !this.inDungeon &&
      !this.enteringDungeon &&
      !this.inArena &&
      this.character != null &&
      this.room.nearDoor(this.character.root.position);
    if (this.controller && this.character) {
      // Track the live enemy each frame; release the stance if the target dies.
      if (this.locked) {
        const lp = this.targets.lockPoint();
        if (lp) this.controller.setLockTarget(lp);
        else {
          this.locked = false;
          this.controller.setLockTarget(null);
        }
      }
      // Shared aim feel: decay recoil and feed the live offset to the camera,
      // ease the sprint FOV kick, and size the crosshair spread — all before the
      // controller positions the camera this frame.
      this.recoil.update(dt);
      this.controller.setAimOffset(this.recoil.pitch, this.recoil.yaw);
      const spd = this.controller.state.speed;
      const sprinting = spd > this.params.moveSpeed * 1.1 && this.controller.state.grounded;
      this.fovKickCur = fovKick(this.fovKickCur, 0, 8, sprinting, dt);
      this.controller.setFovKick(this.fovKickCur);
      // Weapon-aware base gap (melee 0, gun 3–8, bow 4) + motion/recoil bloom
      const retProf = reticleProfileForWeapon(this.weaponId);
      this.aimSpread =
        retProf.baseGap + Math.min(spd, 8) * 1.5 + this.recoil.bloom * 200;
      // Staff ring breathe
      if (retProf.shape === "ring") {
        this.reticlePulseT = (this.reticlePulseT + dt * retProf.pulseHz) % 1;
      }
      // Cast placement → HUD ring tracks world AoE radius
      if (this.castPlacement) {
        const r = this.castPlacement.radius ?? this.params.aoeRadius;
        this.reticleAoeScale = aoeReticleScale(r);
      } else if (this.reticleAoeScale > 1 && !this.castPlacement) {
        // Ease back when placement ends (skills set their own reset schedules)
        this.reticleAoeScale = THREE.MathUtils.lerp(this.reticleAoeScale, 1, Math.min(1, 4 * dt));
        if (this.reticleAoeScale < 1.02) this.reticleAoeScale = 1;
      }
      this.controller.update(dt);
      // Dynamic TPS: combat soft/hard, tools, swim, climb — one profile at a time
      this.tickDynamicCamera();
      // Harvest RMB path: approach selected node then swing
      this.updateHarvestMove();
      // The Controller mutates cameraDistance directly on wheel-zoom (shared
      // params object); persist it (debounced) so zoom level survives reloads.
      if (this.params.cameraDistance !== this.lastSavedCamDist) this.queueControlsSave();
      // A/D movement SSOT (Elden Ring / Souls-like + universal AA/DD dash):
      //  • Hard FOCUS (RMB lock) → pure strafe (Controller setLockTarget faces enemy)
      //  • Soft lock / free       → walk/run camera-relative (body may face move)
      //  • Double-tap A / D       → directional dodge-dash (ALL weapons / heroes)
      //  • Ice staff: triple-tap  → extended slide; double-tap still slides
      //  • Key X                  → timed dodge-roll (any direction held)
      {
        const tripA = this.input.consumeTripleTap("KeyA");
        const tripD = this.input.consumeTripleTap("KeyD");
        const dblA = this.input.consumeDoubleTap("KeyA");
        const dblD = this.input.consumeDoubleTap("KeyD");
        if (this.isIceStaff() && !this.locked) {
          if (tripA) this.doIceSlideDash("L", true);
          else if (tripD) this.doIceSlideDash("R", true);
          else if (dblA) this.doIceSlideDash("L", false);
          else if (dblD) this.doIceSlideDash("R", false);
        } else {
          // Universal AA / DD directional dash-dodge for every character option
          if (dblA || tripA) this.dodgeRoll("L");
          else if (dblD || tripD) this.dodgeRoll("R");
        }
      }
      if (this.controller.consumeDoubleJump()) {
        const p = this.character.root.position.clone();
        p.y += 0.4;
        // Pistol: cut backflip away from target → 0.5s hover aim (LMB ready).
        // Once per ground (Controller.airDoubleUsed) — same rule as staff hover.
        if (this.weaponId === "pistol") {
          this.doPistolAirBackflip();
        } else if (this.isStaffEquipped()) {
          // Staffs: double-jump levitation (per-element foot disc) — except Ice.
          // Only once between ground contacts (pairs with one wall jump for triple).
          const hover = staffHoverTheme(getWeapon(this.weaponId).element);
          this.vfx.burst(p, hover.color, 18, 3);
          if (hover.noFloat || this.isIceStaff()) {
            this.vfx.frostGround(this.character.root.position.clone(), 1.4, hover.color, 0.45);
          } else {
            const apex = Math.max(2.2, this.character.root.position.y + 1.0);
            this.controller.startHover(apex, STAFF_FLOAT_SECONDS);
          }
        } else {
          this.vfx.burst(p, 0x9fe8ff, 16, 3);
          const weaponless = !!getCharacter(this.characterId).weaponless;
          const combat = weaponCombat(weaponless ? "none" : this.weaponId);
          const target = this.pickCrosshairTarget(combat);
          if (target) {
            const { dir, dist } = this.toTargetPlanar(target);
            if (dist > 0.6) {
              const close = THREE.MathUtils.clamp(dist - combat.range[0], 0.6, this.params.dashDistance * 1.4);
              this.controller.dash(dir, close, 0.4, 0, 0.9);
              this.controller.faceToward(dir, 0.25);
            }
          }
        }
      }
      // Wall jump: foot-plant kick off wall (Space near wall / on wall-run).
      if (this.controller.consumeWallJump()) {
        const p = this.character.root.position.clone();
        p.y += 0.9;
        this.vfx.burst(p, 0xc8e0ff, 14, 2.4);
        this.vfx.impact(p, 0xa0c8ff, 1.1);
        this.setCombatFlash("WALL JUMP", 0.45);
        // Prefer unused wall-kick clips if the default controller path missed them
        if (this.character.hasClip("jumpAway")) this.character.playClipOnce("jumpAway", 0.05);
        else if (this.character.hasClip("utilityKick")) this.character.playClipOnce("utilityKick", 0.05);
      }
      // Wall run / freehang: Documents Wall Run.fbx on start; climb hang loco after
      if (this.controller.consumeWallRunStart()) {
        this.character.setTraversalMode?.("climb");
        this.setCombatFlash("WALL RUN", 0.5);
        // Prefer dedicated wall-run stride clip, then freehang entry pack
        if (this.character.hasClip("wallRun")) {
          this.character.playClipOnce("wallRun", 0.08);
        } else if (this.character.hasClip("jumpToFreehang")) {
          this.character.playClipOnce("jumpToFreehang", 0.08);
        } else if (this.character.hasClip("standToFreehang")) {
          this.character.playClipOnce("standToFreehang", 0.08);
        } else if (this.character.hasClip("mantle")) {
          this.character.playClipOnce("mantle", 0.08);
        }
      }
      if (this.controller.consumeWallRunEnd()) {
        this.character.setTraversalMode?.("ground");
      }
      // Keep climb mode while wall-running → freehang idle/climb loco
      if (this.controller.isWallRunning) {
        this.character.setTraversalMode?.("climb");
        // Re-trigger wall-run stride if the one-shot ended and we're still running
        if (this.character.hasClip("wallRun") && !this.character.isOneShotActive) {
          this.character.playClipOnce("wallRun", 0.1);
        }
      }
      // Slam touchdown: detonate the ground explosion + force wave. This takes
      // priority over (and suppresses) the generic landing flair below.
      const didSlam = this.controller.consumeSlamLanded();
      if (didSlam) {
        this.slamPending = false;
        this.doSlamImpact();
      }
      // Landing: Striker does a roll-out recovery after a double-jump or hover;
      // other characters (and grounded Striker jumps) get the generic shockwave.
      const didLand = this.controller.consumeLanded();
      const didRollLand = this.controller.consumeRollLanding();
      const rdef = getCharacter(this.characterId);
      if (didSlam) {
        // Ground blast already fired above; skip the generic land flair.
      } else if (didRollLand && rdef.meleeStyle === "kick") {
        // Roll-out recovery: themed fire flash + a procedural body roll (this rig
        // has no native roll clip, so the controller's tumble sells the recovery).
        const p = this.character.root.position.clone();
        this.vfx.shockwave(p, 0xffaa50, 1.6, 0.38);
        this.vfx.burst(p.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xffc060, 16, 3);
        if (rdef.kick && !this.controller.isBusy) {
          this.controller.rollOut(this.controller.forward(), 0.55);
          this.vfx.flame(p, rdef.kick.palette.ember, 18, 3);
        }
      } else if (didLand) {
        const p = this.character.root.position.clone();
        this.vfx.shockwave(p, 0xbcd2ff, 1.8, 0.4);
        this.vfx.burst(p.clone().add(new THREE.Vector3(0, 0.1, 0)), 0xdfe9ff, 14, 2.5);
        // Striker: roll out of a hard or double-jump landing to absorb the impact.
        const ldef = getCharacter(this.characterId);
        if (ldef.meleeStyle === "kick" && ldef.kick && !this.controller.isBusy) {
          const info = this.controller.landingInfo;
          const hard = info.speed > Math.sqrt(2 * this.params.gravity * this.params.jumpHeight) * 1.15;
          if (info.doubled || hard) {
            this.controller.rollOut(this.controller.forward(), 0.55);
            this.vfx.flame(p, ldef.kick.palette.ember, 18, 3);
          }
        }
      }
      // Aerial-spin finisher: fire a flame-slash projectile toward the crosshair.
      if (this.controller.consumeSpinEnd() && this.spinSkill) {
        const { skill, pal } = this.spinSkill;
        this.spinSkill = null;
        const start = this.character.root.position.clone();
        start.y += 0.6;
        const target = this.pickCrosshairTarget(weaponCombat("none"));
        let dir: THREE.Vector3;
        let range = 16;
        if (target) {
          const to = target.position.clone().sub(start);
          dir = to.clone().normalize();
          range = THREE.MathUtils.clamp(to.length() + 2, 4, 20);
        } else {
          dir = this.crosshairRay().direction.clone();
        }
        this.vfx.flameSlashProjectile(start, dir, pal.flame, pal.ember, 24, range, (p) => {
          this.vfx.flameCone(p, dir, pal.flame, skill.radius + 1);
          this.sparringBlast(p, skill.radius, skill.damage, this.params.skillForce * skill.force);
        });
      }
      // Per-frame fire while the Striker is spinning or hovering.
      const fdef = getCharacter(this.characterId);
      // Keep the flame palette in sync with the active character (fire vs chi).
      const desiredTheme = fdef.kick?.fx === "chi" ? "chi" : "fire";
      if (desiredTheme !== this.fireThemeApplied) {
        this.vfx.setFireTheme(desiredTheme);
        this.fireThemeApplied = desiredTheme;
      }
      if (fdef.kick && (this.controller.spinning || this.controller.hovering)) {
        const pal = fdef.kick.palette;
        const fp = this.character.root.position.clone();
        const spin = this.controller.spinning;
        fp.y += spin ? 1.1 : 0.3;
        this.vfx.flame(fp, spin ? pal.flame : pal.ember, spin ? 6 : 3, 2);
        // GPU trailing flame around the spinning/hovering body.
        this.vfx.flameTrailPoint(fp);
      }
      // Hover foot FX: staffs get a per-element spinning disc (arcane / wind /
      // nature / holy / fire); Striker keeps leg-flame jets. Ice never hovers.
      if (this.controller.isHovering) {
        this.hoverFlameAccum += dt;
        const HOVER_FX_INTERVAL = this.isStaffEquipped() ? 0.12 : 0.1;
        while (this.hoverFlameAccum >= HOVER_FX_INTERVAL) {
          this.hoverFlameAccum -= HOVER_FX_INTERVAL;
          const base = this.character.root.position;
          if (this.isStaffEquipped()) {
            const hover = staffHoverTheme(getWeapon(this.weaponId).element);
            if (hover.style !== "none") {
              this.vfx.hoverFootDisc(
                base.clone().setY(0.05),
                hover.color,
                hover.style === "fire" ||
                  hover.style === "wind" ||
                  hover.style === "nature" ||
                  hover.style === "holy" ||
                  hover.style === "arcane" ||
                  hover.style === "storm"
                  ? hover.style
                  : "arcane",
              );
            }
          } else {
            const yaw = this.character.root.rotation.y;
            const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            for (const s of [-0.22, 0.22]) {
              const foot = base.clone().addScaledVector(side, s);
              foot.y += 0.1;
              this.vfx.legFlame(foot);
            }
          }
        }
      } else {
        this.hoverFlameAccum = 0;
      }
      if (this.skyfallPending) {
        this.skyfallPendingTimer -= dt;
        // Barrage at the apex, or fail-safe if the apex is never reported (so the
        // pending flag can never deadlock future casts).
        if (this.controller.consumeApex() || this.skyfallPendingTimer <= 0) {
          this.skyfallPending = false;
          this.fireSkyfall();
        }
      }
      // Fail-safe: clear a stuck slam flag if the touchdown is never reported, so
      // the next airborne attack can never deadlock.
      if (this.slamPending) {
        this.slamPendingTimer -= dt;
        if (this.slamPendingTimer <= 0) {
          this.slamPending = false;
          this.controller.cancelSlam();
        }
      }
      // Fail-safe for the aerial dagger overhead: if its scheduled end-of-clip slash
      // never fires (e.g. character swapped mid-swing), clear the flag so the next
      // airborne dagger attack can't deadlock.
      if (this.aerialSlashPending) {
        this.aerialSlashPendingTimer -= dt;
        if (this.aerialSlashPendingTimer <= 0) this.aerialSlashPending = false;
      }
    }
    this.character?.update(dt);
    // Step the Rapier physics core (dungeon/arena colliders + dynamic props).
    this.physics?.step(dt);
    // Drive the sparring opponents with the live player position + damage hooks.
    if (this.character) {
      this.sparCtx.playerPos.copy(this.character.root.position);
      this.sparCtx.playerPos.y += 1.0;
      // Reuse the swim traversal clips + underwater ambience while descending
      // through the dungeon's water band; switch back to ground locomotion and
      // ease the tint out above/below it.
      let inWater = false;
      if (this.inDungeon && this.dungeon && !this.controller?.isWallRunning) {
        const y = this.character.root.position.y;
        const band = { top: this.dungeon.waterTop, bottom: this.dungeon.waterBottom };
        inWater = isInWaterBand(y, band);
        this.character.setTraversalMode?.(traversalModeFor(y, band));
      }
      this.updateWaterFx(dt, inWater);
    }
    this.sparCtx.playerAlive = !this.defeated && this.invuln <= 0;
    // Offense-fail lockout = the player just whiffed/got blocked; opponents read
    // this as a punish window.
    this.sparCtx.playerRecovering = this.recoverLock > 0;
    // Ally heal AI reads player HP each frame.
    this.sparCtx.playerHealth01 =
      this.maxHealth > 0 ? this.health / this.maxHealth : 1;
    if (this.duel?.isActive) {
      // Spectator view: the player is hidden + out of the fight, so the duelling
      // AI must never target the player. Advance the duel before the AI tick so
      // any phase change (spawn / difficulty release) lands this frame.
      this.sparCtx.playerAlive = false;
      this.duel.update(dt);
    }
    // Player-vs-NPC arena match (countdown / fight / result / choice).
    if (this.arenaMatch?.isActive && this.targets instanceof Targets) {
      const counts = this.targets.factionCounts();
      const living = counts.enemy;
      this.arenaMatch.setHudLive({
        livingEnemies: living,
        livingAllies: counts.ally,
        bars: this.buildArenaBars(counts),
      });

      // FFA: player down → score field kill + quick respawn (don't end match).
      if (
        this.arenaMatch.isFfa &&
        this.arenaMatch.isFighting &&
        this.defeated
      ) {
        const lost = this.arenaMatch.recordPlayerDeath();
        this.restorePlayerForArena();
        if (this.character) {
          // Reseat on west pad after death
          this.character.root.position.set(-8, 0, 0);
          this.character.root.rotation.y = Math.PI / 2;
        }
        if (lost) {
          this.targets.setDifficulty("passive");
          this.setCombatFlash(`FIRST TO ${FFA_KILL_GOAL} · DEFEAT`, 2);
        }
      }

      const ev = this.arenaMatch.update(
        dt,
        living,
        this.arenaMatch.isFfa ? false : this.defeated,
      );
      if (ev.releasedFight) {
        const saved = this.arenaSavedDifficulty;
        const fightDiff =
          saved && saved !== "passive" ? (saved === "easy" ? "medium" : saved) : "hard";
        this.targets.setDifficulty(fightDiff);
        this.targets.setArenaSkillBoost(true);
        this.setCombatFlash(
          this.arenaMatch.isFfa ? `FIGHT! FIRST TO ${FFA_KILL_GOAL}` : "FIGHT!",
          0.7,
        );
      }
      if (ev.enteredResult) {
        this.targets.setDifficulty("passive");
        this.setCombatFlash(
          ev.enteredResult === "win" ? "VICTORY" : "DEFEAT",
          1.8,
        );
      }
    }
    this.targets.update(dt, this.sparCtx);
    // A.L.E. Bot polls fighter state AFTER the AI tick so it reads this frame's
    // outcomes (cameras, highlights, diagnostics, telemetry).
    if (this.duel?.isActive && this.targets instanceof Targets) {
      this.ale.update(dt, this.targets.fighterViews(), this.duel.state());
    }
    this.arena?.update(dt, this.camera);
    if (this.character) this.status.update(dt, this.character.root.position);
    this.indicators.set(this.targets.indicatorSnapshot?.(this.character?.root.position) ?? []);
    this.indicators.setOverhead(this.targets.selectedHostileHead?.() ?? null);
    this.indicators.update(dt);
    this.telegraphs.update(dt);
    // Sailtest water / wind
    this.forestWorld?.update(dt);
    // Light wind assist when sailing map + character near water surface
    if (this.testWorldId === "sailtest" && this.forestWorld?.sail && this.character && this.controller) {
      const y = this.character.root.position.y;
      const wy = this.forestWorld.sail.waterSurfaceY;
      if (y < wy + 1.2) {
        const w = this.forestWorld.sail.windVelocity(0.35);
        this.character.root.position.x += w.x * dt;
        this.character.root.position.z += w.z * dt;
      }
    }
    // Camp / voxel hostiles (forest creeps + island tribes)
    this.campEnemies?.update(dt, this.character?.root.position ?? null);
    this.volcanoBoss?.update(dt, this.character?.root.position ?? null);
    // Island Life bandit boat raids
    if (this.testWorldId === "island-life") {
      const base = this.character?.root.position ?? new THREE.Vector3();
      this.raiderBoats?.setBase(base);
      this.raiderBoats?.update(dt, this.character?.root.position ?? null);
    }
    // Fabled sky towns — portal spin + E interact / proximity teleport
    if (this.testWorldId === "fabled-zone" && this.fabledSky?.isLoaded) {
      const wantE = this.input.down("KeyE");
      this.fabledSky.update(dt, this.character?.root.position ?? null, {
        wantInteract: wantE,
        autoTeleport: true,
      });
      const hint = this.fabledSky.getHint(this.character?.root.position ?? null);
      if (hint) this.setCombatFlash(hint, 0.35);
    }
    // Player melee splash damages camp creeps
    if (this.campEnemies && this.character && this.activityMode === "combat") {
      // handled on attack connect via damageCampEnemiesNear
    }
    // Camp placeables: animation mixers, towers, traps + ghost follow
    if (this.campBuild) {
      const hostiles: THREE.Vector3[] = [];
      try {
        for (const f of this.targets.fighterViews()) {
          if (f.dead || f.faction !== "enemy") continue;
          hostiles.push(f.group.position.clone());
        }
      } catch {
        /* ignore */
      }
      // Include camp enemies + raiders for tower AI
      for (const p of this.campEnemies?.livingPositions() ?? []) hostiles.push(p);
      for (const e of this.raiderBoats?.enemies ?? []) {
        if (!e.dead) hostiles.push(e.root.position.clone());
      }
      this.campBuild.update(dt, this.character?.root.position, hostiles);
    }
    if (this.campBuild?.isGhostActive && this.character) {
      const origin = this.character.root.position.clone();
      origin.y = 0;
      const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, 1);
      const place = origin.clone().addScaledVector(fwd, 3.2);
      place.y = 0;
      this.campBuild.updateGhost(place);
    }
    this.updatePending(dt);
    // Advance data-driven abilities here (same `dt`, adjacent to updatePending)
    // so their cast/impact phases land on the same frame as the legacy schedule.
    this.abilities.update(dt);
    // Advance the Flanged-Mace throw flight (stun on impact, catch on return,
    // fail-safe recall) and reposition the in-flight mace.
    this.updateMaceThrow(dt);
    // Advance the exo-armour transformation + sync the mech to the player.
    this.updateMech(dt);
    // Swell/settle the background music from the live combat state.
    this.updateMusicIntensity(dt);

    // Player combat timers: hurt vignette, invulnerability.
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt);
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.pistolDodgeCd > 0) this.pistolDodgeCd = Math.max(0, this.pistolDodgeCd - dt);
    if (this.airFollowT > 0) this.airFollowT = Math.max(0, this.airFollowT - dt);
    if (this.pistolHoverAimT > 0) {
      this.pistolHoverAimT = Math.max(0, this.pistolHoverAimT - dt);
      // Keep pistol aimed at focus target while hovering after backflip / dive.
      if (this.controller?.isHovering && this.weaponId === "pistol") {
        const t = this.pickCrosshairTarget(weaponCombat("pistol"));
        if (t) {
          this.controller.faceToward(this.toTargetPlanar(t).dir, 0.35);
          if (this.locked) this.controller.setLockTarget(t.position);
        }
      }
    }
    if (this.skillChainWindow > 0) {
      this.skillChainWindow = Math.max(0, this.skillChainWindow - dt);
      if (this.skillChainWindow <= 0) {
        // Chain expired mid-combo — arm remaining CD for that slot
        if (this.skillChainSlot >= 0) {
          const sk = multiPartFor(this.weaponId, this.skillChainSlot);
          if (sk) this.armSigSlot(this.skillChainSlot, sk.cooldown * 0.65, 10);
        }
        this.skillChainSlot = -1;
        this.skillChainPart = 0;
      }
    }
    // Hold Tab → open radial after a short press threshold (quick tap = cycle target).
    if (this.tabHoldArmed && this.input.down("Tab")) {
      this.radialHoldT += dt;
      if (this.radialHoldT >= 0.18 && !this.radialOpen) {
        this.radialOpen = true;
      }
    } else if (!this.input.down("Tab") && this.radialOpen && !this.tabHoldArmed) {
      // Safety close if key state desyncs
      this.radialOpen = false;
    }
    if (this.tumbleT > 0) {
      this.tumbleT = Math.max(0, this.tumbleT - dt);
      if (this.tumbleT <= 0) this.tumbleActive = false;
    }
    this.afterDamageT += dt;
    if (this.hurt > 0.01) this.afterDamageT = 0;
    this.refreshCombatContext();
    this.updateGunInput(dt);
    this.updateCastPlacement(dt);
    if (this.dodgeCd > 0) this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.slideCd > 0) this.slideCd = Math.max(0, this.slideCd - dt);
    this.updateCombatSlide(dt);
    if (this.iceSlideCd > 0) this.iceSlideCd = Math.max(0, this.iceSlideCd - dt);
    if (this.forceFieldCd > 0) this.forceFieldCd = Math.max(0, this.forceFieldCd - dt);
    if (this.smashRecoverCd > 0) this.smashRecoverCd = Math.max(0, this.smashRecoverCd - dt);
    if (this.respectWindow > 0) this.respectWindow = Math.max(0, this.respectWindow - dt);

    // KeyC parry session age + auto-clear when CC leaves parry
    if (this.parrySession) {
      this.parrySession.age += dt;
      if (
        this.parrySession.age > 0.55 ||
        (this.sparring && this.sparring.getPlayerState() !== "parry" && this.parrySession.age > 0.05)
      ) {
        this.parrySession = null;
      }
    }
    // Failed-parry stamina: drip restored points over ~2s
    if (this.parryFailStamRemaining > 0 && this.parryFailStamRate > 0) {
      const give = Math.min(this.parryFailStamRemaining, this.parryFailStamRate * dt);
      this.sparring.restorePlayerStamina(give, 0.05);
      this.parryFailStamRemaining = Math.max(0, this.parryFailStamRemaining - give);
      if (this.parryFailStamRemaining <= 1e-3) {
        this.parryFailStamRemaining = 0;
        this.parryFailStamRate = 0;
      }
    }

    // Single combat authority: tick the player CC and read CC-authoritative
    // health/stamina back so gating code (skill cost checks, etc.) stays in sync.
    this.sparring.update(dt);
    // In pvp the server owns the player's HP (read back from snapshots); only
    // mirror the local CC health in solo/coop. Stamina stays CC-authoritative.
    if (this.net?.mode !== "pvp") this.health = this.sparring.getPlayerHealth();
    this.stamina = this.sparring.getPlayerStamina();

    // Combat flash: countdown and clear when expired.
    if (this.combatFlashTimer > 0) {
      this.combatFlashTimer = Math.max(0, this.combatFlashTimer - dt);
      if (this.combatFlashTimer === 0) this.combatFlash = "";
    }

    // Weapon collider trail: grip→tip ribbon while swing window active.
    // Samples every frame so the trail follows the real weapon collider path
    // (not a random slash mesh). Flame GPU trail stays for fire-themed skills.
    if (this.swingTimer > 0 && this.mounted?.tip && this.character) {
      this.swingTimer -= dt;
      const tipPos = new THREE.Vector3();
      this.mounted.tip.getWorldPosition(tipPos);
      const basePos = new THREE.Vector3();
      const grip = this.mounted.tip.parent;
      if (grip) grip.getWorldPosition(basePos);
      else {
        // Fallback: hand / root with offset toward tip
        basePos.copy(tipPos);
        const hand = this.character.rightHand;
        if (hand) hand.getWorldPosition(basePos);
        else this.character.root.getWorldPosition(basePos);
      }
      this.vfx.bladeTrailSegment(basePos, tipPos, this.swingColor);
    }

    if (this.skillCooldown > 0) this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    if (this.staffBoltCd > 0) this.staffBoltCd = Math.max(0, this.staffBoltCd - dt);
    // Locked beam cast session (charge → beam ticks → done)
    this.updateBeamCast(dt);
    this.mechReconciler.tickCooldown(dt);
    for (let i = 0; i < this.mechCds.length; i++) {
      if (this.mechCds[i] > 0) this.mechCds[i] = Math.max(0, this.mechCds[i] - dt);
    }
    if (this.skyfallCooldown > 0) this.skyfallCooldown = Math.max(0, this.skyfallCooldown - dt);
    if (this.comboLock > 0) this.comboLock = Math.max(0, this.comboLock - dt);
    if (this.recoverLock > 0) this.recoverLock = Math.max(0, this.recoverLock - dt);
    if (this.kickCd > 0) this.kickCd = Math.max(0, this.kickCd - dt);
    if (this.throwCd > 0) this.throwCd = Math.max(0, this.throwCd - dt);
    if (this.potionCd > 0) this.potionCd = Math.max(0, this.potionCd - dt);
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.comboIndex = 0;
    }
    // Striker kick combo timers.
    if (this.kickComboLock > 0) this.kickComboLock = Math.max(0, this.kickComboLock - dt);
    if (this.kickComboTimer > 0) {
      this.kickComboTimer = Math.max(0, this.kickComboTimer - dt);
      if (this.kickComboTimer === 0) this.kickComboIndex = 0;
    }
    // Soulbinder "Hot Hands" fire-combo timers.
    if (this.fireComboLock > 0) this.fireComboLock = Math.max(0, this.fireComboLock - dt);
    if (this.fireComboTimer > 0) {
      this.fireComboTimer = Math.max(0, this.fireComboTimer - dt);
      if (this.fireComboTimer === 0) this.fireComboIndex = 0;
    }
    // Per-signature-skill cooldowns (Striker + Kiter).
    for (let i = 0; i < 4; i++) {
      if (this.sigCooldowns[i] > 0) this.sigCooldowns[i] = Math.max(0, this.sigCooldowns[i] - dt);
    }
    // Kiter Smoke Phantom: restore visibility + normal speed when the buff ends.
    if (this.phantomTimer > 0) {
      this.phantomTimer = Math.max(0, this.phantomTimer - dt);
      if (this.phantomTimer === 0) {
        // While suited up the pilot is hidden and the mech owns the speed
        // multiplier — let the mech keep ownership instead of clobbering it.
        this.mechReconciler.restorePlayerIfMechInactive();
      }
    }
    // Gun kit: RMB lock → slight kiting speed so A/D strafe + rolls stay fluid
    // under upper-body shoot overlays. Restore base when lock drops.
    if (
      this.controller &&
      this.phantomTimer <= 0 &&
      this.recoverLock <= 0 &&
      !getCharacter(this.characterId).tank &&
      isGunWeapon(this.weaponId)
    ) {
      this.controller.setSpeedMultiplier(
        this.locked ? this.baseSpeedMul() * 1.08 : this.baseSpeedMul(),
      );
    }
    // Stamina is read from the CC each frame (see getPlayerStamina below the loop);
    // do NOT regen it locally — the CombatController handles regen internally.

    this.vfx.update(dt);
    // Network snapshot cadence must stay real-time so slow-mo (a local tuning
    // tool) never throttles outbound multiplayer reports — drive it off `raw`.
    this.updateNet(raw);
    // A.L.E. director camera overrides the player camera last (when active) so a
    // duel can be watched from a selected POV/drone view without touching the
    // player Controller.
    this.ale.applyCamera(this.camera);
    this.renderFrame(dt);

    this.hudAccum += dt;
    if (this.hudAccum >= 0.1) {
      this.hudAccum = 0;
      this.pushHud();
    }
  };

  private pushHud() {
    const weaponless = !!getCharacter(this.characterId).weaponless;
    const def = getCharacter(this.characterId);
    const w = getWeapon(weaponless ? "none" : this.weaponId);
    const cs = this.controller?.state;
    const isKick = def.meleeStyle === "kick";
    // Albion-style: always expose per-slot sig CDs on the HUD (1–4 independent).
    const perSig = true;
    // Project the Tab-locked enemy's head to screen pixels for the floating frame.
    let selectedTarget: HudSnapshot["selectedTarget"] = null;
    const tv = this.targets.selectedView();
    if (tv) {
      const ndc = tv.head.clone().project(this.camera);
      // Require the point to be in front of the camera AND within the frustum;
      // a bare `z <= 1` lets behind-camera points (which still map to on-screen
      // x/y) draw a ghost frame.
      if (ndc.z >= -1 && ndc.z <= 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) {
        const el = this.renderer.domElement;
        const w = el.clientWidth || el.width;
        const h = el.clientHeight || el.height;
        selectedTarget = {
          x: (ndc.x * 0.5 + 0.5) * w,
          y: (-ndc.y * 0.5 + 0.5) * h,
          health: tv.health,
          maxHealth: tv.maxHealth,
          name: tv.name,
        };
      }
    }
    // Project the Shift+Tab-selected ally's head for its (green) floating frame.
    let selectedAllyTarget: HudSnapshot["selectedAllyTarget"] = null;
    const av = this.targets.selectedAllyView?.();
    if (av) {
      const ndc = av.head.clone().project(this.camera);
      if (ndc.z >= -1 && ndc.z <= 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) {
        const el = this.renderer.domElement;
        const w = el.clientWidth || el.width;
        const h = el.clientHeight || el.height;
        selectedAllyTarget = {
          x: (ndc.x * 0.5 + 0.5) * w,
          y: (-ndc.y * 0.5 + 0.5) * h,
          health: av.health,
          maxHealth: av.maxHealth,
          name: av.name,
        };
      }
    }
    // Focused enemy combat readout (HUD bars) from the unified CombatTargets.
    const ecv = this.targets.focusedCombatView(
      this.character?.root.position ?? new THREE.Vector3(),
    );
    // Dungeon zone cue: surface / underwater / pit, derived from the player's Y
    // against the same water band that drives swim mode (see update loop). Null
    // outside the dungeon so the HUD shows no zone label.
    let zone: HudSnapshot["zone"] = null;
    if (this.inDungeon && this.dungeon && this.character) {
      const y = this.character.root.position.y;
      zone =
        y > this.dungeon.waterTop
          ? "surface"
          : y >= this.dungeon.waterBottom
            ? "underwater"
            : "pit";
    }
    // Distinct boss bar: only when the locked hostile is a boss-tier enemy
    // (e.g. Moloch Da God in the pit). Reuses the selectedView read above.
    const boss: HudSnapshot["boss"] = tv?.isBoss
      ? {
          name: tv.name,
          health: Math.round(tv.health),
          maxHealth: tv.maxHealth,
          hint: tv.bossHint ?? "",
        }
      : null;
    // OWR reticle ring + edge SFX: classify the nearest enemy vs the current
    // weapon's optimal band right before the snapshot so the cue stays in sync.
    this.updateOwrRange();
    // Portrait for threejs-rapier UnitFrame (race PNG / account avatar).
    const port = resolveHudPortrait(this.characterId, {
      raceId: (def as { raceId?: string }).raceId ?? parseGrudgeAvatarId(this.characterId)?.raceId,
      classId: (def as { classId?: string }).classId ?? parseGrudgeAvatarId(this.characterId)?.presetId,
    });

    this.onHud({
      character: def.name,
      weapon: weaponless ? "none" : this.weaponId,
      weaponLabel: weaponless ? "Black Leg" : w.label,
      skillName: weaponless ? "Diable Jambe" : w.skillName,
      portraitUrl: port.url,
      portraitCandidates: port.candidates,
      level: 1,
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      poise: Math.round(this.sparring.getPlayerPoise()),
      maxPoise: this.sparring.getPlayerMaxPoise(),
      combatState: this.sparring.getPlayerState(),
      critWindow: this.sparring.getPlayerCritWindow(),
      combatFlash: this.combatFlash,
      enemyHealth: ecv ? Math.round(ecv.health) : 0,
      enemyMaxHealth: ecv?.maxHealth ?? 0,
      enemyStamina: ecv ? Math.round(ecv.stamina) : 0,
      enemyMaxStamina: ecv?.maxStamina ?? 0,
      enemyPoise: ecv ? Math.round(ecv.poise) : 0,
      enemyMaxPoise: ecv?.maxPoise ?? 0,
      enemyCritWindow: ecv?.critWindow ?? 0,
      enemyCombatState: ecv?.state ?? "idle",
      // F-skill uses skillCooldown; kick maps F → sig0. Never use one timer for 1–4.
      skillReady: isKick ? this.sigCooldowns[0]! <= 0 : this.skillCooldown <= 0,
      skillCooldown: isKick ? this.sigCooldowns[0]! : this.skillCooldown,
      skillCooldownMax: isKick
        ? this.sigCooldownMaxes[0]! || 1
        : this.skillCooldownMax,
      skyfallCooldown: this.skyfallCooldown,
      skyfallCooldownMax: 3.5,
      // Striker + Kiter expose per-skill cooldowns for each sig slot.
      sigCooldowns: perSig ? [...this.sigCooldowns] : [0, 0, 0, 0],
      sigCooldownMaxes: perSig ? [...this.sigCooldownMaxes] : [0, 0, 0, 0],
      hovering: this.controller?.isHovering ?? false,
      locked: this.input.locked,
      /** Hard FOCUS (combat) vs soft lock — drives reticle freedom + LMB semantics. */
      focusLocked: this.locked,
      freeMouse: this.freeMouseMode,
      // Prefer fleet SurfaceLocomotion (Controller.state.locoCam); fall back to legacy probes.
      locoCam: (this.controller?.state?.locoCam as "ground" | "swim" | "climb" | undefined) ||
        (this.controller?.isInWater()
          ? "swim"
          : this.controller?.isWallRunning
            ? "climb"
            : "ground"),
      firstPerson: this.viewMode === "first",
      aimSpread: this.aimSpread,
      /** Free-aim crosshair NDC offset (0 = over centre dot). */
      aimNdcX: this.aimNdcX,
      aimNdcY: this.aimNdcY,
      reticleShape: reticleProfileForWeapon(this.weaponId).shape,
      reticlePulse: this.reticlePulseT,
      reticleAoeScale: this.reticleAoeScale,
      owrRange: this.owrRangeState,
      hitMarker: this.hitMarkerCount,
      grounded: cs?.grounded ?? true,
      jumpsLeft: cs?.jumpsLeft ?? 2,
      speed: cs ? Math.round(cs.speed * 100) / 100 : 0,
      fps: Math.round(this.fps),
      targetsAlive: this.targets.aliveCount,
      difficulty: this.difficulty,
      blocking: this.blocking,
      activityMode: this.activityMode,
      activityTool: this.activityTool,
      radialOpen: this.radialOpen,
      hurt: this.hurt,
      // Suppress free-roam "Respawning…" overlay during arena (result UI owns it).
      defeated: this.defeated && !this.arenaMatch?.isActive,
      selectedTarget,
      selectedAllyTarget,
      zone,
      boss,
      clip: this.character?.currentClipName() ?? "",
      slots: this.getSlotBindings(),
      statuses: this.status.views(),
      prompt: this.doorPrompt
        ? "Hit E to Enter"
        : this.inDungeon
          ? "Hit E to Leave"
          : null,
      inDungeon: this.inDungeon,
      arena: this.arenaMatch?.isActive ? this.arenaMatch.state() : null,
      mech: this.mech.isPiloted
        ? {
            abilities: MECH_ABILITIES.map((a, i) => ({
              key: a.key,
              name: a.name,
              icon: a.icon,
              cd: this.mechCds[i],
              cdMax: a.cd,
            })),
          }
        : null,
      duel: this.duelState(),
      ale: this.ale.snapshot(),
    });
  }

  /** Select the A.L.E. duel camera ("off" hands the view back to the player). */
  setDuelCamera(mode: AleCameraMode): void {
    this.ale.setCameraMode(mode);
  }

  /** Toggle the A.L.E. diagnostics lens (colliders + markers). Returns new state. */
  toggleDuelDiagnostics(on?: boolean): boolean {
    return this.ale.toggleDiagnostics(on);
  }

  /** Play an instant replay of the last seconds of recorded fight footage. */
  startReplay(): boolean {
    return this.ale.startReplay();
  }

  /** Pause/resume the active replay's playhead (scrub controls). */
  setReplayPaused(paused: boolean): void {
    this.ale.setReplayPaused(paused);
  }

  /** Toggle pause on the active replay; returns the new paused state. */
  toggleReplayPaused(): boolean {
    return this.ale.toggleReplayPaused();
  }

  /** Set the active replay's playback rate (1 = recorded real-time). */
  setReplaySpeed(speed: number): void {
    this.ale.setReplaySpeed(speed);
  }

  /** Scrub the active replay's playhead to a 0..1 position in the window. */
  seekReplay(progress: number): void {
    this.ale.seekReplay(progress);
  }

  /** Cut to a different camera while a replay is playing. */
  setReplayCamera(mode: AleCameraMode): void {
    this.ale.setReplayCamera(mode);
  }

  /** End the active replay early, restoring live poses + camera. */
  stopReplay(): void {
    this.ale.stopReplay();
  }

  /** Choose how often KOs/highlights auto-trigger an instant replay. */
  setReplayFrequency(freq: ReplayFrequency): void {
    this.ale.setReplayFrequency(freq);
  }

  // ---- Dungeon Mode ---------------------------------------------------------

  /**
   * Door-portal interaction (bound to E by App). While inside the dungeon this
   * leaves it; in the Danger Room it enters only when the player stands at the
   * arch. Returns true when the key was consumed (so App skips the editor panel).
   */
  tryEnterDoor(): boolean {
    if (this.inArena) return false;
    if (this.inDungeon) {
      this.exitDungeon();
      return true;
    }
    if (this.enteringDungeon) return true;
    if (this.character && this.room.nearDoor(this.character.root.position)) {
      void this.enterDungeon();
      return true;
    }
    return false;
  }

  /** Load + mount the dungeon level and swap to its enemy population. */
  private async enterDungeon() {
    if (this.inDungeon || this.enteringDungeon || !this.character) return;
    // A duel owns the Danger Room population + the spectator view; tear it down
    // before swapping to the dungeon so the player re-enters as a live fighter.
    this.stopDuel();
    this.cancelMaceThrow();
    this.enteringDungeon = true;
    this.doorPrompt = false;

    let dungeon: Dungeon | null = null;
    try {
      dungeon = new Dungeon(this.scene, { file: DUNGEON_MAPS[loadDungeonMap()].file });
      await dungeon.load();
      if (this.disposed) {
        dungeon.dispose();
        return;
      }

      // Hide the Danger Room + stash its sparring population (kept alive to restore).
      this.room.group.visible = false;
      if (this.targets instanceof Targets) {
        this.dangerTargets = this.targets;
        this.dangerTargets.group.visible = false;
      }

      // Swap to the dungeon population (same CombatTargets surface). The pit
      // navmesh + spawn drive grudge6 elite pack + map boss (cool armour / tier skills).
      const mapId = loadDungeonMap();
      const enemies = new DungeonEnemies(
        this.scene,
        dungeon.nav,
        dungeon.spawn,
        {
          nav: dungeon.pitNav,
          spawn: dungeon.pitSpawn,
        },
        { mapId },
      );
      enemies.onDeath = (p) => {
        this.vfx.burst(p, 0xff7a8a, 40, 6);
        this.vfx.shockwave(new THREE.Vector3(p.x, p.y + 0.05, p.z), 0xff5a6a, 3, 0.6);
      };
      enemies.onProjectileImpact = (p) => this.vfx.impact(p, 0xffe27a, 1.2);
      enemies.setDifficulty(this.difficulty);
      this.targets = enemies;
      this.wireTargetCombatHooks();

      this.dungeon = dungeon;
      this.inDungeon = true;
      this.locked = false;
      this.controller?.setLockTarget(null);
      // Nested Warlords location (dungeon under Danger Room parent).
      this.locationBag.setLocation(
        dungeonLocation({
          mapId: DUNGEON_MAPS[mapId].file,
          parent: dangerRoomLocation({
            instanceId: this.locationBag.getLocation().instanceId,
          }),
          position: {
            x: dungeon.spawn.x,
            y: dungeon.spawn.y,
            z: dungeon.spawn.z,
          },
        }),
      );

      // The dungeon keeps its own dark dry tone regardless of the room preset, so
      // reset the fog baseline (the water-band fx lerps from this) to the base.
      this.baseFogColor.set(Studio.FOG_BASE_COLOR);
      this.baseFogNear = Studio.FOG_BASE_NEAR;
      this.baseFogFar = Studio.FOG_BASE_FAR;
      this.baseBgColor.set(Studio.FOG_BASE_COLOR);
      this.writeBaselineFog();

      // Fresh start + hand the Controller the dungeon collision + camera occluders.
      this.health = this.maxHealth;
      this.stamina = this.maxStamina;
      this.defeated = false;
      this.controller?.setCollision(dungeon.collision, dungeon.spawn);
      this.controller?.setCameraOccluders(dungeon.occluders);
      // The player sinks (rather than plummets) while inside the water band on
      // the descent from the surface map down to the pit.
      this.controller?.setWaterBand(dungeon.waterTop, dungeon.waterBottom);
    } catch (err) {
      console.error("[Studio] dungeon load failed", err);
      dungeon?.dispose();
      // Roll back any partial swap so the Danger Room stays usable.
      if (!this.inDungeon) {
        this.dungeon = null;
        this.room.group.visible = true;
        if (this.dangerTargets) {
          this.dangerTargets.group.visible = true;
          this.targets = this.dangerTargets;
          this.dangerTargets = null;
        }
      }
    } finally {
      this.enteringDungeon = false;
    }
  }

  /** Tear down the dungeon and restore the Danger Room. */
  private exitDungeon() {
    if (!this.inDungeon) return;
    this.cancelMaceThrow();
    this.targets.dispose();
    this.dungeon?.dispose();
    this.dungeon = null;
    this.inDungeon = false;
    this.locked = false;
    this.controller?.setLockTarget(null);

    // Restore the Danger Room zone: shared Rapier KCC + room bounds (not null).
    // No occluders, no water band, ground traversal, sparring population re-shown.
    this.controller?.setCameraOccluders([]);
    this.controller?.clearWaterBand();
    this.character?.setTraversalMode?.("ground");
    // Snap the underwater tint/fog back to the Danger Room baseline immediately.
    // Adopt the active room preset's atmosphere (not the bare base) so the room
    // returns to its own mood, and re-tune the ambient bed to match.
    this.waterFx = 0;
    this.bubbleAccum = 0;
    this.applyRoomAtmosphere(true);
    this.applyRoomAmbience();
    this.room.group.visible = true;

    const danger = this.dangerTargets ?? new Targets(this.scene);
    danger.group.visible = true;
    danger.onDeath = (p) => {
      this.vfx.burst(p, 0xff7a8a, 40, 6);
      this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0xff5a6a, 3, 0.6);
    };
    this.targets = danger;
    this.wireTargetCombatHooks();
    this.dangerTargets = null;

    // Drop the player back just inside the arena, healed — on shared DR KCC.
    const home = new THREE.Vector3(0, 0, 4);
    this.character?.root.position.copy(home);
    this.applyDangerRoomCollision(home);
    this.locationBag.setLocation(
      dangerRoomLocation({
        position: { x: home.x, y: home.y, z: home.z },
      }),
    );
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.defeated = false;
  }

  /**
   * Load a serialized {@link VoxelMap} into the live Danger Room and drop the
   * authored combatants into the existing sparring population so the player can
   * actually play the map they built. The Danger Room floor/atmosphere stays
   * visible (the map sits on it); blocks/heavy bags become solid colliders,
   * physics bags react to hits, NPCs spawn armed + difficulty-scaled, and the
   * player spawns at the start marker. Exiting disposes the whole Studio.
   */
  async enterArena(map: VoxelMap): Promise<void> {
    if (this.inArena || this.enteringArena || this.disposed) return;
    this.enteringArena = true;
    this.doorPrompt = false;

    let arena: VoxelArena | null = null;
    try {
      arena = new VoxelArena(this.scene);
      await arena.load(map);
      if (this.disposed) {
        arena.dispose();
        return;
      }

      this.arena = arena;
      this.inArena = true;
      this.locked = false;
      this.controller?.setLockTarget(null);

      // Spawn the authored NPCs into the existing Danger Room population.
      if (this.targets instanceof Targets) {
        const t = this.targets;
        t.setBounds(arena.bounds);
        for (const npc of arena.npcs) {
          t.spawnAt(npc.pos, npc.weapon, "enemy", {
            scale: npc.scale,
            maxHealth: npc.maxHealth,
            damageMul: npc.damageMul,
          });
        }
      }

      // Fresh start + hand the Controller the arena collision + camera occluders.
      this.health = this.maxHealth;
      this.stamina = this.maxStamina;
      this.defeated = false;
      this.controller?.setCollision(arena.collision, arena.spawn);
      this.controller?.setCameraOccluders(arena.occluders);
    } catch (err) {
      console.error("[Studio] arena load failed", err);
      arena?.dispose();
      if (!this.inArena) this.arena = null;
    } finally {
      this.enteringArena = false;
    }
  }

  // ---- Touch / on-screen control API (driven by the React TouchControls) ----

  /** Toggle touch mode (suppresses pointer-lock-on-tap). */
  setTouchMode(on: boolean) {
    this.touchMode = on;
    if (on) this.input.exitLock();
    else {
      // Leaving touch mode: drop any held virtual input.
      this.input.setMove(0, 0);
      this.input.lookActive = false;
      this.input.touchSprint = false;
    }
  }

  /** Analog joystick movement (x = strafe, y = forward), each -1..1. */
  touchMoveInput(x: number, y: number) {
    this.input.setMove(x, y);
  }

  /** Look-pad drag delta (screen px); call touchLookEnd when the finger lifts. */
  touchLook(dx: number, dy: number) {
    this.input.lookActive = true;
    this.input.addLook(dx, dy);
  }
  touchLookEnd() {
    this.input.lookActive = false;
  }

  setTouchSprint(on: boolean) {
    this.input.touchSprint = on;
  }

  touchJump() {
    this.controller?.jump();
  }
  touchAttack() {
    this.attack();
  }
  /** F-skill when index is omitted, else signature skill 0-3. */
  touchSkill(index?: number) {
    if (this.activityMode === "harvest") {
      // In harvest, skill stick cardinals map to tools via touchActivityTool.
      return;
    }
    this.useSkill(index);
  }
  touchSkyfall() {
    this.skyfall();
  }

  /** Current activity mode for HUD / touch chrome. */
  getActivityMode(): import("./playerMode").PlayerActivityMode {
    return this.activityMode;
  }

  /**
   * Apply (or refresh) a status effect: spawns its aura + notifier chip. The
   * cast is routed by kind — friendly buffs follow the Shift+Tab-selected ally
   * (green), offensive debuffs follow the Tab-locked hostile (red), and anything
   * unrouted (no valid target) lands on the player.
   *
   * When `aoe` is set, a friendly buff instead splashes onto every ally within
   * {@link FRIENDLY_AOE_RADIUS} of the selected ally (or the caster when none is
   * selected) — each affected ally wears its own aura, mirroring boss AOE splash.
   */
  applyStatus(id: StatusId, aoe = false) {
    // Data-driven path (proof migration): a buff/debuff is an instant, status-only
    // ability. The orchestrator runs cast → release → impact → status synchronously
    // (no wind-up, no travel), firing the scope-routed application below — identical
    // to the previous direct call, but expressed through the shared lifecycle.
    const statusDef = STATUS_DEFS[id];
    const def = statusAbility(id, statusDef?.kind, aoe);
    const scope = def.status?.scope ?? "self";
    // Cast flash (itch-style shell punch) then apply lasting aura
    this.abilities.cast(def, {
      onCast: () => {
        if (statusDef) this.status.playCastBurst(statusDef.color, 0.4);
      },
      onStatus: () => this.applyStatusScoped(id, scope),
    });
  }

  /**
   * Class skill bar (Shift+1–5): play cast/attack + light status feedback.
   * Full ability graph still resolves from fleet skill ids; this is the combat feel hook.
   */
  fireClassSkill(skill: {
    id: string;
    name: string;
    kind?: string;
  }): boolean {
    if (!this.character) return false;
    const k = (skill.kind || "").toLowerCase();
    const id = skill.id.toLowerCase();
    // Prefer cast/magic clips for mage-ish / form; attack otherwise
    const preferCast =
      k.includes("form") ||
      k.includes("place") ||
      k.includes("selection") ||
      skill.id.startsWith("m_") ||
      skill.id.startsWith("wr_");
    // Hand / upper-body first: grudge6 / ummorpg packs often use these names
    const handFirst = preferCast
      ? [
          "cast",
          "magicAttack",
          "magic_cast",
          "skill_cast",
          "upper_cast",
          "attack_spell",
          "magicArea",
          "attack",
          "idle",
        ]
      : [
          "attack",
          "attack1",
          "slash",
          "skill_attack",
          "upper_attack",
          "cast",
          "magicAttack",
          "idle",
        ];
    let played = false;
    for (const c of handFirst) {
      if (this.character.hasClip?.(c)) {
        this.character.playClipOnce(c, 0.1);
        played = true;
        break;
      }
    }
    if (!played && this.character.hasRole?.("attack")) {
      this.character.playRoleOnce?.("attack", 0.1);
      played = true;
    }
    if (!played) this.previewClip("attack");

    // Hand-centered VFX: cast aura + flame column on hands during skill
    const origin = this.character.root.position.clone();
    origin.y += 1.15;
    const pose = this.colliderPose();
    const handPos = pose?.pos?.clone() ?? origin;
    const themeColor =
      id.includes("fire") || id.includes("burn")
        ? 0xff6a1e
        : id.includes("ice") || id.includes("frost")
          ? 0x88d0ff
          : id.includes("nature") || id.includes("poison")
            ? 0x6ee7a0
            : preferCast
              ? 0xb48cff
              : 0xffd28a;
    this.vfx.castAura(handPos, themeColor);
    this.vfx.flame(handPos.clone().setY(handPos.y + 0.15), themeColor, 14, 1.8);
    if (preferCast) {
      this.vfx.auraRing(new THREE.Vector3(origin.x, 0.06, origin.z), themeColor, 1.6, 0.55);
    } else {
      // Melee class skill: slash telegraph from hand
      const quat = pose?.quat
        ? pose.quat
        : new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, this.character.root.rotation.y, 0),
          );
      this.vfx.slashArc(handPos, quat, themeColor);
    }

    // Lightweight status feedback by class skill prefix / kind
    if (id.includes("heal") || id.includes("mend") || id.includes("blood") || id.includes("sooth")) {
      this.applyStatus("regen");
    } else if (id.includes("fire") || id.includes("burn") || id.includes("ember")) {
      this.applyStatus("burning", true);
    } else if (id.includes("poison") || id.includes("venom") || id.includes("nature")) {
      this.applyStatus("poisoned", true);
    } else if (id.includes("frost") || id.includes("ice") || id.includes("freeze")) {
      this.applyStatus("frozen", true);
    } else if (id.includes("storm") || id.includes("shock") || id.includes("thunder")) {
      this.applyStatus("shocked", true);
    } else if (
      id.includes("guard") ||
      id.includes("bulwark") ||
      id.includes("shield") ||
      id.includes("iron") ||
      id.includes("bark")
    ) {
      this.applyStatus("shielded");
    } else if (id.includes("war") || id.includes("onslaught") || id.includes("power") || id.includes("surge")) {
      this.applyStatus("empowered");
    } else if (id.includes("haste") || id.includes("swift") || id.includes("quick")) {
      this.applyStatus("haste");
    } else if (preferCast || k === "form") {
      this.applyStatus("empowered");
    }

    this.setCombatFlash(skill.name || "SKILL", 0.35);
    return true;
  }

  /**
   * Apply a status by scope, mirroring the historical {@link applyStatus}
   * routing exactly: ally buffs follow the Shift+Tab ally (AOE splashes onto
   * every ally in {@link FRIENDLY_AOE_RADIUS}), hostile debuffs follow the
   * Tab-locked enemy, and anything with no valid target lands on the caster.
   */
  private applyStatusScoped(id: StatusId, scope: StatusScope) {
    const selectedAlly = this.targets.selectedAllyGroup?.() ?? null;
    const center = selectedAlly ? selectedAlly.position : this.character?.root.position;
    const aoeAllies =
      scope === "aoeAlly" && center
        ? this.targets.alliesInRadius?.(center, FRIENDLY_AOE_RADIUS) ?? []
        : [];
    const routing = routeStatusScope(scope, {
      aoeAllies,
      selectedAlly,
      selectedHostile: this.targets.selectedHostileGroup?.() ?? null,
    });
    dispatchStatusRouting(
      routing,
      (g) => g.position,
      {
        apply: (anchor) => this.status.apply(id, anchor),
        applyAll: (anchors) => this.status.applyAll(id, anchors),
      },
    );
  }
  clearStatuses() {
    this.status.clearAll();
  }

  /** Tab: cycle the locked-on enemy (red outline + floating health frame). */
  cycleTarget() {
    this.targets.cycleSelection();
  }

  /** Shift+Tab: rotate the selected ally (green outline + floating frame). */
  cycleAllyTarget() {
    this.targets.cycleAllySelection?.();
  }

  /** KeyB: toggle first/third-person framing (mirrored so swaps keep the mode). */
  toggleView() {
    this.viewMode = this.viewMode === "first" ? "third" : "first";
    this.controller?.setViewMode(this.viewMode);
  }

  /** Q: cycle Combat → Harvest → Build → Combat. */
  cycleActivityMode() {
    const next = nextMode(this.activityMode);
    this.setActivityMode(next);
  }

  /**
   * Activity mode switch. **Combat** re-enables the Danger Room combat stack
   * (same Controller loco, soft lock, RMB focus, arsenal anims) — never a
   * parallel character combat runtime. Harvest/build only rebind tools.
   */
  setActivityMode(mode: PlayerActivityMode) {
    const prev = this.activityMode;
    this.activityMode = mode;
    this.activityTool = defaultToolForMode(mode);
    this.radialOpen = false;
    this.harvestMoveActive = false;
    this.tabHoldArmed = false;
    this.radialHoldT = 0;

    if (mode === "harvest" || mode === "build") {
      // Leave combat focus stance; tools use free-aim soft select
      this.locked = false;
      this.controller?.setLockTarget(null);
      if (mode === "build") this.campBuild?.cancelGhost?.();
      // Minecraft-like third person: over-shoulder crosshair, mid body look-at
      this.applyActivityCamera(mode);
    } else if (mode === "combat") {
      // Restore Danger Room combat — same stack as always (no new systems).
      this.restoreDangerRoomCombatMode(prev);
      this.applyActivityCamera("combat");
    }

    // Clamp free-aim into the new mode's max
    const max = this.aimMaxNdc();
    this.aimNdcX = THREE.MathUtils.clamp(this.aimNdcX, -max, max);
    this.aimNdcY = THREE.MathUtils.clamp(this.aimNdcY, -max, max);
    // Short centre flash; persistent mode is the top-centre ModeBanner
    this.setCombatFlash(
      mode === "combat" ? "COMBAT · Q mode · 1–4 skills · RMB lock" : `${MODE_LABEL[mode]} · shoulder TPS`,
      0.7,
    );
  }

  /**
   * Activity-specific third-person camera (Danger Room Controller SSOT).
   * Combat = tight action over-shoulder; harvest/build = Minecraft-like
   * crosshair-riding shoulder cam for block/tool aim.
   * Swim / climb / hard-focus refine via {@link tickDynamicCamera}.
   */
  private applyActivityCamera(mode: PlayerActivityMode) {
    this.lastCamProfile = null; // force re-apply on next tick
    this.tickDynamicCamera(mode);
  }

  /**
   * Modern dynamic TPS camera profiles — combat soft/hard, tools, swim, climb.
   * Shares one Controller orbit; only setCameraOpts when the profile key changes.
   */
  private tickDynamicCamera(mode: PlayerActivityMode = this.activityMode) {
    if (!this.controller) return;
    // Always third for harvest/build tool aim (first-person hides tools poorly)
    if (mode !== "combat" && this.viewMode === "first") {
      this.viewMode = "third";
      this.controller.setViewMode("third");
    }

    const key = resolveCameraProfileKey({
      firstPerson: this.viewMode === "first",
      swimming: this.controller.isInWater(),
      climbing: this.controller.isWallRunning,
      activity: mode,
      hardFocus: mode === "combat" && this.locked,
    });

    if (key === this.lastCamProfile) return;
    this.lastCamProfile = key;
    this.controller.setCameraOpts(cameraProfileOpts(key));
  }

  /**
   * Re-enter Danger Room combat after harvest/build (or explicit combat set).
   * Clears harvest approach state; keeps soft-lock selection if still valid;
   * does not invent alternate loco/anim/targeting — Controller + Targets +
   * Character/GrudgeAvatar remain the only combat path.
   */
  private restoreDangerRoomCombatMode(from: PlayerActivityMode) {
    // Drop harvest walk-to-node / soft harvest pick state
    this.harvestMoveActive = false;
    this.harvestSelectPos = null;
    this.harvestSelectNodeId = null;
    // Soft lock by default when leaving tools (RMB re-toggles hard FOCUS)
    // Keep existing selection outline if targets still have a selected id.
    if (this.locked) {
      const lp = this.targets.lockPoint();
      if (lp) this.controller?.setLockTarget(lp);
      else {
        this.locked = false;
        this.controller?.setLockTarget(null);
      }
    } else {
      this.controller?.setLockTarget(null);
    }
    // Resume combat aim range (hard max when focused, soft free-aim otherwise)
    if (from !== "combat") {
      this.snapAimToCenter();
    }
    // View/loco stay on Controller — no mode-specific character controller swap.
    this.controller?.setViewMode(this.viewMode);
  }

  /**
   * Switch test map: Danger Room (combat) · Sailtest (island) · Forest Map (harvest).
   * Persists selection; applies fog + default activity mode.
   */
  async setTestWorld(id: TestWorldId): Promise<boolean> {
    const def = TEST_WORLDS[id];
    if (!def) return false;
    this.testWorldId = id;
    saveTestWorldId(id);

    // Do NOT load small_island under camp on sailtest — SAILTEST.glb is the dual-island mesh.
    // Camp placeables still use seedSandboxClaim for build rights.

    if (this.forestWorld) {
      const ok = await this.forestWorld.load(def);
      if (!ok && def.kind !== "combat") return false;
    }

    // Voxel / outdoor camp enemies
    this.campEnemies?.clear();
    this.volcanoBoss?.clear();
    if (def.kind === "survival_island" && this.campEnemies) {
      // Orc tribe + outlaws at red-mushroom anchors from island_life.glb materials
      const camps = RED_MUSHROOM_ANCHORS.map((a) => {
        const p = mushroomWorldPos(a.local);
        return { x: p.x, y: p.y, z: p.z, tribe: a.tribe };
      });
      void this.campEnemies.spawnIslandMushroomTribes(camps).then(() => {
        // Golem neutral nodes + elf raid / iron elite (Golem_Free + Elf_Free)
        const nodes = ISLAND_EVENT_NODE_ANCHORS.map((a) => {
          const p = mushroomWorldPos(a.local);
          return { x: p.x, y: p.y, z: p.z, campId: a.campId };
        });
        // Append without clear — spawnIslandEventNodes does not clear first
        void this.campEnemies?.spawnIslandEventNodes(nodes);
      });
      const base = this.character?.root.position.clone() ?? new THREE.Vector3(0, 0, 0);
      this.raiderBoats?.setBase(base);
      // Sailtest dual-island stands in for volcanic / boss-event host when tagged
      void this.volcanoBoss?.spawnIfAllowed({
        sectorId: "s",
        archetype: "volcanic",
        eventTags: ["boss_event", "volcanic", "hellmaw"],
        origin: base.clone().setY(0),
      });
    } else if (def.kind !== "combat" && this.campEnemies) {
      const center = this.character?.root.position.clone() ?? new THREE.Vector3(0, 0, -4);
      void this.campEnemies.spawnVoxelCamp(center);
      // Forest / outdoor maps: still allow boss if event tags request it
      if (id === "forest-map" || def.kind === "harvest") {
        void this.volcanoBoss?.spawnIfAllowed({
          sectorId: "s",
          archetype: "boss",
          eventTags: ["boss_event", "volcanic"],
          origin: center.clone().setY(0),
        });
      }
    }

    // Fabled zone: dwarf + elf sky towns on floating islands + portal web
    if (id === "fabled-zone") {
      this.controller?.setRoomBound(500);
      void this.fabledSky?.load();
    } else {
      this.fabledSky?.clear();
    }

    // Atmosphere: sailtest Sky/fog applied inside SailEnvironment; else fog from def
    if (def.sailing) {
      // SailEnvironment already set fog/background
    } else if (def.fog) {
      this.scene.fog = new THREE.Fog(def.fog.color, def.fog.near, def.fog.far);
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.setHex(def.fog.background ?? def.fog.color);
      }
    } else {
      this.applyRoomAtmosphere?.(true);
    }

    if (def.defaultMode) this.setActivityMode(def.defaultMode);
    this.setCombatFlash(
      `MAP · ${def.name} · ${def.uuid.slice(0, 8)}… · seed ${def.seed}`,
      1.5,
    );
    return true;
  }

  getTestWorldId(): TestWorldId {
    return this.testWorldId;
  }

  getTestWorldUuid(): string {
    return TEST_WORLDS[this.testWorldId]?.uuid ?? "";
  }

  /** Open/close radial options wheel (hold Tab). */
  setRadialOpen(open: boolean) {
    this.radialOpen = open;
  }

  /** Select a radial tool for the current activity mode (public for HUD wheel). */
  selectActivityTool(id: string) {
    this.activityTool = id;
    this.radialOpen = false;
    this.tabHoldArmed = false;
    this.radialHoldT = 0;
    this.setCombatFlash(id.replace(/_/g, " ").toUpperCase(), 0.4);
    // Immediate combat shortcuts from the wheel
    if (this.activityMode === "combat") {
      if (id === "dodge") this.performTimedDodgeRoll();
      else if (id === "parry") this.doParry();
      else if (id === "heavy") this.doHeavyAttack();
      else if (id === "kick") this.utilityKick();
      else if (id === "potion") this.healPotion();
      else if (id === "skill") this.useSkill();
      else if (id === "block") this.forceFieldGuard();
    }
  }

  /** Cancel radial without changing tool. */
  cancelRadial() {
    this.radialOpen = false;
    this.tabHoldArmed = false;
    this.radialHoldT = 0;
  }

  private pickRadialByIndex(i: number) {
    const opt = RADIAL_BY_MODE[this.activityMode][i];
    if (opt) this.selectActivityTool(opt.id);
  }

  /**
   * Non-combat primary action (LMB in harvest/build).
   * Minecraft-like: harvest tools write yields into the production bag;
   * build shows place ghost. Full world authority remains Mine-Loader.
   */
  private runActivityTool(toolId?: string) {
    const id = toolId ?? this.activityTool;
    if (this.activityMode === "combat") return;
    const origin = this.character?.root.position.clone() ?? new THREE.Vector3();
    origin.y += 1;
    if (this.activityMode === "harvest") {
      // Prefer selected forest/sailtest harvest node (tool-matched)
      const nodeId = this.harvestSelectNodeId;
      const node = nodeId ? this.forestWorld?.harvestNode(nodeId) : null;
      const tool = node?.tool || id;
      // Character bag (3×3) — prefer fleet window id, else Studio characterId
      const bagChar =
        (typeof window !== "undefined" &&
          (window as unknown as { __grudgeCharId?: string }).__grudgeCharId) ||
        this.characterId ||
        "explorer";
      applyHarvestYield(tool, undefined, undefined, bagChar);
      // Harvest / farm / build swing (attack role = chop/mine/gather feel)
      const played =
        this.character?.playRoleOnce?.("attack", 0.08) ??
        this.character?.playClipOnce?.("attack", 0.1);
      void played;
      const at = this.harvestSelectPos?.clone().setY(0.5) ?? origin;
      this.vfx.burst(at, 0x7ee7a8, 16, 2.4);
      this.vfx.castAura(at, 0x7ee7a8);
      if (node) {
        this.setCombatFlash(
          `HARVEST · ${node.kind.toUpperCase()} · ${tool} · left ${node.remaining}`,
          0.65,
        );
        if (node.remaining <= 0) {
          this.harvestSelectNodeId = null;
          this.harvestSelectPos = null;
        }
      } else {
        this.setCombatFlash(`HARVEST · ${tool.toUpperCase()} · bag +yield`, 0.5);
      }
      return;
    }
    if (this.activityMode === "build") {
      const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, 1);
      const place = origin.clone().addScaledVector(fwd, 3.2);
      place.y = 0;
      // Map radial build tools → placeable ids
      const toolToPlaceable: Record<string, string> = {
        place: "claim_flag",
        wall: "wall",
        barracks: "barracks",
        archery: "archery",
        station: "miner_forge",
        door: "door",
        gate: "gate",
        farm_plot: "farm_plot",
        floor: "farm_plot",
        ramp: "watchtower",
        tower: "watchtower",
        trap: "bear_trap",
        bench: "work_bench",
        forge: "miner_forge",
        chest: "storage_chest",
      };
      if (this.campBuild?.isGhostActive) {
        const s = this.campBuild.commitPlace();
        if (s) {
          this.vfx.auraRing(new THREE.Vector3(s.x, 0.05, s.z), 0x6ee7b7, 1.6, 0.55);
          this.vfx.hexaring(() => new THREE.Vector3(s.x, 0.4, s.z), 0x6ee7b7, 0.45);
        }
        return;
      }
      const placeableId = toolToPlaceable[id] || id;
      if (getPlaceable(placeableId)) {
        this.campBuild?.beginPlace(placeableId);
        this.campBuild?.updateGhost(place);
      } else {
        this.setCombatFlash(`BUILD · ${id.toUpperCase()} · no placeable`, 0.45);
        this.vfx.auraRing(place, 0x7fb0ff, 1.4, 0.5);
      }
    }
  }

  /**
   * Camp UI / external: start placeable ghost (claim flag, barracks, wall…).
   * Switches to build mode and exits pointer-lock responsibility to the UI host.
   */
  beginPlacePlaceable(placeableId: string): boolean {
    this.setActivityMode("build");
    const ok = this.campBuild?.beginPlace(placeableId) ?? false;
    if (ok && this.character) {
      const origin = this.character.root.position.clone();
      origin.y = 0;
      const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, 1);
      this.campBuild?.updateGhost(origin.addScaledVector(fwd, 3.2).setY(0));
    }
    return ok;
  }

  /** Cancel active camp placeable ghost. */
  cancelPlacePlaceable() {
    this.campBuild?.cancelGhost();
  }

  /** Whether a placeable ghost is following the player. */
  isPlaceGhostActive(): boolean {
    return this.campBuild?.isGhostActive ?? false;
  }

  /** Plant / has claim rights in sandbox (true after seed or claim_flag place). */
  hasCampClaim(): boolean {
    return this.campBuild?.hasClaim ?? false;
  }

  /** Wire keyboard skill/jump shortcuts that need engine-side actions. */
  handleKey(code: string) {
    if (code === "Escape" && this.campBuild?.isGhostActive) {
      this.campBuild.cancelGhost();
      this.setCombatFlash("Place cancelled", 0.5);
      return;
    }
    if (code === "Escape" && this.castPlacement) {
      this.cancelCastPlacement();
      return;
    }
    // Rotate placeable ghost (R in build mode when ghost active — not heavy attack)
    if (code === "KeyR" && this.campBuild?.isGhostActive) {
      this.campBuild.rotateGhost(Math.PI / 4);
      this.setCombatFlash("Rotate ghost 45°", 0.35);
      return;
    }
    // ── vfxgrudge.puter.site hotkeys (Alt+V/B/F/G/T/C + Alt+Space Getsuga) ──
    // Bare keys stay combat (C parry, G evade, T stomp, V kick, B camera, F skill).
    // Alt alone (no VFX letter) = combat slide.
    {
      const altHeld = this.input.down("AltLeft") || this.input.down("AltRight");
      const effectId = sandboxEffectForKey(code, altHeld);
      if (effectId) {
        this.deploySandboxHotkeyVfx(effectId);
        return;
      }
      if (
        (code === "AltLeft" || code === "AltRight") &&
        this.activityMode === "combat"
      ) {
        this.performCombatSlide();
        return;
      }
    }
    if (code === "Space") {
      // Smash recovery: Space during tumble/ragdoll = cut backflip, not jump.
      // Otherwise: wall jump (near wall / wall-run) → double jump → ground jump.
      if (this.tumbleActive || this.recoverLock > 0.2) this.smashRecover();
      else this.tryJumpWithStamina();
    }
    else if (code === "KeyR") this.doHeavyAttack();
    else if (code === "KeyF") {
      // Guns: F starts hold-charge / reload on release (see updateGunInput).
      // Crossbow: F = charged magical bolt.
      // Non-guns: F = f-skill.
      if (isGunWeapon(this.weaponId)) {
        this.fKeyDown = true;
        this.fHoldAccum = 0;
      } else if (isCrossbowWeapon(this.weaponId)) {
        this.doCrossbowChargedBolt();
      } else {
        this.useSkill();
      }
    }
    else if (code === "KeyE") {
      // Camp interact first: doors / gates / workbenches near player
      const pp = this.character?.root.position;
      if (pp && this.campBuild?.tryInteract(pp)) {
        return;
      }
      // Harvest skin channel when in harvest mode; forcefield in combat.
      if (this.activityMode === "harvest") this.runActivityTool("skin");
      else this.forceFieldGuard();
    }
    else if (code === "KeyQ") {
      // Mode swap: Combat ↔ Harvest ↔ Build (SSOT — not weapon swap).
      // Shift+Q in combat: swap main ↔ side arm when dual arsenal is loaded.
      if (this.input.down("ShiftLeft") || this.input.down("ShiftRight")) {
        if (this.activityMode === "combat") this.swapCombatArsenal();
        else this.cycleActivityMode();
      } else {
        this.cycleActivityMode();
      }
    }
    else if (code === "KeyX") {
      // Elden Ring–style timed dodge roll (directional roll + ~0.5s i-frames).
      // Always available — escape pressure in any activity mode.
      this.performTimedDodgeRoll();
    }
    else if (code === "KeyG") this.evade();
    // KeyM = suit up into / exit the Exo-Armour Mech.
    else if (code === "KeyM") this.toggleMech();
    // KeyZ = straight stab: a dash into an extended main-hand thrust, blade
    // classes only (sword + knife); no-ops otherwise. KeyT's motion-attack moved
    // to the middle mouse button (M3); see onMouseDown.
    else if (code === "KeyZ") {
      if (this.activityMode === "combat") this.stab();
    }
    // KeyT = Stomp finisher: a leaping execution that only fires when a
    // knocked-down (fallen) enemy is within reach; no-ops otherwise.
    else if (code === "KeyT") {
      if (this.activityMode === "combat") this.stomp();
    }
    else if (code === "KeyV") {
      if (this.activityMode === "combat") this.utilityKick();
    }
    // KeyH = throw a bomb (quick-draw overhand throw → arcing grenade → AoE blast).
    else if (code === "KeyH") {
      if (this.activityMode === "combat") this.throwBomb();
    }
    // KeyJ = drink a heal potion (quick-draw use → restore HP). No-op at full HP.
    else if (code === "KeyJ") this.healPotion();
    // KeyC = timed parry (success: rebound + stun + uppercut dash knock-up).
    else if (code === "KeyC") {
      if (this.activityMode === "combat") this.doParry();
    }
    else if (code === "KeyB") this.toggleView();
    else if (code === "Digit1") {
      if (this.activityMode === "combat") this.useSkill(0);
      else this.pickRadialByIndex(0);
    }
    else if (code === "Digit2") {
      if (this.activityMode === "combat") this.useSkill(1);
      else this.pickRadialByIndex(1);
    }
    else if (code === "Digit3") {
      if (this.activityMode === "combat") this.useSkill(2);
      else this.pickRadialByIndex(2);
    }
    else if (code === "Digit4") {
      if (this.activityMode === "combat") this.useSkill(3);
      else this.pickRadialByIndex(3);
    }
    else if (code === "Tab") {
      // Hold Tab → radial; quick tap still cycles target (handled on keyup).
      this.tabHoldArmed = true;
      this.radialHoldT = 0;
    }
  }

  /**
   * Preview a Fantasy VFX Sandbox effect at the player (no skill CD).
   * Used by Alt+hotkeys from https://vfxgrudge.puter.site/
   */
  private deploySandboxHotkeyVfx(effectId: string) {
    if (!this.character) return;
    const origin = this.character.root.position.clone();
    const forward = this.controller?.forward() ?? new THREE.Vector3(0, 0, 1);
    const aim =
      this.targets?.selectedHostilePoint?.()?.clone() ??
      origin.clone().addScaledVector(forward, 8).setY(origin.y + 1);
    const weaponEdge = () => {
      if (this.mounted?.tip) {
        const tip = new THREE.Vector3();
        this.mounted.tip.getWorldPosition(tip);
        const base = new THREE.Vector3();
        if (this.mounted.tip.parent) this.mounted.tip.parent.getWorldPosition(base);
        else base.copy(tip).add(new THREE.Vector3(0, -0.4, 0));
        return { base, tip };
      }
      const pose = this.colliderPose();
      if (!pose) return null;
      return {
        base: pose.pos.clone().addScaledVector(forward, -0.5),
        tip: pose.pos.clone(),
      };
    };
    deploySandboxVfx(this.vfx, effectId, {
      origin,
      forward,
      aim,
      weaponEdge,
      onHit: (p) => {
        this.targets.playerHit(
          p,
          1.1,
          { force: 1, damage: 12, poiseDamage: 6 },
          1,
          this.sparCtx,
        );
      },
    });
    this.setCombatFlash(sandboxLabelForEffect(effectId), 0.7);
  }

  /** Keyup path for F (gun reload vs hold-discharge) + Tab radial / cycle. */
  handleKeyUp(code: string) {
    if (code === "Tab") {
      if (this.radialOpen) {
        // Leave wheel open until UI commits (pointer release) or Esc/cancel.
        // Tab release alone does not force-close so players can aim with the mouse.
        this.tabHoldArmed = false;
        return;
      }
      if (this.tabHoldArmed && this.radialHoldT < 0.18) {
        // Quick tap: cycle lock target (Shift+Tab ally handled by input consumer).
        this.cycleTarget();
      }
      this.tabHoldArmed = false;
      this.radialHoldT = 0;
      return;
    }
    if (code !== "KeyF") return;
    if (!isGunWeapon(this.weaponId)) {
      this.fKeyDown = false;
      this.fHoldAccum = 0;
      this.gunCharging = false;
      return;
    }
    const load = gunLoadout(this.weaponId);
    if (!load) return;
    // Hold long enough → full discharge; short tap → reload.
    if (this.fHoldAccum >= load.chargeTime) {
      this.doGunFullDischarge();
    } else {
      this.doGunReload();
    }
    this.fKeyDown = false;
    this.fHoldAccum = 0;
    this.gunCharging = false;
  }

  /**
   * Parry (KeyC): open a timed CC parry window and play the best directional
   * parry/block clip for where the nearest enemy attack is coming from
   * (left / right / front). Success is resolved in {@link onParrySuccess}
   * when an incoming hit lands inside the window; a miss takes full damage
   * and recovers the stamina debt slowly over 2s.
   */
  private doParry() {
    if (!this.character || this.defeated || this.spectating) return;
    if (this.recoverLock > 0.05) return;
    const cut = PARRY_CUT;
    const beforeStam = this.sparring.getPlayerStamina();
    this.sparring.parry();
    // If CC refused (no stam / mid-attack), don't open a fake session.
    if (this.sparring.getPlayerState() !== "parry") {
      this.setCombatFlash("CAN'T PARRY", 0.45);
      return;
    }

    const me = this.character.root.position.clone();
    // Threat = hard lock → nearest hostile → facing ray, for clip side + rebound
    const lock = this.targets?.selectedHostilePoint?.();
    let threat = lock?.clone() ?? null;
    if (!threat) {
      const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, 1);
      const picked = this.pickTargetInFront?.(me, fwd, 6.5, 0.15);
      threat = picked?.position?.clone() ?? me.clone().addScaledVector(fwd, 2.5);
    }
    threat.y = me.y + 1.0;
    const side = this.hitSide(threat);
    this.parrySessionToken += 1;
    this.parrySession = {
      token: this.parrySessionToken,
      age: 0,
      side,
      threat: threat.clone(),
    };

    // Face the threat so the parry reads into the incoming line
    const face = threat.clone().sub(me);
    face.y = 0;
    if (face.lengthSq() > 1e-4) this.controller?.faceToward(face.normalize(), 0.85);

    // Best clip for attack position — directional block/parry family first
    const g = this.playerGroup();
    const d = defenseClips(g);
    const bySide: string[] =
      side === "left"
        ? [d.blockLeft, d.parry, "parry", "parryReact", d.blockReact, d.block]
        : side === "right"
          ? [d.blockRight, d.parry, "parry", "parryReact", d.blockReact, d.block]
          : [d.parry, "parryReact", "parry", d.blockReact, "blockReact", d.block, "blockStart", "block"];
    // Dedupe while keeping order
    const seen = new Set<string>();
    const parryNames = bySide.filter((n) => {
      if (!n || seen.has(n)) return false;
      seen.add(n);
      return true;
    });

    let played = 0;
    for (const n of parryNames) {
      if (!this.character.hasClip(n) && !this.character.hasRole?.(n as never)) continue;
      if (this.character.playClipCut) {
        played = this.character.playClipCut(n, {
          from: cut.from,
          to: cut.to,
          timeScale: cut.timeScale,
          fade: cut.fade,
        });
      }
      if (played <= 0) played = this.character.playClipOnce(n, cut.fade);
      if (played > 0) break;
    }
    if (played <= 0) this.playPlayerReaction("parryReact");

    const p = me.clone();
    p.y += 1.05;
    this.vfx.forceField(() => {
      const q = this.character?.root.position.clone() ?? p.clone();
      q.y += 1.05;
      return q;
    }, cut.forceFieldRadius, cut.forceFieldLife, 0xa0f0ff);
    this.vfx.burst(p, 0xc8f4ff, 10, 2.0);
    this.invuln = Math.max(this.invuln, cut.invuln * 0.35); // brief open; full i-frames on success
    this.sfx?.play("block", p, { volume: 0.75, rate: 1.25 });
    this.setCombatFlash(side === "front" ? "PARRY" : side === "left" ? "PARRY ←" : "PARRY →", 0.35);

    // Track spent stamina so a failed window can slow-recover it
    void beforeStam;
  }

  /**
   * Timed parry SUCCESS — rebound projectiles, stun the attacker, auto uppercut
   * dash with VFX, knock them up then to the ground.
   */
  private onParrySuccess(
    pos: THREE.Vector3,
    opts: { perfect: boolean; spell: boolean },
  ) {
    if (!this.character || this.defeated) return;
    const cut = PARRY_CUT;
    const me = this.character.root.position.clone();
    const threat = this.parrySession?.threat.clone() ?? pos.clone();
    // Prefer the contact point as the enemy reference
    const foe = pos.clone();

    this.vfx.parryClash(pos);
    this.vfx.forceField(
      () => pos.clone(),
      cut.forceFieldRadius * (opts.perfect ? 1.15 : 1),
      cut.forceFieldLife,
      opts.perfect ? 0xffe8a0 : 0xbcd0ff,
    );
    this.invuln = Math.max(this.invuln, cut.invuln);
    this.respectWindow = Math.max(this.respectWindow, 0.55);
    this.sfx?.play("block", pos, { volume: 1, rate: opts.perfect ? 1.35 : 1.15 });

    // Stun + shield-break the attacker so they eat the uppercut
    this.targets.reactAt(foe, "stunned");
    this.targets.shieldBreak(foe, 3.4, cut.stunOnSuccess);
    this.targets.kickStagger(
      foe,
      2.8,
      this.params.skillForce * 1.15,
      cut.stunOnSuccess,
      me,
    );

    // Rebound spell / projectile back at the attacker (getsuga + bolt)
    this.reboundParryProjectile(foe, opts.perfect || opts.spell);

    // Automatic uppercut dash counter → knock-up → slam down
    this.executeParryUppercut(foe);

    // Clear session so a second hit in the same window doesn't re-trigger
    this.parrySession = null;
  }

  /** Fire a face-on slash projectile back along the attack line (spell rebound). */
  private reboundParryProjectile(target: THREE.Vector3, strong: boolean) {
    if (!this.character) return;
    const from = this.character.root.position.clone();
    from.y += 1.15;
    const dir = target.clone().sub(from);
    if (dir.lengthSq() < 1e-4) dir.copy(this.controller?.forward() ?? new THREE.Vector3(0, 0, 1));
    dir.normalize();
    const variant = strong ? "slashyellow" : "slashblue";
    this.vfx.getsugaSlash(from, dir, {
      variant,
      aim: target.clone().setY(target.y + 0.2),
      speed: 18,
      range: 11,
      contactRadius: 1.05,
      followDuration: 0.04,
      onPathTick: (p, r) => {
        this.targets.playerHit(
          p,
          r,
          { force: 2, damage: strong ? 14 : 10, poiseDamage: 12 },
          2,
          this.sparCtx,
        );
      },
      onHit: (p) => {
        this.vfx.impact(p, strong ? 0xffe08a : 0x4aa8ff, 0.9);
        this.targets.playerHit(
          p,
          1.2,
          { force: 2, damage: strong ? 18 : 12, poiseDamage: 16 },
          2,
          this.sparCtx,
        );
      },
    });
    // Extra bolt read for “spell rebound”
    this.vfx.bolt(from, dir, strong ? 0xffe08a : 0x88d0ff, 22, 10, (p) => {
      this.vfx.burst(p, 0xfff0c0, 12, 2.2);
    });
  }

  /**
   * Post-parry automatic uppercut: short dash into the foe, play best uppercut
   * clip, launch them skyward then ground-slam residual.
   */
  private executeParryUppercut(foePos: THREE.Vector3) {
    if (!this.character || !this.controller) return;
    // Success counter still costs uppercut stamina (partial if low)
    this.spendPhysicalStamina(STAMINA_COST.uppercut * 0.65, "parry-uppercut");
    const cut = PARRY_CUT;
    const me = this.character.root.position.clone();
    const dir = foePos.clone().sub(me);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.copy(this.controller.forward());
    dir.normalize();
    this.controller.faceToward(dir, 1);
    this.controller.dash(dir, cut.uppercutDashM, cut.uppercutDashDur, 0.15, 0.55);

    // Best available uppercut / rising clip
    const upperNames = [
      "uppercut",
      "unarmed_uppercut",
      "comboHit2",
      "parryReact",
      "attack",
    ];
    let played = 0;
    for (const n of upperNames) {
      if (!this.character.hasClip(n)) continue;
      if (this.character.playClipCut) {
        played = this.character.playClipCut(n, {
          from: 0.08,
          to: 0.72,
          timeScale: 1.55,
          fade: 0.05,
        });
      }
      if (played <= 0) played = this.character.playClipOnce(n, 0.06);
      if (played > 0) break;
    }

    const hand = me.clone().addScaledVector(dir, 0.6);
    hand.y += 1.1;
    this.vfx.castAura(hand, 0xffe08a);
    this.vfx.burst(hand, 0xfff2c0, 16, 2.8);
    this.setCombatFlash("PARRY UPPERCUT!", 0.9);

    this.schedule(cut.uppercutDelay, () => {
      if (!this.character || this.defeated) return;
      const impact = this.character.root.position.clone().addScaledVector(dir, 1.1);
      impact.y += 1.0;
      // Clean knock-up (≥8) → rise → fall prone
      this.targets.launch(impact, cut.uppercutRadius, cut.uppercutDamage, cut.uppercutUpVel);
      this.targets.reactAt(impact, "stunned");
      this.vfx.impact(impact, 0xffe08a, 1.2);
      this.vfx.fireAura(impact, 0.95, this.fireThemeApplied, { groundOnly: true });
      this.vfx.getsugaSlash(impact, dir, {
        variant: "slashred",
        aim: impact.clone().addScaledVector(dir, 4).setY(impact.y + 0.5),
        speed: 14,
        range: 5,
        contactRadius: 1.1,
        followDuration: 0.02,
        onHit: (p) => this.vfx.impact(p, 0xff5a20, 0.8),
      });
      this.sfx?.play("whooshHeavy", impact, { volume: 0.9, rate: 1.15 });
      this.controller?.addCameraShake(0.18);
    });

    // Ground residual after they peak / fall
    this.schedule(cut.uppercutDelay + 0.42, () => {
      if (!this.character || this.defeated) return;
      const ground = foePos.clone();
      ground.y = 0.05;
      this.vfx.shockwave(ground, 0xffb060, 2.4, 0.55);
      this.vfx.burst(ground.clone().setY(0.6), 0xff9040, 18, 3.2);
      // Extra ground hit for the slam-down beat
      this.targets.playerHit(
        foePos.clone().setY(0.8),
        2.2,
        { force: 3, damage: 12, poiseDamage: 20 },
        3,
        this.sparCtx,
      );
    });
  }

  /**
   * Failed / late parry: full damage already applied by the CC; drain stamina
   * and drip it back evenly over {@link PARRY_CUT.failStamRecoverSec} (2s).
   */
  private onParryFail(pos: THREE.Vector3) {
    const cut = PARRY_CUT;
    // Drop the bar now, hold natural regen, drip the debt back over 2s
    this.sparring.drainPlayerStamina(cut.failStamDebt, cut.failStamRecoverSec);
    this.parryFailStamRemaining += cut.failStamDebt;
    this.parryFailStamRate = this.parryFailStamRemaining / Math.max(0.05, cut.failStamRecoverSec);
    this.sparring.holdPlayerStaminaRegen(cut.failStamRecoverSec);
    this.parrySession = null;
    this.setCombatFlash("PARRY FAIL", 0.85);
    this.sfx?.play("block", pos, { volume: 0.55, rate: 0.75 });
    this.vfx.burst(pos, 0xff6060, 14, 2.4);
  }

  /**
   * KeyE forcefield guard: short raised block + large hex forcefield.
   * Block is NOT on RMB (RMB = focus toggle).
   */
  private forceFieldGuard() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.forceFieldCd > 0) return;
    const cut = FORCEFIELD_CUT;

    this.sparring.startBlock();
    this.blocking = true;
    // Timed guard only — never clears hard focus
    this.schedule(cut.holdSec, () => {
      this.blocking = false;
      this.sparring.endBlock();
    });

    const guardNames = ["blockGuard", "block", "blockStart", "parry"];
    for (const n of guardNames) {
      if (!this.character.hasClip(n)) continue;
      if (this.character.playClipCut) {
        const d = this.character.playClipCut(n, {
          from: cut.from,
          to: cut.to,
          timeScale: cut.timeScale,
          fade: cut.fade,
        });
        if (d > 0) break;
      }
      if (this.character.playClipOnce(n, cut.fade) > 0) break;
    }

    const origin = this.character.root.position.clone();
    const getPos = () => {
      const q = this.character?.root.position.clone() ?? origin.clone();
      q.y += 1.0;
      return q;
    };
    this.vfx.forceField(getPos, cut.radius, cut.life, cut.color);
    this.vfx.shockwave(new THREE.Vector3(origin.x, 0.05, origin.z), cut.color, 2.2, 0.4);
    this.vfx.burst(origin.clone().setY(1.0), 0xa8ecff, 16, 2.8);
    this.sfx?.play("block", origin, { volume: 1, rate: 0.95 });
    this.controller.addCameraShake(0.12);
    this.forceFieldCd = cut.cooldown;
    this.setCombatFlash("FORCEFIELD", 0.4);
  }

  /** @deprecated Focus is toggle; block is timed (E) or C parry. */
  private rmbHeld(): boolean {
    return false;
  }

  /**
   * Smash recovery (Space while tumbled): cut into backflip / kip-up, procedural
   * {@link Controller.backflip}, clear recover lock, re-enter active combat.
   */
  private smashRecover() {
    if (!this.controller || !this.character || this.defeated) return;
    if (this.smashRecoverCd > 0) return;
    const cut = RECOVERY_CUT;

    this.tumbleActive = false;
    this.tumbleT = 0;
    this.recoverLock = 0;
    this.hurt = 0;

    // Prefer backflip cut, then kipUp / get_up / airDodge.
    const names = ["backflip", "kipUp", "airDodge", "get_up", "Get Up", "roll"];
    let played = 0;
    for (const n of names) {
      if (!this.character.hasClip(n)) continue;
      if (this.character.playClipCut) {
        played = this.character.playClipCut(n, {
          from: cut.from,
          to: cut.to,
          timeScale: cut.timeScale,
          fade: cut.fade,
        });
      }
      if (played <= 0) played = this.character.playClipOnce(n, cut.fade);
      if (played > 0) break;
    }
    if (played <= 0) this.playPlayerReaction("kipUp");

    // Procedural backflip owns body pitch + soft landing (slower, readable fall).
    this.controller.backflip(cut.flipDuration, cut.flipHop);
    this.invuln = Math.max(this.invuln, cut.invuln);
    this.smashRecoverCd = cut.cooldown;

    const p = this.character.root.position.clone();
    this.vfx.afterimage(this.character.root, p, this.controller.forward().negate(), 1.4, 0xb8f0ff, 5, 0.3);
    this.vfx.burst(p.clone().setY(0.9), 0xd0f4ff, 14, 2.5);
    this.sfx?.play("somersault", p, { volume: 0.7 });
    this.setCombatFlash("RECOVER", 0.45);
    this.bumpMusicHeat(0.2);
  }

  /**
   * Acrobatic evade (KeyG): an air-dodge when airborne, a corkscrew ground
   * evade otherwise. Mobility only — drives a short {@link Controller.dash}
   * displacement, never any combat. Only procedural rigs ship these clips, so it
   * no-ops on GLB characters (matching the existing dodge behaviour).
   */
  private evade() {
    if (!this.controller || !this.character) return;
    if (this.controller.isBusy) return;
    const airborne = !this.controller.state.grounded;
    const clip = airborne ? "airDodge" : "evadeThreat";
    if (!this.character.hasClip(clip)) return;
    const dir = this.controller.forward();
    this.controller.faceToward(dir, 0.25);
    const dur = this.character.playClipOnce(clip, 0.1);
    const reach = airborne ? 1.6 : 2.4;
    this.controller.dash(dir, reach, dur > 0 ? dur * 0.9 : 0.4, 0, 0.4);
  }

  // ─────────────────────────── Exo-Armour Mech Mode ───────────────────────────

  /**
   * Suit up into (or exit) the rideable exo-armour. The armour assembles around
   * the current fighter, hides the pilot once sealed, and hands control to the
   * mech; pressing again re-opens the armour and releases the pilot. The mech
   * tracks the (hidden) pilot root each frame, so the existing Controller still
   * drives movement — just heavier — while suited.
   */
  toggleMech() {
    if (!this.character || !this.controller) return;
    if (this.spectating || this.defeated) return;
    const action = this.mech.toggle();
    if (action === "enter") this.setCombatFlash("EXO-ARMOUR ONLINE", 1.6);
    else if (action === "exit") this.setCombatFlash("ARMOUR RELEASED", 1.4);
  }

  /**
   * Instantly tear down any active exo-armour and restore the pilot's control
   * state. Used when entering contexts (e.g. duel spectating) that take over the
   * player avatar and must not leave a stray mech in the scene.
   */
  private cancelMech() {
    this.mechReconciler.cancel();
    this.mechCds = [0, 0, 0];
    this.mechWasAirborne = false;
    // No longer piloting: kill any active low-integrity klaxon. (updateMech may
    // not run again before a takeover context's loop early-returns.)
    this.sfx?.setKlaxon(false);
  }

  /**
   * Advance the mech transformation each frame and sync the armour to the player.
   * Hides/restores the pilot mesh per the state machine, and applies (and later
   * restores) a movement-weight speed penalty on the piloted edge.
   */
  private updateMech(dt: number) {
    if (!this.character || !this.controller) return;
    const frame = this.mechReconciler.update(dt);
    const snap = frame.snap;

    // Staged assemble / release feel + heavy-step punctuation.
    if (frame.justOpened) this.onMechAssembleStart();
    if (frame.justSealed) this.onMechSealed();
    if (frame.justReleased) this.onMechRelease();
    if (frame.footstep) this.onMechFootstep(frame.footstep);

    // Heavy landing slam: detect the airborne→grounded edge while piloting.
    if (snap.mechControlled) {
      const grounded = this.controller.isGrounded;
      if (grounded && this.mechWasAirborne) this.onMechLanding();
      this.mechWasAirborne = !grounded;
    } else {
      this.mechWasAirborne = false;
    }

    // Low-integrity warning klaxon: loops while piloting and armour integrity is
    // critically low (<=25%) — the same condition the cockpit's red-alert uses.
    // Stops automatically when integrity recovers or the mech is released. The
    // alarm escalates (faster/higher/louder) as integrity falls from 25% to 0%.
    const integrityFrac = this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    const klaxonOn = this.mech.isPiloted && integrityFrac <= 0.25;
    const klaxonIntensity = Math.max(0, Math.min(1, (0.25 - integrityFrac) / 0.25));
    this.sfx?.setKlaxon(klaxonOn, klaxonIntensity);
  }

  /** Heat the combat-music bed by `amount` (clamped 0..1). Called from combat
   *  events (blows landed/taken, blocks, AoE blasts); decays in the loop. */
  private bumpMusicHeat(amount: number) {
    this.musicHeat = Math.min(1, this.musicHeat + amount);
  }

  /**
   * Drive the background-music swell from the live combat state. The per-event
   * {@link musicHeat} decays between exchanges (~3s falloff) so the bed eases off
   * when idle; an active, non-passive fight (or a running duel) holds a gentle
   * floor so it stays engaged through a lull. Loudness still rides the mixer.
   */
  private updateMusicIntensity(dt: number) {
    const DECAY_PER_SEC = 0.33; // ~3s to fall from a peak hit back to calm
    const COMBAT_FLOOR = 0.3; // baseline while a real fight is underway
    this.musicHeat = Math.max(0, this.musicHeat - dt * DECAY_PER_SEC);
    let target = this.musicHeat;
    const fighting = this.difficulty !== "passive" && this.targets.aliveCount > 0 && !this.defeated;
    if (fighting || this.duel?.isActive) target = Math.max(target, COMBAT_FLOOR);
    this.sfx?.setMusicIntensity(target);
  }

  /** Suit-up start: parts arrive in a ring of sparks + steam, with a servo whoosh. */
  private onMechAssembleStart() {
    if (!this.character) return;
    const p = this.character.root.position;
    const base = new THREE.Vector3(p.x, p.y + 0.1, p.z);
    this.vfx.smokeColumn(base.clone(), 0x9fb0c0, 1.1, 2.4);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const fp = new THREE.Vector3(p.x + Math.cos(a) * 0.7, p.y + 0.1, p.z + Math.sin(a) * 0.7);
      this.vfx.burst(fp, 0xffd58a, 14, 5, { spread: 0.2, sizeScale: 0.8 });
      this.vfx.puff(fp, 0xc8d2dc, 8, 0.9);
    }
    this.sfx?.play("whooshHeavy", base, { volume: 0.8, rate: 0.7 });
  }

  /** Seal-shut: the armour clamps closed — a chest spark blast, smoke pop + shake. */
  private onMechSealed() {
    if (!this.character) return;
    const p = this.character.root.position;
    const chest = new THREE.Vector3(p.x, p.y + 1.7, p.z);
    this.vfx.burst(chest, 0xfff0c0, 26, 7, { spread: 0.5, sizeScale: 1.1 });
    this.vfx.smokePop(chest, 0xffcaa0, 1.4);
    this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0xbfd0e0, 2.4, 0.4);
    this.sfx?.play("heavyHit", chest, { volume: 1 });
    this.controller?.addCameraShake(0.55);
  }

  /** Release: the armour cracks open with a steam hiss + sparks before letting go. */
  private onMechRelease() {
    if (!this.character) return;
    const p = this.character.root.position;
    const mid = new THREE.Vector3(p.x, p.y + 1.4, p.z);
    this.vfx.smokeColumn(new THREE.Vector3(p.x, p.y + 0.2, p.z), 0xaeb8c2, 1.4, 2.0);
    this.vfx.burst(mid, 0xffe2a0, 16, 4.5, { spread: 0.5, sizeScale: 0.9 });
    this.vfx.puff(mid, 0xd8e0e8, 12, 1.2);
    this.sfx?.play("block", mid, { volume: 0.7, rate: 0.6 });
    this.controller?.addCameraShake(0.3);
  }

  /** A heavy foot just planted: a dust puff + ground ring, a thud and a rattle. */
  private onMechFootstep(pos: THREE.Vector3) {
    const foot = new THREE.Vector3(pos.x, Math.max(0.02, pos.y + 0.02), pos.z);
    this.vfx.puff(foot, 0xcdd6df, 14, 1.3);
    this.vfx.shockwave(new THREE.Vector3(foot.x, 0.04, foot.z), 0xc6d2dd, 1.6, 0.32);
    this.sfx?.play("heavyHit", foot, { volume: 0.55, rate: 0.7 });
    this.controller?.addCameraShake(0.22);
  }

  /** A piloted landing: a big dust ring, a ground shockwave, a thud and a hard kick. */
  private onMechLanding() {
    if (!this.character) return;
    const p = this.character.root.position;
    const foot = new THREE.Vector3(p.x, 0.04, p.z);
    this.vfx.puff(new THREE.Vector3(p.x, p.y + 0.05, p.z), 0xccd6e0, 22, 1.8);
    this.vfx.shockwave(foot, 0xbcd0e2, 3.0, 0.45);
    this.vfx.burst(new THREE.Vector3(p.x, p.y + 0.1, p.z), 0xffe0a0, 18, 5, { spread: 0.6 });
    this.sfx?.play("heavyHit", foot, { volume: 0.95, rate: 0.6 });
    this.controller?.addCameraShake(0.6);
  }

  /** Mech basic attack (LMB): a scaled-up forward smash that reuses the impact VFX. */
  private doMechPunch() {
    if (!this.character || !this.controller) return;
    const fwd = this.controller.forward();
    const center = this.character.root.position.clone().add(fwd.clone().multiplyScalar(2.6));
    center.y += 1.5;
    this.vfx.impact(center, 0xffd27a, 2.6);
    this.vfx.shockwave(center, 0xffe7a0, 2.2, 0.32);
    this.targets.blast(center, 2.8, 26, this.params.skillForce * 1.6, this.sparCtx);
    this.controller.dash(fwd, 1.2, 0.26, 0.16, 0.6);
    this.sfx?.play("heavyHit", center, { volume: 0.85 });
    this.controller.addCameraShake(0.3);
  }

  /**
   * Dispatch the mech's bespoke skill kit by the same key index the on-foot bar
   * uses: F (no index) → Seismic Stomp, 1 (index 0) → Plasma Cannon, 2 (index 1)
   * → Grapple Throw. Slots 3/4 fall back to the stomp. Each ability has its own
   * cooldown (`mechCds`); this returns true once the press is consumed so the
   * caller treats it as a handled skill.
   */
  private doMechSkill(signatureIndex?: number): boolean {
    if (!this.character || !this.controller) return false;
    // F → 0 (Stomp); Digit1 → 1 (Cannon); Digit2 → 2 (Grapple). Higher slots reuse Stomp.
    const ability = signatureIndex == null ? 0 : Math.min(signatureIndex + 1, 2);
    if (this.mechCds[ability] > 0) return false;
    switch (ability) {
      case 1:
        this.doMechCannon();
        break;
      case 2:
        this.doMechGrapple();
        break;
      default:
        this.doMechStomp();
        break;
    }
    this.mechCds[ability] = MECH_ABILITIES[ability].cd;
    return true;
  }

  /** Mech ability 0 — Seismic Stomp: a heavy ground-pound that LAUNCHES nearby foes. */
  private doMechStomp() {
    if (!this.character) return;
    const p = this.character.root.position.clone();
    this.vfx.aoeBlast(p, 0xffa64d, 6.0);
    this.vfx.impact(p.clone().setY(p.y + 1.0), 0xfff0c0, 4.0);
    this.vfx.shockwave(new THREE.Vector3(p.x, 0.05, p.z), 0xff8a3a, 6.0, 0.6);
    // A knock-up (not a flat blast) so the stomp reads as a ground-pound.
    this.targets.launch(p, 6.0, 44, 9.6);
    this.setCombatFlash("SEISMIC STOMP!", 1.0);
    this.sfx?.play("heavyHit", p, { volume: 1 });
    this.controller?.addCameraShake(0.7);
  }

  /**
   * Mech ability 1 — Plasma Cannon: a charged forward energy beam. Fires a long
   * additive beam down the mech's facing and blasts whatever it lands on (a
   * picked target at range, else a point straight ahead) for heavy ranged damage.
   */
  private doMechCannon() {
    if (!this.character || !this.controller) return;
    const fwd = this.controller.forward();
    const origin = this.character.root.position.clone();
    origin.y += 1.6;
    const picked = this.pickTargetInFront(origin, fwd, 28, -0.2);
    const hit = picked?.position ?? origin.clone().addScaledVector(fwd, 16);
    this.vfx.beam(() => origin.clone(), () => fwd.clone(), 0x7fd8ff, 30, 0.55);
    this.vfx.impact(hit.clone().setY(hit.y + 0.6), 0xbfeaff, 3.4);
    this.vfx.shockwave(new THREE.Vector3(hit.x, 0.05, hit.z), 0x7fd8ff, 4.0, 0.45);
    this.targets.blast(hit, 4.0, 60, this.params.skillForce * 2.0, this.sparCtx);
    this.setCombatFlash("PLASMA CANNON!", 0.9);
    this.sfx?.play("heavyHit", hit, { volume: 0.95 });
  }

  /**
   * Mech ability 2 — Grapple Throw: lunge at the foe in front and hurl it. Closes
   * to a target straight ahead, dashes the mech in, then detonates an impact AoE
   * at the grab point that launches the gripped foe and anyone next to it.
   */
  private doMechGrapple() {
    if (!this.character || !this.controller) return;
    const fwd = this.controller.forward();
    const origin = this.character.root.position.clone();
    origin.y += 1.0;
    const picked = this.pickTargetInFront(origin, fwd, 6.5, 0.1);
    const grab = picked?.position ?? origin.clone().addScaledVector(fwd, 3.0);
    // Lunge the mech onto the grab point so the throw reads as a real grapple.
    this.controller.dash(fwd, 2.0, 0.2, 0, 0.6);
    this.vfx.impact(grab.clone().setY(grab.y + 1.2), 0xffcaa0, 3.0);
    this.vfx.shockwave(new THREE.Vector3(grab.x, 0.05, grab.z), 0xffae6a, 4.5, 0.5);
    // Hurl: a strong launch at the grab point throws the foe (and nearby ones) clear.
    this.targets.launch(grab, 3.5, 54, 11.0);
    this.setCombatFlash("GRAPPLE THROW!", 0.9);
    this.sfx?.play("heavyHit", grab, { volume: 1 });
    this.controller.addCameraShake(0.5);
  }

  /**
   * Directional dodge-dash (double-tap A = left, D = right).
   * Shares X-key timed dodge path for i-frames / clips / root travel.
   * Works for every weapon and every grudge6 hero (not ice-only).
   */
  private dodgeRoll(side: "L" | "R") {
    if (this.defeated || !this.controller || !this.character) return;
    if (this.dodgeCd > 0) return;
    this.setCombatFlash(side === "L" ? "DASH ◀" : "DASH ▶", 0.35);
    this.performTimedDodgeRoll(side === "L" ? "left" : "right");
  }

  /**
   * Elden Ring–style timed dodge roll (Key X only — A/D are movement).
   * - Directional roll clips (F/B/L/R) + procedural pitch tumble fallback
   * - Jump-hop into roll → root travel for reposition
   * - True i-frames (~0.42–0.55s) on CombatController + Studio invuln
   * - Dust / afterimage telegraph the avoid window
   */
  /**
   * Dodge plan from fleet SSOT (`planDodge` in @workspace/epicfight).
   * under 15% → 0.5 m; full → max; cost = 40% max stamina.
   */
  private dodgeDistanceFromStamina(): { dist: number; cost: number; ratio: number } {
    const p = planDodge(this.sparring.getPlayerStamina(), this.sparring.getPlayerMaxStamina());
    return { dist: p.distance, cost: p.cost, ratio: p.ratio };
  }

  private performTimedDodgeRoll(forceSide?: "forward" | "back" | "left" | "right") {
    const ch = this.character;
    if (!this.controller || !ch || this.defeated) return;
    if (this.dodgeCd > 0) return;
    if (
      this.controller.isBusy &&
      this.sparring.getPlayerState() !== "attack" &&
      !this.controller.isDashing
    ) {
      const st = this.sparring.getPlayerState();
      if (st === "stunned" || st === "downed" || st === "dead") return;
    }

    const { dist: rollDist, cost: stamCost, ratio } = this.dodgeDistanceFromStamina();
    if (stamCost < 0.5 && ratio <= 0) {
      this.setCombatFlash("NO STAMINA", 0.4);
      return;
    }

    const fwd = this.controller.forward().clone();
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);

    let mx = 0;
    let mz = 0;
    if (forceSide === "forward") mz = 1;
    else if (forceSide === "back") mz = -1;
    else if (forceSide === "left") mx = -1;
    else if (forceSide === "right") mx = 1;
    else {
      if (this.input.down("KeyW") || this.input.down("ArrowUp")) mz += 1;
      if (this.input.down("KeyS") || this.input.down("ArrowDown")) mz -= 1;
      if (this.input.down("KeyD") || this.input.down("ArrowRight")) mx += 1;
      if (this.input.down("KeyA") || this.input.down("ArrowLeft")) mx -= 1;
      if (Math.abs(this.input.moveX) > 0.2 || Math.abs(this.input.moveY) > 0.2) {
        mx = this.input.moveX;
        mz = this.input.moveY;
      }
      if (Math.abs(mx) < 0.15 && Math.abs(mz) < 0.15) mz = -1;
    }

    const worldDir = new THREE.Vector3()
      .addScaledVector(right, mx)
      .addScaledVector(fwd, mz);
    if (worldDir.lengthSq() < 1e-6) worldDir.copy(fwd).negate();
    worldDir.normalize();

    const fDot = worldDir.dot(fwd);
    const rDot = worldDir.dot(right);
    let cardinal: "F" | "B" | "L" | "R" = "B";
    if (Math.abs(fDot) >= Math.abs(rDot)) cardinal = fDot >= 0 ? "F" : "B";
    else cardinal = rDot >= 0 ? "R" : "L";

    // Pay 40% (or remaining) then open CC dodge without double-spend
    this.sparring.drainPlayerStamina(stamCost, 0.35);
    this.sparring.dodge({ x: worldDir.x, z: worldDir.z }, { paidExternally: true });

    const origin = ch.root.position.clone();
    const grounded = this.controller.state.grounded;

    if (grounded) this.controller.hop(1.35);
    else this.controller.hop(0.65);

    const dodgeCut = DODGE_CUT;
    let animDur = 0;
    const dodgeNames =
      cardinal === "F"
        ? ["standing-dodge-forward", "standing_dodge_forward", "dodgeF", "dodge_forward", "roll", "Roll"]
        : cardinal === "B"
          ? ["standing-dodge-backward", "standing_dodge_backward", "dodgeB", "dodge_backward", "roll", "Roll"]
          : cardinal === "L"
            ? ["standing-dodge-left", "standing_dodge_left", "dodgeL", "dodge_left", "roll", "Roll"]
            : ["standing-dodge-right", "standing_dodge_right", "dodgeR", "dodge_right", "roll", "Roll"];
    for (const n of dodgeNames) {
      if (!ch.hasClip(n)) continue;
      if (ch.playClipCut) {
        animDur = ch.playClipCut(n, {
          from: dodgeCut.from,
          to: dodgeCut.to,
          timeScale: Math.min(1.85, dodgeCut.timeScale),
          fade: grounded ? 0.08 : 0.1,
        });
      }
      if (animDur <= 0) animDur = ch.playClipOnce(n, grounded ? 0.08 : 0.12);
      if (animDur > 0) break;
    }
    if (animDur <= 0 && ch.rollDir) {
      animDur = ch.rollDir(cardinal, grounded ? 0.08 : 0.14);
    }
    if (animDur <= 0) {
      this.controller.rollOut(worldDir, 0.52);
      if (ch.hasRole("hurt")) ch.playRoleOnce("hurt", 0.08);
      animDur = 0.52;
    } else {
      this.controller.rollOut(worldDir, Math.min(0.48, animDur * 0.85));
    }

    const dashDur = THREE.MathUtils.clamp(animDur * 0.78, 0.36, 0.58);
    this.controller.dash(worldDir, rollDist, dashDur, 0.02, 0.42);
    if (cardinal === "L" || cardinal === "R") {
      if (this.locked) this.controller.faceToward(fwd, 0);
      else this.controller.faceToward(worldDir, 0.08);
    } else {
      this.controller.faceToward(cardinal === "F" ? worldDir : fwd, 0.05);
    }

    this.vfx.afterimage(ch.root, origin, worldDir, rollDist * 0.95, 0xc8e8ff, 10, 0.42);
    this.vfx.burst(origin.clone().setY(origin.y + 0.85), 0xdfeeff, 12, 2.2);
    const dustAt = origin.clone().addScaledVector(worldDir, 0.4);
    dustAt.y = 0.04;
    this.vfx.puff(dustAt, 0xd8e0ec, 14, 1.35);
    this.vfx.auraRing(dustAt, 0xa8c8e8, 0.85, 0.35);
    this.schedule(0.18, () => {
      if (this.defeated || !this.character) return;
      const p = this.character.root.position.clone();
      p.y = 0.05;
      this.vfx.puff(p, 0xc8d4e4, 10, 1.05);
      this.vfx.afterimage(this.character.root, p, worldDir, 1.4, 0xa0d8ff, 5, 0.26);
    });
    this.sfx?.play("somersault", origin.clone().setY(origin.y + 0.8), { volume: 0.78 });

    this.invuln = Math.max(this.invuln, 0.55);
    this.dodgeCd = 0.78;
    this.setCombatFlash(
      ratio < DODGE_CUT.lowStaminaRatio ? "ROLL SHORT" : "ROLL",
      0.28,
    );
    this.bumpMusicHeat(0.12);
  }

  /** Ground / double jump with stamina cost. */
  private tryJumpWithStamina() {
    if (!this.controller || this.defeated) return;
    const wasGrounded = this.controller.state.grounded;
    const cur = this.sparring.getPlayerStamina();
    const need = wasGrounded ? STAMINA_COST.jump : STAMINA_COST.doubleJump;
    if (cur < Math.max(1, need * 0.4)) {
      this.setCombatFlash("NO STAMINA", 0.35);
      return;
    }
    this.controller.jump();
    if (this.controller.consumeDoubleJump()) {
      this.sparring.drainPlayerStamina(Math.min(cur, STAMINA_COST.doubleJump), 0.25);
    } else if (wasGrounded && !this.controller.state.grounded) {
      this.sparring.drainPlayerStamina(Math.min(cur, STAMINA_COST.jump), 0.25);
    }
  }

  /**
   * Combat slide (Alt): running-slide anim + rear push for distance.
   * Contact: trip damage, unparryable; blocked → stop + 0.2s stun; breaks parry → knockdown.
   */
  private performCombatSlide() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.slideCd > 0 || this.recoverLock > 0.05) return;
    if (this.combatSlide) return;
    if (!this.controller.state.grounded) {
      this.setCombatFlash("SLIDE · GROUND", 0.35);
      return;
    }
    const cut = SLIDE_CUT;
    const cur = this.sparring.getPlayerStamina();
    if (cur < cut.staminaCost * 0.4) {
      this.setCombatFlash("NO STAMINA", 0.4);
      return;
    }
    this.sparring.drainPlayerStamina(Math.min(cur, cut.staminaCost), 0.4);

    const fwd = this.controller.forward().clone();
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    // Prefer movement intent, else body forward
    let mx = 0;
    let mz = 0;
    if (this.input.down("KeyW") || this.input.down("ArrowUp")) mz += 1;
    if (this.input.down("KeyS") || this.input.down("ArrowDown")) mz -= 1;
    if (this.input.down("KeyD") || this.input.down("ArrowRight")) mx += 1;
    if (this.input.down("KeyA") || this.input.down("ArrowLeft")) mx -= 1;
    if (Math.abs(this.input.moveX) > 0.2 || Math.abs(this.input.moveY) > 0.2) {
      mx = this.input.moveX;
      mz = this.input.moveY;
    }
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dir = new THREE.Vector3().addScaledVector(right, mx).addScaledVector(fwd, mz);
    if (dir.lengthSq() < 1e-4) dir.copy(fwd);
    dir.normalize();

    const ch = this.character;
    const origin = ch.root.position.clone();
    // Slide clip (global `slide` + weapon slide-attack fallbacks)
    const names = [
      "slide",
      "running-slide",
      "running_slide",
      "great-sword-slide-attack",
      "dashAttack",
      "roll",
    ];
    let played = 0;
    for (const n of names) {
      if (!ch.hasClip(n)) continue;
      if (ch.playClipCut) {
        played = ch.playClipCut(n, {
          from: cut.from,
          to: cut.to,
          timeScale: cut.timeScale,
          fade: cut.fade,
        });
      }
      if (played <= 0) played = ch.playClipOnce(n, cut.fade);
      if (played > 0) break;
    }

    const totalDist = cut.distance + cut.rearPushM;
    // Main slide travel + small rear push (impulse feel from behind)
    this.controller.dash(dir, totalDist, cut.duration, 0.05, 0.35);
    this.controller.faceToward(dir, 0.2);
    // Small rear push boost — impulse from behind along travel
    this.controller.applyImpulse(dir, 3.2, 0.12, 5);

    this.vfx.afterimage(ch.root, origin, dir, totalDist * 0.9, cut.color, 8, 0.4);
    this.vfx.puff(origin.clone().setY(0.05), 0xd0dce8, 16, 1.5);
    this.vfx.auraRing(origin.clone().setY(0.04), cut.color, 0.9, 0.3);
    this.sfx?.play("whooshHeavy", origin, { volume: 0.7, rate: 1.1 });
    this.setCombatFlash("SLIDE", 0.35);

    this.combatSlideToken += 1;
    this.combatSlide = {
      token: this.combatSlideToken,
      age: 0,
      life: cut.duration + 0.08,
      dir: dir.clone(),
      hitIds: new Set(),
    };
    this.slideCd = cut.cooldown;
    this.bumpMusicHeat(0.15);
  }

  /** Per-frame slide trip volume vs enemies. */
  private updateCombatSlide(dt: number) {
    const s = this.combatSlide;
    if (!s || !this.character) return;
    s.age += dt;
    if (s.age >= s.life) {
      this.combatSlide = null;
      return;
    }
    const cut = SLIDE_CUT;
    const me = this.character.root.position.clone();
    const probe = me.clone().addScaledVector(s.dir, 0.65);
    probe.y += 0.7;
    // One contact probe per frame (dedupe via hitIds when result focuses an id)
    const payload: AttackPayload = {
      force: 2,
      damage: cut.damage,
      poiseDamage: cut.poiseDamage,
      unparryable: true,
    };
    const result = this.targets.playerHit(probe, cut.hitRadius, payload, 2.2, this.sparCtx);
    if (!result) return;
    if (result.outcome === "blockStop") {
      // Raised guard stops the slide — no damage, we are stuck 0.2s
      this.endCombatSlideStuck(probe);
      this.vfx.parryClash(probe, 0x88e0ff);
      this.setCombatFlash("SLIDE BLOCKED", 0.5);
      return;
    }
    if (result.defenderReaction === "fallen") {
      // Broke their parry into knockdown
      this.targets.reactAt(probe, "fallen");
      this.vfx.burst(probe, 0xffa060, 18, 3);
      this.vfx.shockwave(new THREE.Vector3(probe.x, 0.05, probe.z), 0xff9040, 1.6, 0.35);
      this.setCombatFlash("SLIDE BREAK!", 0.55);
      return;
    }
    if (result.outcome === "hit" || result.outcome === "crit") {
      this.vfx.burst(probe, cut.color, 12, 2.2);
      // Trip residual — short launch
      this.targets.launch(probe, cut.hitRadius * 0.9, cut.damage * 0.35, 4.5);
    }
  }

  private endCombatSlideStuck(at?: THREE.Vector3) {
    this.combatSlide = null;
    this.recoverLock = Math.max(this.recoverLock, SLIDE_CUT.blockStunSec);
    this.hurt = Math.max(this.hurt, SLIDE_CUT.blockStunSec);
    if (this.controller) {
      const back = this.controller.forward().clone().negate();
      back.y = 0;
      if (back.lengthSq() > 1e-4) this.controller.dash(back.normalize(), 0.2, 0.1, 0, 0.5);
    }
    if (at) this.vfx.burst(at, 0x88d0ff, 10, 1.8);
    this.playPlayerReaction("hitHead");
  }

  /** Spend stamina for a physical action; returns false if starved. */
  private spendPhysicalStamina(cost: number, label: string): boolean {
    const cur = this.sparring.getPlayerStamina();
    if (cur < cost * 0.35) {
      this.setCombatFlash("NO STAMINA", 0.35);
      return false;
    }
    this.sparring.drainPlayerStamina(Math.min(cur, cost), 0.3);
    void label;
    return true;
  }

  /**
   * Motion-math attack (M3 = Attack3; the reserved Attack2 profile is kept for
   * the future KeyZ tactical ability): drives the body along a
   * {@link MotionProfile} ({@link MM_TO_M}-scaled peak/settle) into a real strike
   * resolved through the shared combo-hit path. Steers toward the crosshair
   * target like the LMB combo, so it lands in weapon range regardless of MM.
   */
  private motionAttack(profile: MotionProfile) {
    if (!this.character || !this.controller) return;
    if (this.controller.isBusy || this.recoverLock > 0) return;
    const weaponless = !!getCharacter(this.characterId).weaponless;
    const wid: WeaponId = weaponless ? "none" : this.weaponId;
    const combat = weaponCombat(wid);
    const intensityN = THREE.MathUtils.clamp(combat.intensity, 1, 100) / 100;
    const dirN = THREE.MathUtils.clamp(combat.direction, 0, 100) / 100;
    const [rMin, rMax] = combat.range;
    const origin = this.character.root.position.clone();

    const target = this.pickCrosshairTarget(combat);
    const dir = this.controller.forward();
    if (target) {
      const planar = this.toTargetPlanar(target);
      const steer = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.3, 1, dirN) * this.params.attackSteer, 0, 1);
      dir.lerp(planar.dir, steer).normalize();
    }
    this.controller.faceToward(dir, 0.2);

    // The real attack clip drives the joints; the motion profile drives the body.
    const primary = this.overrides.primary;
    let clipDur = 0;
    if (primary && this.character.hasClip(primary)) clipDur = this.character.playClipOnce(primary, 0.1);
    else if (this.character.hasRole("attack")) clipDur = this.character.playRoleOnce("attack", 0.1);
    this.swingTimer = clipDur > 0 ? clipDur * 0.45 : 0.2;

    const color = SKILL_COLOR[getWeapon(wid).kind] ?? 0x9fe8ff;
    this.swingColor = color;
    const dashDur = clipDur > 0 ? THREE.MathUtils.clamp(clipDur * 0.7, 0.18, 0.5) : 0.24;
    const peakM = profile.peak * MM_TO_M;
    const settleM = (profile.settle ?? profile.peak) * MM_TO_M;
    this.controller.dash(dir, peakM, dashDur, peakM - settleM, profile.impactAt);
    if (peakM > 0.4) {
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(peakM, 0.6), color, 4, 0.3);
    }
    this.scheduleComboHit(dashDur * profile.impactAt, dir, rMin, rMax, intensityN, color, true, null);
  }

  /**
   * True for strikes the Shadow Kick open window can smart-parry.
   * Melee basics + melee skill kinds; never projectiles / spells.
   */
  private isMeleeIncoming(kind: SkillKind, isSkill: boolean, _force: number): boolean {
    // Projectiles / aimed spells — do not shadow-parry
    if (
      kind === "bolt" ||
      kind === "laser" ||
      kind === "soul" ||
      kind === "fireDragon" ||
      kind === "meteor" ||
      kind === "darkBlades" ||
      kind === "swordVolley" ||
      kind === "muzzle" ||
      kind === "turret"
    ) {
      return false;
    }
    // Light/basic enemy swings always count as melee
    if (!isSkill) return true;
    // Melee skill kinds only (no pure ranged spells)
    return kind === "slash" || kind === "slam" || kind === "thrust" || kind === "nova";
  }

  /**
   * Utility kick (KeyV) — two-phase **Shadow Kick**:
   *
   *  1. **OPEN** (`openFrom`→`openTo`, ~real-time): planted, **no movement**.
   *     Smart-parry window — if melee damage would land, teleport behind the
   *     attacker and finish at high speed.
   *  2. **COMMIT** (no parry): finish slice at 2× + short lunge + foot wave.
   *
   * Timing (see {@link UTILITY_KICK_CUT}): open ≈ 0.38 × fullDur / 1.0;
   * with a ~1.2s clip that is ~**0.46s** before any move. Commit finish ≈ 0.34s.
   */
  private utilityKick() {
    if (!this.controller || !this.character) return;
    if (this.controller.isBusy || this.kickCd > 0) return;
    if (!this.character.hasClip("utilityKick")) return;
    if (this.shadowKick?.phase === "open") return; // already winding up

    const cut = UTILITY_KICK_CUT;
    const cfg = this.assistConfig();
    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(aim, origin, picked, cfg.steer).clone().setY(0).normalize();
    this.controller.faceToward(dir, 0.25);

    // OPEN: planted wind-up only (parry window) — no dash.
    // playClipCut returns wall-clock for the slice; derive fullDur from that.
    let openDur = 0;
    if (this.character.playClipCut) {
      openDur = this.character.playClipCut("utilityKick", {
        from: cut.openFrom,
        to: cut.openTo,
        timeScale: cut.openTimeScale,
        fade: cut.fade,
      });
    }
    let fullDur = 1.2;
    if (openDur > 0) {
      const openFrac = Math.max(0.05, cut.openTo - cut.openFrom);
      fullDur = (openDur * cut.openTimeScale) / openFrac;
    } else {
      const played = this.character.playClipOnce("utilityKick", cut.fade);
      fullDur = played > 0 ? played : 1.2;
      openDur = Math.max(0.18, (fullDur * (cut.openTo - cut.openFrom)) / cut.openTimeScale);
    }

    const token = ++this.shadowKickToken;
    this.shadowKick = {
      phase: "open",
      token,
      dir: dir.clone(),
      fullDur,
      openDur,
    };
    this.kickCd = cut.cooldown;
    this.setCombatFlash("SHADOW KICK · HOLD", 0.45);
    // Soft i-frame edge so chip doesn't leak before the first frame resolves
    this.invuln = Math.max(this.invuln, 0.06);

    // After open with no smart-parry → commit lunge + finish
    this.schedule(openDur, () => {
      if (this.disposed || this.shadowKick?.token !== token) return;
      if (this.shadowKick?.phase !== "open") return; // already shadowed
      this.commitUtilityKickFinish(dir, false);
    });
  }

  /**
   * Finish half of KeyV: strike cut + lunge + foot wave.
   * `shadow` = after smart-parry teleport (faster scale, earlier impact).
   */
  private commitUtilityKickFinish(dir: THREE.Vector3, shadow: boolean) {
    if (!this.controller || !this.character) return;
    const cut = UTILITY_KICK_CUT;
    const token = this.shadowKick?.token ?? this.shadowKickToken;
    this.shadowKick = {
      phase: shadow ? "shadow" : "commit",
      token,
      dir: dir.clone(),
      fullDur: this.shadowKick?.fullDur ?? 1.2,
      openDur: this.shadowKick?.openDur ?? 0,
    };

    const timeScale = shadow ? cut.shadowTimeScale : cut.finishTimeScale;
    const impactFrac = shadow ? cut.shadowImpactAt : cut.impactAt;

    let dur = 0;
    if (this.character.playClipCut) {
      dur = this.character.playClipCut("utilityKick", {
        from: cut.finishFrom,
        to: cut.finishTo,
        timeScale,
        fade: cut.fade,
      });
    }
    if (dur <= 0) {
      const full = this.shadowKick.fullDur;
      dur = Math.max(0.1, (full * (cut.finishTo - cut.finishFrom)) / timeScale);
    }

    const origin = this.character.root.position.clone();
    const cfg = this.assistConfig();
    const picked = this.pickTargetInFront(origin, dir, cfg.acqRange, cfg.minDot);
    const blurDist = shadow ? 1.6 : 1.1;
    this.vfx.afterimage(
      this.character.root,
      origin,
      dir,
      blurDist,
      shadow ? 0xc0a0ff : 0xffe0a0,
      shadow ? cut.shadowBlurCount : cut.blurCount,
      shadow ? cut.shadowBlurLife : cut.blurLife,
    );
    this.vfx.dashStreak(
      origin.clone().setY(origin.y + 0.2),
      origin.clone().addScaledVector(dir, blurDist).setY(origin.y + 0.2),
      shadow ? 0xb090ff : 0xffd27a,
    );

    // Shadow: tiny step into the kick; commit: full short lunge
    const reach = shadow
      ? 0.55
      : picked
        ? THREE.MathUtils.clamp(picked.dist - 0.55, 0.7, Math.min(cfg.maxReach, 3.2))
        : 1.45;
    const lungeDur = Math.max(0.1, dur * (shadow ? 0.55 : 0.85));
    this.controller.dash(dir, reach, lungeDur, 0.05, impactFrac);

    const dmgMul = shadow ? cut.shadowDamageMul : 1;
    const forceMul = shadow ? cut.shadowForceMul : cut.pushForceMul;
    const impactDelay = lungeDur * impactFrac;

    this.abilities.cast(kitAbility(shadow ? "shadowKick" : "utilityKick", "slam", shadow ? 0xb090ff : 0xffd27a, impactDelay), {
      onImpact: () => {
        if (!this.character || this.disposed) return;
        if (this.shadowKick?.token !== token) return;
        const kickFrom = this.character.root.position.clone();
        const foot = kickFrom.clone().addScaledVector(dir, 0.55);
        foot.y = 0.06;
        const chestHit = foot.clone().setY(0.9);
        const radius = cut.aoeRadius * (shadow ? 1.1 : 1);
        const force = this.params.skillForce * forceMul;
        const dmg = Math.round(cut.blastDamage * dmgMul);

        this.vfx.shockwave(foot, shadow ? 0xa080ff : 0xffb24d, radius * 1.15, 0.48);
        this.vfx.aoeBlast(chestHit, shadow ? 0xb090ff : 0xffd27a, radius * 0.85);
        this.vfx.burst(foot.clone().setY(0.25), shadow ? 0xe0d0ff : 0xffe8b0, shadow ? 36 : 28, 5);
        this.vfx.impact(chestHit, shadow ? 0xc0a0ff : 0xffd27a, shadow ? 3.0 : 2.4);
        this.vfx.legFlame(foot.clone().setY(0.12));
        this.controller?.addCameraShake(shadow ? 0.38 : 0.28);
        this.sfx?.play("heavyHit", foot, { volume: 0.95, rate: shadow ? 1.15 : 1.05 });

        this.targets.shieldBreak(chestHit, radius, cut.shieldBreakSec);
        this.targets.blast(chestHit, radius, dmg, force, this.sparCtx);
        const hitPos = this.targets.kickStagger(
          chestHit,
          radius,
          force,
          cut.shieldBreakSec,
          kickFrom.clone().setY(1.0),
        );
        if (hitPos) {
          this.vfx.impactExplode(hitPos, this.fireThemeApplied);
          this.vfx.burst(hitPos, shadow ? 0xd0c0ff : 0xffe0a0, 22, 4);
          if (shadow) {
            this.targets.stun(hitPos, radius * 0.9, 1.1);
            this.vfx.stunMark(hitPos.clone().setY(hitPos.y + 0.4), 0xffe24a, 1.1);
          }
        }
        this.shadowKick = null;
      },
    });

    // Safety clear if impact never fires
    this.schedule(dur + 0.15, () => {
      if (this.shadowKick?.token === token) this.shadowKick = null;
    });
  }

  /**
   * Smart parry success: melee would have hit during OPEN → zero damage,
   * warp behind attacker, high-speed finish animation.
   */
  private resolveShadowKickParry(
    from: THREE.Vector3,
    _strikeCenter: THREE.Vector3,
    _wouldBeDamage: number,
  ): DefensiveResult {
    const cut = UTILITY_KICK_CUT;
    const player = this.character!.root.position.clone();
    // Face dir of attacker toward player → behind is opposite
    const face = player.clone().sub(from);
    face.y = 0;
    if (face.lengthSq() < 1e-4) face.copy(this.controller?.forward() ?? new THREE.Vector3(0, 0, 1));
    face.normalize();
    // Land behind the enemy's back
    const land = from.clone().addScaledVector(face, -cut.shadowBehindM);
    land.y = 0;
    land.x = THREE.MathUtils.clamp(land.x, -14.5, 14.5);
    land.z = THREE.MathUtils.clamp(land.z, -14.5, 14.5);

    // Vanish VFX at old feet
    this.vfx.burst(player.clone().setY(0.4), 0xb090ff, 22, 3.5);
    this.vfx.afterimage(this.character!.root, player, face.clone().negate(), 2.2, 0xa080ff, 10, 0.35);

    // Teleport
    this.character!.root.position.copy(land);
    this.controller?.faceToward(face, 1); // face back into the enemy
    this.invuln = Math.max(this.invuln, cut.shadowInvuln);
    this.respectWindow = Math.max(this.respectWindow, 0.55);

    // Kick direction: into the enemy's back
    const kickDir = face.clone();
    this.setCombatFlash("SHADOW KICK!", 1.1);
    this.sfx?.play("whooshHeavy", land, { volume: 0.85, rate: 1.25 });
    this.vfx.burst(land.clone().setY(0.5), 0xd0b8ff, 18, 3);
    this.vfx.hexaring(() => this.character!.root.position.clone().setY(0.3), 0xb090ff, 0.45);

    // Close open window → high-speed finish
    this.commitUtilityKickFinish(kickDir, true);

    // Synthetic perfect-parry result — no damage, attacker gets punished via kick
    return {
      outcome: "perfectParry",
      damageDealt: 0,
      poiseDamageDealt: 0,
      attackerReaction: "parried",
      defenderReaction: "none",
      critWindow: true,
    };
  }

  /**
   * Throw a bomb (KeyH): a quick-draw overhand throw that lobs a hand-grenade
   * prop along an arc to the aimed point (or the nearest target in front), then
   * detonates on landing with an AoE blast that damages every enemy in range.
   * Works on any rig — the `throw` clip no-ops to duration 0 on GLB rigs that
   * lack it, but the grenade still flies on a default release beat. Cooldowned.
   */
  private throwBomb() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.controller.isBusy || this.throwCd > 0) return;
    if (!this.spendPhysicalStamina(STAMINA_COST.throw, "throw")) return;

    const cfg = this.assistConfig();
    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    // Wide acquire so a loose aim still lands the lob near an enemy.
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange * 1.6, cfg.minDot * 0.4);
    this.controller.faceToward(aim, 0.2);

    // Quick-draw overhand throw (returns 0 on rigs without the clip).
    const dur = this.character.playClipOnce("throw", 0.1);

    // Lob from the throwing hand (chest height) to the target / a point ahead.
    const hand = origin.clone();
    hand.y += 1.4;
    const to = picked
      ? picked.position.clone().setY(0.2)
      : origin.clone().addScaledVector(aim, 6).setY(0.2);

    const RADIUS = 3.6;
    // Release at the throw's apex (mid-clip) so the grenade leaves the hand on cue.
    const release = dur > 0 ? dur * 0.42 : 0.24;
    this.abilities.cast(kitAbility("throwBomb", "slam", 0xffd27a, release), {
      onImpact: () => {
        this.vfx.thrownProp("models/props/hand-grenade.glb", hand, to, 0xffd27a, (p) =>
          this.bombDetonation(p, RADIUS, 50),
        );
      },
    });

    this.throwCd = 1.2;
  }

  /**
   * Big, satisfying frag detonation: a layered fire/ember/shockwave VFX stack
   * plus a real concussive result — AoE damage AND a knock-up that shoves every
   * enemy outward and topples them (impact reactions). The damage routes through
   * {@link sparringBlast} (defensive resolution + difficulty/PvP scaling) while
   * the knockback uses a zero-damage {@link CombatTargets.launch} so we don't
   * double-count damage. `upVel >= 8` triggers the clean knock-up chain.
   */
  private bombDetonation(p: THREE.Vector3, radius: number, damage: number) {
    if (this.disposed) return;
    const ground = new THREE.Vector3(p.x, 0.05, p.z);
    const HOT = 0xfff0c0;
    const FIRE = 0xff8c2a;
    const EMBER = 0xffb24d;

    // --- Visual stack: white-hot core flash → fire eruption → embers → smoke. ---
    this.vfx.impact(p, HOT, radius * 1.15); // bright ground burst + glow sphere
    this.vfx.impactExplode(p); // GPU fireball
    this.vfx.fireBurst(p.clone().setY(p.y + 0.3)); // hot upward puff + smoke
    this.vfx.aoeBlast(p, FIRE, radius); // radial flame tongues + ember spray
    this.vfx.nova(p.clone().setY(p.y + 0.4), 0xffc060); // energy ring pop
    this.vfx.burst(p.clone().setY(p.y + 0.4), 0xffe0a0, 80, 12); // shrapnel sparks
    // Twin expanding shockwaves (tight bright + wide faint) sell the blast wave.
    this.vfx.shockwave(ground, EMBER, radius * 1.1, 0.42);
    this.vfx.shockwave(ground, FIRE, radius * 1.7, 0.7);
    // Lingering smoke plume.
    this.vfx.smokeColumn(ground, 0x35302b, 1.9, 2.6);
    this.vfx.smokePop(p.clone().setY(p.y + 0.6), 0x4a443c, 1.4);

    // --- Concussive result: damage + knockback/topple on every enemy in range. ---
    this.sparringBlast(p, radius, damage, this.params.skillForce * 1.6, 0.8);
    this.targets.launch(p, radius, 0, 9.4);
  }

  /**
   * Drink a heal potion (KeyJ): a quick-draw "use" that restores a chunk of HP
   * after a short windup, with a green restorative burst. Routed through the
   * player CombatController (which owns HP in solo/coop, so a raw `this.health`
   * write would be overwritten by the per-frame sync next frame). Cooldowned,
   * and a no-op at full health.
   */
  private healPotion() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.controller.isBusy || this.potionCd > 0) return;
    if (this.health >= this.maxHealth) return;

    // Reuse the quick overhand-throw clip as a fast "draw + use" gesture.
    const dur = this.character.playClipOnce("throw", 0.1);
    const heal = Math.round(this.maxHealth * 0.35);
    const applyAt = dur > 0 ? dur * 0.5 : 0.3;

    this.abilities.cast(kitAbility("healPotion", "nova", 0x66ffaa, applyAt), {
      onImpact: () => {
        if (!this.character) return;
        // HP lives on the player CombatController in solo/coop; heal it there so
        // the per-frame `this.health = sparring.getPlayerHealth()` sync persists it.
        // (No raw `this.health` write: that would fight PvP's snapshot authority.)
        this.sparring.healPlayer(heal);
        const base = this.character.root.position.clone();
        const ground = new THREE.Vector3(base.x, 0.05, base.z);
        const core = base.clone().setY(base.y + 1.0);
        const GREEN = 0x66ffaa;
        // Restorative bloom: rising swirl + aura ring + soft nova, green motes
        // streaming up the body, grounded by a gentle ring (no fiery blast).
        this.vfx.castSwirl(core, 0x9affc0, 0.9, 1.0);
        this.vfx.auraRing(core, GREEN, 1.5, 0.9);
        this.vfx.nova(core, 0x88ffb0);
        this.vfx.burst(base.clone().setY(base.y + 0.4), 0xa8ffd0, 44, 5);
        this.vfx.shockwave(ground, GREEN, 1.6, 0.55);
      },
    });

    this.potionCd = 8;
  }

  // ---- Flanged Mace signature throw (slot 4) ----

  private ensureMaceThrow(): MaceThrowMachine {
    if (!this.maceThrow) this.maceThrow = new MaceThrowMachine();
    return this.maceThrow;
  }

  /**
   * Slot-4 press while the Flanged Mace is equipped. From a clean state it
   * launches the throw; while the mace is already out (either flight phase) it
   * recalls the mace and dashes the player to it instead — a gap-closer. All the
   * automatic transitions (impact stun, return catch, fail-safe recall) are
   * driven from the loop by {@link updateMaceThrow}.
   */
  private doMaceThrow(): boolean {
    if (!this.character || !this.controller || this.defeated) return false;
    const m = this.ensureMaceThrow();
    // Re-press: recall + dash regardless of cooldown (the throw is already paid).
    if (m.isOut) {
      this.applyMaceEvents(m.press());
      return true;
    }
    if (this.controller.isBusy) return false;
    if (this.sigCooldowns[3] > 0) return false;
    this.beginMaceThrow();
    m.press();
    // Stamina is spent up-front (the cost of throwing), but the cooldown only
    // starts once the throw RESOLVES — see onMaceCaught. This means the slot-4
    // radial reads "ready/in-use" while the mace is out, never ticking down.
    this.stamina = Math.max(0, this.stamina - MACE_THROW_ST);
    return true;
  }

  /** Set up the throw: aim, hide the held mace, and spawn the flying one. */
  private beginMaceThrow() {
    if (!this.character || !this.controller) return;
    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    const cfg = this.assistConfig();
    // Wide acquire so a loose aim still lands the throw near an enemy.
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange * 1.6, cfg.minDot * 0.4);
    this.controller.faceToward(aim, 0.2);

    const hand = origin.clone();
    hand.y += 1.4;
    this.maceFrom.copy(hand);
    this.maceTo.copy(
      picked ? picked.position.clone().setY(0.9) : origin.clone().addScaledVector(aim, 8).setY(0.9),
    );
    this.maceImpactPoint.copy(this.maceTo);

    this.hideHeldWeapon();
    this.spawnMaceMesh(hand);
    // Overhand throw gesture (no-ops on GLB rigs lacking the clip).
    this.character.playClipOnce("throw", 0.1);
  }

  /** Apply the machine's events (impact stun, return catch, dash-recall). */
  private applyMaceEvents(events: MaceThrowEvent[]) {
    for (const ev of events) {
      if (ev === "impact") this.onMaceImpact();
      else if (ev === "caught") this.onMaceCaught();
      else if (ev === "dash") this.onMaceDash();
    }
  }

  /** Mace reached the target: stun + light damage + impact VFX. */
  private onMaceImpact() {
    const p = this.maceTo.clone();
    this.maceImpactPoint.copy(p);
    this.vfx.impact(p, MACE_THROW_COLOR, 1.4);
    this.vfx.smokePop(p.clone().setY(p.y + 0.4), 0xb0b6c0, 1.2);
    this.vfx.stunMark(p.clone().setY(p.y + 1.9), 0xffe24a, MACE_THROW_STUN + 0.4);
    this.targets.stun(p, MACE_THROW_RADIUS, MACE_THROW_STUN);
    this.sparringBlast(p, MACE_THROW_RADIUS, MACE_THROW_DAMAGE, this.params.skillForce * 0.6);
  }

  /**
   * Mace is back in hand: restore the held weapon, drop the flying mesh, and
   * NOW start the slot-4 cooldown. This is the single terminal resolution for
   * both throw outcomes — the auto-return catch and the dash-recall (which emits
   * "dash" then "caught") — so the cooldown begins exactly once per throw, only
   * after it has fully resolved.
   */
  private onMaceCaught() {
    this.showHeldWeapon();
    this.removeMaceMesh();
    this.sigCooldowns[3] = MACE_THROW_CD;
    this.sigCooldownMaxes[3] = MACE_THROW_CD;
  }

  /** Re-press recall: dash the player to the mace, landing beside the target. */
  private onMaceDash() {
    if (!this.character || !this.controller) return;
    const target = (this.maceMesh ? this.maceMesh.position : this.maceTo).clone();
    const from = this.character.root.position;
    const to = new THREE.Vector3(target.x - from.x, 0, target.z - from.z);
    const dist = to.length();
    if (dist > 1e-3) {
      const dir = to.multiplyScalar(1 / dist);
      this.controller.faceToward(dir, 0.2);
      // Stop ~1.2m short so we arrive beside the (stunned) target, not on top.
      const reach = Math.max(0, dist - 1.2);
      this.controller.dash(dir, reach, 0.2, 0, 0.85);
      this.vfx.smokePop(from.clone().setY(0.5), 0xb0b6c0, 1);
    }
  }

  /** Advance the mace throw timers + reposition the flying mesh (loop-driven). */
  private updateMaceThrow(dt: number) {
    const m = this.maceThrow;
    if (!m || !m.isOut) return;
    this.applyMaceEvents(m.step(dt));
    if (!this.maceMesh || !m.isOut) return;
    const k = m.progress();
    if (m.phase === "outbound") {
      this.quadBezier(this.maceFrom, this.maceTo, k, this.maceMesh.position);
    } else {
      // Return arc: from the impact point back to the player's live hand.
      const handY = this.character ? this.character.root.position.y + 1.4 : this.maceFrom.y;
      const hand = this.character
        ? new THREE.Vector3(this.character.root.position.x, handY, this.character.root.position.z)
        : this.maceFrom;
      this.quadBezier(this.maceImpactPoint, hand, k, this.maceMesh.position);
    }
    this.maceMesh.rotation.x += dt * 18;
    this.maceMesh.rotation.y += dt * 12;
  }

  /** Quadratic arc between two points (apex lifted above the higher end). */
  private quadBezier(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + 2.2;
    const u = 1 - t;
    out.set(
      u * u * a.x + 2 * u * t * mid.x + t * t * b.x,
      u * u * a.y + 2 * u * t * mid.y + t * t * b.y,
      u * u * a.z + 2 * u * t * mid.z + t * t * b.z,
    );
  }

  private hideHeldWeapon() {
    if (this.mounted) for (const o of this.mounted.objects) o.visible = false;
  }

  private showHeldWeapon() {
    if (this.mounted) for (const o of this.mounted.objects) o.visible = true;
  }

  /** Build + add the small procedural flying mace (owned; disposed on catch). */
  private spawnMaceMesh(at: THREE.Vector3) {
    this.removeMaceMesh();
    const g = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 8);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.85 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.castShadow = true;
    g.add(shaft);
    const headGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x8a929e, metalness: 0.7, roughness: 0.35 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.4;
    head.castShadow = true;
    g.add(head);
    g.position.copy(at);
    this.scene.add(g);
    this.maceMesh = g;
    this.maceMeshGeos = [shaftGeo, headGeo];
    this.maceMeshMats = [shaftMat, headMat];
  }

  private removeMaceMesh() {
    if (this.maceMesh) this.scene.remove(this.maceMesh);
    for (const geo of this.maceMeshGeos) geo.dispose();
    for (const mat of this.maceMeshMats) mat.dispose();
    this.maceMesh = null;
    this.maceMeshGeos = [];
    this.maceMeshMats = [];
  }

  /**
   * Forced teardown (weapon swap, death, dungeon/room change, dispose): recall
   * the mace, drop the flying mesh, and restore the held weapon if it was out.
   * Safe (a no-op) when the mace was never thrown.
   */
  private cancelMaceThrow() {
    const wasOut = this.maceThrow?.cancel() ?? false;
    this.removeMaceMesh();
    if (wasOut) this.showHeldWeapon();
  }

  /**
   * Illegal headbutt (KeyC): a quick, dirty close-range melee. Steers a short
   * lunge onto the nearest target in front, plays the headbutt one-shot, and
   * lands a light {@link PLAYER_HEADBUTT_PAYLOAD} hit (low damage, solid poise
   * stagger) at head height on contact. Gated like the other one-shots so it
   * can't fire mid-attack; no-ops on rigs without the clip.
   */
  private headbutt() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.controller.isBusy || this.recoverLock > 0) return;
    if (!this.character.hasClip("headbutt")) return;

    const cfg = this.assistConfig();
    const origin = this.character.root.position.clone();
    const aim = this.controller.forward();
    const picked = this.pickTargetInFront(origin, aim, cfg.acqRange, cfg.minDot);
    const dir = this.steerToward(aim, origin, picked, cfg.steer);
    this.controller.faceToward(dir, 0.25);

    const dur = this.character.playClipOnce("headbutt", 0.1);
    this.swingTimer = dur > 0 ? dur * 0.5 : 0.3;
    this.swingColor = 0xff5a5a;

    // Short lunge into head-butt range (close most of the gap to the target).
    const reach = picked
      ? THREE.MathUtils.clamp(picked.dist - 0.5, 0.4, cfg.maxReach)
      : 0.9;
    const lungeDur = dur > 0 ? dur * 0.45 : 0.22;
    const impactAt = 0.55;
    this.controller.dash(dir, reach, lungeDur, 0, impactAt);

    // Light disruptive hit at head height on contact.
    this.abilities.cast(kitAbility("headbutt", "thrust", 0xff5a5a, lungeDur * impactAt), {
      onImpact: () => {
        if (!this.character) return;
        const here = this.character.root.position.clone().addScaledVector(dir, reach * 0.5);
        here.y += 1.5;
        this.targets.playerHit(here, 1.2, PLAYER_HEADBUTT_PAYLOAD, this.params.skillForce, this.sparCtx);
        this.vfx.impact(here, 0xff7a7a, 1.4);
        this.vfx.burst(here, 0xffb0b0, 22, 5);
        this.vfx.impactExplode(here, this.fireThemeApplied);
      },
    });
  }

  /**
   * Aerial dagger overhead (airborne light attack with a knife): an angled,
   * overdriven two-handed leaping-overhead swing that DIVES forward and throws a
   * forward slash reaching ~2 m ahead, landing a real hit at the END of the swing.
   * Replaces the generic crash-down slam for the dagger loadout. The hit is timed
   * to the clip's true impact frame (not a fixed early offset), so the big aerial
   * swing connects instead of whiffing into empty air. A pending flag + fail-safe
   * timer guarantee the airborne attack state can never deadlock.
   */
  private aerialDaggerSlash() {
    if (!this.character || !this.controller) return;
    // Mutually exclusive with the crash-down slam so two airborne attacks can never
    // both resolve from one jump.
    if (this.recoverLock > 0 || this.aerialSlashPending || this.slamPending) return;
    this.aerialSlashPending = true;
    this.aerialSlashPendingTimer = 1.5;

    const weaponless = !!getCharacter(this.characterId).weaponless;
    const wid: WeaponId = weaponless ? "none" : this.weaponId;
    const combat = weaponCombat(wid);
    const intensityN = THREE.MathUtils.clamp(combat.intensity, 1, 100) / 100;
    const dirN = THREE.MathUtils.clamp(combat.direction, 0, 100) / 100;
    const origin = this.character.root.position.clone();

    // Aim the dive at the crosshair target so the overhead comes down on it.
    const target = this.pickCrosshairTarget(combat);
    const dir = this.controller.forward();
    let targetDist = Infinity;
    if (target) {
      const planar = this.toTargetPlanar(target);
      targetDist = planar.dist;
      const steer = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.3, 1, dirN) * this.params.attackSteer, 0, 1);
      dir.lerp(planar.dir, steer).normalize();
    }
    this.controller.faceToward(dir, 0.25);

    const color = SKILL_COLOR[getWeapon(wid).kind] ?? 0x9fe8ff;
    this.swingColor = color;
    const dur = this.character.playClipOnce("jumpAttack", 0.1);
    this.swingTimer = dur > 0 ? dur * 0.5 : 0.3;

    // Angled overdrive: carry the body forward through the descent so the overhead
    // reads as a diving forward slash, not a vertical drop. Closes toward the
    // target (clamped) or commits a fixed forward dive when nothing is locked.
    const close = Number.isFinite(targetDist)
      ? THREE.MathUtils.clamp(targetDist - 1.0, 0.6, this.params.dashDistance * 1.3)
      : Math.min(2.0, this.params.dashDistance);
    const diveDur = dur > 0 ? THREE.MathUtils.clamp(dur * 0.6, 0.25, 0.6) : 0.4;
    this.controller.dash(dir, close, diveDur, 0, 0.85);
    if (close > 0.4) {
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(close, 0.6), color, 4, 0.3);
    }

    // Resolve the forward slash + hit at the clip's true end-of-animation impact,
    // so the blade connects with the swing instead of resolving in empty air.
    const hitDelay = dur > 0 ? THREE.MathUtils.clamp(dur * 0.85, 0.25, 1.0) : 0.5;
    this.abilities.cast(kitAbility("aerialDaggerSlash", "slash", color, hitDelay), {
      onImpact: () => {
      if (!this.character) return;
      this.aerialSlashPending = false;
      // A long forward reach band (~2 m ahead) — much longer than the dagger's
      // grounded poke — so the diving overhead sweeps the ground in front of it.
      const strike = meleeStrike(
        { intensity: intensityN * 100, direction: 0, range: [0.8, 2.2] },
        { finisher: true, skillForce: this.params.skillForce },
      );
      const center = this.character.root.position.clone().addScaledVector(dir, strike.reach);
      center.y += 0.8;
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.character.root.rotation.y, 0));
      // Collider-bound (opt-in): draw the diving cut from the swinging hand's
      // world pose; the HIT center stays tied to the body so combat is unchanged.
      const pose = this.colliderPose();
      this.vfx.slashArc(pose ? pose.pos : center, pose ? pose.quat : quat, color);
      const payload: AttackPayload = {
        force: 2,
        damage: strike.damage,
        poiseDamage: Math.round(strike.damage * 0.7),
      };
      const result = this.targets.playerHit(center, strike.radius, payload, strike.force, this.sparCtx);
      if (!result || result.outcome === "hit" || result.outcome === "crit") {
        this.vfx.impact(center, color, strike.radius * 1.25);
        this.vfx.impactExplode(center, this.fireThemeApplied);
        this.vfx.shockwave(new THREE.Vector3(center.x, 0.05, center.z), color, strike.radius * 1.2, 0.45);
      }
      this.hitBags(center, strike.radius, strike.force);
      this.netStrike(center, strike.radius, payload.damage);
      },
    });
  }

  /**
   * Straight stab (KeyZ): a normal forward dash into an extended main-hand
   * thrust, for the blade classes (sword + knife) only. Unlike the slashing
   * combo it barely steers — it commits to a straight line — and its hit band
   * reaches a touch past the swing arc so the lunging thrust reads as a poke,
   * not a slash. Plays the dedicated `stab` clip; no-ops on non-blade loadouts
   * and on GLB rigs (which ship no stab clip).
   */
  private stab() {
    if (!this.character || !this.controller) return;
    if (this.controller.isBusy || this.recoverLock > 0) return;
    if (!this.character.hasClip("stab")) return;
    if (!this.spendPhysicalStamina(STAMINA_COST.stab, "stab")) return;
    const weaponless = !!getCharacter(this.characterId).weaponless;
    const wid: WeaponId = weaponless ? "none" : this.weaponId;
    // Blade-only move: the thrust only reads with a sword or dagger in hand.
    const cls = getWeapon(wid).animSet;
    if (cls !== "sword" && cls !== "knife") return;
    const combat = weaponCombat(wid);
    const intensityN = THREE.MathUtils.clamp(combat.intensity, 1, 100) / 100;
    const [rMin, rMax] = combat.range;
    const origin = this.character.root.position.clone();

    // Aim straight down the camera forward; only a light soft-aim nudge toward a
    // crosshair target so the stab still connects without curving off-line.
    const target = this.pickCrosshairTarget(combat);
    const dir = this.controller.forward();
    let targetDist = Infinity;
    if (target) {
      const planar = this.toTargetPlanar(target);
      targetDist = planar.dist;
      const steer = THREE.MathUtils.clamp(0.35 * this.params.attackSteer, 0, 1);
      dir.lerp(planar.dir, steer).normalize();
    }
    this.controller.faceToward(dir, 0.18);

    const dur = this.character.playClipOnce("stab", 0.1);
    this.swingTimer = dur > 0 ? dur * 0.45 : 0.2;
    const color = SKILL_COLOR[getWeapon(wid).kind] ?? 0x9fe8ff;
    this.swingColor = color;

    // Normal dash that closes to just inside the (extended) thrust reach.
    const reachMid = THREE.MathUtils.lerp(rMin, rMax, 0.6);
    const close = Number.isFinite(targetDist)
      ? THREE.MathUtils.clamp(targetDist - reachMid, 0, this.params.dashDistance)
      : Math.min(rMax, this.params.dashDistance * 0.6);
    const dashDur = dur > 0 ? THREE.MathUtils.clamp(dur * 0.5, 0.18, 0.4) : 0.24;
    const impactAt = 0.55;
    this.controller.dash(dir, close, dashDur, 0, impactAt);
    if (close > 0.4) {
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(close, 0.6), color, 4, 0.3);
    }
    // Extend the hit band outward a touch: a thrust pokes past the swing arc.
    this.scheduleComboHit(dashDur * impactAt, dir, rMin, rMax + 0.4, intensityN, color, false, null);
  }

  /**
   * Stomp finisher (KeyT): a leaping downward axe-kick that executes a
   * knocked-down (fallen) enemy. It is gated — nothing happens unless a fallen
   * foe is within reach — so it reads as a true ground execution rather than a
   * free attack. On trigger the player leaps onto the prone target, the stomp
   * one-shot plays, and a heavy {@link PLAYER_STOMP_PAYLOAD} lands at the foot-
   * fall with slam VFX. No-ops on GLB rigs (no stomp clip) and while busy.
   */
  private stomp() {
    if (!this.character || !this.controller || this.defeated) return;
    if (this.controller.isBusy || this.recoverLock > 0) return;
    if (!this.character.hasClip("stomp")) return;
    const origin = this.character.root.position.clone();
    const targetPos = this.targets.nearestDownedPoint(origin, STOMP_REACH);
    if (!targetPos) return; // finisher only lands on a downed enemy

    const dir = targetPos.clone().sub(origin);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 1e-3) dir.normalize();
    else dir.copy(this.controller.forward());
    this.controller.faceToward(dir, 0.15);

    const dur = this.character.playClipOnce("stomp", 0.1);
    this.swingTimer = dur > 0 ? dur * 0.5 : 0.3;
    const color = 0xffb24d; // slam-orange
    this.swingColor = color;

    // Leap onto the prone target: close most of the gap, landing on top of it.
    const close = THREE.MathUtils.clamp(dist - 0.4, 0, STOMP_REACH);
    const dashDur = dur > 0 ? THREE.MathUtils.clamp(dur * 0.55, 0.2, 0.6) : 0.32;
    const impactAt = 0.6;
    this.controller.dash(dir, close, dashDur, 0, impactAt);
    if (close > 0.4) {
      this.vfx.afterimage(this.character.root, origin, dir, Math.max(close, 0.6), color, 4, 0.3);
    }

    // Heavy execution hit at the foot-fall. Strict finisher semantics: only land
    // damage if a downed enemy is STILL prone here (re-acquire so a foe that slid
    // a touch still gets stomped, but one that already got up does not). A whiff
    // still plays the ground slam VFX at the foot-fall for feedback.
    this.abilities.cast(kitAbility("stomp", "slam", color, dashDur * impactAt), {
      onImpact: () => {
        if (!this.character) return;
        const here = this.character.root.position;
        const downed = this.targets.nearestDownedPoint(here, STOMP_REACH + 0.6);
        const hitPos = downed ?? new THREE.Vector3(here.x, 0.6, here.z);
        if (downed) {
          this.targets.playerHit(downed, 1.8, PLAYER_STOMP_PAYLOAD, this.params.skillForce, this.sparCtx);
        }
        const ground = new THREE.Vector3(hitPos.x, 0.05, hitPos.z);
        this.vfx.aoeBlast(new THREE.Vector3(hitPos.x, hitPos.y + 0.2, hitPos.z), color, 2.0);
        this.vfx.burst(hitPos, 0xffd27a, 40, 6);
        this.vfx.shockwave(ground, color, 2.2, 0.4);
        this.vfx.smokePop(ground, 0xffcaa0, 1.2);
      },
    });
  }

  signatureSkills(): { label: string; icon: string; mm?: number; iconUrl?: string | null }[] {
    // HUD 1–4: master-weaponSkills (uMMORPG) via t0SignatureSkills, else T0 sheet.
    const t0 = t0SignatureSkills(this.weaponId);
    if (t0.length) {
      return t0.map((s) => ({
        label: s.label,
        icon: SKILL_KIND_ICON[s.kind] ?? "attack",
        mm: s.mm,
        iconUrl: s.iconUrl,
      }));
    }
    return getCharacter(this.characterId).signatureSkills.map((s) => ({
      label: s.label,
      icon: SKILL_KIND_ICON[s.kind],
    }));
  }

  // ── Multiplayer wiring ─────────────────────────────────────────────────────

  /**
   * Attach a live relay client so this Studio joins a multiplayer room: it
   * broadcasts the local player's transform/anim each report tick, renders the
   * other players as interpolated avatars, and (in coop) either owns the NPC
   * roster as host or mirrors the host's roster as a peer. Safe to call after the
   * room `welcome` has already arrived — remotes are seeded from the first
   * snapshot, so no welcome handoff is required.
   */
  attachNet(net: DangerClient): void {
    this.detachNet();
    this.net = net;
    // A coop peer (non-host) must NOT run its own AI/spawns — the host is the
    // sole authority for NPCs, mirrored in via `npcs` broadcasts.
    if (net.mode === "coop" && !net.isHost) {
      this.targets.setCount(0);
      this.targets.setDifficulty("passive");
    }
    this.netUnsub.push(
      net.on("joined", (p) => this.spawnRemote(p.id, p.name)),
      net.on("left", (id) => this.removeRemote(id)),
      net.on("snapshot", (players) => this.onNetSnapshot(players)),
      net.on("combat", (ev) => this.onNetCombat(ev)),
      net.on("npcs", (npcs) => this.onNetNpcs(npcs)),
      net.on("preset", (preset) => this.onNetPreset(preset)),
    );
  }

  /**
   * Apply a host-broadcast environment preset change so this joiner switches to
   * the same arena. Unknown/invalid values are ignored (the lib stays decoupled
   * from the animator's preset set). `propagate: false` keeps this from echoing
   * back to the relay; the React UI is notified so its menubar stays in sync.
   */
  private onNetPreset(preset: string): void {
    const id = asRoomPresetId(preset);
    if (!id || id === this.room.presetId) return;
    this.setRoomPreset(id, { propagate: false });
    this.onRoomPresetChanged?.(id);
  }

  /** Detach the relay client and tear down all networked avatars. */
  detachNet(): void {
    for (const off of this.netUnsub) off();
    this.netUnsub.length = 0;
    for (const a of this.remotes.values()) {
      this.remoteRoot.remove(a.root);
      a.dispose();
    }
    this.remotes.clear();
    for (const a of this.mirrorNpcs.values()) {
      this.remoteRoot.remove(a.root);
      a.dispose();
    }
    this.mirrorNpcs.clear();
    this.net = null;
  }

  /** Get-or-create a remote player avatar (async rig load; idempotent by id). */
  private spawnRemote(id: string, name: string): RemoteAvatar {
    const existing = this.remotes.get(id);
    if (existing) return existing;
    const avatar = new RemoteAvatar(id, name);
    this.remotes.set(id, avatar);
    this.remoteRoot.add(avatar.root);
    void avatar.load();
    return avatar;
  }

  private removeRemote(id: string): void {
    const a = this.remotes.get(id);
    if (!a) return;
    this.remotes.delete(id);
    this.remoteRoot.remove(a.root);
    a.dispose();
  }

  /** Reconcile remote players against the authoritative snapshot list. */
  private onNetSnapshot(players: PlayerState[]): void {
    const net = this.net;
    if (!net) return;
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === net.selfId) {
        // PvP: the server owns our HP — read it back here (the loop no longer
        // overwrites this.health from the local CC in pvp). Death/respawn
        // transitions are driven by explicit combat events, but mirror them off
        // the authoritative alive flag too in case an event was missed.
        if (net.mode === "pvp") {
          this.health = p.hp;
          if (!p.alive && !this.defeated) this.defeatPlayer(false);
          else if (p.alive && this.defeated) this.restorePlayer();
        }
        continue;
      }
      seen.add(p.id);
      const a = this.spawnRemote(p.id, p.name);
      a.applyTransform(p.px, p.py, p.pz, p.ry, p.moving, p.grounded, p.weapon);
    }
    for (const id of [...this.remotes.keys()]) {
      if (!seen.has(id)) this.removeRemote(id);
    }
  }

  /** Reconcile mirrored host NPCs (coop peers only). */
  private onNetNpcs(npcs: NpcState[]): void {
    const net = this.net;
    if (!net || net.mode !== "coop" || net.isHost) return;
    const seen = new Set<string>();
    for (const n of npcs) {
      if (!n.alive) continue;
      seen.add(n.id);
      let a = this.mirrorNpcs.get(n.id);
      if (!a) {
        a = new RemoteAvatar(n.id, "");
        this.mirrorNpcs.set(n.id, a);
        this.remoteRoot.add(a.root);
        void a.load();
      }
      a.applyTransform(n.px, n.py, n.pz, n.ry, false, true, n.weapon);
    }
    for (const id of [...this.mirrorNpcs.keys()]) {
      if (!seen.has(id)) {
        const a = this.mirrorNpcs.get(id)!;
        this.mirrorNpcs.delete(id);
        this.remoteRoot.remove(a.root);
        a.dispose();
      }
    }
  }

  /** Handle an incoming combat event from another player. */
  private onNetCombat(ev: CombatEvent): void {
    const net = this.net;
    if (!net) return;
    switch (ev.k) {
      case "attack":
        if (ev.from !== net.selfId) this.remotes.get(ev.from)?.playAttack();
        return;
      case "hit":
        if (ev.target === "player") {
          // PvP hits are resolved server-side: the broadcast carries the already
          // applied (post-guard) amount + outcome. The local player reads its
          // authoritative HP from snapshots, so on a self-hit we only play
          // VFX/recoil — never decrement HP locally (that would double-count).
          if (ev.to === net.selfId) this.reactNetPlayerHit(ev.amount, ev.outcome, ev.from);
          else this.remotes.get(ev.to)?.playHurt();
        } else if (ev.target === "npc" && net.isHost) {
          // Host owns NPC health: resolve the peer-forwarded hit on the dummy CC.
          this.targets.applyNetHit(ev.to, ev.amount, this.sparCtx);
        }
        return;
      case "death":
        // Server-authoritative death (pvp). On self, enter the defeat state but
        // do NOT auto-respawn — the server owns the respawn timer.
        if (ev.from === net.selfId) this.defeatPlayer(false);
        else this.remotes.get(ev.from)?.playHurt();
        return;
      case "respawn":
        // Server-authoritative respawn (pvp). Restore the local player on self.
        if (ev.from === net.selfId) this.restorePlayer();
        return;
    }
  }

  /**
   * React to a server-resolved PvP hit on the local player: VFX + recoil only.
   * The server already applied the (post-guard) damage to authoritative HP, which
   * arrives via snapshots — never decrement HP here. `outcome` is the server's
   * resolution (hit/block/avoid) so the reaction matches what actually landed.
   */
  private reactNetPlayerHit(amount: number, outcome: string | undefined, fromId: string): void {
    if (!this.character || this.defeated) return;
    const defended = outcome === "block" || outcome === "avoid";
    const chest = this.character.root.position.clone();
    chest.y += 1.0;
    const from = this.remotes.get(fromId)?.position(new THREE.Vector3()) ?? chest.clone();
    const push = chest.clone().sub(from);
    push.y = 0;
    if (push.lengthSq() < 1e-4) push.set(0, 0, 1);
    push.normalize();
    // Bigger recoil on a clean hit, lighter nudge when blocked; none when avoided.
    const recoil = outcome === "avoid" ? 0 : defended ? 3 : 6;
    if (recoil > 0) this.controller?.applyImpulse(push, recoil * 0.5, recoil > 4 ? 1.5 : 0);
    if (!defended && amount > 0) {
      this.hurt = 0.5;
      this.vfx.fireAura(chest, amount > 20 ? 1.2 : 0.9, this.fireThemeApplied);
    } else if (outcome === "block") {
      this.vfx.impact(chest, 0x6ad0ff, 0.8);
    }
  }

  /** Restore the local player after a server-authoritative pvp respawn. */
  private restorePlayer(): void {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.invuln = 1.6;
    this.defeated = false;
    this.hurt = 0;
  }

  /**
   * Forward a local melee/skill strike to networked combatants: in pvp, hit
   * remote players in range; as a coop peer, forward hits onto mirrored host
   * NPCs (the host resolves the damage). No-op in solo play.
   */
  private netStrike(center: THREE.Vector3, radius: number, damage: number): void {
    const net = this.net;
    if (!net || !net.roomCode) return;
    const reach = radius + 1.0;
    const amount = Math.max(1, Math.round(damage));
    if (net.mode === "pvp") {
      for (const [id, a] of this.remotes) {
        if (a.position(this.netTmp).distanceTo(center) <= reach) {
          net.sendCombat({ k: "hit", from: net.selfId, to: id, target: "player", amount });
        }
      }
    } else if (net.mode === "coop" && !net.isHost) {
      for (const [id, a] of this.mirrorNpcs) {
        if (a.position(this.netTmp).distanceTo(center) <= reach) {
          net.sendCombat({ k: "hit", from: net.selfId, to: id, target: "npc", amount });
          this.vfx.impact(a.position(this.netTmp), 0xff7a8a, 1.0);
        }
      }
    }
  }

  /** Build the local player's snapshot for broadcast. */
  private buildSnapshot(): PlayerSnapshot {
    const root = this.character?.root;
    const cs = this.controller?.state;
    const weaponless = !!getCharacter(this.characterId).weaponless;
    // Report the current defensive stance so the server can mitigate PvP damage
    // authoritatively (block/parry/dodge map straight through; else "open").
    const cstate = this.sparring.getPlayerState();
    const guard: GuardState =
      cstate === "block" || cstate === "parry" || cstate === "dodge" ? cstate : "open";
    return {
      px: root?.position.x ?? 0,
      py: root?.position.y ?? 0,
      pz: root?.position.z ?? 0,
      ry: root?.rotation.y ?? 0,
      clip: this.character?.currentClipName() ?? "",
      weapon: weaponless ? "none" : this.weaponId,
      hp: Math.round(this.health),
      moving: (cs?.speed ?? 0) > 0.1,
      grounded: cs?.grounded ?? true,
      guard,
    };
  }

  /** Per-frame multiplayer pump: broadcast + interpolate networked avatars. */
  private updateNet(dt: number): void {
    const net = this.net;
    if (!net) return;
    if (net.roomCode) {
      this.stateAccum += dt;
      if (this.stateAccum >= STATE_REPORT_MS / 1000) {
        this.stateAccum = 0;
        net.sendState(this.buildSnapshot());
      }
      if (net.mode === "coop" && net.isHost) {
        this.npcAccum += dt;
        if (this.npcAccum >= STATE_REPORT_MS / 1000) {
          this.npcAccum = 0;
          net.sendNpcs(this.targets.netSnapshot());
        }
      }
    }
    for (const a of this.remotes.values()) a.update(dt);
    for (const a of this.mirrorNpcs.values()) a.update(dt);
  }

  dispose() {
    this.disposed = true;
    // Flush any pending (debounced) controls save so the last zoom/feel sticks.
    if (this.controlsSaveTimer !== null) {
      clearTimeout(this.controlsSaveTimer);
      this.controlsSaveTimer = null;
      saveControls(this.params);
    }
    this.detachNet();
    this.remoteRoot.clear();
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("click", this.onClick);
    this.renderer.domElement.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keyup", this.onKeyUp);
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.input.exitLock();
    this.input.dispose();
    this.cancelMaceThrow();
    if (this.mounted) unmountWeapon(this.mounted);
    this.character?.dispose();
    this.djBooth?.dispose();
    this.room.dispose();
    this.sfx?.dispose();
    this.vfx.dispose();
    this.ale.dispose();
    this.targets.dispose();
    this.dangerTargets?.dispose();
    this.arena?.dispose();
    this.physics?.dispose();
    this.status.dispose();
    this.mech.dispose();
    this.indicators.dispose();
    this.telegraphs.dispose();
    this.cancelCastPlacement();
    if (this.castReticle) {
      this.scene.remove(this.castReticle);
      this.castReticle.geometry.dispose();
      (this.castReticle.material as THREE.Material).dispose();
      this.castReticle = null;
    }
    this.pending.length = 0;
    this.abilities.cancelAll();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    this.postfx?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

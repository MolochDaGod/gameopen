/**
 * BrawlerScene — Ruins Brawler on the **canonical Danger Room controller stack**.
 *
 * Stack (same ownership as Studio / Danger Room):
 *   InputState  → keyboard / pointer lock / mouse look
 *   Controller  → camera-relative WASD, jump, orbit cam, lock-on, dash, loco
 *   PhysicsSystem → Rapier ground plane + optional static layers (arena)
 *   Character   → AnimationMixer + loco blend + one-shots
 *   Vfx         → combat feedback
 *
 * Do not re-implement custom WASD/yaw/jump cameras here — extend Controller.
 * Networking is best-effort; offline local AI always runs.
 */
import * as THREE from "three";
import { getCharacter, getWeapon } from "../assets";
import { Character } from "../Character";
import { Controller } from "../Controller";
import { InputState } from "../input";
import { PhysicsSystem } from "../PhysicsSystem";
import { getBakedCharacter } from "../grudge/bakedRoster";
import { GrudgeAvatar } from "../grudge/GrudgeAvatar";
import { loadGrudge6CombatRig } from "../grudge/grudge6Runtime";
import {
  listHostilePrefabs,
  type EntityPrefab,
} from "../ummorpg/prefabProfile";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Vfx } from "../Vfx";
import { createMysticalComposer, type MysticalComposer } from "../fx/postfx";
import { loadControls } from "../controlsSettings";
import { mountWeaponModel, unmountWeapon, type MountedWeapon } from "../Weapons";
import { GRAVITY_Y, LOCOMOTION, PLAYER_HEIGHT_M } from "../../lib/productionRuntime";
import type { Avatar, EditorParams, WeaponId } from "../types";
import { DEFAULT_EDITOR } from "../types";
import { parseGrudgeAvatarId } from "../../lib/raceModel";
import {
  applyContentSkillLabels,
  buildT0SkillHud,
  mainWeaponCycle,
  softLoadContentCatalog,
  type ContentCatalogOverlay,
} from "./combatLoadout";

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAYER_MAX_HP = 150;
const PLAYER_BASE_ARMOR = 30;
const PLAYER_BASE_AMMO = 60;
const ATTACK_CD = 0.4;
const ENEMY_MAX = 12;
const ENEMY_SPEED = 2.5;
const ENEMY_ATTACK_REACH = 1.8;
const ENEMY_ATTACK_CD = 1.2;
const ENEMY_HP = 60;
const ENEMY_DAMAGE = 15;
const SPAWN_INTERVAL = 4;
const SPAWN_RADIUS = 28;
/** Flat-floor half-extent for Controller.setRoomBound (must fit spawn ring). */
const ARENA_HALF = 36;
const SAFE_ZONE_RADIUS = 6;
const HEAL_RATE = 2;
const NET_TICK_HZ = 20;
const FOCUS_ACQUIRE_RANGE = 18;
const FOCUS_BREAK_RANGE = 28;
const DASH_COOLDOWN = 2.0;

/** Full arsenal cycle (Danger Room weapon table). */
const WEAPON_CYCLE: WeaponId[] = mainWeaponCycle();

/** Lab GLB fallbacks when grudge6 rig fails (no karate-boss — prefer race/catalog kits). */
const AVATAR_CANDIDATES = [
  "orc",
  "sanji",
  "gunslinger",
  "explorer",
] as const;

// ── Public types ──────────────────────────────────────────────────────────────
export interface BrawlerSkillSlot {
  slot: 1 | 2 | 3 | 4;
  label: string;
  key: string;
  cd: number;
  cdMax: number;
  ready: boolean;
  /** Danger Room skill pack icon (CDN or local). */
  iconUrl?: string;
}

export interface BrawlerState {
  phase: "loading" | "playing" | "dead";
  playerHp: number;
  playerMaxHp: number;
  playerArmor: number;
  ammo: number;
  credits: number;
  kills: number;
  weaponName: string;
  weaponId: string;
  characterName: string;
  characterClass: string;
  connected: boolean;
  playerCount: number;
  inSafeZone: boolean;
  wave: number;
  skills: BrawlerSkillSlot[];
  moving: boolean;
  loadError: string | null;
  focusLocked: boolean;
  hasTarget: boolean;
  targetHp: number;
  targetMaxHp: number;
  /** Studio avatar id actually loaded (`grudge:…` or catalog). */
  avatarId: string;
  /** Weapon cycle list for HUD strip (arsenal ids). */
  weaponCycle: string[];
}

export interface BrawlerSceneOptions {
  displayName?: string;
  characterClass?: string;
  preferredAvatarId?: string;
  rosterIndex?: number;
  /**
   * Arena / map GLB path under public (e.g. models/agama-map.glb).
   * Default: classic Ruins arena (models/arena-war-zone.glb).
   */
  mapPath?: string;
  /** Enemy ring spawn radius (meters). Larger maps need more. */
  spawnRadius?: number;
  /** Soft safe-zone radius at origin (heal + shop). */
  safeZoneRadius?: number;
  /** Max concurrent hostiles (default 12). */
  maxEnemies?: number;
  /** Seconds between spawns (default 4). */
  spawnInterval?: number;
  /** Opening wave count before interval spawn takes over. */
  initialSpawnCount?: number;
  /**
   * Studio avatar id — prefer `grudge:race:preset` (GrudgeAvatar + baked anims)
   * or catalog id (`orc`, `grudge-western-kingdoms-knight`, …). Never karate-boss.
   */
  characterId?: string;
  /** Main-hand arsenal weapon (Danger Room WeaponId). */
  weaponId?: WeaponId;
  /** Off-hand (shield etc.) when main is 1H-eligible. */
  offHand?: WeaponId | null;
  /** Fleet combat power → skill damage scale. */
  atk?: number;
  /** Fleet / class max HP. */
  maxHp?: number;
}

// ── Internal ──────────────────────────────────────────────────────────────────
interface EnemyObj {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  speed: number;
  attackCd: number;
  /** Prefab combat range (m) — uMMORPG EntityPrefab.combat.range */
  attackReach: number;
  /** Prefab combat damage */
  attackDamage: number;
  /** Prefab attack cooldown (s) */
  attackCdMax: number;
  walkClock: number;
}

interface SkillDef {
  slot: 1 | 2 | 3 | 4;
  label: string;
  key: string;
  clip: string;
  reach: number;
  damage: number;
  cdMax: number;
  cd: number;
  lunge: number;
  iconUrl?: string;
  kind?: string;
}

type StateCb = (s: BrawlerState) => void;

// ── BrawlerScene ──────────────────────────────────────────────────────────────
export class BrawlerScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro?: ResizeObserver;
  private vfx: Vfx;
  private postfx: MysticalComposer | null = null;

  /** Canonical stack — same as Danger Room / Studio. */
  private input: InputState;
  private params: EditorParams;
  private controller: Controller | null = null;
  private physics: PhysicsSystem | null = null;
  private arenaColliders: THREE.Object3D[] = [];

  private avatar: Avatar | null = null;
  private fallbackModel: THREE.Object3D | null = null;
  private mounted: MountedWeapon | null = null;
  private mountedOff: MountedWeapon | null = null;
  private weaponToken = 0;
  private playerHp = PLAYER_MAX_HP;
  private playerMaxHp = PLAYER_MAX_HP;
  private playerArmor = PLAYER_BASE_ARMOR;
  private ammo = PLAYER_BASE_AMMO;
  private credits = 0;
  private kills = 0;
  private wave = 1;
  private atkCd = 0;
  private dashCd = 0;
  private weaponId: WeaponId = "sword";
  private offHandId: WeaponId | null = null;
  private atkPower = 16;
  private phase: BrawlerState["phase"] = "loading";
  private moving = false;
  private loadError: string | null = null;
  private characterName = "Brawler";
  private characterClass = "Fighter";
  /** Prefer grudge6 modular kits; never default to karate-boss GLB. */
  private preferredAvatarId = "grudge:orcs:knight";
  private characterId = "grudge:orcs:knight";
  private rosterIndex = 0;
  private skills: SkillDef[] = [];
  private contentCatalog: ContentCatalogOverlay | null = null;

  private lmbDown = false;
  private rmbDown = false;
  private focusEnabled = false;
  private focusTarget: EnemyObj | null = null;
  private canvas: HTMLCanvasElement;

  private enemies: EnemyObj[] = [];
  /** Multi-race grudge6 hostile templates (filled by loadEnemyTemplates). */
  private enemyTemplates: (THREE.Group | null)[] = [];
  private spawnTimer = 0;
  private focusRing: THREE.Mesh | null = null;
  private safeZoneRing: THREE.Mesh | null = null;
  private inSafeZone = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private connected = false;
  private selfId = "";
  private playerCount = 1;
  private remoteMeshes = new Map<string, THREE.Group>();
  private netTimer = 0;
  private netSeq = 0;

  private onState: StateCb;
  private lastSig = "";

  /** Environment map path (same-origin / CDN candidates). */
  private mapPath = "models/arena-war-zone.glb";
  private spawnRadius = SPAWN_RADIUS;
  private safeZoneRadius = SAFE_ZONE_RADIUS;
  private maxEnemies = ENEMY_MAX;
  private spawnInterval = SPAWN_INTERVAL;
  private initialSpawnCount = 4;

  constructor(canvas: HTMLCanvasElement, onState: StateCb, opts: BrawlerSceneOptions = {}) {
    this.canvas = canvas;
    this.onState = onState;
    if (opts.displayName) this.characterName = opts.displayName;
    if (opts.characterClass) this.characterClass = opts.characterClass;
    if (opts.preferredAvatarId) this.preferredAvatarId = opts.preferredAvatarId;
    if (opts.characterId) {
      this.characterId = opts.characterId;
      this.preferredAvatarId = opts.characterId;
    }
    if (opts.weaponId) this.weaponId = opts.weaponId;
    if (opts.offHand !== undefined) this.offHandId = opts.offHand;
    if (typeof opts.atk === "number" && opts.atk > 0) this.atkPower = opts.atk;
    if (typeof opts.maxHp === "number" && opts.maxHp > 20) {
      this.playerMaxHp = opts.maxHp;
      this.playerHp = opts.maxHp;
    }
    if (typeof opts.rosterIndex === "number") this.rosterIndex = opts.rosterIndex;
    if (opts.mapPath) this.mapPath = opts.mapPath.replace(/^\//, "");
    if (typeof opts.spawnRadius === "number" && opts.spawnRadius > 4) {
      this.spawnRadius = opts.spawnRadius;
    }
    if (typeof opts.safeZoneRadius === "number" && opts.safeZoneRadius > 1) {
      this.safeZoneRadius = opts.safeZoneRadius;
    }
    if (typeof opts.maxEnemies === "number" && opts.maxEnemies > 0) {
      this.maxEnemies = opts.maxEnemies;
    }
    if (typeof opts.spawnInterval === "number" && opts.spawnInterval > 0.5) {
      this.spawnInterval = opts.spawnInterval;
    }
    if (typeof opts.initialSpawnCount === "number" && opts.initialSpawnCount >= 0) {
      this.initialSpawnCount = opts.initialSpawnCount;
    }

    // Danger Room controls (persisted) — same loadControls() as Studio
    this.params = {
      ...DEFAULT_EDITOR,
      ...loadControls(),
      moveSpeed: LOCOMOTION.walkSpeed,
      sprintMultiplier: LOCOMOTION.sprintMult,
    };

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x0a0c12);
    this.scene.fog = new THREE.FogExp2(0x0a0c12, 0.015);
    this.camera = new THREE.PerspectiveCamera(this.params.fov, w / h, 0.1, 500);
    this.vfx = new Vfx(this.scene, this.camera);
    this.vfx.setGoreCamera(this.camera);
    // Same postprocessing stack as Danger Room (bloom / vignette / grain / ACES)
    try {
      this.postfx = createMysticalComposer(this.renderer, this.scene, this.camera, {
        bloomIntensity: 0.85,
        bloomThreshold: 0.22,
        bloomRadius: 0.55,
        saturation: 0.1,
        vignetteDarkness: 0.55,
        chromatic: 0.0006,
        grain: 0.04,
      });
      this.postfx.setSize(w, h);
    } catch (err) {
      console.warn("[BrawlerScene] postfx init failed", err);
      this.postfx = null;
    }

    // Canonical input layer (pointer lock + KeyW/A/S/D + mouse look)
    this.input = new InputState(canvas);

    this.buildLights();
    this.buildSafeZoneRing();
    this.buildFocusRing();

    this.raf = requestAnimationFrame(this.animate);
    void this.bootstrap();

    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("blur", this.onWindowBlur);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.emitState();
  }

  private async bootstrap() {
    await Promise.all([
      this.initPhysics(),
      this.buildPlayer(),
      this.loadEnemyTemplates(),
      this.loadEnvironment(),
    ]);
    if (this.disposed) return;
    this.setPhase("playing");
    // Immediate wave presence — don't wait for first spawn-interval tick.
    for (let i = 0; i < this.initialSpawnCount; i++) this.spawnEnemy();
    void this.initNetwork();
  }

  /** Rapier ground layer — same foundation as Danger Room Studio. */
  private async initPhysics() {
    const physics = new PhysicsSystem();
    try {
      await physics.init(GRAVITY_Y);
    } catch (err) {
      console.warn("[BrawlerScene] physics init failed — visual-only floor", err);
      return;
    }
    if (this.disposed || !physics.world) {
      physics.dispose();
      return;
    }
    physics.addGroundPlane(0, ARENA_HALF + 10, 0.5);
    this.physics = physics;
  }

  /** Fleet multi-CDN GLB load (Draco + Meshopt via sharedGltfLoader). */
  private async loadGltf(path: string) {
    const { loadGltfFirst } = await import("../assets");
    const { sharedGltfLoader } = await import("../loaders/gltf");
    const { scene, animations, url } = await loadGltfFirst(path, sharedGltfLoader());
    return { scene, animations, url };
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x20160f, 0.6));
    const key = new THREE.DirectionalLight(0xfff1d8, 1.6);
    key.position.set(14, 26, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 90;
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -40;
    sc.right = 40;
    sc.top = 40;
    sc.bottom = -40;
    this.scene.add(key);
    const p1 = new THREE.PointLight(0xff6030, 1.2, 18);
    p1.position.set(-12, 3, -8);
    this.scene.add(p1);
    const p2 = new THREE.PointLight(0x4080ff, 1.0, 20);
    p2.position.set(14, 2, 12);
    this.scene.add(p2);
    this.scene.add(new THREE.AmbientLight(0x2a3350, 0.4));
  }

  private buildSafeZoneRing() {
    const r = this.safeZoneRadius;
    const geo = new THREE.RingGeometry(Math.max(0.5, r - 0.25), r, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7ee0a0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    this.scene.add(ring);
    this.safeZoneRing = ring;
  }

  private buildFocusRing() {
    const geo = new THREE.RingGeometry(0.55, 0.75, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6a4a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.scene.add(ring);
    this.focusRing = ring;
  }

  /**
   * Load Avatar (Grudge6 / catalog) → Controller + arsenal weapons + T0 skills.
   * Same ownership as Danger Room Studio.spawnCharacter / applyWeapon.
   */
  private async buildPlayer() {
    // Soft-fetch content / ObjectStore catalogs (non-blocking for first paint)
    void softLoadContentCatalog().then((cat) => {
      if (this.disposed) return;
      this.contentCatalog = cat;
      this.installSkillsForWeapon(this.weaponId);
      this.emitState();
    });

    const order = [
      this.characterId,
      this.preferredAvatarId,
      ...AVATAR_CANDIDATES.filter(
        (id) => id !== this.preferredAvatarId && id !== this.characterId,
      ),
    ].filter(Boolean) as string[];

    for (const id of order) {
      try {
        const av = await this.spawnAvatar(id);
        if (!av) continue;
        if (this.disposed) {
          av.dispose();
          return;
        }
        this.avatar = av;
        this.characterId = id;
        this.ensureAvatarHumanScale(av);
        av.root.position.set(0, 0, 8);
        this.scene.add(av.root);
        this.bindController(av);
        this.installSkillsForWeapon(this.weaponId);
        await this.applyWeaponAsync(this.weaponId);
        if (av.def?.name) this.characterClass = av.def.name;
        console.info(
          "[BrawlerScene] avatar ready:",
          id,
          "weapon:",
          this.weaponId,
          "clips:",
          av.clipNames().slice(0, 10),
        );
        this.emitState();
        return;
      } catch (err) {
        console.warn("[BrawlerScene] avatar candidate failed:", id, err);
      }
    }

    // Fallback: static baked mesh (pose only)
    try {
      const model = await getBakedCharacter(this.rosterIndex);
      if (this.disposed) return;
      this.fallbackModel = model;
      model.position.set(0, 0, 8);
      this.scene.add(model);
      this.installSkillsForWeapon(this.weaponId);
      this.loadError =
        "Static mesh only — grudge6 / lab rig failed; skills still use T0 kit";
      console.warn("[BrawlerScene]", this.loadError);
    } catch (err) {
      this.loadError = "Player model failed to load";
      console.error("[BrawlerScene] player load failed", err);
      this.installSkillsForWeapon(this.weaponId);
    }
    this.emitState();
  }

  /** Studio-parity spawn: grudge: → GrudgeAvatar, else Character catalog. */
  private async spawnAvatar(id: string): Promise<Avatar | null> {
    const grudge = parseGrudgeAvatarId(id);
    if (grudge) {
      const av = new GrudgeAvatar(grudge.raceId, grudge.presetId);
      await av.load();
      return av;
    }
    const def = getCharacter(id);
    if (!def) return null;
    // Procedural explorer still works as Character file empty path → skip empty
    if (!def.file && !def.procedural) return null;
    if (def.procedural) {
      // Lazy import avoids circular weight when only GLB path is used
      const { ExplorerCharacter } = await import("../ExplorerCharacter");
      const av = new ExplorerCharacter(def);
      await av.load();
      return av;
    }
    const av = new Character(def);
    await av.load();
    return av;
  }

  /**
   * Final guard: if the loaded avatar is wildly off 1.8 m (e.g. residual 100×
   * unit bug), re-fit the visual model under the avatar root.
   * SSOT: three/characterDeploy.ensureHumanScale (Y-up / XZ ground).
   */
  private ensureAvatarHumanScale(av: Avatar): void {
    void import("../characterDeploy").then(({ ensureHumanScale }) => {
      ensureHumanScale(av.root, PLAYER_HEIGHT_M);
    });
  }

  /** Wire Danger Room Controller to the loaded Avatar. */
  private bindController(av: Avatar) {
    this.controller = new Controller(av, this.camera, this.input, this.params);
    this.controller.setRoomBound(ARENA_HALF);
    this.controller.setObstacles(() =>
      this.enemies.map((e) => ({ x: e.pos.x, z: e.pos.z, r: 0.55 })),
    );
    if (this.arenaColliders.length) {
      this.controller.setCameraOccluders(this.arenaColliders);
    }
  }

  /** T0 weapon skills (+ optional content API labels) — Danger Room kit. */
  private installSkillsForWeapon(weaponId: WeaponId) {
    let hud = buildT0SkillHud(weaponId, this.atkPower);
    hud = applyContentSkillLabels(hud, weaponId, this.contentCatalog);
    // Prefer character signature clips when present on the loaded def
    const sigs = this.avatar?.def?.signatureSkills ?? [];
    this.skills = hud.map((h, i) => {
      const sig = sigs[i];
      return {
        slot: h.slot,
        label: h.label,
        key: h.key,
        clip: (sig?.clip && sig.clip.length > 0 ? sig.clip : h.clip) || "attack",
        reach: h.reach,
        damage: h.damage,
        cdMax: h.cdMax,
        cd: 0,
        lunge: h.lunge,
        iconUrl: h.iconUrl,
        kind: h.kind,
      };
    });
  }

  /** Mount main + off-hand via arsenal mountWeaponModel (same as Studio). */
  private async applyWeaponAsync(weaponId: WeaponId) {
    const token = ++this.weaponToken;
    this.weaponId = weaponId;
    this.avatar?.setWeaponId?.(weaponId);
    this.avatar?.readyPose?.(weaponId);

    if (this.mounted) {
      unmountWeapon(this.mounted);
      this.mounted = null;
    }
    if (this.mountedOff) {
      unmountWeapon(this.mountedOff);
      this.mountedOff = null;
    }

    const character = this.avatar;
    const rightHand = character?.rightHand;
    const leftHand = character?.leftHand;
    if (!character || !rightHand || !leftHand) {
      this.installSkillsForWeapon(weaponId);
      this.emitState();
      return;
    }
    if (character.def?.weaponless) {
      this.installSkillsForWeapon("none");
      this.emitState();
      return;
    }

    const def = getWeapon(weaponId);
    const mounted = await mountWeaponModel(def, rightHand, leftHand);
    if (this.disposed || token !== this.weaponToken || this.avatar !== character) {
      unmountWeapon(mounted);
      return;
    }
    this.mounted = mounted;

    // Off-hand (shield) when eligible
    if (this.offHandId) {
      const { offHandEligible } = await import("../arsenal");
      if (offHandEligible(weaponId)) {
        const off = await mountWeaponModel(getWeapon(this.offHandId), rightHand, leftHand);
        if (this.disposed || token !== this.weaponToken || this.avatar !== character) {
          unmountWeapon(off);
        } else {
          this.mountedOff = off;
        }
      }
    }

    this.installSkillsForWeapon(weaponId);
    this.emitState();
  }

  /**
   * Hostiles from uMMORPG EntityPrefab catalog (`listHostilePrefabs`) —
   * full grudge6 multi-race kits with mesh_ids + combat numbers (same SSOT
   * as Danger Room Targets.loadGrudgeOpponent). Not orcs-only or voxel boxes.
   */
  private async loadEnemyTemplates() {
    const all = listHostilePrefabs();
    // Cap templates for first-load snappiness; diversify by race (WK/BRB/ELF/DWF/ORC/UD).
    const loadList = pickHostileLoadList(all, Math.max(6, Math.min(all.length, 12)));
    for (let i = 0; i < loadList.length; i++) {
      const prefab = loadList[i]!;
      try {
        const rig = await loadGrudge6CombatRig(prefab.raceId, prefab.presetId, {
          meshIds: prefab.meshIds,
        });
        if (this.disposed) {
          rig.mixer.stopAllAction();
          return;
        }
        // Template is the visual group only (spawn clones skinned mesh tree)
        const root = rig.root;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.userData.selectable = "hostile";
          }
        });
        root.userData.selectable = "hostile";
        stampPrefabCombat(root, prefab);
        // Stop mixer on template — spawns are static clones (AI walk bob handles motion)
        rig.mixer.stopAllAction();
        this.enemyTemplates[i] = root as THREE.Group;
        console.info(
          `[BrawlerScene] hostile prefab ${prefab.id} race=${prefab.raceId} preset=${prefab.presetId} meshes=${prefab.meshIds.length} range=${prefab.combat.range}`,
        );
      } catch (err) {
        console.warn(`[BrawlerScene] grudge6 hostile ${prefab.id} failed`, err);
      }
    }
    // Soft fallback: voxel zombies only if all grudge6 kits failed
    if (!this.enemyTemplates.some(Boolean)) {
      console.warn("[BrawlerScene] no grudge6 hostiles — trying voxel fallback");
      for (let i = 0; i < 3; i++) {
        const n = i + 1;
        const paths = [
          `models/enemies/voxel-zombies/voxel-zombie-${n}.glb`,
          `voxel-zombie-${n}.glb`,
        ];
        for (const path of paths) {
          try {
            const gltf = await this.loadGltf(path);
            if (this.disposed) return;
            const root = gltf.scene;
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            root.scale.setScalar((PLAYER_HEIGHT_M * 0.9) / (size.y || 1));
            root.updateMatrixWorld(true);
            const b2 = new THREE.Box3().setFromObject(root);
            root.position.y -= b2.min.y;
            root.traverse((o) => {
              const m = o as THREE.Mesh;
              if (m.isMesh) {
                m.castShadow = true;
                m.receiveShadow = true;
                m.userData.selectable = "hostile";
              }
            });
            root.userData.selectable = "hostile";
            this.enemyTemplates[i] = root as THREE.Group;
            break;
          } catch {
            /* try next */
          }
        }
      }
    }
  }

  /**
   * Scale arena GLB into metres relative to a 1.8 m player.
   * Handles cm-authored maps (100×) and oversized pads without shrinking
   * doors/props smaller than a human.
   */
  private scaleMapToPlayer(root: THREE.Object3D): { half: number; unitScale: number } {
    const playerH = PLAYER_HEIGHT_M; // 1.8 m
    root.scale.set(1, 1, 1);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(root);
    let size = box.getSize(new THREE.Vector3());
    let maxXZ = Math.max(size.x, size.z) || 1;
    let height = size.y || 1;

    // Decade unit fix: cm scenes often report XZ thousands / height hundreds
    let unitScale = 1;
    if (maxXZ > 500 || height > 100) {
      // e.g. 180 cm character authoring → treat scene as cm
      unitScale = 0.01;
    } else if (maxXZ > 80 && height > 40 && height / playerH > 25) {
      // Borderline: very tall "buildings" relative to human → likely cm
      unitScale = 0.01;
    } else if (maxXZ < 0.5 && height < 0.5) {
      unitScale = 100;
    }
    if (unitScale !== 1) {
      root.scale.setScalar(unitScale);
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      size = box.getSize(new THREE.Vector3());
      maxXZ = Math.max(size.x, size.z) || 1;
      height = size.y || 1;
    }

    // Playable footprint vs 1.8 m human:
    //  - too huge (> ~120 m span) → shrink so half-extent ≈ 40–50 m
    //  - too tiny (< ~20 m span) → enlarge so half-extent ≈ 25 m
    const span = maxXZ;
    const TARGET_SPAN = 90; // full width metres — roomy for survival waves
    const MIN_SPAN = 24;
    let playScale = 1;
    if (span > TARGET_SPAN * 1.35) {
      playScale = TARGET_SPAN / span;
    } else if (span < MIN_SPAN) {
      playScale = MIN_SPAN / span;
    }
    // Don't squash vertical props: if height after unit fix is already human
    // scale (doors ~2–3 m), avoid further shrink below ~0.4
    if (playScale < 1 && height * playScale < playerH * 1.2 && height < playerH * 8) {
      playScale = Math.max(playScale, (playerH * 2.2) / Math.max(height, playerH));
    }
    if (Math.abs(playScale - 1) > 0.02) {
      root.scale.multiplyScalar(playScale);
      unitScale *= playScale;
      root.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(root);
      size = box.getSize(new THREE.Vector3());
      maxXZ = Math.max(size.x, size.z) || 1;
    }

    // Center XZ, feet of terrain at y=0
    const b2 = new THREE.Box3().setFromObject(root);
    const c2 = b2.getCenter(new THREE.Vector3());
    root.position.x -= c2.x;
    root.position.z -= c2.z;
    root.position.y -= b2.min.y;
    root.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(root);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    const finalHalf = Math.max(finalSize.x, finalSize.z) * 0.5;

    console.info(
      "[BrawlerScene] map scale unit=",
      unitScale.toFixed(4),
      "playerH=",
      playerH,
      "span=",
      finalSize.x.toFixed(1),
      "×",
      finalSize.z.toFixed(1),
      "h=",
      finalSize.y.toFixed(1),
      "m",
    );

    return { half: finalHalf, unitScale };
  }

  private async loadEnvironment() {
    const paths = [this.mapPath];
    // Fallback chain: requested map → classic ruins → none
    if (this.mapPath !== "models/arena-war-zone.glb") {
      paths.push("models/arena-war-zone.glb");
    }
    for (const path of paths) {
      try {
        const gltf = await this.loadGltf(path);
        if (this.disposed) return;
        const root = gltf.scene;
        const { half } = this.scaleMapToPlayer(root);
        // Auto-fit spawn ring to ~42% of map half-extent (clamped for 1.8 m play)
        if (half > 8) {
          const autoSpawn = Math.min(70, Math.max(14, half * 0.42));
          if (this.spawnRadius <= SPAWN_RADIUS + 0.01) {
            this.spawnRadius = autoSpawn;
          }
        }
        // Room bound tracks playable footprint
        const bound = Math.max(18, Math.min(80, half * 0.95));
        this.controller?.setRoomBound(bound);

        const occluders: THREE.Object3D[] = [];
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = true;
          m.userData.physicsLayer = "terrain";
          occluders.push(m);
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mm of mats) {
            const std = mm as THREE.MeshStandardMaterial;
            if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace;
          }
        });
        this.scene.add(root);
        this.arenaColliders = occluders;
        this.controller?.setCameraOccluders(occluders);
        void this.bakeArenaTrimesh(root);
        console.info(
          "[BrawlerScene] map loaded:",
          path,
          "spawnR=",
          this.spawnRadius.toFixed(1),
          "half=",
          half.toFixed(1),
          "player=",
          `${PLAYER_HEIGHT_M}m`,
        );
        return;
      } catch (err) {
        console.warn(`[BrawlerScene] map failed: ${path}`, err);
      }
    }
    console.warn("[BrawlerScene] all maps failed — fallback ground");
    this.buildFallbackGround();
  }

  /** Optional static layer: extract first large mesh into Rapier trimesh. */
  private async bakeArenaTrimesh(root: THREE.Object3D) {
    const phys = this.physics;
    if (!phys?.world) return;
    try {
      let best: THREE.Mesh | null = null;
      let bestVerts = 0;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.geometry) return;
        const pos = m.geometry.getAttribute("position");
        if (pos && pos.count > bestVerts) {
          bestVerts = pos.count;
          best = m;
        }
      });
      if (!best || bestVerts < 12) return;
      const mesh = best as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      const geo = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry;
      const posAttr = geo.getAttribute("position");
      if (!posAttr) return;
      const verts = new Float32Array(posAttr.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
        verts[i * 3] = v.x;
        verts[i * 3 + 1] = v.y;
        verts[i * 3 + 2] = v.z;
      }
      const indices = new Uint32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) indices[i] = i;
      phys.addStaticTrimesh(verts, indices);
      console.info("[BrawlerScene] arena trimesh layer:", posAttr.count, "verts");
    } catch (err) {
      console.warn("[BrawlerScene] arena trimesh bake skipped", err);
    }
  }

  private buildFallbackGround() {
    const g = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_HALF, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.96 }),
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    g.userData.physicsLayer = "terrain";
    this.scene.add(g);
  }

  private async initNetwork() {
    try {
      const { BrawlClient } = await import("../../net/BrawlClient");
      if (this.disposed) return;
      const client = new BrawlClient();
      this.client = client;
      client.on("open", () => {
        this.connected = true;
        this.emitState();
      });
      client.on("close", () => {
        this.connected = false;
        this.emitState();
      });
      client.on("welcome", (w: { self: string }) => {
        this.selfId = w.self;
        this.emitState();
      });
      client.on("snapshot", (snap: { players: { id: string; px?: number; pz?: number }[] }) => {
        this.playerCount = Math.max(1, snap.players.length);
        void this.syncRemotePlayers(snap.players);
        this.emitState();
      });
      client.connect();
      client.join(this.characterName.slice(0, 24) || "Brawler");
    } catch (err) {
      console.warn("[BrawlerScene] BrawlClient unavailable — offline mode", err);
    }
  }

  private async syncRemotePlayers(players: { id: string; px?: number; pz?: number }[]) {
    for (const p of players) {
      if (p.id === this.selfId) continue;
      if (!this.remoteMeshes.has(p.id)) {
        try {
          const model = await getBakedCharacter((this.rosterIndex + 1) % 30);
          if (this.disposed) return;
          const grp = new THREE.Group();
          grp.add(model);
          this.scene.add(grp);
          this.remoteMeshes.set(p.id, grp);
        } catch {
          /* optional */
        }
      }
      const mesh = this.remoteMeshes.get(p.id);
      if (mesh) mesh.position.set(p.px ?? 0, 0, p.pz ?? 0);
    }
    const ids = new Set(players.map((p) => p.id));
    for (const [id, mesh] of this.remoteMeshes) {
      if (!ids.has(id)) {
        this.scene.remove(mesh);
        this.remoteMeshes.delete(id);
      }
    }
  }

  // ── Input (combat keys only — locomotion is InputState → Controller) ──────
  private onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;

    // Space → Controller jump (Danger Room parity)
    if (e.code === "Space") {
      e.preventDefault();
      this.controller?.jump();
      return;
    }
    // Shift dash via Controller.dash (short burst when CD ready)
    if (
      (e.code === "ShiftLeft" || e.code === "ShiftRight") &&
      this.dashCd <= 0 &&
      this.controller &&
      !this.controller.isDashing
    ) {
      const fwd = this.controller.forward();
      this.controller.dash(fwd, LOCOMOTION.walkSpeed * 0.9, 0.28, 0.12, 0.55);
      this.dashCd = DASH_COOLDOWN;
    }
    if (e.code === "Tab") {
      e.preventDefault();
      this.toggleFocus();
    }
    // Digits 1-4: skill slots only (Danger Room parity — weapon is loadout/strip)
    if (e.code.startsWith("Digit")) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 4) {
        this.triggerSkill(n as 1 | 2 | 3 | 4);
      }
    }
    // [ / ] cycle arsenal weapons
    if (e.code === "BracketLeft") this.cycleWeapon(-1);
    if (e.code === "BracketRight") this.cycleWeapon(1);
    if (e.code === "KeyQ") this.triggerSkill(1);
    if (e.code === "KeyE") this.triggerSkill(2);
    if (e.code === "KeyR") this.triggerSkill(3);
    if (e.code === "KeyF") this.triggerSkill(4);
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.lmbDown = true;
      if (!this.input.locked) this.input.requestLock();
      else this.triggerSkill(1);
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      this.rmbDown = true;
      if (!this.input.locked) this.input.requestLock();
      this.toggleFocus();
      this.acquireFocusTarget();
      this.emitState();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.lmbDown = false;
    if (e.button === 2) {
      this.rmbDown = false;
      this.emitState();
    }
  };

  private onWindowBlur = () => {
    this.lmbDown = false;
    this.rmbDown = false;
  };

  private toggleFocus() {
    this.focusEnabled = !this.focusEnabled;
    if (!this.focusEnabled) {
      this.focusTarget = null;
      this.controller?.setLockTarget(null);
    } else {
      this.acquireFocusTarget();
    }
  }

  private isFocusActive(): boolean {
    return this.focusEnabled || this.rmbDown;
  }

  private playerPos(): THREE.Vector3 {
    return (
      this.avatar?.root.position ??
      this.fallbackModel?.position ??
      new THREE.Vector3()
    );
  }

  private acquireFocusTarget(): EnemyObj | null {
    if (!this.isFocusActive()) {
      this.focusTarget = null;
      this.controller?.setLockTarget(null);
      return null;
    }
    const pp = this.playerPos();
    if (this.focusTarget && this.enemies.includes(this.focusTarget)) {
      const d = pp.distanceTo(this.focusTarget.pos);
      if (d <= FOCUS_BREAK_RANGE) {
        this.controller?.setLockTarget(this.focusTarget.pos);
        return this.focusTarget;
      }
    }
    let best: EnemyObj | null = null;
    let bestD = FOCUS_ACQUIRE_RANGE;
    for (const en of this.enemies) {
      const d = pp.distanceTo(en.pos);
      if (d < bestD) {
        bestD = d;
        best = en;
      }
    }
    this.focusTarget = best;
    this.controller?.setLockTarget(best ? best.pos : null);
    return best;
  }

  // ── Combat ─────────────────────────────────────────────────────────────────
  private isIceStaff(): boolean {
    return this.weaponId === "staffIce" || getWeapon(this.weaponId).element === "ice";
  }

  private triggerSkill(slot: 1 | 2 | 3 | 4) {
    if (this.phase !== "playing") return;
    const skill = this.skills.find((s) => s.slot === slot);
    if (!skill || skill.cd > 0) return;

    skill.cd = skill.cdMax;
    this.atkCd = Math.max(this.atkCd, 0.15);

    this.acquireFocusTarget();
    // Ice Staff tank-mage kit (Danger Room parity) — VFX + zone damage.
    if (this.isIceStaff()) {
      this.triggerIceStaffSkill(slot, skill.damage);
      this.emitState();
      return;
    }

    let target = this.focusTarget;
    const pp = this.playerPos();

    if (target && this.controller) {
      const to = new THREE.Vector3(
        target.pos.x - pp.x,
        0,
        target.pos.z - pp.z,
      );
      if (to.lengthSq() > 0.001) {
        this.controller.faceToward(to, 0.2);
      }
    }

    if (this.avatar) {
      let played = 0;
      if (skill.clip) played = this.avatar.playClipOnce(skill.clip, 0.1);
      if (played <= 0) played = this.avatar.playRoleOnce("attack", 0.1);
      if (played <= 0) {
        const names = this.avatar.clipNames();
        const hit = names.find((n) => /attack|slash|strike|punch|kick|hit/i.test(n));
        if (hit) this.avatar.playClipOnce(hit, 0.1);
      }
    }

    // Controller dash lunge (canonical MM motion) instead of ad-hoc lungeVel
    if (this.controller && skill.lunge > 0) {
      const fwd = this.controller.forward();
      this.controller.dash(fwd, skill.lunge, 0.22, skill.lunge * 0.15, 0.5);
    }

    const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, -1);
    const hitPos = pp.clone().addScaledVector(fwd, 1.4);
    hitPos.y += 1;
    this.vfx.impact(hitPos, 0x9fe8ff, 0.7 + skill.damage / 80);

    const softReach = skill.reach + (this.isFocusActive() ? 1.2 : 0);
    if (target) {
      const d = pp.distanceTo(target.pos);
      if (d <= softReach) {
        this.damageEnemy(target, skill.damage);
        this.emitState();
        return;
      }
    }
    let nearest: EnemyObj | null = null;
    let nearDist = softReach;
    for (const en of this.enemies) {
      const d = pp.distanceTo(en.pos);
      if (d < nearDist) {
        nearDist = d;
        nearest = en;
      }
    }
    if (nearest) {
      this.focusTarget = nearest;
      this.controller?.setLockTarget(nearest.pos);
      this.damageEnemy(nearest, skill.damage);
    }
    this.emitState();
  }

  /**
   * Ice Staff 1–4 (Brawler): spline / wall / frost-shell dodge / blizzard.
   * Mirrors Studio ice kit with sphere damage against wave hostiles.
   */
  private triggerIceStaffSkill(slot: 1 | 2 | 3 | 4, damage: number) {
    const color = 0x9fdcff;
    const pp = this.playerPos();
    const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, -1);
    const target = this.focusTarget;
    const aim = target
      ? target.pos.clone()
      : pp.clone().addScaledVector(fwd, 12);

    this.avatar?.playRoleOnce?.("attack", 0.1);

    if (slot === 1) {
      // Ice Spline
      const from = pp.clone().setY(pp.y + 1.3);
      const to = aim.clone().setY(Math.max(0.5, aim.y + 0.8));
      this.vfx.splineStrike(from, to, color, (p) => {
        this.vfx.frostGround(p, 1.8, color, 0.7);
        this.damageEnemiesInRadius(p, 1.8, damage);
      });
      return;
    }

    if (slot === 2) {
      // Ice Wall between caster and enemy (+ push if close)
      const origin = pp.clone().setY(0);
      const enemy = aim.clone().setY(0);
      const toE = new THREE.Vector3(enemy.x - origin.x, 0, enemy.z - origin.z);
      const dist = toE.length();
      const dir = dist > 1e-3 ? toE.normalize() : fwd.clone();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      if (target && dist < 3.2) {
        this.damageEnemy(target, Math.round(damage * 0.6));
        // shove enemy away
        target.pos.addScaledVector(dir, 2.2);
        target.mesh.position.copy(target.pos);
        const wallAt = origin.clone().addScaledVector(dir, 1.2);
        this.vfx.iceWall(
          wallAt.clone().addScaledVector(side, -1.6),
          wallAt.clone().addScaledVector(side, 1.6),
          color,
          3.2,
        );
        this.damageEnemiesInRadius(wallAt, 1.8, Math.round(damage * 0.45));
      } else {
        const mid = origin.clone().lerp(enemy, target ? 0.5 : 0.55);
        this.vfx.iceWall(
          mid.clone().addScaledVector(side, -2.0),
          mid.clone().addScaledVector(side, 2.0),
          color,
          3.4,
        );
        this.damageEnemiesInRadius(mid, 1.6, Math.round(damage * 0.5));
      }
      this.vfx.frostGround(origin.clone().addScaledVector(dir, 1.2), 1.8, color, 0.5);
      return;
    }

    if (slot === 3) {
      // Frost shell + back dodge + delayed spline + ground explode
      const shellPos = pp.clone().setY(0);
      this.vfx.frozenShell(shellPos, color, 2.4);
      this.vfx.frostGround(shellPos, 1.2, color, 0.4);
      if (this.controller) {
        this.controller.dash(fwd.clone().multiplyScalar(-1), 4.0, 0.36, 0, 0.55);
      }
      const to = aim.clone();
      window.setTimeout(() => {
        if (this.disposed) return;
        this.vfx.splineStrike(shellPos.clone().setY(1.3), to.setY(0.8), color, (p) => {
          this.vfx.frostGround(p, 1.6, color, 0.55);
          this.damageEnemiesInRadius(p, 1.6, Math.round(damage * 0.7));
        });
      }, 350);
      window.setTimeout(() => {
        if (this.disposed) return;
        this.vfx.frostGround(shellPos, 3.2, color, 0.9);
        this.vfx.aoeBlast(shellPos.clone().setY(0.4), color, 3.0);
        this.damageEnemiesInRadius(shellPos, 3.2, Math.round(damage * 1.1));
      }, 1100);
      return;
    }

    // Slot 4 — Blizzard
    const center = aim.clone().setY(0);
    this.vfx.blizzardField(center, 7, color, 3.2, (p, i) => {
      this.damageEnemiesInRadius(p, 6.5, Math.round(damage * (0.35 + i * 0.05)));
    });
  }

  private damageEnemiesInRadius(center: THREE.Vector3, radius: number, amount: number) {
    for (const en of this.enemies) {
      if (en.pos.distanceTo(center) <= radius) this.damageEnemy(en, amount);
    }
  }

  private damageEnemy(en: EnemyObj, amount: number) {
    en.hp = Math.max(0, en.hp - amount);
    // Fire-aura impact (skill prefab damage read)
    const p = en.pos.clone();
    p.y += 0.9;
    this.vfx.fireAura?.(p, amount > 40 ? 1.15 : 0.75);
    this.vfx.impact(p, amount > 40 ? 0xff6040 : 0xff8060, amount > 40 ? 1.4 : 0.95);
    if (this.focusRing && en === this.focusTarget) {
      const mat = this.focusRing.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0xffe080);
      setTimeout(() => {
        if (!this.disposed && this.focusRing) {
          (this.focusRing.material as THREE.MeshBasicMaterial).color.setHex(0xff6a4a);
        }
      }, 80);
    }
    if (en.hp <= 0) this.killEnemy(en);
  }

  private killEnemy(en: EnemyObj) {
    const pos = en.pos.clone();
    pos.y += 0.8;
    this.vfx.blastImpact(pos, 0xff4400, 0.6);
    this.scene.remove(en.mesh);
    this.enemies = this.enemies.filter((e) => e !== en);
    if (this.focusTarget === en) {
      this.focusTarget = null;
      this.controller?.setLockTarget(null);
    }
    this.kills++;
    this.credits += 10;
    if (this.kills % 10 === 0) this.wave++;
    if (this.isFocusActive()) this.acquireFocusTarget();
    this.emitState();
  }

  private damagePlayer(amount: number) {
    if (this.phase !== "playing") return;
    const effective = Math.max(1, amount - this.playerArmor * 0.1);
    this.playerHp = Math.max(0, this.playerHp - effective);
    this.avatar?.playRoleOnce("hurt", 0.08);
    // 2D gore on player torso
    if (this.controller) {
      const p = this.controller.position.clone();
      p.y += 1.1;
      this.vfx.impact(p, 0xaa2028, 0.85);
    }
    // Knockback via Controller (Danger Room parity)
    if (this.controller) {
      const away = this.controller.forward().multiplyScalar(-1);
      this.controller.applyImpulse(away, 4.5, 0.8, 3);
    }
    const p = this.playerPos().clone();
    p.y += 1;
    // Fire-aura take-damage indication (same stack as Danger Room skill prefabs)
    this.vfx.fireAura?.(p, 0.95);
    if (this.playerHp <= 0) {
      this.avatar?.playRoleOnce("death", 0.1);
      this.controller?.setLockTarget(null);
      this.setPhase("dead");
    }
    this.emitState();
  }

  // ── Enemies ────────────────────────────────────────────────────────────────
  private spawnEnemy() {
    if (this.enemies.length >= this.maxEnemies || this.phase !== "playing") return;
    const angle = Math.random() * Math.PI * 2;
    const r = this.spawnRadius;
    const pos = new THREE.Vector3(
      Math.sin(angle) * r,
      0,
      Math.cos(angle) * r,
    );
    const loaded = this.enemyTemplates.filter(Boolean) as THREE.Group[];
    const tpl =
      loaded.length > 0
        ? loaded[Math.floor(Math.random() * loaded.length)]!
        : null;
    const mesh = new THREE.Group();
    if (tpl) {
      // Skinned Toon RTS kits need SkeletonUtils.clone (not Object3D.clone)
      try {
        mesh.add(cloneSkinned(tpl));
      } catch {
        mesh.add(tpl.clone(true));
      }
      // Propagate EntityPrefab combat / identity onto the live spawn root
      mesh.userData.entityPrefab = tpl.userData.entityPrefab;
      mesh.userData.warlordsRole = tpl.userData.warlordsRole;
      mesh.userData.raceId = tpl.userData.raceId;
      mesh.userData.presetId = tpl.userData.presetId;
      mesh.userData.combatRange = tpl.userData.combatRange;
      mesh.userData.combatDamage = tpl.userData.combatDamage;
      mesh.userData.combatCd = tpl.userData.combatCd;
      mesh.userData.moveSpeed = tpl.userData.moveSpeed;
      mesh.userData.maxHp = tpl.userData.maxHp;
    } else {
      // Last resort only — prefer never shipping green box as final art
      console.warn("[BrawlerScene] spawn without grudge6 template — box placeholder");
      const fb = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.6, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x4a7a30, roughness: 0.9 }),
      );
      fb.position.y = 0.8;
      fb.castShadow = true;
      mesh.add(fb);
    }
    mesh.position.copy(pos);
    mesh.userData.selectable = "hostile";
    mesh.userData.physicsLayer = "npc";
    this.scene.add(mesh);

    // Combat from EntityPrefab (template userData), with ENEMY_* constants as fallback
    const baseHp = numUd(tpl, "maxHp", ENEMY_HP);
    const baseSpeed = numUd(tpl, "moveSpeed", ENEMY_SPEED);
    const attackReach = numUd(tpl, "combatRange", ENEMY_ATTACK_REACH);
    const attackDamage = numUd(tpl, "combatDamage", ENEMY_DAMAGE);
    const attackCdMax = numUd(tpl, "combatCd", ENEMY_ATTACK_CD);
    const waveHp = baseHp + Math.floor((this.wave - 1) * 8);

    this.enemies.push({
      mesh,
      hp: waveHp,
      maxHp: waveHp,
      pos: pos.clone(),
      speed: baseSpeed * (0.8 + Math.random() * 0.4),
      attackCd: 0,
      attackReach,
      attackDamage,
      attackCdMax,
      walkClock: Math.random() * Math.PI * 2,
    });
  }

  private updateEnemies(dt: number) {
    const pp = this.playerPos();
    for (const en of this.enemies) {
      en.attackCd = Math.max(0, en.attackCd - dt);
      const dir = new THREE.Vector3(pp.x - en.pos.x, 0, pp.z - en.pos.z);
      const dist = dir.length();
      if (dist > 0.1) {
        dir.normalize();
        en.pos.addScaledVector(dir, en.speed * dt);
        en.mesh.position.copy(en.pos);
        en.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
      en.walkClock += dt * 4;
      en.mesh.position.y = Math.abs(Math.sin(en.walkClock)) * 0.08;
      if (dist <= en.attackReach && en.attackCd <= 0) {
        en.attackCd = en.attackCdMax;
        this.damagePlayer(en.attackDamage);
      }
    }
  }

  // ── RAF ────────────────────────────────────────────────────────────────────
  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Physics layer (fixed substeps inside PhysicsSystem)
    this.physics?.step(dt);

    this.atkCd = Math.max(0, this.atkCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    for (const s of this.skills) s.cd = Math.max(0, s.cd - dt);

    if (this.phase === "playing") {
      // Canonical controller: camera + WASD + gravity + loco weights
      if (this.controller) {
        this.controller.update(dt);
        this.moving = this.controller.state.speed > 0.15;
      } else if (this.fallbackModel) {
        // Minimal fallback if Controller couldn't bind
        this.fallbackModel.position.y =
          Math.sin(performance.now() * 0.004) * 0.015;
      }
      // Mixer clock (Studio calls character.update after controller)
      this.avatar?.update(dt);

      this.updateEnemies(dt);
      this.updateFocus(dt);
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnEnemy();
      }
      this.updateSafeZone(dt);
      this.sendNetInput(dt);
      if (this.lmbDown && this.skills[0] && this.skills[0].cd <= 0) {
        this.triggerSkill(1);
      }
    } else {
      this.avatar?.setLocomotion?.(0);
      this.avatar?.update(dt);
      if (this.focusRing) this.focusRing.visible = false;
    }

    this.vfx.update(dt);
    if (this.postfx) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.camera);
  };

  private updateFocus(dt: number) {
    void dt;
    if (!this.isFocusActive()) {
      this.focusTarget = null;
      this.controller?.setLockTarget(null);
      if (this.focusRing) this.focusRing.visible = false;
      return;
    }
    this.acquireFocusTarget();
    const t = this.focusTarget;
    if (!t || !this.focusRing) {
      if (this.focusRing) this.focusRing.visible = false;
      return;
    }
    this.focusRing.visible = true;
    this.focusRing.position.set(t.pos.x, 0.06, t.pos.z);
    const pulse = 0.75 + Math.sin(performance.now() * 0.008) * 0.15;
    this.focusRing.scale.setScalar(pulse);
    // Keep lock target fresh for Controller camera/body facing
    this.controller?.setLockTarget(t.pos);
  }

  private updateSafeZone(dt: number) {
    const pp = this.playerPos();
    const xz = new THREE.Vector2(pp.x, pp.z);
    const wasIn = this.inSafeZone;
    this.inSafeZone = xz.length() < this.safeZoneRadius;
    if (this.inSafeZone) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + HEAL_RATE * dt);
    }
    if (this.safeZoneRing) {
      const mat = this.safeZoneRing.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.25 + Math.abs(Math.sin(Date.now() * 0.0025)) * 0.2;
    }
    if (wasIn !== this.inSafeZone) this.emitState();
  }

  private sendNetInput(dt: number) {
    if (!this.client?.connected) return;
    this.netTimer += dt;
    if (this.netTimer < 1 / NET_TICK_HZ) return;
    this.netTimer = 0;
    const fwd = this.controller?.forward() ?? new THREE.Vector3(0, 0, -1);
    const move = new THREE.Vector3();
    if (this.input.down("KeyW")) move.add(fwd);
    if (this.input.down("KeyS")) move.sub(fwd);
    try {
      this.client.sendInput({
        seq: ++this.netSeq,
        dt: 1 / NET_TICK_HZ,
        moveX: move.x,
        moveZ: move.z,
        aimX: fwd.x,
        aimZ: fwd.z,
        fire: this.lmbDown,
        dash: this.controller?.isDashing ?? false,
        weapon: WEAPON_CYCLE.indexOf(this.weaponId),
      });
    } catch {
      /* optional */
    }
  }

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.postfx?.setSize(w, h);
  }

  private setPhase(p: BrawlerState["phase"]) {
    this.phase = p;
    this.emitState();
  }

  private emitState() {
    const weaponId = this.weaponId;
    const wdef = getWeapon(weaponId);
    const ft = this.focusTarget;
    const s: BrawlerState = {
      phase: this.phase,
      playerHp: Math.round(this.playerHp),
      playerMaxHp: Math.round(this.playerMaxHp),
      playerArmor: Math.round(this.playerArmor),
      ammo: this.ammo,
      credits: this.credits,
      kills: this.kills,
      weaponName: wdef.label || weaponId,
      weaponId,
      characterName: this.characterName,
      characterClass: this.characterClass,
      connected: this.connected,
      playerCount: this.playerCount,
      inSafeZone: this.inSafeZone,
      wave: this.wave,
      skills: this.skills.map((sk) => ({
        slot: sk.slot,
        label: sk.label,
        key: sk.key,
        cd: sk.cd,
        cdMax: sk.cdMax,
        ready: sk.cd <= 0,
        iconUrl: sk.iconUrl,
      })),
      moving: this.moving,
      loadError: this.loadError,
      focusLocked: this.isFocusActive(),
      hasTarget: !!ft,
      targetHp: ft ? Math.round(ft.hp) : 0,
      targetMaxHp: ft ? Math.round(ft.maxHp) : 0,
      avatarId: this.characterId,
      weaponCycle: [...WEAPON_CYCLE],
    };
    const sig = JSON.stringify({
      p: s.phase,
      hp: s.playerHp,
      mh: s.playerMaxHp,
      k: s.kills,
      c: s.credits,
      n: s.connected ? 1 : 0,
      pc: s.playerCount,
      sz: s.inSafeZone ? 1 : 0,
      w: s.wave,
      a: s.ammo,
      wi: s.weaponId,
      av: s.avatarId,
      sk: s.skills.map((x) => `${x.label}:${Math.round(x.cd * 10)}`),
      m: s.moving ? 1 : 0,
      le: s.loadError || "",
      fl: s.focusLocked ? 1 : 0,
      ht: s.hasTarget ? 1 : 0,
      th: s.targetHp,
    });
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.onState(s);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  respawn() {
    this.playerHp = this.playerMaxHp;
    this.playerArmor = PLAYER_BASE_ARMOR;
    this.ammo = PLAYER_BASE_AMMO;
    if (this.avatar) this.avatar.root.position.set(0, 0, 8);
    if (this.fallbackModel) this.fallbackModel.position.set(0, 0, 8);
    for (const en of this.enemies) this.scene.remove(en.mesh);
    this.enemies = [];
    this.spawnTimer = 0;
    for (const sk of this.skills) sk.cd = 0;
    this.avatar?.playRole("idle", 0);
    this.controller?.setLockTarget(null);
    this.setPhase("playing");
  }

  buyAmmoRefill() {
    if (this.credits < 20) return;
    this.credits -= 20;
    this.ammo = Math.min(120, this.ammo + 30);
    this.emitState();
  }

  buyArmor() {
    if (this.credits < 40) return;
    this.credits -= 40;
    this.playerArmor = Math.min(80, this.playerArmor + 20);
    this.emitState();
  }

  buyMaxHpUp() {
    if (this.credits < 80) return;
    this.credits -= 80;
    this.playerMaxHp += 25;
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 30);
    this.emitState();
  }

  castSkill(slot: 1 | 2 | 3 | 4) {
    this.triggerSkill(slot);
  }

  /** Equip arsenal weapon by index in the HUD cycle strip. */
  setWeapon(index: number) {
    const i = Math.max(0, Math.min(WEAPON_CYCLE.length - 1, index));
    const id = WEAPON_CYCLE[i] ?? "sword";
    void this.applyWeaponAsync(id);
  }

  /** Equip arsenal weapon by WeaponId (Danger Room loadout). */
  setWeaponId(id: WeaponId) {
    void this.applyWeaponAsync(id);
  }

  cycleWeapon(dir: -1 | 1) {
    const idx = Math.max(0, WEAPON_CYCLE.indexOf(this.weaponId));
    const next = (idx + dir + WEAPON_CYCLE.length) % WEAPON_CYCLE.length;
    void this.applyWeaponAsync(WEAPON_CYCLE[next] ?? "sword");
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("blur", this.onWindowBlur);
    this.input.exitLock();
    this.input.dispose();
    this.controller = null;
    this.physics?.dispose();
    this.physics = null;
    this.client?.dispose?.();
    this.postfx?.dispose();
    this.postfx = null;
    this.vfx.dispose();
    if (this.mounted) {
      unmountWeapon(this.mounted);
      this.mounted = null;
    }
    if (this.mountedOff) {
      unmountWeapon(this.mountedOff);
      this.mountedOff = null;
    }
    this.avatar?.dispose();
    this.avatar = null;
    this.focusTarget = null;
    for (const [, mesh] of this.remoteMeshes) this.scene.remove(mesh);
    this.remoteMeshes.clear();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (this.fallbackModel && isDescendant(m, this.fallbackModel)) return;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}

function isDescendant(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = obj;
  while (p) {
    if (p === root) return true;
    p = p.parent;
  }
  return false;
}

/** Stamp uMMORPG EntityPrefab combat + identity onto a template / spawn root. */
function stampPrefabCombat(root: THREE.Object3D, prefab: EntityPrefab): void {
  root.userData.entityPrefab = prefab.id;
  root.userData.warlordsRole = prefab.id;
  root.userData.raceId = prefab.raceId;
  root.userData.presetId = prefab.presetId;
  root.userData.combatRange = prefab.combat.range;
  root.userData.combatDamage = prefab.combat.damage;
  root.userData.combatCd = prefab.combat.attackCooldown;
  root.userData.moveSpeed = prefab.moveSpeed;
  root.userData.maxHp = prefab.maxHp;
  root.userData.combatStyle = prefab.combat.style;
  root.userData.weaponId = prefab.weaponId;
}

/** Read numeric userData with constant fallback (missing template / voxel). */
function numUd(
  root: THREE.Object3D | null | undefined,
  key: string,
  fallback: number,
): number {
  if (!root) return fallback;
  const v = Number(root.userData[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Round-robin by race so a load cap still covers WK / BRB / ELF / DWF / ORC / UD
 * instead of only the first N catalog entries (mostly orcs).
 */
function pickHostileLoadList(prefabs: EntityPrefab[], max: number): EntityPrefab[] {
  if (prefabs.length <= max) return prefabs.slice();
  const byRace = new Map<string, EntityPrefab[]>();
  for (const p of prefabs) {
    const arr = byRace.get(p.raceId) || [];
    arr.push(p);
    byRace.set(p.raceId, arr);
  }
  const buckets = [...byRace.values()].map((b) => b.slice());
  const out: EntityPrefab[] = [];
  let i = 0;
  while (out.length < max && buckets.some((b) => b.length > 0)) {
    const b = buckets[i % buckets.length]!;
    if (b.length > 0) out.push(b.shift()!);
    i++;
  }
  return out;
}

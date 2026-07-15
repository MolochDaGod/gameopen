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
import { getCharacter } from "../assets";
import { Character } from "../Character";
import { Controller } from "../Controller";
import { InputState } from "../input";
import { PhysicsSystem } from "../PhysicsSystem";
import { getBakedCharacter } from "../grudge/bakedRoster";
import { Vfx } from "../Vfx";
import { loadControls } from "../controlsSettings";
import { GRAVITY_Y, LOCOMOTION } from "../../lib/productionRuntime";
import type { CharacterDef, EditorParams, WeaponId } from "../types";
import { DEFAULT_EDITOR } from "../types";

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

const WEAPON_CYCLE: WeaponId[] = ["sword", "axe", "dagger", "bow"];
const WEAPON_FILE: Partial<Record<WeaponId, string>> = {
  sword: "models/weapons/sword.glb",
  axe: "models/weapons/axe.glb",
  dagger: "models/weapons/dagger.glb",
  bow: "models/weapons/bow.glb",
  greatsword: "models/weapons/greatsword.glb",
  spear: "models/weapons/spear.glb",
  hammer: "models/weapons/hammer.glb",
  staff: "models/weapons/staff.glb",
};

const AVATAR_CANDIDATES = ["karate-boss", "orc", "sanji", "gunslinger"] as const;

// ── Public types ──────────────────────────────────────────────────────────────
export interface BrawlerSkillSlot {
  slot: 1 | 2 | 3 | 4;
  label: string;
  key: string;
  cd: number;
  cdMax: number;
  ready: boolean;
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
}

export interface BrawlerSceneOptions {
  displayName?: string;
  characterClass?: string;
  preferredAvatarId?: string;
  rosterIndex?: number;
}

// ── Internal ──────────────────────────────────────────────────────────────────
interface EnemyObj {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  speed: number;
  attackCd: number;
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

  /** Canonical stack — same as Danger Room / Studio. */
  private input: InputState;
  private params: EditorParams;
  private controller: Controller | null = null;
  private physics: PhysicsSystem | null = null;
  private arenaColliders: THREE.Object3D[] = [];

  private avatar: Character | null = null;
  private fallbackModel: THREE.Object3D | null = null;
  private weaponAttach: THREE.Object3D | null = null;
  private playerHp = PLAYER_MAX_HP;
  private playerArmor = PLAYER_BASE_ARMOR;
  private ammo = PLAYER_BASE_AMMO;
  private credits = 0;
  private kills = 0;
  private wave = 1;
  private atkCd = 0;
  private dashCd = 0;
  private selectedWeapon = 0;
  private phase: BrawlerState["phase"] = "loading";
  private moving = false;
  private loadError: string | null = null;
  private characterName = "Brawler";
  private characterClass = "Fighter";
  private preferredAvatarId = "karate-boss";
  private rosterIndex = 0;
  private skills: SkillDef[] = [];

  private lmbDown = false;
  private rmbDown = false;
  private focusEnabled = false;
  private focusTarget: EnemyObj | null = null;
  private canvas: HTMLCanvasElement;

  private enemies: EnemyObj[] = [];
  private enemyTemplates: (THREE.Group | null)[] = [null, null, null];
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

  constructor(canvas: HTMLCanvasElement, onState: StateCb, opts: BrawlerSceneOptions = {}) {
    this.canvas = canvas;
    this.onState = onState;
    if (opts.displayName) this.characterName = opts.displayName;
    if (opts.characterClass) this.characterClass = opts.characterClass;
    if (opts.preferredAvatarId) this.preferredAvatarId = opts.preferredAvatarId;
    if (typeof opts.rosterIndex === "number") this.rosterIndex = opts.rosterIndex;

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
    this.vfx = new Vfx(this.scene);

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
    for (let i = 0; i < 4; i++) this.spawnEnemy();
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
    const geo = new THREE.RingGeometry(SAFE_ZONE_RADIUS - 0.25, SAFE_ZONE_RADIUS, 64);
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
   * Load Character → bind canonical Controller (Danger Room stack).
   * Avatar root is the movable body; Controller owns camera + locomotion.
   */
  private async buildPlayer() {
    const order = [
      this.preferredAvatarId,
      ...AVATAR_CANDIDATES.filter((id) => id !== this.preferredAvatarId),
    ];

    for (const id of order) {
      try {
        const def = getCharacter(id);
        if (!def?.file) continue;
        const av = new Character(def);
        await av.load();
        if (this.disposed) {
          av.dispose();
          return;
        }
        this.avatar = av;
        av.root.position.set(0, 0, 8);
        this.scene.add(av.root);
        this.bindController(av);
        this.installSkillsFromDef(def);
        await this.attachWeapon(WEAPON_CYCLE[this.selectedWeapon] ?? "sword");
        if (def.name) this.characterClass = def.name;
        console.info(
          "[BrawlerScene] avatar + Controller ready:",
          id,
          "clips:",
          av.clipNames().slice(0, 8),
        );
        this.emitState();
        return;
      } catch (err) {
        console.warn("[BrawlerScene] avatar candidate failed:", id, err);
      }
    }

    // Fallback: static mesh without Controller (no Avatar contract)
    try {
      const model = await getBakedCharacter(this.rosterIndex);
      if (this.disposed) return;
      this.fallbackModel = model;
      model.position.set(0, 0, 8);
      this.scene.add(model);
      this.installDefaultSkills();
      this.loadError =
        "Static mesh only — Controller needs a rigged Character (try karate-boss)";
      console.warn("[BrawlerScene]", this.loadError);
    } catch (err) {
      this.loadError = "Player model failed to load";
      console.error("[BrawlerScene] player load failed", err);
      this.installDefaultSkills();
    }
    this.emitState();
  }

  /** Wire Danger Room Controller to the loaded Character. */
  private bindController(av: Character) {
    this.controller = new Controller(av, this.camera, this.input, this.params);
    this.controller.setRoomBound(ARENA_HALF);
    // Enemy footprints as push-out obstacles (same pattern as Danger Room dummies)
    this.controller.setObstacles(() =>
      this.enemies.map((e) => ({ x: e.pos.x, z: e.pos.z, r: 0.55 })),
    );
    // Arena meshes for camera occlusion pull-in
    if (this.arenaColliders.length) {
      this.controller.setCameraOccluders(this.arenaColliders);
    }
  }

  private installSkillsFromDef(def: CharacterDef) {
    const sigs = def.signatureSkills ?? [];
    const attackClip =
      (def.clips?.attack as string | undefined) || sigs[0]?.clip || "attack";

    const defaults: Array<{
      label: string;
      reach: number;
      damage: number;
      cd: number;
      lunge: number;
    }> = [
      { label: "Primary", reach: 2.4, damage: 28, cd: ATTACK_CD, lunge: 2.5 },
      { label: "Skill 2", reach: 2.6, damage: 36, cd: 2.0, lunge: 3.5 },
      { label: "Skill 3", reach: 3.0, damage: 44, cd: 4.5, lunge: 2.0 },
      { label: "Ultimate", reach: 3.4, damage: 55, cd: 8.0, lunge: 6.0 },
    ];
    const keys = ["1", "2", "3", "4"] as const;

    this.skills = [1, 2, 3, 4].map((slot) => {
      const i = slot - 1;
      const sig = sigs[i];
      const d = defaults[i]!;
      return {
        slot: slot as 1 | 2 | 3 | 4,
        label: sig?.label || d.label,
        key: keys[i]!,
        clip: sig?.clip && sig.clip.length > 0 ? sig.clip : attackClip,
        reach: d.reach,
        damage: d.damage,
        cdMax: d.cd,
        cd: 0,
        lunge: d.lunge,
      };
    });
  }

  private installDefaultSkills() {
    this.skills = [
      {
        slot: 1,
        label: "Slash",
        key: "1",
        clip: "attack",
        reach: 2.4,
        damage: 28,
        cdMax: ATTACK_CD,
        cd: 0,
        lunge: 2.5,
      },
      {
        slot: 2,
        label: "Twin Strike",
        key: "2",
        clip: "attack",
        reach: 2.6,
        damage: 36,
        cdMax: 2.0,
        cd: 0,
        lunge: 3.5,
      },
      {
        slot: 3,
        label: "Spin",
        key: "3",
        clip: "attack",
        reach: 3.0,
        damage: 44,
        cdMax: 4.5,
        cd: 0,
        lunge: 2.0,
      },
      {
        slot: 4,
        label: "Advance",
        key: "4",
        clip: "attack",
        reach: 3.4,
        damage: 55,
        cdMax: 8.0,
        cd: 0,
        lunge: 6.0,
      },
    ];
  }

  private async attachWeapon(weaponId: WeaponId) {
    if (this.weaponAttach) {
      this.weaponAttach.removeFromParent();
      this.weaponAttach = null;
    }
    const hand = this.avatar?.rightHand;
    const file = WEAPON_FILE[weaponId];
    if (!hand || !file) return;
    try {
      const { loadGltfFirst } = await import("../assets");
      const { sharedGltfLoader } = await import("../loaders/gltf");
      const gltf = await loadGltfFirst(file, sharedGltfLoader());
      if (this.disposed) return;
      const w = gltf.scene;
      const box = new THREE.Box3().setFromObject(w);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      w.scale.setScalar(0.9 / maxDim);
      w.position.set(0, 0, 0);
      w.rotation.set(0, 0, 0);
      if (weaponId === "sword" || weaponId === "dagger") {
        w.rotation.set(Math.PI / 2, 0, 0);
      } else if (weaponId === "bow") {
        w.rotation.set(0, Math.PI / 2, 0);
      }
      w.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.frustumCulled = false;
        }
      });
      hand.add(w);
      this.weaponAttach = w;
    } catch (err) {
      console.warn("[BrawlerScene] weapon attach failed", weaponId, err);
    }
  }

  private async loadEnemyTemplates() {
    for (let i = 0; i < 3; i++) {
      const n = i + 1;
      const paths = [
        `models/enemies/voxel-zombies/voxel-zombie-${n}.glb`,
        `voxel-zombie-${n}.glb`,
      ];
      let loaded = false;
      for (const path of paths) {
        try {
          const gltf = await this.loadGltf(path);
          if (this.disposed) return;
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          root.scale.setScalar(1.6 / (size.y || 1));
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
          loaded = true;
          break;
        } catch {
          /* try next */
        }
      }
      if (!loaded) {
        console.warn(`[BrawlerScene] voxel-zombie-${n}.glb failed on all candidates`);
      }
    }
  }

  private async loadEnvironment() {
    try {
      const gltf = await this.loadGltf("models/arena-war-zone.glb");
      if (this.disposed) return;
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z) || 1;
      if (maxDim > 300) root.scale.setScalar(0.01);
      else if (maxDim < 40) root.scale.setScalar(40 / maxDim);
      root.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(root);
      const c2 = b2.getCenter(new THREE.Vector3());
      root.position.x -= c2.x;
      root.position.z -= c2.z;
      root.position.y -= b2.min.y;
      const occluders: THREE.Object3D[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        // Tag static collision layer for camera occluders + future KCC trimesh
        m.userData.physicsLayer = "terrain";
        occluders.push(m);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) {
          const std = mm as THREE.MeshStandardMaterial;
          if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
      this.scene.add(root);
      this.arenaColliders = occluders;
      this.controller?.setCameraOccluders(occluders);
      // Bake arena triangle colliders into Rapier when physics is up
      void this.bakeArenaTrimesh(root);
    } catch (err) {
      console.warn("[BrawlerScene] arena-war-zone.glb failed — fallback ground", err);
      this.buildFallbackGround();
    }
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
    // Digits 1-4: weapon + skill
    if (e.code.startsWith("Digit")) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 4) {
        this.selectedWeapon = n - 1;
        void this.attachWeapon(WEAPON_CYCLE[this.selectedWeapon] ?? "sword");
        this.triggerSkill(n as 1 | 2 | 3 | 4);
      }
    }
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
  private triggerSkill(slot: 1 | 2 | 3 | 4) {
    if (this.phase !== "playing") return;
    const skill = this.skills.find((s) => s.slot === slot);
    if (!skill || skill.cd > 0) return;

    skill.cd = skill.cdMax;
    this.atkCd = Math.max(this.atkCd, 0.15);

    this.acquireFocusTarget();
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

  private damageEnemy(en: EnemyObj, amount: number) {
    en.hp = Math.max(0, en.hp - amount);
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
    // Knockback via Controller (Danger Room parity)
    if (this.controller) {
      const away = this.controller.forward().multiplyScalar(-1);
      this.controller.applyImpulse(away, 4.5, 0.8, 3);
    }
    const p = this.playerPos().clone();
    p.y += 1;
    this.vfx.burst(p, 0xff5a5a, 10, 3);
    if (this.playerHp <= 0) {
      this.avatar?.playRoleOnce("death", 0.1);
      this.controller?.setLockTarget(null);
      this.setPhase("dead");
    }
    this.emitState();
  }

  // ── Enemies ────────────────────────────────────────────────────────────────
  private spawnEnemy() {
    if (this.enemies.length >= ENEMY_MAX || this.phase !== "playing") return;
    const angle = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(
      Math.sin(angle) * SPAWN_RADIUS,
      0,
      Math.cos(angle) * SPAWN_RADIUS,
    );
    const tplIdx = Math.floor(Math.random() * 3);
    const tpl = this.enemyTemplates[tplIdx];
    const mesh = new THREE.Group();
    if (tpl) {
      mesh.add(tpl.clone(true));
    } else {
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
    this.enemies.push({
      mesh,
      hp: ENEMY_HP + Math.floor((this.wave - 1) * 8),
      maxHp: ENEMY_HP + Math.floor((this.wave - 1) * 8),
      pos: pos.clone(),
      speed: ENEMY_SPEED * (0.8 + Math.random() * 0.4),
      attackCd: 0,
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
      if (dist <= ENEMY_ATTACK_REACH && en.attackCd <= 0) {
        en.attackCd = ENEMY_ATTACK_CD;
        this.damagePlayer(ENEMY_DAMAGE);
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
      if (this.spawnTimer >= SPAWN_INTERVAL) {
        this.spawnTimer = 0;
        this.spawnEnemy();
      }
      this.updateSafeZone(dt);
      this.sendNetInput(dt);
      if (this.lmbDown && this.skills[0] && this.skills[0].cd <= 0) {
        this.triggerSkill(1);
      }
    } else {
      this.avatar?.setLocomotion(0);
      this.avatar?.update(dt);
      if (this.focusRing) this.focusRing.visible = false;
    }

    this.vfx.update(dt);
    this.renderer.render(this.scene, this.camera);
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
    this.inSafeZone = xz.length() < SAFE_ZONE_RADIUS;
    if (this.inSafeZone) {
      this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + HEAL_RATE * dt);
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
        weapon: this.selectedWeapon,
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
  }

  private setPhase(p: BrawlerState["phase"]) {
    this.phase = p;
    this.emitState();
  }

  private emitState() {
    const weaponId = WEAPON_CYCLE[this.selectedWeapon] ?? "sword";
    const ft = this.focusTarget;
    const s: BrawlerState = {
      phase: this.phase,
      playerHp: Math.round(this.playerHp),
      playerMaxHp: PLAYER_MAX_HP,
      playerArmor: Math.round(this.playerArmor),
      ammo: this.ammo,
      credits: this.credits,
      kills: this.kills,
      weaponName: weaponId.charAt(0).toUpperCase() + weaponId.slice(1),
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
      })),
      moving: this.moving,
      loadError: this.loadError,
      focusLocked: this.isFocusActive(),
      hasTarget: !!ft,
      targetHp: ft ? Math.round(ft.hp) : 0,
      targetMaxHp: ft ? Math.round(ft.maxHp) : 0,
    };
    const sig = JSON.stringify({
      p: s.phase,
      hp: s.playerHp,
      k: s.kills,
      c: s.credits,
      n: s.connected ? 1 : 0,
      pc: s.playerCount,
      sz: s.inSafeZone ? 1 : 0,
      w: s.wave,
      a: s.ammo,
      wi: s.weaponId,
      sk: s.skills.map((x) => Math.round(x.cd * 10)),
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
    this.playerHp = PLAYER_MAX_HP;
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
    this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + 30);
    this.emitState();
  }

  castSkill(slot: 1 | 2 | 3 | 4) {
    this.triggerSkill(slot);
  }

  setWeapon(index: number) {
    this.selectedWeapon = Math.max(0, Math.min(WEAPON_CYCLE.length - 1, index));
    void this.attachWeapon(WEAPON_CYCLE[this.selectedWeapon] ?? "sword");
    this.emitState();
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
    this.vfx.dispose();
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

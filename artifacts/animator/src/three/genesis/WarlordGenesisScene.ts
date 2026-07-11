/**
 * WarlordGenesis — self-contained encounter scene.
 *
 * Architecture mirrors MimicDungeon.ts (canvas-owned WebGLRenderer,
 * ResizeObserver, clock-based RAF, WASD movement, no Rapier).
 *
 * Phases: loading → select (3-D carousel) → countdown (3 s) →
 *         wave (1-3 normal) → bosswave (wave 4, karate-boss) → victory | defeat
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { asset } from "../assets";
import { getBakedCharacter } from "../grudge/bakedRoster";
import { Vfx } from "../Vfx";

// ── public types ──────────────────────────────────────────────────────────────

export type GenesisPhase =
  | "loading"
  | "select"
  | "countdown"
  | "wave"
  | "bosswave"
  | "victory"
  | "defeat";

export interface WarlordGenesisState {
  phase: GenesisPhase;
  raceId: string | null;
  playerHp: number;
  playerMaxHp: number;
  wave: number;
  maxWaves: number;
  kills: number;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  hint: string;
  countdown: number;
}

// ── constants ─────────────────────────────────────────────────────────────────

const RACES = ["human", "orc", "undead", "barbarian", "dwarf", "high_elf"] as const;
type RaceKey = (typeof RACES)[number];

const RACE_BAKED_INDEX: Record<RaceKey, number> = {
  human: 0,
  orc: 5,
  undead: 10,
  barbarian: 15,
  dwarf: 20,
  high_elf: 25,
};

const PLAYER_MAX_HP = 100;
const PLAYER_SPEED = 5.5;
const PLAYER_ATK_REACH = 2.2;
const PLAYER_ATK_CD = 0.55;
const PLAYER_ATK_DAMAGE = 18;

const CAROUSEL_RADIUS = 5;
const CAROUSEL_SPEED = 0.4; // rad/s

const BOSS_MAX_HP = 200;
const BOSS_MELEE_REACH = 1.8;
const BOSS_ATK_CD_RESET = 0.8;

// ── internal types ────────────────────────────────────────────────────────────

interface EnemyAgent {
  model: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
  atkCd: number;
  atkDamage: number;
  atkReach: number;
  dead: boolean;
}

interface WaveDef {
  modelKey: string;
  hp: number;
  speed: number;
  atkDamage: number;
  atkReach: number;
  count: number;
}

const WAVE_DEFS: WaveDef[][] = [
  // Wave 1 — 6 zombies
  [{ modelKey: "zombie-1", hp: 40, speed: 2.2, atkDamage: 10, atkReach: 1.5, count: 6 }],
  // Wave 2 — 8 mixed
  [
    { modelKey: "zombie-1", hp: 55, speed: 2.6, atkDamage: 12, atkReach: 1.5, count: 3 },
    { modelKey: "zombie-2", hp: 60, speed: 2.6, atkDamage: 12, atkReach: 1.5, count: 2 },
    { modelKey: "zombie-3", hp: 65, speed: 2.6, atkDamage: 14, atkReach: 1.5, count: 2 },
    { modelKey: "orc-foe", hp: 70, speed: 2.6, atkDamage: 15, atkReach: 1.8, count: 1 },
  ],
  // Wave 3 — 10 mixed + skeleton
  [
    { modelKey: "zombie-1", hp: 60, speed: 2.8, atkDamage: 14, atkReach: 1.5, count: 4 },
    { modelKey: "zombie-2", hp: 70, speed: 2.8, atkDamage: 14, atkReach: 1.5, count: 3 },
    { modelKey: "zombie-3", hp: 80, speed: 2.8, atkDamage: 16, atkReach: 1.5, count: 2 },
    { modelKey: "skeleton", hp: 90, speed: 2.8, atkDamage: 18, atkReach: 2.0, count: 1 },
  ],
];

const ENEMY_MODEL_PATHS: Record<string, string> = {
  "zombie-1": "models/enemies/voxel-zombies/voxel-zombie-1.glb",
  "zombie-2": "models/enemies/voxel-zombies/voxel-zombie-2.glb",
  "zombie-3": "models/enemies/voxel-zombies/voxel-zombie-3.glb",
  "orc-foe": "models/orc.glb",
  skeleton: "models/skeleton-warrior.glb",
};

type StateCb = (s: WarlordGenesisState) => void;

// ── scene class ───────────────────────────────────────────────────────────────

export class WarlordGenesisScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro?: ResizeObserver;
  private vfx: Vfx;

  // Raycasting for ground height
  private groundMeshes: THREE.Mesh[] = [];
  private ray = new THREE.Raycaster();
  private readonly DOWN = new THREE.Vector3(0, -1, 0);

  // Carousel (select phase)
  private carouselGroup = new THREE.Group();
  private carouselT = 0;

  // Disposable scene assets (arena, race GLBs, enemy templates)
  private ownedObjects: THREE.Object3D[] = [];

  // Enemy template GLBs (cloned per wave)
  private enemyTemplates = new Map<string, THREE.Object3D>();
  private bossTemplate: THREE.Object3D | null = null;

  // Player
  private player = new THREE.Group();
  private playerModel: THREE.Object3D | null = null;
  private playerYaw = 0;
  private playerHp = PLAYER_MAX_HP;
  private playerAtkCd = 0;
  private attackQueued = false;

  // Enemies (active wave)
  private enemies: EnemyAgent[] = [];

  // Boss (wave 4)
  private bossAgent: EnemyAgent | null = null;
  private bossPhaseStage = 0; // 0 = charge, 1 = double-hit, 2 = berserk

  // Phase
  private phase: GenesisPhase = "loading";
  private countdown = 0;
  private currentWave = 0; // 1-indexed, 0 = not started
  private totalKills = 0;
  private selectedRaceId: string | null = null;

  private keys = new Set<string>();
  private onState: StateCb;
  private lastSig = "";

  constructor(private canvas: HTMLCanvasElement, onState: StateCb) {
    this.onState = onState;

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

    this.scene.background = new THREE.Color(0x060910);
    this.scene.fog = new THREE.FogExp2(0x060910, 0.009);
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);

    this.vfx = new Vfx(this.scene);
    this.buildLights();

    this.scene.add(this.carouselGroup);
    this.scene.add(this.player);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    this.emit();
    void this.load();
  }

  // ── lighting ────────────────────────────────────────────────────────────────

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x20160f, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d8, 1.5);
    key.position.set(14, 26, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 90;
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
    this.scene.add(key);
    const accent1 = new THREE.PointLight(0xff9a60, 0.6, 30);
    accent1.position.set(-8, 5, -8);
    this.scene.add(accent1);
    const accent2 = new THREE.PointLight(0x60a8ff, 0.4, 30);
    accent2.position.set(8, 4, 8);
    this.scene.add(accent2);
    this.scene.add(new THREE.AmbientLight(0x2a3350, 0.4));
  }

  // ── asset loading ──────────────────────────────────────────────────────────

  private async loadGlb(path: string): Promise<THREE.Object3D | null> {
    try {
      const gltf = await new GLTFLoader().loadAsync(asset(path));
      return gltf.scene;
    } catch {
      return null;
    }
  }

  /**
   * Apply best-practice shadow + sRGB pass to a character or enemy model, then
   * fit it to `targetHeight` metres (measured by bounding box height).
   */
  private normalizeChar(root: THREE.Object3D, targetHeight = 1.8) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const h = size.y || 1;
    root.scale.multiplyScalar(targetHeight / h);
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    root.position.y -= b2.min.y;
  }

  /**
   * Load arena GLB (arena-war-zone.glb → fallback dungeon.glb).
   * Scales to a ~34-unit playable footprint and centres on origin, same
   * approach as MimicDungeon.ts.
   */
  private async loadArena(): Promise<THREE.Object3D | null> {
    let arena = await this.loadGlb("models/arena-war-zone.glb");
    if (this.disposed) return null;
    if (!arena) arena = await this.loadGlb("models/dungeon.glb");
    if (!arena || this.disposed) return null;

    arena.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial;
        if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
      }
    });

    // Scale to ~34 u footprint.
    const box = new THREE.Box3().setFromObject(arena);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z) || 1;
    if (maxDim > 300) arena.scale.setScalar(0.01);
    else if (maxDim > 0.001 && maxDim < 34) arena.scale.setScalar(34 / maxDim);
    arena.updateMatrixWorld(true);

    // Re-centre + feet on y=0.
    const b2 = new THREE.Box3().setFromObject(arena);
    const c2 = b2.getCenter(new THREE.Vector3());
    arena.position.x -= c2.x;
    arena.position.z -= c2.z;
    arena.position.y -= b2.min.y;
    arena.updateMatrixWorld(true);
    return arena;
  }

  private buildFallbackGround() {
    const g = new THREE.Mesh(
      new THREE.CircleGeometry(36, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.9 }),
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    this.groundMeshes.push(g);
    this.ownedObjects.push(g);
  }

  /** Minimal procedural capsule stand-in when a GLB fails to load. */
  private buildFallbackChar(color = 0x4477aa): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.7, 4, 8),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 0.7;
    body.castShadow = true;
    g.add(body);
    return g;
  }

  /** Main async load: arena → race carousel → boss template → enemy templates. */
  private async load() {
    // 1. Arena
    const arena = await this.loadArena();
    if (this.disposed) return;
    if (arena) {
      this.scene.add(arena);
      this.ownedObjects.push(arena);
      arena.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) this.groundMeshes.push(m);
      });
    } else {
      this.buildFallbackGround();
    }

    // 2. Race models for carousel
    const carouselY = this.groundY(0, 0);
    for (let i = 0; i < RACES.length; i++) {
      if (this.disposed) return;
      const race = RACES[i];
      let model = await this.loadGlb(`models/races/${race}.glb`);
      if (this.disposed) return;
      if (!model) model = this.buildFallbackChar(0x336699 + i * 0x111111);
      else {
        this.normalizeChar(model, 1.8);
        this.ownedObjects.push(model);
      }
      const angle = (i / RACES.length) * Math.PI * 2;
      model.position.set(
        Math.sin(angle) * CAROUSEL_RADIUS,
        carouselY,
        Math.cos(angle) * CAROUSEL_RADIUS,
      );
      model.rotation.y = -angle + Math.PI; // face inward
      this.carouselGroup.add(model);
    }

    // 3. Boss template
    const bossGlb = await this.loadGlb("models/karate-boss.glb");
    if (this.disposed) return;
    if (bossGlb) {
      this.normalizeChar(bossGlb, 2.4);
      this.bossTemplate = bossGlb;
      this.ownedObjects.push(bossGlb);
    }

    // 4. Enemy templates
    for (const [key, path] of Object.entries(ENEMY_MODEL_PATHS)) {
      if (this.disposed) return;
      const tpl = await this.loadGlb(path);
      if (this.disposed) return;
      if (tpl) {
        this.normalizeChar(tpl, 1.4);
        this.enemyTemplates.set(key, tpl);
        this.ownedObjects.push(tpl);
      }
    }

    this.setPhase("select");
    this.raf = requestAnimationFrame(this.animate);
  }

  // ── ground height ──────────────────────────────────────────────────────────

  private groundY(x: number, z: number): number {
    if (this.groundMeshes.length === 0) return 0;
    this.ray.set(new THREE.Vector3(x, 40, z), this.DOWN);
    this.ray.far = 80;
    const hits = this.ray.intersectObjects(this.groundMeshes, true);
    return hits.length ? hits[0].point.y : 0;
  }

  // ── input ──────────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.attackQueued = true;
  };

  // ── public API ─────────────────────────────────────────────────────────────

  /** Called by React UI when the player taps a race card. */
  selectRace(raceId: string) {
    if (this.phase !== "select" && this.phase !== "countdown") return;
    this.selectedRaceId = raceId;
    if (this.phase === "select") {
      this.setPhase("countdown");
      void this.loadPlayerModel(raceId);
    }
    this.emit();
  }

  /** Restart after defeat. */
  respawn() {
    if (this.phase !== "defeat") return;
    // Clear enemies
    for (const e of this.enemies) this.scene.remove(e.model);
    this.enemies = [];
    if (this.bossAgent) { this.scene.remove(this.bossAgent.model); this.bossAgent = null; }
    // Reset player
    this.playerHp = PLAYER_MAX_HP;
    this.playerAtkCd = 0;
    this.totalKills = 0;
    this.currentWave = 0;
    this.selectedRaceId = null;
    this.bossPhaseStage = 0;
    // Show carousel again
    this.carouselGroup.visible = true;
    this.setPhase("select");
  }

  /** Keep interface consistent with other scenes. */
  interact() { /* unused in this mode */ }

  // ── phase management ───────────────────────────────────────────────────────

  private setPhase(p: GenesisPhase) {
    this.phase = p;
    if (p === "countdown") {
      this.countdown = 3;
    }
    this.emit();
  }

  private async loadPlayerModel(raceId: string) {
    const idx = RACE_BAKED_INDEX[raceId as RaceKey] ?? 0;
    try {
      const model = await getBakedCharacter(idx);
      if (this.disposed) return;
      this.playerModel = model;
      this.player.add(model);
    } catch (err) {
      console.error("[WarlordGenesis] player model load failed", err);
    }
  }

  private startWave(waveIndex: number) {
    // Remove previous enemies
    for (const e of this.enemies) this.scene.remove(e.model);
    this.enemies = [];

    if (waveIndex >= 3) {
      // Wave 4 — boss
      this.currentWave = 4;
      this.spawnBoss();
      return;
    }

    this.currentWave = waveIndex + 1;
    this.carouselGroup.visible = false;

    const waveDefs = WAVE_DEFS[waveIndex];
    if (!waveDefs) return;

    const spawnRadius = 12;
    let spawnSlot = 0;
    for (const def of waveDefs) {
      for (let i = 0; i < def.count; i++) {
        const angle = ((spawnSlot++) / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const r = spawnRadius + Math.random() * 4;
        const x = Math.sin(angle) * r;
        const z = Math.cos(angle) * r;
        const model = this.cloneEnemy(def.modelKey);
        model.position.set(x, this.groundY(x, z), z);
        this.scene.add(model);
        this.enemies.push({
          model,
          hp: def.hp,
          maxHp: def.hp,
          speed: def.speed,
          atkCd: Math.random() * 1.5,
          atkDamage: def.atkDamage,
          atkReach: def.atkReach,
          dead: false,
        });
      }
    }
    this.setPhase("wave");
  }

  private cloneEnemy(key: string): THREE.Group {
    const tpl = this.enemyTemplates.get(key);
    if (tpl) {
      return tpl.clone(true) as THREE.Group;
    }
    return this.buildFallbackChar(0x7a5a20);
  }

  private spawnBoss() {
    this.carouselGroup.visible = false;
    const tpl = this.bossTemplate;
    const model = tpl ? (tpl.clone(true) as THREE.Group) : this.buildFallbackChar(0xcc2244);
    model.position.set(0, this.groundY(0, -10), -10);
    this.scene.add(model);
    this.bossAgent = {
      model,
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      speed: 4.0,
      atkCd: 1.5,
      atkDamage: 25,
      atkReach: BOSS_MELEE_REACH,
      dead: false,
    };
    this.bossPhaseStage = 0;
    this.setPhase("bosswave");
  }

  // ── combat ─────────────────────────────────────────────────────────────────

  private doPlayerAttack() {
    if (this.playerAtkCd > 0) return;
    if (this.phase !== "wave" && this.phase !== "bosswave") return;
    this.playerAtkCd = PLAYER_ATK_CD;

    // VFX at the front of the player
    const fwd = new THREE.Vector3(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
    const hitPt = this.player.position.clone().addScaledVector(fwd, 1.2);
    hitPt.y += 1.0;
    this.vfx.impact(hitPt, 0xffd24d, 0.9);

    const pp = this.player.position;
    if (this.phase === "wave") {
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.model.position.distanceTo(pp) <= PLAYER_ATK_REACH) {
          this.damageEnemy(e, PLAYER_ATK_DAMAGE);
        }
      }
    } else if (this.phase === "bosswave" && this.bossAgent && !this.bossAgent.dead) {
      if (this.bossAgent.model.position.distanceTo(pp) <= PLAYER_ATK_REACH) {
        this.damageBoss(PLAYER_ATK_DAMAGE);
      }
    }
    this.emit();
  }

  private damageEnemy(e: EnemyAgent, dmg: number) {
    e.hp = Math.max(0, e.hp - dmg);
    const head = e.model.position.clone();
    head.y += 1.0;
    this.vfx.burst(head, 0xff5a3a, 10, 2.5);
    if (e.hp <= 0) {
      e.dead = true;
      this.totalKills++;
      this.scene.remove(e.model);
    }
    this.emit();
  }

  private damageBoss(dmg: number) {
    const b = this.bossAgent;
    if (!b) return;
    b.hp = Math.max(0, b.hp - dmg);
    const head = b.model.position.clone();
    head.y += 1.8;
    this.vfx.burst(head, 0xff3a8a, 14, 3);

    // Phase transitions (100% → chase, 60% → double-hit, 30% → berserk)
    const pct = b.hp / b.maxHp;
    if (pct <= 0.3 && this.bossPhaseStage < 2) {
      this.bossPhaseStage = 2;
      b.speed = 6.0;
      b.atkDamage = 40;
      b.atkCd = Math.min(b.atkCd, 0.4);
    } else if (pct <= 0.6 && this.bossPhaseStage < 1) {
      this.bossPhaseStage = 1;
      b.speed = 5.0;
      b.atkDamage = 32;
      b.atkCd = Math.min(b.atkCd, 0.5);
    }

    if (b.hp <= 0) {
      b.dead = true;
      this.scene.remove(b.model);
      this.setPhase("victory");
    }
    this.emit();
  }

  private damagePlayer(dmg: number) {
    if (this.playerHp <= 0) return;
    this.playerHp = Math.max(0, this.playerHp - dmg);
    const p = this.player.position.clone();
    p.y += 1.0;
    this.vfx.burst(p, 0xff3a3a, 12, 2.5);
    if (this.playerHp <= 0) this.setPhase("defeat");
    this.emit();
  }

  // ── animation loop ─────────────────────────────────────────────────────────

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.playerAtkCd = Math.max(0, this.playerAtkCd - dt);

    switch (this.phase) {
      case "select":
        this.carouselT += dt;
        this.carouselGroup.rotation.y = this.carouselT * CAROUSEL_SPEED;
        break;

      case "countdown":
        this.countdown = Math.max(0, this.countdown - dt);
        if (this.countdown <= 0) {
          this.player.position.set(0, this.groundY(0, 0), 0);
          this.carouselGroup.visible = false;
          this.startWave(0);
        }
        this.emit();
        break;

      case "wave":
        this.updatePlayer(dt);
        this.updateEnemies(dt);
        this.checkWaveEnd();
        break;

      case "bosswave":
        this.updatePlayer(dt);
        this.updateBoss(dt);
        break;

      case "victory":
      case "defeat":
        // Idle — camera still tracks player position
        break;

      default:
        break;
    }

    // Process queued attack after movement so facing is current
    if (this.attackQueued) {
      this.attackQueued = false;
      this.doPlayerAttack();
    }

    this.updateCamera();
    this.vfx.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(dt: number) {
    if (this.phase === "victory" || this.phase === "defeat") return;
    // Camera-relative WASD: same as MimicDungeon.
    const move = new THREE.Vector3(
      (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0),
      0,
      (this.keys.has("s") ? 1 : 0) - (this.keys.has("w") ? 1 : 0),
    );
    if (move.lengthSq() > 0) {
      move.normalize();
      this.player.position.addScaledVector(move, PLAYER_SPEED * dt);
      this.playerYaw = Math.atan2(move.x, move.z);
    }
    this.player.position.y = this.groundY(this.player.position.x, this.player.position.z);
    this.player.rotation.y = this.playerYaw;
  }

  private updateEnemies(dt: number) {
    const pp = this.player.position;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.atkCd = Math.max(0, e.atkCd - dt);

      const dir = pp.clone().sub(e.model.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist > e.atkReach) {
        dir.normalize();
        e.model.position.addScaledVector(dir, e.speed * dt);
        e.model.position.y = this.groundY(e.model.position.x, e.model.position.z);
        e.model.rotation.y = Math.atan2(dir.x, dir.z);
      } else if (e.atkCd <= 0) {
        e.atkCd = 1.2;
        this.damagePlayer(e.atkDamage);
        if (this.phase === "defeat") return;
      }
    }
  }

  private updateBoss(dt: number) {
    const b = this.bossAgent;
    if (!b || b.dead) return;
    b.atkCd = Math.max(0, b.atkCd - dt);

    const dir = this.player.position.clone().sub(b.model.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist > b.atkReach) {
      dir.normalize();
      b.model.position.addScaledVector(dir, b.speed * dt);
      b.model.position.y = this.groundY(b.model.position.x, b.model.position.z);
      b.model.rotation.y = Math.atan2(dir.x, dir.z);
    } else if (b.atkCd <= 0) {
      // Phase 0: single strike; Phase 1+: double hit; Phase 2 (berserk): triple
      b.atkCd = this.bossPhaseStage >= 2
        ? 0.4
        : this.bossPhaseStage === 1
          ? 0.5
          : BOSS_ATK_CD_RESET;
      const hits = this.bossPhaseStage >= 2 ? 3 : this.bossPhaseStage === 1 ? 2 : 1;
      for (let i = 0; i < hits; i++) {
        this.damagePlayer(b.atkDamage);
        if (this.phase === "defeat") return;
      }
    }
  }

  private checkWaveEnd() {
    if (this.phase !== "wave") return;
    if (this.enemies.some((e) => !e.dead)) return;
    // All enemies defeated — advance to next wave (currentWave is 1-indexed,
    // so pass it as the next 0-indexed wave index).
    this.startWave(this.currentWave);
  }

  // ── camera ─────────────────────────────────────────────────────────────────

  private updateCamera() {
    const target = this.player.position.clone();
    target.y += 1.1;
    const desired = new THREE.Vector3(target.x, target.y + 7, target.z + 10);
    this.camera.position.lerp(desired, 0.1);
    this.camera.lookAt(target);
  }

  // ── state emission ─────────────────────────────────────────────────────────

  private emit() {
    const hint: string =
      this.phase === "loading"
        ? "Loading Warlord Genesis…"
        : this.phase === "select"
          ? "Choose your race below to begin."
          : this.phase === "countdown"
            ? "Prepare for battle!"
            : this.phase === "wave"
              ? `WASD move · LMB attack — Wave ${this.currentWave} of 3`
              : this.phase === "bosswave"
                ? "WASD move · LMB attack — DEFEAT THE WARLORD BOSS!"
                : this.phase === "victory"
                  ? "Victory! You claimed the Warlord title."
                  : "Defeated. Try again or enter GRUDOX.";

    const s: WarlordGenesisState = {
      phase: this.phase,
      raceId: this.selectedRaceId,
      playerHp: Math.round(this.playerHp),
      playerMaxHp: PLAYER_MAX_HP,
      wave: this.currentWave,
      maxWaves: 4,
      kills: this.totalKills,
      bossHp: Math.round(this.bossAgent?.hp ?? 0),
      bossMaxHp: BOSS_MAX_HP,
      bossName: "Karate Warlord",
      hint,
      countdown: Math.ceil(this.countdown),
    };

    const sig = `${s.phase}|${s.playerHp}|${s.bossHp}|${s.wave}|${s.countdown}|${s.kills}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.onState(s);
  }

  // ── resize ─────────────────────────────────────────────────────────────────

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // ── dispose ────────────────────────────────────────────────────────────────

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.vfx.dispose();

    // Dispose owned geometry/materials (skip the baked-roster player model which
    // is shared with the app-wide roster cache and must not be freed here).
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (this.playerModel && this.isDescendant(m, this.playerModel)) return;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });

    this.renderer.dispose();
  }

  private isDescendant(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let p: THREE.Object3D | null = node;
    while (p) {
      if (p === ancestor) return true;
      p = p.parent;
    }
    return false;
  }
}

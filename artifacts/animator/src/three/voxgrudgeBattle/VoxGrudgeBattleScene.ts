/**
 * VoxGrudge Battle — Three.js battleground host.
 *
 * Best practices:
 *  - WebGL2 renderer, sRGB, ACES tone mapping, shadow map PCF soft
 *  - Third-person orbit camera (Controller-style yaw/pitch) + optional free look
 *  - Pointer-lock combat input; M = minimap; 1–4 skills; Q sidearm; LMB attack
 *  - Arena GLB when available; procedural biomes + props fallback
 *  - Bot brains from BattleAI + strategy profiles
 *  - Projectiles + voxel wildlife hazards
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assetUrl } from "../../lib/fleet";
import {
  BattleMatch,
  type BattleHudSnapshot,
  type BattleLoadout,
  type BattleMode,
  type BattleFighterSpec,
  ARENA_RADIUS,
  SHRINK_END_RADIUS,
  SHRINK_START_SEC,
  buildBattleRoster,
  thinkBot,
  createBrain,
  botMoveSpeed,
  type BotBrainState,
  getBattleDeployment,
} from "../../game/voxgrudgeBattle";
import { Minimap } from "./Minimap";

export type VoxBattleSceneOpts = {
  canvas: HTMLCanvasElement;
  mode: BattleMode;
  playerSlots?: number;
  deploymentId?: string;
  loadout: BattleLoadout;
  localName?: string;
  localRaceId?: string;
  seed?: string;
  onHud?: (s: BattleHudSnapshot) => void;
};

type FighterBody = {
  spec: BattleFighterSpec;
  group: THREE.Group;
  mesh: THREE.Mesh;
  brain: BotBrainState | null;
  attackCd: number;
  vel: THREE.Vector3;
};

type Projectile = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  ownerId: string;
  dmg: number;
};

type Animal = {
  kind: string;
  mesh: THREE.Group;
  hp: number;
  t: number;
  phase: number;
};

export class VoxGrudgeBattleScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private match = new BattleMatch();
  private minimap: Minimap;
  private fighters = new Map<string, FighterBody>();
  private projectiles: Projectile[] = [];
  private animals: Animal[] = [];
  private keys = new Set<string>();
  private mouse = { dx: 0, dy: 0, lmb: false };
  private yaw = 0;
  private pitch = 0.35;
  private camDist = 9;
  private running = false;
  private raf = 0;
  private disposed = false;
  private opts: VoxBattleSceneOpts;
  private zoneRadius = ARENA_RADIUS;
  private zoneCenter = new THREE.Vector3(0, 0, 0);
  private zoneRing: THREE.Mesh | null = null;
  private arenaRoot = new THREE.Group();
  private ground: THREE.Mesh | null = null;
  private pointerLocked = false;
  private hudAcc = 0;
  private onHud: (s: BattleHudSnapshot) => void;

  constructor(opts: VoxBattleSceneOpts) {
    this.opts = opts;
    this.onHud = opts.onHud ?? (() => {});
    const canvas = opts.canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth || 960, canvas.clientHeight || 540, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(
      55,
      (canvas.clientWidth || 960) / (canvas.clientHeight || 540),
      0.1,
      400,
    );

    this.scene.background = new THREE.Color(0x87b5d4);
    this.scene.fog = new THREE.Fog(0x87b5d4, 60, 160);

    this.minimap = new Minimap(canvas.parentElement ?? undefined);
    this.bindInput();
    this.setupLights();
    this.scene.add(this.arenaRoot);

    void this.boot();
  }

  private async boot() {
    const dep =
      getBattleDeployment(this.opts.deploymentId || "voxgrudge-battle-hunger-singles") ??
      getBattleDeployment("voxgrudge-battle-hunger-singles")!;

    this.match.resetLobby(this.opts.mode, this.opts.loadout);
    this.match.primary = this.opts.loadout.primary;
    this.match.sidearm = this.opts.loadout.sidearm;

    await this.loadArena(dep.primaryArena);
    this.buildProceduralBiomes();
    this.spawnWildlife(dep.animals);

    const roster = buildBattleRoster({
      mode: this.opts.mode,
      playerSlots: this.opts.playerSlots ?? dep.maxPlayers,
      seed: this.opts.seed || `battle-${Date.now()}`,
      localName: this.opts.localName || "You",
      localRaceId: this.opts.localRaceId || "human",
      localLoadout: this.opts.loadout,
      spawnRadius: dep.spawnRing.radius,
      spawnY: dep.spawnRing.y,
    });
    this.match.armFighters(roster);
    this.spawnFighterMeshes(roster);

    this.zoneRadius = dep.spawnRing.radius + 20;
    this.buildZoneRing();
    this.match.startCountdown(5);
    this.running = true;
    this.clock.start();
    this.loop();
    this.pushHud();
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x445544, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
    sun.position.set(40, 70, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  }

  private async loadArena(publicPath: string) {
    const loader = new GLTFLoader();
    const candidates = [
      assetUrl(publicPath),
      assetUrl("models/arena-war-zone.glb"),
      assetUrl("models/agama-map.glb"),
    ];
    for (const url of candidates) {
      try {
        const gltf = await loader.loadAsync(url);
        const root = gltf.scene;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        // Fit arena roughly into play radius
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxXZ = Math.max(size.x, size.z, 1);
        const scale = (ARENA_RADIUS * 1.6) / maxXZ;
        root.scale.setScalar(scale);
        box.setFromObject(root);
        const c = box.getCenter(new THREE.Vector3());
        root.position.sub(c);
        root.position.y -= box.min.y * 0; // keep after center
        // re-ground
        const box2 = new THREE.Box3().setFromObject(root);
        root.position.y -= box2.min.y;
        this.arenaRoot.add(root);
        return;
      } catch {
        /* try next */
      }
    }
    // full procedural fallback
    this.match.loadError = "Arena GLB not staged — procedural battleground active.";
  }

  private buildProceduralBiomes() {
    // Ground disc
    const groundGeo = new THREE.CircleGeometry(ARENA_RADIUS + 8, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a7a48,
      roughness: 0.92,
      metalness: 0.05,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.name = "battle_ground";
    this.arenaRoot.add(this.ground);

    // Biome scatter: trees, walls, ruins (stand-in for practice_15 kit)
    const rng = mulberry((this.opts.seed || "arena").length * 9973);
    const treeGeo = new THREE.ConeGeometry(0.7, 2.4, 6);
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.9, 6);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.85 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a22, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8680, roughness: 0.88 });
    const factionMat = new THREE.MeshStandardMaterial({ color: 0x4a6fa5, roughness: 0.75 });
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0xa84a4a, roughness: 0.75 });

    for (let i = 0; i < 48; i++) {
      const a = rng() * Math.PI * 2;
      const r = 18 + rng() * (ARENA_RADIUS - 22);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.45;
      trunk.castShadow = true;
      const leaf = new THREE.Mesh(treeGeo, leafMat);
      leaf.position.y = 1.9;
      leaf.castShadow = true;
      g.add(trunk, leaf);
      g.position.set(x, 0, z);
      this.arenaRoot.add(g);
    }

    // Faction / enemy wall segments
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const r = 32 + (i % 3) * 6;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.2, 0.55),
        i % 2 === 0 ? factionMat : enemyMat,
      );
      wall.position.set(Math.cos(a) * r, 1.1, Math.sin(a) * r);
      wall.rotation.y = a + Math.PI / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.arenaRoot.add(wall);
    }

    // Ruins blocks
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + rng() * 40;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.5 + rng() * 2, 0.8 + rng() * 2, 1.2 + rng()),
        wallMat,
      );
      box.position.set(Math.cos(a) * r, box.geometry.parameters.height / 2, Math.sin(a) * r);
      box.rotation.y = rng() * Math.PI;
      box.castShadow = true;
      this.arenaRoot.add(box);
    }

    // Dock / boat proxies near edge
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const boat = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.6, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }),
      );
      boat.position.set(Math.cos(a) * (ARENA_RADIUS - 4), 0.2, Math.sin(a) * (ARENA_RADIUS - 4));
      boat.rotation.y = a;
      this.arenaRoot.add(boat);
    }
  }

  private spawnWildlife(kinds: string[]) {
    const list = kinds.length ? kinds : ["gator", "fox", "wolf", "buffalo", "bear"];
    const colors: Record<string, number> = {
      gator: 0x3d6b3a,
      fox: 0xc4682a,
      wolf: 0x888888,
      buffalo: 0x4a3728,
      bear: 0x3a2818,
    };
    for (let i = 0; i < list.length * 2; i++) {
      const kind = list[i % list.length]!;
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.7, 2.0),
        new THREE.MeshStandardMaterial({ color: colors[kind] ?? 0x555555, roughness: 0.9 }),
      );
      body.position.y = 0.45;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.55),
        new THREE.MeshStandardMaterial({ color: colors[kind] ?? 0x555555 }),
      );
      head.position.set(0, 0.55, 1.1);
      g.add(body, head);
      const a = (i / (list.length * 2)) * Math.PI * 2;
      const r = 22 + (i % 5) * 7;
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      this.arenaRoot.add(g);
      this.animals.push({ kind, mesh: g, hp: 40, t: 0, phase: a });
    }
  }

  private spawnFighterMeshes(roster: BattleFighterSpec[]) {
    for (const spec of roster) {
      const group = new THREE.Group();
      const color = new THREE.Color(spec.color);
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 }),
      );
      body.position.y = 1.0;
      body.castShadow = true;
      // simple head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        new THREE.MeshStandardMaterial({ color: color.clone().offsetHSL(0, 0, 0.15) }),
      );
      head.position.y = 1.75;
      head.castShadow = true;
      // team stripe
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.12, 0.15),
        new THREE.MeshBasicMaterial({ color: spec.isLocal ? 0xffffff : color }),
      );
      stripe.position.set(0, 1.35, 0.3);
      group.add(body, head, stripe);
      group.position.set(spec.spawn.x, spec.spawn.y, spec.spawn.z);
      group.rotation.y = spec.spawn.yaw;
      this.scene.add(group);

      const brain = spec.isBot
        ? createBrain(spec.id, spec.strategy, spec.loadout.primary)
        : null;

      this.fighters.set(spec.id, {
        spec,
        group,
        mesh: body,
        brain,
        attackCd: 0,
        vel: new THREE.Vector3(),
      });
    }
  }

  private buildZoneRing() {
    if (this.zoneRing) {
      this.scene.remove(this.zoneRing);
      this.zoneRing.geometry.dispose();
      (this.zoneRing.material as THREE.Material).dispose();
    }
    const geo = new THREE.RingGeometry(this.zoneRadius - 0.4, this.zoneRadius + 0.4, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.zoneRing = new THREE.Mesh(geo, mat);
    this.zoneRing.rotation.x = -Math.PI / 2;
    this.zoneRing.position.y = 0.08;
    this.scene.add(this.zoneRing);
  }

  private bindInput() {
    const canvas = this.opts.canvas;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.code;
      if (down) this.keys.add(k);
      else this.keys.delete(k);
      if (down && (k === "KeyM")) {
        this.match.toggleMinimap();
        this.minimap.setVisible(this.match.minimapOpen);
        e.preventDefault();
      }
      if (down && k === "KeyQ") {
        this.match.swapWeapon();
      }
      if (down && (k === "Digit1" || k === "Digit2" || k === "Digit3" || k === "Digit4")) {
        const slot = Number(k.replace("Digit", "")) as 1 | 2 | 3 | 4;
        if (this.match.trySkill(slot)) this.fireSkill("local-player", slot);
      }
      if (down && k === "Escape") {
        document.exitPointerLock?.();
      }
    };
    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));
    canvas.addEventListener("click", () => {
      if (this.match.phase === "alive" || this.match.phase === "countdown") {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouse.lmb = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.lmb = false;
    });
    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    const canvas = this.opts.canvas;
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 540;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.tick(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private tick(dt: number) {
    const events = this.match.update(dt);
    for (const ev of events) {
      if (ev.t === "fight") {
        /* could play SFX */
      }
    }

    // Shrink zone after delay
    if (this.match.phase === "alive" || this.match.phase === "spectate") {
      const snap = this.match.snapshot();
      // use elapsed via shrink: start after SHRINK_START_SEC
      void snap;
    }
    this.updateZone(dt);
    this.updateLocal(dt);
    this.updateBots(dt);
    this.updateProjectiles(dt);
    this.updateAnimals(dt);
    this.updateCamera(dt);
    this.syncMatchPoses();

    if (this.match.minimapOpen) {
      this.minimap.setWorldRadius(ARENA_RADIUS + 10);
      this.minimap.draw(
        this.match.snapshot().fighters,
        { x: this.zoneCenter.x, z: this.zoneCenter.z, radius: this.zoneRadius },
      );
    }

    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      this.pushHud();
    }
  }

  private updateZone(dt: number) {
    // Shrink toward end radius after start
    if (this.match.phase === "lobby" || this.match.phase === "countdown") return;
    const t = this.clock.elapsedTime;
    if (t < SHRINK_START_SEC) return;
    const target = SHRINK_END_RADIUS;
    this.zoneRadius = THREE.MathUtils.damp(this.zoneRadius, target, 0.08, dt);
    if (this.zoneRing) {
      this.zoneRing.scale.setScalar(this.zoneRadius / ARENA_RADIUS);
    }
    // Zone damage
    for (const [id, body] of this.fighters) {
      const live = this.match.fighters.get(id);
      if (!live?.alive) continue;
      const d = Math.hypot(body.group.position.x - this.zoneCenter.x, body.group.position.z - this.zoneCenter.z);
      if (d > this.zoneRadius) {
        this.match.applyDamage(id, 8 * dt, null);
      }
    }
  }

  private updateLocal(dt: number) {
    const body = this.fighters.get("local-player");
    if (!body) return;
    const live = this.match.fighters.get("local-player");
    if (!live?.alive) return;
    if (this.match.phase !== "alive") return;

    // look
    this.yaw -= this.mouse.dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - this.mouse.dy * 0.002, 0.05, 1.2);
    this.mouse.dx = 0;
    this.mouse.dy = 0;

    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 8.5 : 6.2;
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) wish.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) wish.sub(forward);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) wish.add(right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) wish.sub(right);
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed * dt);
      body.group.position.add(wish);
      body.group.rotation.y = this.yaw;
    }

    // clamp to soft arena
    const p = body.group.position;
    const r = Math.hypot(p.x, p.z);
    if (r > ARENA_RADIUS + 6) {
      p.x *= (ARENA_RADIUS + 6) / r;
      p.z *= (ARENA_RADIUS + 6) / r;
    }
    p.y = 0;

    body.attackCd = Math.max(0, body.attackCd - dt);
    if (this.mouse.lmb && body.attackCd <= 0) {
      body.attackCd = 0.45;
      this.meleeAttack("local-player");
    }
  }

  private updateBots(dt: number) {
    if (this.match.phase !== "alive") return;
    const all = this.match.snapshot().fighters;
    for (const [id, body] of this.fighters) {
      if (!body.brain) continue;
      const live = this.match.fighters.get(id);
      if (!live?.alive) continue;
      body.attackCd = Math.max(0, body.attackCd - dt);

      const intent = thinkBot(
        body.brain,
        live,
        all,
        this.opts.mode,
        dt,
        { x: this.zoneCenter.x, z: this.zoneCenter.z },
        this.zoneRadius,
      );
      const spd = botMoveSpeed(body.brain.strategy) * dt;

      if (intent.kind === "chase" || intent.kind === "support") {
        const dx = intent.tx - body.group.position.x;
        const dz = intent.tz - body.group.position.z;
        const d = Math.hypot(dx, dz) || 1;
        body.group.position.x += (dx / d) * spd;
        body.group.position.z += (dz / d) * spd;
        body.group.rotation.y = Math.atan2(dx, dz);
      } else if (intent.kind === "retreat") {
        const dx = body.group.position.x - intent.tx;
        const dz = body.group.position.z - intent.tz;
        const d = Math.hypot(dx, dz) || 1;
        body.group.position.x += (dx / d) * spd;
        body.group.position.z += (dz / d) * spd;
        body.group.rotation.y = Math.atan2(-dx, -dz);
      } else if (intent.kind === "strafe") {
        const dx = intent.tx - body.group.position.x;
        const dz = intent.tz - body.group.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const fx = dx / d;
        const fz = dz / d;
        const sx = -fz * intent.dir;
        const sz = fx * intent.dir;
        body.group.position.x += sx * spd;
        body.group.position.z += sz * spd;
        body.group.rotation.y = Math.atan2(dx, dz);
      } else if (intent.kind === "attack") {
        if (intent.skillSlot) this.fireSkill(id, intent.skillSlot);
        else if (body.attackCd <= 0) {
          body.attackCd = 0.55;
          this.meleeAttack(id);
        }
      } else if (intent.kind === "swapSidearm") {
        live.usingSidearm = !live.usingSidearm;
      }

      // soft separation
      for (const [oid, other] of this.fighters) {
        if (oid === id) continue;
        const ox = other.group.position.x - body.group.position.x;
        const oz = other.group.position.z - body.group.position.z;
        const dd = Math.hypot(ox, oz);
        if (dd > 0.01 && dd < 1.0) {
          body.group.position.x -= (ox / dd) * (1 - dd) * 0.5;
          body.group.position.z -= (oz / dd) * (1 - dd) * 0.5;
        }
      }
      body.group.position.y = 0;
    }
  }

  private meleeAttack(ownerId: string) {
    const body = this.fighters.get(ownerId);
    if (!body) return;
    const reach = 2.4;
    const origin = body.group.position;
    const yaw = body.group.rotation.y;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (const [id, other] of this.fighters) {
      if (id === ownerId) continue;
      const live = this.match.fighters.get(id);
      if (!live?.alive) continue;
      const dx = other.group.position.x - origin.x;
      const dz = other.group.position.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > reach) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.35) continue;
      this.match.applyDamage(id, 18 + Math.random() * 8, ownerId);
      // flash
      const mat = other.mesh.material as THREE.MeshStandardMaterial;
      const prev = mat.emissive.getHex();
      mat.emissive.setHex(0xff2222);
      setTimeout(() => mat.emissive.setHex(prev), 80);
    }
    // animals
    for (const a of this.animals) {
      const dx = a.mesh.position.x - origin.x;
      const dz = a.mesh.position.z - origin.z;
      if (Math.hypot(dx, dz) < 2.2) a.hp -= 25;
    }
  }

  private fireSkill(ownerId: string, slot: 1 | 2 | 3 | 4) {
    const body = this.fighters.get(ownerId);
    if (!body) return;
    const yaw = body.group.rotation.y;
    const speed = slot === 3 ? 28 : slot === 4 ? 18 : 22;
    const dmg = slot === 4 ? 42 : slot === 2 ? 28 : slot === 3 ? 22 : 16;
    const geo = new THREE.SphereGeometry(0.18 + slot * 0.04, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: slot === 4 ? 0xff6644 : slot === 3 ? 0x66ccff : 0xffee88,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(body.group.position);
    mesh.position.y = 1.2;
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vel: new THREE.Vector3(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed),
      life: 1.4,
      ownerId,
      dmg,
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      let hit = false;
      for (const [id, body] of this.fighters) {
        if (id === p.ownerId) continue;
        const live = this.match.fighters.get(id);
        if (!live?.alive) continue;
        const d = p.mesh.position.distanceTo(body.group.position.clone().setY(1.2));
        if (d < 0.85) {
          this.match.applyDamage(id, p.dmg, p.ownerId);
          hit = true;
          break;
        }
      }
      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateAnimals(dt: number) {
    for (const a of this.animals) {
      if (a.hp <= 0) {
        a.mesh.visible = false;
        continue;
      }
      a.t += dt;
      a.phase += dt * 0.35;
      const r = 20 + Math.sin(a.phase) * 8;
      a.mesh.position.x = Math.cos(a.phase) * r;
      a.mesh.position.z = Math.sin(a.phase) * r;
      a.mesh.rotation.y = a.phase + Math.PI / 2;
      // aggro local
      const local = this.fighters.get("local-player");
      if (local && this.match.phase === "alive") {
        const d = a.mesh.position.distanceTo(local.group.position);
        if ((d < 2.5 && a.kind === "bear") || (d < 2.0 && (a.kind === "wolf" || a.kind === "gator"))) {
          if (Math.random() < dt * 1.2) {
            this.match.applyDamage("local-player", 6, null);
          }
        }
      }
    }
  }

  private updateCamera(_dt: number) {
    const focus =
      this.fighters.get("local-player")?.group.position ?? new THREE.Vector3();
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * -this.camDist,
      2.2 + Math.sin(this.pitch) * 6,
      Math.cos(this.yaw) * -this.camDist,
    );
    // lift pitch
    off.y = 3.5 + this.pitch * 5;
    const target = focus.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.camera.position.lerp(focus.clone().add(off), 0.18);
    this.camera.lookAt(target);
  }

  private syncMatchPoses() {
    for (const [id, body] of this.fighters) {
      const p = body.group.position;
      this.match.setPose(id, p.x, p.y, p.z, body.group.rotation.y);
      const live = this.match.fighters.get(id);
      if (live && !live.alive) {
        body.group.scale.setScalar(0.01);
        body.group.visible = live.isLocal; // hide dead bots
        if (!live.isLocal) body.group.visible = false;
      }
    }
  }

  private pushHud() {
    this.onHud(this.match.snapshot());
  }

  /** Called from UI after loadout confirm — if still lobby, restart. */
  beginMatch() {
    if (this.match.phase === "lobby") this.match.startCountdown(5);
  }

  getSnapshot(): BattleHudSnapshot {
    return this.match.snapshot();
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.minimap.dispose();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose?.();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else (mat as THREE.Material | undefined)?.dispose?.();
      }
    });
  }
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

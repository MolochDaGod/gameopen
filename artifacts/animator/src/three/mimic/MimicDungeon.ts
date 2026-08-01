/**
 * Test Dungeon (Mimic) — self-contained encounter on **vol.glb** (volcano scene).
 *
 * Player is a real **GrudgeAvatar** (skinned Bip001 + baked anim pack + arsenal
 * sword) — NOT the static 30characters T-pose roster.
 *
 *   disguised (barrel) → [E] reveal → chase → attack → recover
 *
 * Controls: WASD move · mouse aim-yaw (drag / hold RMB) · LMB / 1–4 skills · E interact · Shift sprint
 */
import * as THREE from "three";
import { Vfx } from "../Vfx";
import { GrudgeAvatar } from "../grudge/GrudgeAvatar";
import { getWeapon } from "../assets";
import { mountWeaponModel, unmountWeapon, type MountedWeapon } from "../Weapons";
import type { WeaponId } from "../types";
import { buildT0SkillHud } from "../brawler/combatLoadout";
import {
  MIMIC_ATTACKS,
  mimicAttackDuration,
  mimicAttackPose,
  mimicIdlePose,
  mimicWalkPose,
  chooseMimicAttack,
  telegraphBlink,
  type MimicAttackName,
  type MimicPose,
} from "./mimicMoves";

/** Grudge "Maneuver Motion" → metres. +30 MM ≈ 1.8 m lunge. */
const MM_TO_M = 0.06;

const PLAYER_MAX_HP = 100;
const MIMIC_MAX_HP = 120;
const PLAYER_SPEED = 5.5;
const PLAYER_SPRINT = 8.2;
const MIMIC_SPEED = 2.6;
const MELEE_REACH = 2.4;
const PLAYER_MELEE_REACH = 2.8;
const INTERACT_RANGE = 3.0;
const ACID_AOE = MIMIC_ATTACKS.acid.aoeRadius; // 3 m
/**
 * Map candidates for the Mimic test dungeon.
 * NOTE: `vol.glb` is known-broken in three GLTFLoader (skin joints → isBone crash)
 * and must NOT be first. Prefer playable arena maps that parse cleanly.
 */
const MAP_MESH_KEYS = [
  "models/dungeon.glb",
  "models/minecraft-kit.glb",
  "models/chicken-gun-town.glb",
  "models/arena-war-zone.glb",
  // Last resort — often fails parse; keep for when repaired on R2
  "models/vol.glb",
  "models/worlds/vol.glb",
] as const;
const PLAYER_WEAPON: WeaponId = "sword";

export type MimicPhase =
  | "loading"
  | "disguised"
  | "reveal"
  | "chase"
  | "windup"
  | "strike"
  | "recover"
  | "victory"
  | "defeat";

export interface MimicSkillHud {
  slot: number;
  key: string;
  label: string;
  cd: number;
  cdMax: number;
  iconUrl?: string;
}

export interface MimicDungeonState {
  phase: MimicPhase;
  prompt: string | null;
  hint: string;
  playerHp: number;
  playerMaxHp: number;
  mimicHp: number;
  mimicMaxHp: number;
  telegraph: MimicAttackName | null;
  /** T0 skill strip (1–4) — same kit language as Danger Room. */
  skills: MimicSkillHud[];
  /** Short status for load failures / ready. */
  loadNote: string;
}

type StateCb = (s: MimicDungeonState) => void;

export class MimicDungeon {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro?: ResizeObserver;
  private vfx: Vfx;

  // World
  private groundMeshes: THREE.Mesh[] = [];
  private ray = new THREE.Raycaster();
  private readonly DOWN = new THREE.Vector3(0, -1, 0);

  // Player — GrudgeAvatar (skinned + mixer + director), not static baked mesh
  private player = new THREE.Group();
  private avatar: GrudgeAvatar | null = null;
  private mountedWeapon: MountedWeapon | null = null;
  private playerYaw = 0;
  private camYaw = 0;
  private playerHp = PLAYER_MAX_HP;
  private playerAtkCd = 0;
  private skills = buildT0SkillHud(PLAYER_WEAPON, 1).map((h) => ({
    slot: h.slot,
    key: h.key,
    label: h.label,
    clip: h.clip || "attack",
    reach: h.reach,
    damage: h.damage,
    cdMax: h.cdMax,
    cd: 0,
    lunge: h.lunge,
    iconUrl: h.iconUrl,
    kind: h.kind,
  }));
  private loadNote = "Loading volcano scene + hero…";
  private moving = false;
  private sprinting = false;
  private pointerDragging = false;
  private lastPointerX = 0;

  // Mimic
  private mimicRoot = new THREE.Group(); // world nav transform (position + yaw)
  private mimicPose = new THREE.Group(); // procedural pose offsets (local)
  private mimicModel: THREE.Object3D | null = null;
  private mimicMats: THREE.MeshStandardMaterial[] = [];
  private mimicBaseEmissive: THREE.Color[] = [];
  private mimicHp = MIMIC_MAX_HP;
  private phase: MimicPhase = "loading";
  private phaseT = 0;
  private attack: MimicAttackName = "melee";
  private strikeFired = false;
  private lungeFrom = new THREE.Vector3();
  private lungeTo = new THREE.Vector3();
  private animClock = 0;

  // Barrels / interaction
  private decoy = new THREE.Group();
  private decoyOpen = false;
  private nearMimicBarrel = false;
  private nearDecoy = false;
  private interactQueued = false;

  private keys = new Set<string>();
  private onState: StateCb;
  private lastSig = "";

  constructor(private canvas: HTMLCanvasElement, onState: StateCb) {
    this.onState = onState;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x0a0c12);
    this.scene.fog = new THREE.FogExp2(0x0a0c12, 0.012);
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);

    this.vfx = new Vfx(this.scene);
    this.scene.add(this.mimicRoot);
    this.mimicRoot.add(this.mimicPose);
    this.scene.add(this.decoy);
    this.scene.add(this.player);
    this.buildLights();
    // Seed camera so first frames are not black / zero-aspect before load
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 1, 0);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    this.emit();
    // Parallel: vol scene + skinned hero (don't block volcano on character)
    void Promise.all([this.load(), this.buildPlayer()]);
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x20160f, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d8, 1.5);
    key.position.set(14, 26, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 90;
    const c = key.shadow.camera as THREE.OrthographicCamera;
    c.left = -40; c.right = 40; c.top = 40; c.bottom = -40;
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x2a3350, 0.4));
  }

  /**
   * Player: GrudgeAvatar (arena race GLB + Bip001 baked anims) + arsenal sword.
   * Static 30characters mesh is forbidden here — that path is permanent T-pose.
   */
  private async buildPlayer() {
    try {
      const av = new GrudgeAvatar("western-kingdoms", "warrior", {
        animPack: "sword_shield",
      });
      await av.load();
      if (this.disposed) {
        av.dispose();
        return;
      }
      this.avatar = av;
      this.player.add(av.root);
      av.root.position.set(0, 0, 0);
      // Art-forward: grudge6 kits face +Z; parent yaw steers facing.
      // If the mesh still looks sideways, setModelYaw(±π/2) is the next knob.
      if (typeof av.setModelYaw === "function") {
        av.setModelYaw(0);
      }
      // Ground feet after load (hip tracks / AABB) then idle
      try {
        const { reGroundAfterAnimSample, findDeployModel } = await import("../characterDeploy");
        const model = findDeployModel?.(av.root) ?? av.root;
        reGroundAfterAnimSample(model, 0);
      } catch {
        /* optional */
      }
      av.playRole?.("idle", 0);
      av.setLocomotion?.(0, false);

      // Mount sword on hand sockets (Danger Room arsenal path)
      try {
        const def = getWeapon(PLAYER_WEAPON);
        const rh = av.rightHand;
        const lh = av.leftHand;
        if (rh && lh) {
          this.mountedWeapon = await mountWeaponModel(def, rh, lh, 0);
        } else {
          console.warn("[MimicDungeon] no hand bones on avatar — sword not mounted");
        }
      } catch (werr) {
        console.warn("[MimicDungeon] weapon mount failed — combat still works", werr);
      }

      const clips = av.clipNames?.() ?? [];
      this.loadNote =
        clips.length > 0
          ? `Hero ready · sword + skills 1–4 · ${clips.length} clips`
          : "Hero mesh ready · anim clips missing (check /anims/baked)";
      this.emit();
      console.info("[MimicDungeon] GrudgeAvatar ready", av.def?.name, "clips:", clips.slice(0, 16));
    } catch (err) {
      console.error("[MimicDungeon] GrudgeAvatar load failed", err);
      this.loadNote = "Hero load failed — check grudge6 race GLB + anim packs";
      this.emit();
    }
  }

  /** Load GLB from the first working fleet candidate (same-origin → Open → R2). */
  private async loadGltf(path: string | string[]) {
    const { loadGltfFirst } = await import("../assets");
    const { sharedGltfLoader } = await import("../loaders/gltf");
    const keys = Array.isArray(path) ? path : [path];
    const gltf = await loadGltfFirst(keys, sharedGltfLoader());
    console.info("[MimicDungeon] loaded", keys[0], "from", gltf.url);
    return gltf;
  }

  /**
   * Find the real Mimic armature inside vol.glb (Sketchfab hierarchy).
   * Prefer Mimicfbx (full rig) over a single mesh bone name.
   */
  private findMimicRoot(root: THREE.Object3D): THREE.Object3D | null {
    const preferred = ["Mimicfbx", "Mimic", "Barrel_Creature_1_0", "Armatura"];
    for (const name of preferred) {
      const hit = root.getObjectByName(name);
      if (hit) {
        // Climb to Mimicfbx / top creature group under Sketchfab_model when possible
        let cur: THREE.Object3D = hit;
        while (cur.parent && cur.parent !== root) {
          if (/^Mimicfbx$/i.test(cur.parent.name) || /^Mimic$/i.test(cur.parent.name)) {
            return cur.parent;
          }
          if (/Sketchfab_model|ForgeScene/i.test(cur.parent.name)) break;
          cur = cur.parent;
        }
        return hit;
      }
    }
    // Fuzzy scan
    let found: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (found) return;
      if (/mimic/i.test(o.name) && !/barrel/i.test(o.name)) found = o;
    });
    return found;
  }

  private async load() {
    let gltf: Awaited<ReturnType<MimicDungeon["loadGltf"]>> | null = null;
    let usedKey = "";
    const errors: string[] = [];
    for (const key of MAP_MESH_KEYS) {
      try {
        gltf = await this.loadGltf(key);
        usedKey = key;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${key}: ${msg.slice(0, 80)}`);
        console.warn("[MimicDungeon] map candidate failed", key, msg);
      }
    }

    if (!gltf) {
      console.error("[MimicDungeon] all map candidates failed", errors);
      this.loadNote = "Map GLBs failed — arena floor (dungeon/minecraft/vol)";
      this.buildArenaFallback();
      this.spawnMimicFallback();
      this.finishSetup();
      this.emit();
      return;
    }
    if (this.disposed) return;
    const root = gltf.scene;
    this.loadNote = `Map loaded · ${usedKey.split("/").pop()}`;

    // Auto-scale to a playable footprint (~34–48 m), like the Dungeon loader.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z) || 1;
    if (maxDim > 300) root.scale.setScalar(0.01);
    else if (maxDim > 80) root.scale.setScalar(48 / maxDim);
    else if (maxDim > 0.001 && maxDim < 28) root.scale.setScalar(36 / maxDim);
    root.updateMatrixWorld(true);

    // Separate the real Mimic creature (from barrel) from the static environment.
    let creatureRoot = this.findMimicRoot(root);

    // Best-practice pass: shadows + sRGB base maps; lift pure-black materials.
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) {
        const std = mm as THREE.MeshStandardMaterial;
        if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace;
        // Prevent "black void" materials on unlit/emissive-only map chunks
        if (std?.color && std.color.getHex() === 0x000000 && !std.map && !std.emissiveMap) {
          std.color.setHex(0x2a3040);
          std.roughness = 0.92;
        }
      }
    });

    // Re-centre the environment on origin, feet on y=0.
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    const c2 = b2.getCenter(new THREE.Vector3());
    root.position.x -= c2.x;
    root.position.z -= c2.z;
    root.position.y -= b2.min.y;
    root.updateMatrixWorld(true);

    // Pull the creature out into the mimic pose group (posed procedurally).
    if (creatureRoot) {
      // Detach from map graph so we don't double-transform
      creatureRoot.parent?.remove(creatureRoot);
      this.mimicModel = creatureRoot;
      this.mimicPose.add(creatureRoot);
      creatureRoot.position.set(0, 0, 0);
      creatureRoot.rotation.set(0, 0, 0);
      const cbox = new THREE.Box3().setFromObject(creatureRoot);
      const csize = cbox.getSize(new THREE.Vector3());
      const cs = 1.6 / (csize.y || 1);
      creatureRoot.scale.multiplyScalar(cs);
      creatureRoot.updateMatrixWorld(true);
      const drop = new THREE.Box3().setFromObject(creatureRoot);
      creatureRoot.position.y -= drop.min.y;
      creatureRoot.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) {
          const std = mm as THREE.MeshStandardMaterial;
          if (std?.emissive) {
            this.mimicMats.push(std);
            this.mimicBaseEmissive.push(std.emissive.clone());
          }
        }
      });
    }

    // Collect ground meshes for height raycasts (environment only).
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !(creatureRoot && this.isDescendant(m, creatureRoot))) {
        this.groundMeshes.push(m);
      }
    });

    // If the map has almost no floor area, pad with an arena underlay
    if (this.groundMeshes.length < 2) {
      this.buildArenaFallback(true);
    }

    this.scene.add(root);
    if (!this.mimicModel) this.spawnMimicFallback();
    this.finishSetup();
    this.emit();
  }

  private isDescendant(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let p: THREE.Object3D | null = node;
    while (p) {
      if (p === ancestor) return true;
      p = p.parent;
    }
    return false;
  }

  /**
   * Playable dungeon arena when map GLBs fail (broken vol.glb isBone, etc.).
   * Not an empty black circle — walls, pillars, floor, torch lights.
   * @param underlayOnly when true, only add a large ground plane under a sparse map
   */
  private buildArenaFallback(underlayOnly = false) {
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2a3142,
      roughness: 0.92,
      metalness: 0.05,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1c2230,
      roughness: 0.88,
      metalness: 0.08,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x3d4a62,
      roughness: 0.75,
      emissive: 0x1a2840,
      emissiveIntensity: 0.15,
    });

    const floor = new THREE.Mesh(new THREE.CircleGeometry(22, 56), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = "mimic_arena_floor";
    this.scene.add(floor);
    this.groundMeshes.push(floor);

    if (underlayOnly) return;

    // Ring wall segments
    const wallH = 3.2;
    const wallR = 20;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(10.5, wallH, 0.55), wallMat);
      seg.position.set(Math.sin(a) * wallR, wallH * 0.5, Math.cos(a) * wallR);
      seg.rotation.y = a;
      seg.castShadow = true;
      seg.receiveShadow = true;
      this.scene.add(seg);
    }

    // Pillars around arena
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.2, 10), accent);
      p.position.set(Math.sin(a) * 12, 2.1, Math.cos(a) * 12);
      p.castShadow = true;
      this.scene.add(p);
      const light = new THREE.PointLight(0xffaa66, 1.1, 14, 2);
      light.position.set(Math.sin(a) * 12, 3.4, Math.cos(a) * 12);
      this.scene.add(light);
    }

    // Center dais (mimic spawn)
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.35, 24), accent);
    dais.position.y = 0.15;
    dais.receiveShadow = true;
    dais.castShadow = true;
    this.scene.add(dais);
    this.groundMeshes.push(dais);

    // Soft fill light so arena is not a black void
    const fill = new THREE.PointLight(0x88aaff, 0.55, 40, 2);
    fill.position.set(0, 8, 0);
    this.scene.add(fill);

    this.scene.background = new THREE.Color(0x0c1018);
    this.scene.fog = new THREE.FogExp2(0x0c1018, 0.018);
  }

  /** @deprecated use buildArenaFallback */
  private buildFallbackGround() {
    this.buildArenaFallback(false);
  }

  /** Procedural fallback mimic (a fanged barrel) if the GLB creature isn't found. */
  private spawnMimicFallback() {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.55, 1.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 }),
    );
    body.position.y = 0.65;
    body.castShadow = true;
    this.mimicMats.push(body.material as THREE.MeshStandardMaterial);
    this.mimicBaseEmissive.push((body.material as THREE.MeshStandardMaterial).emissive.clone());
    this.mimicModel = body;
    this.mimicPose.add(body);
  }

  private finishSetup() {
    // Place the mimic (disguised) at origin; player a few metres away; decoy by
    // a simple "home door" a bit further out.
    this.mimicRoot.position.set(0, this.groundY(0, 0), 0);
    this.player.position.set(0, this.groundY(0, 7), 7);
    this.playerYaw = Math.PI; // face the mimic (−Z)
    this.camYaw = this.playerYaw;
    this.player.rotation.y = this.playerYaw;
    void this.buildDecoyBarrel(new THREE.Vector3(9, 0, -3));
    this.setPhase("disguised");
    if (!this.raf) this.raf = requestAnimationFrame(this.animate);
  }

  /** Real destructible barrel GLB when available; procedural fallback otherwise. */
  private async buildDecoyBarrel(at: THREE.Vector3) {
    this.decoy.position.set(at.x, this.groundY(at.x, at.z), at.z);
    try {
      const gltf = await this.loadGltf("models/destructibles/barrel-01.glb");
      if (this.disposed) return;
      const b = gltf.scene;
      b.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(b);
      const h = box.getSize(new THREE.Vector3()).y || 1;
      b.scale.setScalar(1.15 / h);
      b.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(b);
      b.position.y -= b2.min.y;
      this.decoy.add(b);
    } catch {
      const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85 });
      const iron = new THREE.MeshStandardMaterial({ color: 0x30302f, roughness: 0.6, metalness: 0.4 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.2, 16), wood);
      body.position.y = 0.6;
      body.castShadow = true;
      this.decoy.add(body);
      for (const y of [0.25, 0.95]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 20), iron);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        this.decoy.add(ring);
      }
    }
    // Simple door frame beside it so it reads as "by the home's door".
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x59452f, roughness: 0.9 });
    const post = () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), frameMat);
    const pL = post(); pL.position.set(-1.6, 1.2, 0);
    const pR = post(); pR.position.set(-0.6, 1.2, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.2), frameMat);
    top.position.set(-1.1, 2.3, 0);
    this.decoy.add(pL, pR, top);
  }

  /** Ground height at world (x,z) via a downward ray onto the environment. */
  private groundY(x: number, z: number): number {
    if (this.groundMeshes.length === 0) return 0;
    this.ray.set(new THREE.Vector3(x, 40, z), this.DOWN);
    this.ray.far = 120;
    const hits = this.ray.intersectObjects(this.groundMeshes, false);
    return hits.length ? hits[0].point.y : 0;
  }

  // ── input ────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === "e") this.interactQueued = true;
    if (k === "1") this.castSkill(0);
    if (k === "2") this.castSkill(1);
    if (k === "3") this.castSkill(2);
    if (k === "4") this.castSkill(3);
    if (k === " ") e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.castSkill(0); // LMB = skill 1 / basic attack
    if (e.button === 2 || e.button === 1) {
      this.pointerDragging = true;
      this.lastPointerX = e.clientX;
      e.preventDefault();
    }
  };
  private onMouseUp = () => {
    this.pointerDragging = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerDragging) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.camYaw -= dx * 0.005;
  };
  /** React HUD may also forward an interact press (button). */
  interact() {
    this.interactQueued = true;
  }

  /** Slot 0–3 → T0 weapon skill (clip + damage + optional MM lunge). */
  private castSkill(slot: number) {
    if (this.phase === "victory" || this.phase === "defeat" || this.phase === "loading") return;
    const sk = this.skills[slot];
    if (!sk || sk.cd > 0) return;
    sk.cd = sk.cdMax;
    this.playerAtkCd = Math.min(0.35, sk.cdMax * 0.25);

    // Face mimic when in combat
    if (this.phase !== "disguised") {
      const d = this.mimicRoot.position.clone().sub(this.player.position);
      d.y = 0;
      if (d.lengthSq() > 1e-4) this.playerYaw = Math.atan2(d.x, d.z);
    }

    // Play attack / skill clip on skinned rig
    const clip = sk.clip || "attack";
    const av = this.avatar;
    if (av) {
      if (typeof av.playClipOnce === "function") {
        const d = av.playClipOnce(clip, 0.08);
        if (d <= 0) av.playClipOnce?.("attack", 0.08);
      } else {
        av.playRole?.("attack", 0.08);
      }
    }

    // MM lunge along facing
    if (sk.lunge && sk.lunge > 0) {
      const fwd = new THREE.Vector3(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
      this.player.position.addScaledVector(fwd, Math.min(1.4, sk.lunge * MM_TO_M * 8));
      this.player.position.y = this.groundY(this.player.position.x, this.player.position.z);
    }

    const mp = this.mimicRoot.position;
    const d = mp.clone().sub(this.player.position);
    d.y = 0;
    const dist = d.length();
    const hitPt = this.player.position
      .clone()
      .addScaledVector(d.lengthSq() > 1e-6 ? d.normalize() : new THREE.Vector3(0, 0, 1), Math.min(dist, 1.4));
    hitPt.y += 1.0;
    this.vfx.impact(hitPt, 0x9fe8ff, 1.1 + slot * 0.15);

    const reach = (sk.reach || PLAYER_MELEE_REACH) + 0.2;
    if (this.phase !== "disguised" && this.phase !== "loading" && dist <= reach) {
      this.damageMimic(sk.damage || 18 + slot * 4);
    }
    this.emit();
  }

  // ── damage ─────────────────────────────────────────────────────────────────
  private damageMimic(amount: number) {
    if (this.mimicHp <= 0) return;
    this.mimicHp = Math.max(0, this.mimicHp - amount);
    const head = this.mimicRoot.position.clone();
    head.y += 1.4;
    this.vfx.burst(head, 0x9cff5a, 12, 3);
    if (this.mimicHp <= 0) this.setPhase("victory");
    this.emit();
  }

  private damagePlayer(amount: number) {
    if (this.playerHp <= 0) return;
    this.playerHp = Math.max(0, this.playerHp - amount);
    const p = this.player.position.clone();
    p.y += 1.0;
    this.vfx.burst(p, 0xff5a5a, 12, 3);
    this.vfx.smokePop(p, 0xff8a6a, 0.6);
    if (this.playerHp <= 0) this.setPhase("defeat");
    this.emit();
  }

  // ── state ──────────────────────────────────────────────────────────────────
  private setPhase(p: MimicPhase) {
    this.phase = p;
    this.phaseT = 0;
    this.strikeFired = false;
    this.emit();
  }

  private emit() {
    let prompt: string | null = null;
    if (this.phase === "disguised" && this.nearMimicBarrel) prompt = "E: Open Barrel";
    else if (this.nearDecoy && !this.decoyOpen) prompt = "E: Open Barrel";
    const hint =
      this.phase === "victory"
        ? "The mimic is slain. Test complete."
        : this.phase === "defeat"
          ? "You were devoured. Refresh to retry."
          : "WASD · Shift sprint · RMB drag camera · LMB/1–4 skills · E barrels";
    const state: MimicDungeonState = {
      phase: this.phase,
      prompt,
      hint,
      playerHp: Math.round(this.playerHp),
      playerMaxHp: PLAYER_MAX_HP,
      mimicHp: Math.round(this.mimicHp),
      mimicMaxHp: MIMIC_MAX_HP,
      telegraph: this.phase === "windup" ? this.attack : null,
      skills: this.skills.map((s) => ({
        slot: s.slot,
        key: s.key,
        label: s.label,
        cd: Math.max(0, s.cd),
        cdMax: s.cdMax,
        iconUrl: s.iconUrl,
      })),
      loadNote: this.loadNote,
    };
    const sig = `${state.phase}|${state.prompt}|${state.playerHp}|${state.mimicHp}|${state.telegraph}|${this.loadNote}|${this.skills.map((s) => s.cd.toFixed(1)).join(",")}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.onState(state);
  }

  // ── loop ─────────────────────────────────────────────────────────────────
  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.animClock += dt;
    this.playerAtkCd = Math.max(0, this.playerAtkCd - dt);

    this.updatePlayer(dt);
    this.updateInteraction();
    this.updateMimic(dt);
    this.updateCamera();
    this.vfx.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(dt: number) {
    // Tick skill CDs always
    for (const sk of this.skills) {
      if (sk.cd > 0) sk.cd = Math.max(0, sk.cd - dt);
    }

    if (this.phase === "victory" || this.phase === "defeat") {
      this.avatar?.setLocomotion?.(0, false);
      this.avatar?.update?.(dt);
      return;
    }

    // Camera-yaw relative WASD (third-person, not world axes)
    const input = new THREE.Vector3(
      (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0),
      0,
      (this.keys.has("s") ? 1 : 0) - (this.keys.has("w") ? 1 : 0),
    );
    this.sprinting = this.keys.has("shift");
    this.moving = input.lengthSq() > 0;

    if (this.moving) {
      input.normalize();
      // Rotate input into camera yaw plane
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const world = new THREE.Vector3(
        input.x * cos + input.z * sin,
        0,
        -input.x * sin + input.z * cos,
      );
      const speed = this.sprinting ? PLAYER_SPRINT : PLAYER_SPEED;
      this.player.position.addScaledVector(world, speed * dt);
      this.playerYaw = Math.atan2(world.x, world.z);
    }

    this.player.position.y = this.groundY(this.player.position.x, this.player.position.z);
    this.player.rotation.y = this.playerYaw;

    // Skinned locomotion + mixer
    const av = this.avatar;
    if (av) {
      const speed01 = this.moving ? (this.sprinting ? 1 : 0.55) : 0;
      av.setLocomotion?.(speed01, this.sprinting);
      av.update?.(dt);
    }
  }

  private updateInteraction() {
    const pp = this.player.position;
    this.nearMimicBarrel =
      this.phase === "disguised" && pp.distanceTo(this.mimicRoot.position) <= INTERACT_RANGE;
    this.nearDecoy = !this.decoyOpen && pp.distanceTo(this.decoy.position) <= INTERACT_RANGE;

    if (this.interactQueued) {
      this.interactQueued = false;
      if (this.nearMimicBarrel) {
        this.setPhase("reveal");
      } else if (this.nearDecoy) {
        this.decoyOpen = true;
        const lid = this.decoy.children[0];
        this.vfx.puff(this.decoy.position.clone().setY(this.decoy.position.y + 1.2), 0xd8c39a, 16, 1.2);
        if (lid) lid.scale.y = 0.6; // pops open, empty
      }
    }
    // Recompute prompt visibility.
    this.emit();
  }

  private applyPose(pose: MimicPose) {
    this.mimicPose.position.set(0, pose.lift, pose.lunge);
    this.mimicPose.rotation.set(pose.pitch, 0, pose.sway * 0.4);
  }

  private faceMimicToPlayer(rate: number, dt: number) {
    const d = this.player.position.clone().sub(this.mimicRoot.position);
    d.y = 0;
    if (d.lengthSq() < 1e-5) return;
    const want = Math.atan2(d.x, d.z);
    let cur = this.mimicRoot.rotation.y;
    let diff = want - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mimicRoot.rotation.y = cur + diff * Math.min(1, rate * dt);
  }

  private setTelegraph(intensity: number) {
    const c = new THREE.Color(this.attack === "acid" ? 0x7cff3a : 0xff5a2a);
    for (let i = 0; i < this.mimicMats.length; i++) {
      const m = this.mimicMats[i];
      m.emissive.copy(this.mimicBaseEmissive[i]).lerp(c, intensity);
      m.emissiveIntensity = 0.2 + intensity * 1.6;
    }
  }

  private updateMimic(dt: number) {
    if (!this.mimicModel) return;
    this.phaseT += dt;
    this.mimicRoot.position.y = this.groundY(this.mimicRoot.position.x, this.mimicRoot.position.z);
    const distToPlayer = this.mimicRoot.position.distanceTo(this.player.position);

    switch (this.phase) {
      case "disguised": {
        this.applyPose(mimicIdlePose(this.animClock));
        break;
      }
      case "reveal": {
        // A brief shudder as the barrel "unfolds" into the mimic.
        const t = Math.min(1, this.phaseT / 0.8);
        const pose = mimicIdlePose(this.animClock);
        pose.lift += Math.sin(this.phaseT * 40) * 0.05 * (1 - t);
        pose.mouth = t;
        this.applyPose(pose);
        this.setTelegraph(0);
        if (this.phaseT >= 0.8) this.setPhase("chase");
        break;
      }
      case "chase": {
        this.faceMimicToPlayer(6, dt);
        this.applyPose(mimicWalkPose(this.animClock));
        // Walk toward the player until in decision range.
        if (distToPlayer > MELEE_REACH * 0.85) {
          const d = this.player.position.clone().sub(this.mimicRoot.position);
          d.y = 0;
          d.normalize();
          this.mimicRoot.position.addScaledVector(d, MIMIC_SPEED * dt);
        }
        if (this.phaseT > 0.4) {
          this.attack = chooseMimicAttack(distToPlayer, MELEE_REACH);
          this.setPhase("windup");
        }
        break;
      }
      case "windup": {
        this.faceMimicToPlayer(3, dt);
        const spec = MIMIC_ATTACKS[this.attack];
        const dur = spec.prep + spec.pausePeak;
        const t = Math.min(1, this.phaseT / dur);
        // Hold the early charge frames of the attack pose while telegraphing.
        this.applyPose(mimicAttackPose(this.attack, t * 0.35));
        this.setTelegraph(telegraphBlink(this.phaseT, dur, 3));
        if (this.phaseT >= dur) {
          this.beginStrike();
          this.setPhase("strike");
        }
        break;
      }
      case "strike": {
        this.updateStrike(dt);
        break;
      }
      case "recover": {
        this.setTelegraph(0);
        this.applyPose(mimicIdlePose(this.animClock));
        if (this.phaseT >= 0.6) this.setPhase("chase");
        break;
      }
      case "victory":
      case "defeat": {
        this.setTelegraph(0);
        this.applyPose(mimicIdlePose(this.animClock));
        break;
      }
    }
  }

  private beginStrike() {
    this.strikeFired = false;
    this.lungeFrom.copy(this.mimicRoot.position);
    if (this.attack === "melee") {
      // Lunge target: +30 MM forward toward the player.
      const d = this.player.position.clone().sub(this.mimicRoot.position);
      d.y = 0;
      d.normalize();
      this.lungeTo.copy(this.mimicRoot.position).addScaledVector(d, MIMIC_ATTACKS.melee.mmLunge * MM_TO_M);
    }
  }

  private updateStrike(dt: number) {
    const spec = MIMIC_ATTACKS[this.attack];
    const dur = mimicAttackDuration(this.attack);
    const t = Math.min(1, this.phaseT / dur);
    this.applyPose(mimicAttackPose(this.attack, t));
    this.setTelegraph(Math.max(0, 1 - t) * 0.5);

    if (this.attack === "melee") {
      // Ease the +30 MM lunge in over the first 55% of the strike.
      const k = Math.min(1, t / 0.55);
      const eased = 1 - Math.pow(1 - k, 3);
      this.mimicRoot.position.lerpVectors(this.lungeFrom, this.lungeTo, eased);
      if (!this.strikeFired && t >= 0.5) {
        this.strikeFired = true;
        const dist = this.mimicRoot.position.distanceTo(this.player.position);
        const mouth = this.mimicRoot.position.clone(); mouth.y += 1.2;
        this.vfx.impact(mouth, 0xff7a2a, 1.1);
        if (dist <= MELEE_REACH + spec.reachBonus) this.damagePlayer(18);
      }
    } else if (!this.strikeFired && t >= 0.62) {
      // Acid: at the spit frame, lob at the player's position captured NOW.
      this.strikeFired = true;
      const mouth = this.mimicMouthWorld();
      const target = this.player.position.clone();
      target.y = this.groundY(target.x, target.z);
      this.vfx.acidLob(mouth, target, ACID_AOE, (landing) => {
        if (this.player.position.distanceTo(landing) <= ACID_AOE) this.damagePlayer(22);
      });
    }

    if (this.phaseT >= dur) this.setPhase("recover");
  }

  private mimicMouthWorld(): THREE.Vector3 {
    const p = this.mimicRoot.position.clone();
    p.y += 1.35;
    // A little forward from the body along facing.
    p.x += Math.sin(this.mimicRoot.rotation.y) * 0.5;
    p.z += Math.cos(this.mimicRoot.rotation.y) * 0.5;
    return p;
  }

  private updateCamera() {
    // Third-person boom behind player yaw / orbit camYaw
    const boom = 8.5;
    const height = 3.2;
    const lookY = 1.25;
    const yaw = this.camYaw;
    // Soft-follow cam yaw toward player facing when moving (optional glue)
    if (this.moving && !this.pointerDragging) {
      let diff = this.playerYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * 0.04;
    }
    const y = this.camYaw;
    const target = this.player.position.clone();
    target.y += lookY;
    const desired = new THREE.Vector3(
      target.x - Math.sin(y) * boom,
      target.y + height,
      target.z - Math.cos(y) * boom,
    );
    this.camera.position.lerp(desired, 0.14);
    this.camera.lookAt(target);
    void yaw;
  }

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    if (this.mountedWeapon) {
      unmountWeapon(this.mountedWeapon);
      this.mountedWeapon = null;
    }
    this.avatar?.dispose?.();
    this.avatar = null;
    this.vfx.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Skip player rig (mixer owns shared clip/geo from fleet cache)
      if (this.player && this.isDescendant(m, this.player)) return;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}

/**
 * Test Dungeon (Mimic) — a self-contained encounter scene.
 *
 * Loads `vol.glb` (best-practice mesh/material/shadow pass), separates the
 * rigged mimic-creature from the static environment, and runs the full mimic
 * fight against a simple third-person player:
 *
 *   disguised (barrel idle) → [E] reveal → chase (waddle) → attack → recover
 *
 * Two attacks (shared attack pose at two speeds, per {@link ./mimicMoves}):
 *   • melee — 1.5× speed, lunges +30 MM (maneuver motion) forward, 0.25 s tell + blink.
 *   • acid  — 0.75× speed, 1 s prep, lobs an arcing acid glob at the player's
 *     position captured at launch (does NOT home), bursting in a 3 m AoE.
 *
 * A decoy barrel by the home's door shares the identical "E: Open Barrel"
 * prompt but is harmless. Reuses the animator's `Vfx` (acid) — no new engine.
 * This is an isolated test surface; it does not thread through the full Studio
 * combat pipeline (a follow-up can promote it into the Danger Room flow).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { asset } from "../assets";
import { Vfx } from "../Vfx";
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

/**
 * Grudge "Maneuver Motion" → metres. The controller expresses attack lunges in
 * MM units; +30 MM reads as a brisk ~1.8 m forward lunge here. Tunable once the
 * canonical MM↔metre scale is confirmed.
 */
const MM_TO_M = 0.06;

const PLAYER_MAX_HP = 100;
const MIMIC_MAX_HP = 120;
const PLAYER_SPEED = 5.5;
const MIMIC_SPEED = 2.6;
const MELEE_REACH = 2.4;
const PLAYER_MELEE_REACH = 2.6;
const INTERACT_RANGE = 3.0;
const ACID_AOE = MIMIC_ATTACKS.acid.aoeRadius; // 3 m

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

export interface MimicDungeonState {
  phase: MimicPhase;
  prompt: string | null;
  hint: string;
  playerHp: number;
  playerMaxHp: number;
  mimicHp: number;
  mimicMaxHp: number;
  telegraph: MimicAttackName | null;
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

  // Player
  private player = new THREE.Group();
  private playerYaw = 0;
  private playerHp = PLAYER_MAX_HP;
  private playerAtkCd = 0;

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
    this.buildLights();
    this.buildPlayer();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    this.emit();
    void this.load();
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

  private buildPlayer() {
    const geo = new THREE.CapsuleGeometry(0.35, 1.1, 6, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4f9bff, roughness: 0.5, metalness: 0.1 });
    const body = new THREE.Mesh(geo, mat);
    body.position.y = 0.9;
    body.castShadow = true;
    this.player.add(body);
    // A snout so the facing reads.
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xdfe9ff, roughness: 0.4 }),
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.1, 0.45);
    this.player.add(nose);
    this.scene.add(this.player);
  }

  private async load() {
    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(asset("models/vol.glb"));
    } catch (err) {
      console.error("[MimicDungeon] vol.glb load failed", err);
      this.buildFallbackGround();
      this.spawnMimicFallback();
      this.finishSetup();
      return;
    }
    if (this.disposed) return;
    const root = gltf.scene;

    // Auto-scale to a playable footprint (~34 u), like the Dungeon loader.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z) || 1;
    if (maxDim > 300) root.scale.setScalar(0.01);
    else if (maxDim > 0.001 && maxDim < 34) root.scale.setScalar(34 / maxDim);
    root.updateMatrixWorld(true);

    // Separate the mimic creature subtree from the static environment.
    const creature =
      root.getObjectByName("Barrel_Creature_1_0") ??
      root.getObjectByName("Mimicfbx") ??
      root.getObjectByName("Mimic");
    let creatureRoot: THREE.Object3D | null = creature ?? null;
    if (creatureRoot) {
      // Walk up to the top-level creature group (child of a Sketchfab/Forge wrapper).
      while (
        creatureRoot.parent &&
        creatureRoot.parent !== root &&
        !/ForgeScene/i.test(creatureRoot.parent.name)
      ) {
        creatureRoot = creatureRoot.parent;
      }
    }

    // Best-practice pass: shadows + sRGB base maps; collect ground meshes.
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) {
        const std = mm as THREE.MeshStandardMaterial;
        if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
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
      this.mimicModel = creatureRoot;
      this.mimicPose.add(creatureRoot);
      creatureRoot.position.set(0, 0, 0);
      creatureRoot.rotation.set(0, 0, 0);
      // Normalise the creature to ~1.6 m tall and record its materials for the
      // telegraph emissive flash.
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
          if (std.emissive) {
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

    this.scene.add(root);
    if (!this.mimicModel) this.spawnMimicFallback();
    this.finishSetup();
  }

  private isDescendant(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let p: THREE.Object3D | null = node;
    while (p) {
      if (p === ancestor) return true;
      p = p.parent;
    }
    return false;
  }

  private buildFallbackGround() {
    const g = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.96 }),
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    this.groundMeshes.push(g);
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
    this.buildDecoyBarrel(new THREE.Vector3(9, 0, -3));
    this.setPhase("disguised");
    this.raf = requestAnimationFrame(this.animate);
  }

  /** A clean procedural decoy barrel + a small door frame ("home"). */
  private buildDecoyBarrel(at: THREE.Vector3) {
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
    // A simple door frame beside it so it reads as "by the home's door".
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x59452f, roughness: 0.9 });
    const post = () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), frameMat);
    const pL = post(); pL.position.set(-1.6, 1.2, 0);
    const pR = post(); pR.position.set(-0.6, 1.2, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.2), frameMat);
    top.position.set(-1.1, 2.3, 0);
    this.decoy.add(pL, pR, top);
    this.decoy.position.set(at.x, this.groundY(at.x, at.z), at.z);
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
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.playerMelee();
  };
  /** React HUD may also forward an interact press (button). */
  interact() {
    this.interactQueued = true;
  }

  private playerMelee() {
    if (this.playerAtkCd > 0 || this.phase === "victory" || this.phase === "defeat") return;
    this.playerAtkCd = 0.45;
    const mp = this.mimicRoot.position;
    const d = mp.clone().sub(this.player.position);
    d.y = 0;
    const dist = d.length();
    const hitPt = this.player.position.clone().addScaledVector(d.normalize(), Math.min(dist, 1.2));
    hitPt.y += 1.0;
    this.vfx.impact(hitPt, 0x9fe8ff, 1.0);
    if (this.phase !== "disguised" && this.phase !== "loading" && dist <= PLAYER_MELEE_REACH) {
      this.damageMimic(20);
    }
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
          : "WASD move · LMB attack · E interact — beware the barrels.";
    const state: MimicDungeonState = {
      phase: this.phase,
      prompt,
      hint,
      playerHp: Math.round(this.playerHp),
      playerMaxHp: PLAYER_MAX_HP,
      mimicHp: Math.round(this.mimicHp),
      mimicMaxHp: MIMIC_MAX_HP,
      telegraph: this.phase === "windup" ? this.attack : null,
    };
    const sig = `${state.phase}|${state.prompt}|${state.playerHp}|${state.mimicHp}|${state.telegraph}`;
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
    if (this.phase === "victory" || this.phase === "defeat") return;
    // Camera-relative WASD (camera sits behind +Z, so W drives −Z into screen).
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
    const target = this.player.position.clone();
    target.y += 1.1;
    const desired = new THREE.Vector3(target.x, target.y + 6.5, target.z + 9);
    this.camera.position.lerp(desired, 0.12);
    this.camera.lookAt(target);
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
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.vfx.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
    this.renderer.dispose();
  }
}

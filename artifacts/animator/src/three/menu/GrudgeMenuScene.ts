/**
 * GrudgeMenuScene — the post-login main-menu campfire scene. A standalone
 * three.js night-forest diorama (aurora sky, silhouette pines, stars, a
 * particle campfire) with the account's roster heroes standing around the
 * fire in 3D. Pure presentation: the React host (GrudgeMenu.tsx) owns the
 * roster state and DOM chrome; this class renders heroes, reports per-slot
 * screen anchors every frame (for the "+" create buttons), and raycasts
 * clicks on standing heroes back to the host.
 *
 * Ownership rules (see .agents/memory/three-disposal.md): GLB hero templates
 * are cached per-scene and disposed once at scene dispose; per-slot instances
 * are SkeletonUtils clones sharing template geometry/materials, so instance
 * teardown only detaches + stops mixers. Async loads are guarded with a
 * per-slot token so stale loads never attach after a roster change.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { asset, getCharacter } from "../assets";
import { CHARACTER_HEIGHT_M } from "../types";
import { ExplorerCharacter } from "../ExplorerCharacter";
import { lockHorizontalRoot } from "../explorer/Animator";

export interface SlotAnchor {
  slot: number;
  /** CSS px within the mount element. */
  x: number;
  y: number;
  /** False when the projected point is off-screen / behind the camera. */
  visible: boolean;
  /** True when a hero occupies this slot (anchor sits over their head). */
  occupied: boolean;
}

export interface GrudgeMenuSceneCallbacks {
  /** A standing hero (occupied slot) was clicked. */
  onPickSlot: (slot: number) => void;
  /** Per-frame projected slot anchors, in mount-local CSS px. */
  onAnchors: (anchors: SlotAnchor[]) => void;
}

interface SlotEntry {
  heroKey: string; // `${uuid}:${baseId}` — identity of what is loaded
  group: THREE.Group; // scene-attached slot root (owned)
  mixer: THREE.AnimationMixer | null;
  explorer: ExplorerCharacter | null;
  hitVolume: THREE.Mesh | null; // invisible click cylinder (owned geo/mat)
  token: number;
}

export const SLOT_COUNT = 4;

/** World-space standing spots arced behind the campfire, facing the camera. */
export function slotPosition(slot: number): { x: number; z: number } {
  const xs = [-3.6, -1.3, 1.3, 3.6];
  const zs = [0.4, -1.0, -1.0, 0.4];
  return { x: xs[slot] ?? 0, z: zs[slot] ?? 0 };
}

const FIRE_POS = new THREE.Vector3(0, 0, 1.6);

export class GrudgeMenuScene {
  private readonly mount: HTMLElement;
  private readonly cb: GrudgeMenuSceneCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;

  private readonly slots: (SlotEntry | null)[] = new Array(SLOT_COUNT).fill(null);
  private slotTokens: number[] = new Array(SLOT_COUNT).fill(0);
  private picked = -1;

  /** GLB template cache — owned; disposed once at scene dispose. */
  private readonly templates = new Map<string, Promise<GLTF>>();
  private readonly loadedTemplates: GLTF[] = [];

  private readonly ring: THREE.Mesh;
  private readonly fireLight: THREE.PointLight;
  private readonly flames: THREE.Points;
  private readonly embers: THREE.Points;
  private readonly flameMat: THREE.ShaderMaterial;
  private readonly emberMat: THREE.ShaderMaterial;
  private readonly auroras: THREE.Mesh[] = [];

  private raf = 0;
  private disposed = false;
  private time = 0;

  constructor(mount: HTMLElement, callbacks: GrudgeMenuSceneCallbacks) {
    this.mount = mount;
    this.cb = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    mount.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";

    this.scene.background = new THREE.Color(0x060a16);
    this.scene.fog = new THREE.FogExp2(0x060a16, 0.028);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    this.camera.position.set(0, 2.4, 8.4);
    this.camera.lookAt(0, 1.2, -0.5);

    // ── Lighting ──────────────────────────────────────────────────────
    this.scene.add(new THREE.HemisphereLight(0x27406e, 0x05070c, 0.55));
    const moon = new THREE.DirectionalLight(0x4a6db0, 0.35);
    moon.position.set(-6, 12, -8);
    this.scene.add(moon);
    this.fireLight = new THREE.PointLight(0xff8b3d, 60, 22, 2);
    this.fireLight.position.copy(FIRE_POS).setY(0.9);
    this.scene.add(this.fireLight);

    // ── Environment ───────────────────────────────────────────────────
    this.buildGround();
    this.buildTrees();
    this.buildStars();
    this.buildAurora();
    this.buildCampfireBase();
    this.flameMat = makeFlameMaterial();
    this.flames = makeFirePoints(this.flameMat, 70, 0.55, FIRE_POS);
    this.scene.add(this.flames);
    this.emberMat = makeEmberMaterial();
    this.embers = makeFirePoints(this.emberMat, 26, 0.9, FIRE_POS);
    this.scene.add(this.embers);

    // ── Selection ring ────────────────────────────────────────────────
    const ringGeo = new THREE.RingGeometry(0.72, 0.92, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);

    this.raf = requestAnimationFrame(this.loop);
  }

  // ─────────────────────────────────────────────────────── environment ──

  private buildGround(): void {
    const geo = new THREE.CircleGeometry(60, 48);
    const mat = new THREE.MeshLambertMaterial({ color: 0x121016 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    // Slight warm dirt patch under the fire so the pool of light reads.
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 32),
      new THREE.MeshLambertMaterial({ color: 0x231710 }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(FIRE_POS.x, 0.01, FIRE_POS.z);
    this.scene.add(patch);
  }

  private buildTrees(): void {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x090b12 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x070a12 });
    const rand = mulberry32(1337);
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + rand() * 0.25;
      // Keep the camera-facing wedge clear so the clearing stays open.
      const deg = ((angle * 180) / Math.PI + 360) % 360;
      if (deg > 250 && deg < 290) continue;
      const radius = 13 + rand() * 14;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 2;
      const h = 8 + rand() * 9;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, h * 0.45, 5), trunkMat);
      trunk.position.y = h * 0.22;
      tree.add(trunk);
      for (let tier = 0; tier < 3; tier++) {
        const r = (2.6 - tier * 0.7) * (0.8 + rand() * 0.5);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.35, 6), leafMat);
        cone.position.y = h * (0.35 + tier * 0.22);
        cone.rotation.y = rand() * Math.PI;
        tree.add(cone);
      }
      tree.position.set(x, 0, z);
      tree.rotation.y = rand() * Math.PI;
      this.scene.add(tree);
    }
  }

  private buildStars(): void {
    const rand = mulberry32(99);
    const n = 320;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = rand() * Math.PI * 0.42;
      const r = 90;
      pos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 8;
      pos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfd4ff,
      size: 0.35,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      fog: false,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  private buildAurora(): void {
    const tex = makeAuroraTexture();
    const specs: Array<{ x: number; z: number; w: number; h: number; hue: number }> = [
      { x: -18, z: -46, w: 22, h: 42, hue: 0x86f0ff },
      { x: 4, z: -52, w: 30, h: 52, hue: 0xa9c8ff },
      { x: 24, z: -44, w: 18, h: 38, hue: 0x9fefff },
      { x: -38, z: -40, w: 14, h: 30, hue: 0xc2b6ff },
    ];
    for (const s of specs) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: s.hue,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
      mesh.position.set(s.x, s.h * 0.32, s.z);
      this.auroras.push(mesh);
      this.scene.add(mesh);
    }
  }

  private buildCampfireBase(): void {
    const logMat = new THREE.MeshLambertMaterial({ color: 0x3a2415 });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x1c1d24 });
    const rand = mulberry32(7);
    // Teepee logs.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 6), logMat);
      log.position.set(FIRE_POS.x + Math.cos(a) * 0.28, 0.42, FIRE_POS.z + Math.sin(a) * 0.28);
      log.rotation.z = Math.cos(a) * 0.75;
      log.rotation.x = -Math.sin(a) * 0.75;
      this.scene.add(log);
    }
    // Rock ring.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
      const s = 0.22 + rand() * 0.16;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(FIRE_POS.x + Math.cos(a) * 0.95, s * 0.5, FIRE_POS.z + Math.sin(a) * 0.95);
      rock.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
      this.scene.add(rock);
    }
  }

  // ────────────────────────────────────────────────────────── roster ──

  /**
   * Reconcile the rendered heroes with the roster. Entries are keyed by
   * `${uuid}:${baseId}` so renames don't reload but form changes do.
   */
  setRoster(entries: Array<{ uuid: string; baseId: string } | null>, picked: number): void {
    this.picked = picked;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const want = entries[slot] ?? null;
      const key = want ? `${want.uuid}:${want.baseId}` : "";
      const have = this.slots[slot];
      if (have && have.heroKey === key) continue;
      if (have) this.removeSlot(slot);
      if (want) void this.loadSlot(slot, key, want.baseId);
    }
    this.updateRing();
  }

  private removeSlot(slot: number): void {
    const entry = this.slots[slot];
    if (!entry) return;
    this.slots[slot] = null;
    this.slotTokens[slot]++;
    entry.mixer?.stopAllAction();
    if (entry.explorer) entry.explorer.dispose();
    if (entry.hitVolume) {
      entry.hitVolume.geometry.dispose();
      (entry.hitVolume.material as THREE.Material).dispose();
    }
    // GLB clones share template geometry/materials — detach only.
    this.scene.remove(entry.group);
  }

  private async loadSlot(slot: number, heroKey: string, baseId: string): Promise<void> {
    const token = ++this.slotTokens[slot];
    const def = getCharacter(baseId);
    const group = new THREE.Group();
    const { x, z } = slotPosition(slot);
    group.position.set(x, 0, z);
    // Face the campfire-ish / camera: heroes on the wings angle inward.
    group.rotation.y = Math.atan2(this.camera.position.x - x, this.camera.position.z - z) * 0.35;

    const entry: SlotEntry = { heroKey, group, mixer: null, explorer: null, hitVolume: null, token };

    try {
      if (!def.file) {
        // Procedural rig (Explorer & friends).
        const explorer = new ExplorerCharacter(def);
        await explorer.load();
        if (this.disposed || this.slotTokens[slot] !== token) {
          explorer.dispose();
          return;
        }
        explorer.setGroundFeet(true);
        entry.explorer = explorer;
        group.add(explorer.root);
      } else {
        const gltf = await this.template(def.file);
        if (this.disposed || this.slotTokens[slot] !== token) return;
        const model = cloneSkeleton(gltf.scene);
        // Normalize: canonical fighter height, feet on y=0, authored yaw.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const s = size.y > 0.001 ? (CHARACTER_HEIGHT_M / size.y) * (def.scale ?? 1) : def.scale ?? 1;
        model.scale.setScalar(s);
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y -= box2.min.y;
        model.rotation.y = def.modelYaw ?? 0;
        hideBakedNodes(model, def.hideNodes);
        group.add(model);

        // Idle clip: match the def's idle name, else any "idle", else clip 0.
        const clips = gltf.animations;
        if (clips.length > 0) {
          const wantName = def.clips?.idle ?? "idle";
          const clip =
            clips.find((c) => c.name.toLowerCase() === wantName.toLowerCase()) ??
            clips.find((c) => /idle/i.test(c.name)) ??
            clips[0];
          // Re-baseline the root track so baked hip translation can't drift
          // the hero off their campfire spot (mirrors Character.ts).
          model.updateMatrixWorld(true);
          const hipPos = new THREE.Vector3();
          let bindHipY = 0;
          model.traverse((o) => {
            if (!bindHipY && o instanceof THREE.Bone && /^(Bip001$|Hips$|Pelvis$|mixamorigHips$)/i.test(o.name)) {
              o.getWorldPosition(hipPos);
              bindHipY = hipPos.y;
            }
          });
          const use = clip.clone();
          if (bindHipY) lockHorizontalRoot(use, { x: 0, y: bindHipY, z: 0 });
          const mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(use);
          action.time = Math.random() * use.duration; // de-sync the band
          action.play();
          entry.mixer = mixer;
        }
      }
    } catch (err) {
      console.warn("[GrudgeMenuScene] failed to load hero", baseId, err);
      if (this.disposed || this.slotTokens[slot] !== token) return;
      // Fallback silhouette so the slot still reads as occupied.
      const ph = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.32, 1.05, 4, 10),
        new THREE.MeshLambertMaterial({ color: 0x2a3350 }),
      );
      ph.position.y = 0.85;
      group.add(ph);
    }

    if (this.disposed || this.slotTokens[slot] !== token) return;

    // Invisible click volume (owned).
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 2.1, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 1.05;
    hit.userData.slot = slot;
    group.add(hit);
    entry.hitVolume = hit;

    this.slots[slot] = entry;
    this.scene.add(group);
    this.updateRing();
  }

  private template(file: string): Promise<GLTF> {
    let p = this.templates.get(file);
    if (!p) {
      p = new GLTFLoader().loadAsync(asset(file)).then((gltf) => {
        this.loadedTemplates.push(gltf);
        return gltf;
      });
      this.templates.set(file, p);
    }
    return p;
  }

  private updateRing(): void {
    const entry = this.picked >= 0 ? this.slots[this.picked] : null;
    if (!entry) {
      this.ring.visible = false;
      return;
    }
    const { x, z } = slotPosition(this.picked);
    this.ring.position.set(x, 0.02, z);
    this.ring.visible = true;
  }

  // ─────────────────────────────────────────────────────────── frame ──

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;

    for (const entry of this.slots) {
      if (!entry) continue;
      entry.mixer?.update(dt);
      entry.explorer?.update(dt);
    }

    // Fire flicker + shader time.
    const flick = Math.sin(this.time * 11.3) * 0.5 + Math.sin(this.time * 23.7 + 1.3) * 0.3;
    this.fireLight.intensity = 55 + flick * 12;
    this.flameMat.uniforms.uTime.value = this.time;
    this.emberMat.uniforms.uTime.value = this.time;

    // Aurora breathing.
    for (let i = 0; i < this.auroras.length; i++) {
      const m = this.auroras[i].material as THREE.MeshBasicMaterial;
      m.opacity = 0.38 + 0.18 * Math.sin(this.time * 0.35 + i * 1.7);
    }

    // Gentle camera sway.
    this.camera.position.x = Math.sin(this.time * 0.13) * 0.25;
    this.camera.position.y = 2.4 + Math.sin(this.time * 0.21) * 0.06;
    this.camera.lookAt(0, 1.2, -0.5);

    // Selection ring pulse.
    if (this.ring.visible) {
      const s = 1 + 0.06 * Math.sin(this.time * 2.4);
      this.ring.scale.setScalar(s);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.25 * Math.sin(this.time * 2.4);
    }

    this.publishAnchors();
    this.renderer.render(this.scene, this.camera);
  };

  private readonly _anchorVec = new THREE.Vector3();

  private publishAnchors(): void {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    if (w === 0 || h === 0) return;
    const anchors: SlotAnchor[] = [];
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const { x, z } = slotPosition(slot);
      const occupied = this.slots[slot] !== null;
      this._anchorVec.set(x, occupied ? 2.35 : 1.35, z).project(this.camera);
      const v = this._anchorVec;
      const visible = v.z >= -1 && v.z <= 1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05;
      anchors.push({
        slot,
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        visible,
        occupied,
      });
    }
    this.cb.onAnchors(anchors);
  }

  private onPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const volumes: THREE.Object3D[] = [];
    for (const entry of this.slots) if (entry?.hitVolume) volumes.push(entry.hitVolume);
    const hits = this.raycaster.intersectObjects(volumes, false);
    if (hits.length > 0) {
      const slot = hits[0].object.userData.slot as number;
      this.cb.onPickSlot(slot);
    }
  };

  private resize(): void {
    const w = this.mount.clientWidth;
    const h = this.mount.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    for (let slot = 0; slot < SLOT_COUNT; slot++) this.removeSlot(slot);
    // Environment + templates: this scene owns everything left in the graph.
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => disposeMaterial(m));
      else if (mat) disposeMaterial(mat);
    });
    for (const gltf of this.loadedTemplates) {
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => disposeMaterial(m));
        else if (mat) disposeMaterial(mat);
      });
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ───────────────────────────────────────────────────────────── helpers ──

function disposeMaterial(m: THREE.Material): void {
  const anyM = m as THREE.MeshBasicMaterial;
  if (anyM.map) anyM.map.dispose();
  m.dispose();
}

/** Deterministic PRNG so the forest layout is stable across mounts. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hide baked weapon meshes (Heroes of Grudge) — mirrors Character.ts. */
function hideBakedNodes(model: THREE.Object3D, pattern: string | undefined): void {
  if (!pattern) return;
  try {
    const re = new RegExp(pattern, "i");
    model.traverse((o) => {
      if (!o.name || !re.test(o.name)) return;
      if (/container/i.test(o.name)) {
        for (const child of o.children) child.visible = false;
      } else {
        o.visible = false;
      }
    });
  } catch {
    /* invalid pattern — leave visible */
  }
}

function makeAuroraTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  // Vertical streaks for the curtain look.
  ctx.globalCompositeOperation = "destination-out";
  for (let x = 0; x < 128; x += 6) {
    const a = 0.15 + 0.55 * Math.abs(Math.sin(x * 1.7));
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(x, 0, 3, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * GPU-driven fire points: per-particle seed attribute, life computed from
 * uTime in the vertex shader (no per-frame attribute writes). gl_PointSize
 * is clamped (see .agents/memory/animator-danger-room-collision-vfx.md).
 */
function makeFirePoints(material: THREE.ShaderMaterial, count: number, radius: number, at: THREE.Vector3): THREE.Points {
  const seeds = new Float32Array(count);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i] = Math.random();
    pos[i * 3] = at.x;
    pos[i * 3 + 1] = at.y;
    pos[i * 3 + 2] = at.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  material.uniforms.uRadius.value = radius;
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return points;
}

const FIRE_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uRadius;
  uniform float uLifetime;
  uniform float uRise;
  uniform float uBaseSize;
  varying float vLife;
  varying float vSeed;
  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  void main() {
    float cycle = uTime / uLifetime + aSeed * 7.31;
    float life = fract(cycle);           // 0 → 1 over one particle life
    float gen = floor(cycle);            // reseed every respawn
    float h1 = hash(aSeed * 91.7 + gen);
    float h2 = hash(aSeed * 53.3 + gen * 1.7);
    float ang = h1 * 6.2831;
    float rad = uRadius * sqrt(h2) * (1.0 - life * 0.6);
    vec3 offset = vec3(
      cos(ang) * rad + sin(uTime * 3.1 + aSeed * 20.0) * 0.06 * life,
      life * uRise,
      sin(ang) * rad + cos(uTime * 2.7 + aSeed * 17.0) * 0.06 * life
    );
    vec4 mv = modelViewMatrix * vec4(position + offset, 1.0);
    float size = uBaseSize * (1.0 - life * 0.75) * (0.7 + h1 * 0.6);
    gl_PointSize = clamp(size * (180.0 / -mv.z), 1.0, 42.0);
    gl_Position = projectionMatrix * mv;
    vLife = life;
    vSeed = aSeed;
  }
`;

const FLAME_FRAG = /* glsl */ `
  precision mediump float;
  varying float vLife;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.08, d) * (1.0 - vLife) * 0.9;
    vec3 hot = vec3(1.0, 0.93, 0.55);
    vec3 mid = vec3(1.0, 0.45, 0.12);
    vec3 cool = vec3(0.75, 0.14, 0.03);
    vec3 col = mix(hot, mid, smoothstep(0.0, 0.5, vLife));
    col = mix(col, cool, smoothstep(0.45, 1.0, vLife));
    gl_FragColor = vec4(col, alpha);
  }
`;

const EMBER_FRAG = /* glsl */ `
  precision mediump float;
  varying float vLife;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float tw = 0.6 + 0.4 * sin(vLife * 25.0 + vSeed * 40.0);
    float alpha = smoothstep(0.5, 0.05, d) * (1.0 - vLife) * tw;
    gl_FragColor = vec4(1.0, 0.6, 0.2, alpha);
  }
`;

function makeFlameMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FIRE_VERT,
    fragmentShader: FLAME_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 0.5 },
      uLifetime: { value: 1.1 },
      uRise: { value: 1.5 },
      uBaseSize: { value: 0.34 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function makeEmberMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FIRE_VERT,
    fragmentShader: EMBER_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 0.8 },
      uLifetime: { value: 2.6 },
      uRise: { value: 3.2 },
      uBaseSize: { value: 0.09 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * CampfireLobbyScene — Open `/characters` 4-seat farm camp (TVS Voxel Farm props).
 *
 * Product rules:
 *  - No dungeon / Ethereal Falls overlook
 *  - TVS farm props: fence, hay, soil, trees, wheat + chair + campfire center
 *  - Heroes sit idle in chairs; hover → stand, glow, tooltip, gesture
 *  - SI: human ~1.8 m
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createAnimatedCharacter } from "../explorer/loader";
import type { Animator } from "../explorer/Animator";
import type { CharacterLook } from "../explorer/types";
import type { VoxelPart } from "../explorer/rig";
import { CHARACTER_HEIGHT_M } from "../types";
import { baseIdToRaceKey, type GenesisHeroOption } from "../../lib/grudoxRoster";
import {
  loadVoxelAvatarForCharacter,
  partOverridesFromSave,
  voxelAvatarToLook,
  VOXEL_AVATAR_EVENT,
} from "../explorer/voxelAvatarSave";
import {
  CAMPFIRE_TVS,
  campfireTvsTextureUrl,
  campfireTvsUrls,
  encampmentBackdropUrls,
} from "../../lib/productionSystemsPattern";
import { bindKtx2, makeGltfLoader } from "../loaders/gltf";
import { bindTextureAnisotropy, prepObjectMaterials } from "../texturePrep";

export interface CampfireSlotView {
  index: number;
  hero: GenesisHeroOption | null;
  worldPos: THREE.Vector3;
}

export type CampfireHoverInfo = {
  index: number;
  hero: GenesisHeroOption | null;
  /** Screen-space CSS px relative to canvas */
  x: number;
  y: number;
} | null;

const SEAT_RADIUS = 3.55;
const HERO_H = CHARACTER_HEIGHT_M;
const CAM_POS = new THREE.Vector3(0.15, 2.55, 7.4);
const CAM_LOOK = new THREE.Vector3(0, 0.95, 0.1);
// TVS URL SSOT: productionSystemsPattern.CAMPFIRE_TVS (CDN first — Vercel bans .glb)

const LOOK_RACES: Record<string, Partial<CharacterLook>> = {
  human: { skin: "#c98c5a", shirt: "#3d5a80", pants: "#2e3440", cape: true, capeColor: "#1a2740" },
  orc: { skin: "#5a8f3a", shirt: "#4a3020", pants: "#2a2018", cape: false },
  undead: { skin: "#9aa8b0", shirt: "#2a2038", pants: "#1a1520", cape: true, capeColor: "#2a1840" },
  barbarian: { skin: "#c07040", shirt: "#8b3a1a", pants: "#3a2818", cape: false },
  dwarf: { skin: "#c09060", shirt: "#5a4a30", pants: "#3a3028", cape: false },
  elf: { skin: "#e8d0b0", shirt: "#2a6050", pants: "#1a3028", cape: true, capeColor: "#143028" },
};

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Prefer R2 CDN (production), fall back to same-origin public for local dev.
 * SSOT: campfireTvsUrls — must not invent parallel CDN roots.
 */
function tvsUrl(file: string): string[] {
  const base =
    (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const b = base.endsWith("/") ? base : `${base}/`;
  const name = file.replace(/^\//, "");
  // campfireTvsUrls already CDN-first; rewrite local path with Vite BASE_URL
  const [cdn, local] = campfireTvsUrls(name);
  return [cdn, `${b}${CAMPFIRE_TVS.localRel}/${name}`, local];
}

async function loadGltfFirst(
  loader: { loadAsync: (url: string) => Promise<{ scene: THREE.Group }> },
  urls: string[],
): Promise<THREE.Group | null> {
  for (const url of urls) {
    try {
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    } catch {
      /* try next */
    }
  }
  return null;
}

const tvsTexCache = new Map<string, Promise<THREE.Texture | null>>();

function loadTvsPalette(url: string): Promise<THREE.Texture | null> {
  const hit = tvsTexCache.get(url);
  if (hit) return hit;
  const pending = new Promise<THREE.Texture | null>((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  });
  tvsTexCache.set(url, pending);
  return pending;
}

/** TVS Voxel Farm palettes are 1-mesh atlas UVs — nearest, white multiply, low metal. */
function bindTvsPalette(root: THREE.Object3D, tex: THREE.Texture): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const std = m as THREE.MeshStandardMaterial;
      if (!std.map) {
        std.map = tex;
        if (std.color) std.color.setHex(0xffffff);
      }
      if ("metalness" in std) std.metalness = Math.min(std.metalness ?? 0, 0.08);
      if ("roughness" in std) std.roughness = Math.max(std.roughness ?? 0.88, 0.78);
      if ("flatShading" in std) std.flatShading = true;
      std.needsUpdate = true;
    }
  });
}

function applyVoxelFilters(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial | undefined;
      if (!std?.map) continue;
      const name = (std.name || "").toLowerCase();
      if (!name.startsWith("palette")) continue;
      std.map.colorSpace = THREE.SRGBColorSpace;
      std.map.generateMipmaps = false;
      std.map.minFilter = THREE.NearestFilter;
      std.map.magFilter = THREE.NearestFilter;
      std.map.needsUpdate = true;
    }
  });
}

async function finishTvsProp(root: THREE.Object3D, file: string): Promise<void> {
  prepObjectMaterials(root, { neutralizeMetal: true });
  const texUrl = campfireTvsTextureUrl(file);
  if (texUrl) {
    const tex = await loadTvsPalette(texUrl);
    if (tex) bindTvsPalette(root, tex);
  }
  applyVoxelFilters(root);
}

export class CampfireLobbyScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private fireSprites: THREE.Sprite[] = [];
  private mist?: THREE.Points;
  private stars?: THREE.Points;
  private ro?: ResizeObserver;
  private heroes: (Animator | null)[] = [null, null, null, null];
  private seats: THREE.Group[] = [];
  private labels: { mesh: THREE.Sprite; name: string }[] = [];
  private selected = 0;
  private hover = -1;
  private orbit = 0;
  private onSelect: ((index: number) => void) | null = null;
  private onHover: ((info: CampfireHoverInfo) => void) | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private envRoot = new THREE.Group();
  private farmRoot = new THREE.Group();
  private lastHeroes: GenesisHeroOption[] = [];
  private fireLight: THREE.PointLight | null = null;
  private fireLight2: THREE.PointLight | null = null;
  private gltf!: ReturnType<typeof makeGltfLoader>;
  private glowMats: Map<number, THREE.MeshStandardMaterial[]> = new Map();
  private seatMode: ("sit" | "stand")[] = ["sit", "sit", "sit", "sit"];
  private gestureCd = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    opts?: {
      onSelect?: (index: number) => void;
      onHover?: (info: CampfireHoverInfo) => void;
    },
  ) {
    this.onSelect = opts?.onSelect ?? null;
    this.onHover = opts?.onHover ?? null;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    bindKtx2(this.renderer);
    bindTextureAnisotropy(this.renderer);
    this.gltf = makeGltfLoader({ renderer: this.renderer });

    // Warm dusk farm — no purple dungeon sky
    this.scene.background = new THREE.Color(0x0a1420);
    this.scene.fog = new THREE.Fog(0x0c1824, 28, 220);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.08, 280);
    this.camera.position.copy(CAM_POS);
    this.camera.lookAt(CAM_LOOK);

    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.5, 0.28));
    this.composer.addPass(new OutputPass());
    this.composer.setSize(w, h);

    this.scene.add(this.envRoot);
    this.scene.add(this.farmRoot);
    this.buildLightsAndGround();
    this.buildSeats();
    this.buildCampfireProcedural();
    this.buildStars();
    void this.loadTvsFarmProps();
    void this.loadEncampmentBackdrop();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener(VOXEL_AVATAR_EVENT, this.onAvatarSaved);

    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);
  }

  async setHeroes(heroes: GenesisHeroOption[]): Promise<void> {
    if (this.disposed) return;
    this.lastHeroes = heroes.slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const prev = this.heroes[i];
      if (prev) {
        this.seats[i]?.remove(prev.root);
        prev.dispose();
        this.heroes[i] = null;
      }
      this.clearGlow(i);
      this.seatMode[i] = "sit";
    }
    for (let i = 0; i < 4; i++) {
      const hero = heroes[i] ?? null;
      this.updateLabel(i, hero?.name ?? (i === 0 ? "Empty seat" : "—"));
      if (!hero) continue;
      try {
        const raceKey = baseIdToRaceKey(hero.baseId) || hero.raceKey;
        const saved = loadVoxelAvatarForCharacter(hero.id || null);
        let look: CharacterLook = {
          skin: "#c98c5a",
          shirt: "#c0392b",
          pants: "#2e3440",
          hat: "none",
          hatColor: "#b03030",
          avatarHead: true,
          ...LOOK_RACES[raceKey],
        };
        let parts: Partial<Record<VoxelPart, string>> | null = null;
        if (saved) {
          look = { ...look, ...voxelAvatarToLook(saved) };
          parts = partOverridesFromSave(saved);
        }
        const anim = await createAnimatedCharacter({
          height: HERO_H,
          weapon: "unarmed",
          look,
          classes: ["unarmed", "sword"],
        });
        if (this.disposed) {
          anim.dispose();
          return;
        }
        if (parts) {
          for (const [part, hex] of Object.entries(parts)) {
            if (hex) anim.character.setPartColor(part as VoxelPart, hex);
          }
        }
        anim.setWeapon("unarmed", true);
        anim.root.position.set(0, 0, 0);
        anim.root.rotation.y = 0;
        anim.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(anim.root);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 0.05) {
          const s = (HERO_H / size.y) * (anim.root.scale.x || 1);
          anim.root.scale.setScalar(THREE.MathUtils.clamp(s, 0.9, 1.2));
          anim.root.updateMatrixWorld(true);
          const b2 = new THREE.Box3().setFromObject(anim.root);
          anim.root.position.y -= b2.min.y;
        }
        // Sit: slight lower + crouch if available
        this.applySitPose(anim, true);
        const seat = this.seats[i]!;
        seat.add(anim.root);
        this.heroes[i] = anim;
        this.cacheGlowMats(i, anim.root);
      } catch (err) {
        console.warn("[CampfireLobby] hero load failed", hero.name, err);
      }
    }
    this.setSelected(this.selected);
  }

  setSelected(index: number): void {
    this.selected = Math.max(0, Math.min(3, index | 0));
    for (let i = 0; i < 4; i++) {
      const ring = this.seats[i]?.userData.ring as THREE.Mesh | undefined;
      if (!ring) continue;
      const mat = ring.material as THREE.MeshBasicMaterial;
      const on = i === this.selected || i === this.hover;
      mat.color.setHex(on ? 0x5fe0ff : 0x1a3048);
      mat.opacity = on ? 0.95 : 0.32;
      this.updateLabel(i, this.labels[i]?.name ?? "—");
    }
  }

  getSelected(): number {
    return this.selected;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener(VOXEL_AVATAR_EVENT, this.onAvatarSaved);
    this.ro?.disconnect();
    for (const h of this.heroes) h?.dispose();
    this.heroes = [null, null, null, null];
    this.composer.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }

  // ── private ────────────────────────────────────────────────────────────

  private onAvatarSaved = (): void => {
    if (this.lastHeroes.length) void this.setHeroes(this.lastHeroes);
  };

  private buildLightsAndGround(): void {
    this.scene.add(new THREE.AmbientLight(0x4a5a48, 0.5));
    this.scene.add(new THREE.HemisphereLight(0x9ab8d0, 0x2a2010, 0.62));
    const sun = new THREE.DirectionalLight(0xffe0b0, 0.95);
    sun.position.set(6, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const d = 16;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    // Grass ground disc — farm clearing (no dungeon floor)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2d5a32,
        roughness: 0.95,
        metalness: 0.02,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.envRoot.add(ground);

    // Dirt ring around fire
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.98 }),
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.02;
    this.envRoot.add(dirt);

    // Soft sky dome (flat color already set)
  }

  /**
   * Encament village behind the fire (camera is +Z looking toward origin).
   * Author scale 1 — decade unit-fix only if bake is cm. Not a second lobby.
   */
  private async loadEncampmentBackdrop(): Promise<void> {
    try {
      const root = await loadGltfFirst(this.gltf, encampmentBackdropUrls());
      if (!root || this.disposed) return;
      root.name = "encampment-backdrop";
      prepObjectMaterials(root, { neutralizeMetal: true, receiveShadow: true });
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 80) {
        root.scale.multiplyScalar(0.01);
        root.updateMatrixWorld(true);
        box.setFromObject(root);
      }
      root.position.y -= box.min.y;
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const depth = Math.max(8, box.max.z - box.min.z);
      const zBack = -(16 + Math.min(depth * 0.35, 36));
      root.position.x += -center.x;
      root.position.z += -center.z + zBack;
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      // Keep the 4-seat ring clear — Encament must stay behind the fire.
      if (box.max.z > -10) {
        root.position.z += -10 - box.max.z;
        root.updateMatrixWorld(true);
      }
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = false;
        m.receiveShadow = true;
      });
      this.envRoot.add(root);
      const fill = new THREE.DirectionalLight(0xffd8a0, 0.35);
      fill.position.set(-8, 18, zBack - 6);
      fill.target.position.set(0, 1, zBack);
      this.envRoot.add(fill);
      this.envRoot.add(fill.target);
    } catch (e) {
      console.warn("[CampfireLobby] Encament backdrop skip", e);
    }
  }

  /** Load TVS Voxel Farm GLBs — soft-fail; keep procedural ground if missing. */
  private async loadTvsFarmProps(): Promise<void> {
    const place = async (
      file: string,
      x: number,
      z: number,
      yaw = 0,
      scale = 1,
      y = 0,
    ) => {
      try {
        const root = await loadGltfFirst(this.gltf, tvsUrl(file));
        if (!root) {
          console.warn("[CampfireLobby] TVS prop skip (no CDN/local)", file);
          return;
        }
        await finishTvsProp(root, file);
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        // Normalize height ~1–2 m for props
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        const target = file.includes("barn") ? 4.5 : file.includes("tree") ? 3.2 : 1.2;
        const s = (target / maxDim) * scale;
        root.scale.setScalar(s);
        root.updateMatrixWorld(true);
        const b2 = new THREE.Box3().setFromObject(root);
        root.position.set(x, y - b2.min.y, z);
        root.rotation.y = yaw;
        this.farmRoot.add(root);
      } catch (e) {
        console.warn("[CampfireLobby] TVS prop skip", file, e);
      }
    };

    // Fence ring / farm edge
    await place("fence.glb", -5.5, -2.2, 0.2, 1.1);
    await place("fence.glb", 5.5, -1.8, Math.PI - 0.15, 1.1);
    await place("fence.glb", -4.2, 4.5, Math.PI * 0.5, 1.0);
    await place("fencepost.glb", -6.2, 3.8, 0, 1.2);
    await place("fencepost.glb", 6.0, 3.5, 0, 1.2);

    // Hay / trough / soil plots
    await place("haybale.glb", -3.8, 2.4, 0.4, 1.0);
    await place("haybale.glb", -4.6, 2.9, -0.3, 0.9);
    await place("watertrough.glb", 4.2, 2.6, -0.6, 1.0);
    await place("soil.glb", 3.6, -3.5, 0.1, 1.4);
    await place("wheat.glb", 4.4, -3.2, 0.2, 1.0);
    await place("wheat.glb", 3.2, -4.0, -0.4, 0.95);
    await place("pumpkin.glb", 2.6, -3.0, 0.5, 0.7);

    // Trees background
    await place("tree.glb", -7.5, -5.5, 0.3, 1.0);
    await place("appletree.glb", 7.2, -4.8, -0.4, 1.0);
    await place("tree.glb", -2.0, -8.0, 0.1, 1.15);

    // Distant barn silhouette
    await place("barn.glb", 0.5, -10.5, Math.PI * 0.08, 1.0);

    // Prefer TVS campfire mesh if present (replaces procedural if load ok)
    try {
      const root = await loadGltfFirst(this.gltf, tvsUrl("campfire.glb"));
      if (root) {
        await finishTvsProp(root, "campfire.glb");
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const s = 1.6 / Math.max(size.x, size.y, size.z, 0.01);
        root.scale.setScalar(s);
        root.updateMatrixWorld(true);
        const b2 = new THREE.Box3().setFromObject(root);
        root.position.set(0, -b2.min.y + 0.02, 0.1);
        this.farmRoot.add(root);
      }
      // Keep procedural flames on top for glow
    } catch {
      /* procedural campfire already built */
    }
  }

  private buildCampfireProcedural(): void {
    const fire = new THREE.Group();
    fire.name = "campfire_fx";
    const logMat = new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.15, 7), logMat);
      log.position.set(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3);
      log.rotation.z = Math.cos(a) * 0.7;
      log.rotation.x = -Math.sin(a) * 0.7;
      log.castShadow = true;
      fire.add(log);
    }
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.92 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = 0.18 + hash2(i, 7) * 0.1;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(Math.cos(a) * 0.9, s * 0.4, Math.sin(a) * 0.9);
      rock.castShadow = true;
      fire.add(rock);
    }
    const flameTex = makeFlameTexture();
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.SpriteMaterial({
        map: flameTex,
        color: i % 2 === 0 ? 0xff8a30 : 0xffc868,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sp = new THREE.Sprite(mat);
      const w = 0.7 - i * 0.05;
      sp.scale.set(w, w * 1.7, 1);
      sp.position.set((hash2(i, 4) - 0.5) * 0.18, 0.4 + i * 0.09, (hash2(i, 5) - 0.5) * 0.18);
      sp.userData.baseW = w;
      sp.userData.phase = i * 1.15;
      this.fireSprites.push(sp);
      fire.add(sp);
    }
    const light = new THREE.PointLight(0xff7a2e, 26, 16, 1.8);
    light.position.set(0, 1.0, 0);
    light.castShadow = true;
    fire.add(light);
    this.fireLight = light;
    const fill = new THREE.PointLight(0xffaa55, 9, 11, 2);
    fill.position.set(0, 0.4, 0.7);
    fire.add(fill);
    this.fireLight2 = fill;
    fire.position.set(0, 0.02, 0.1);
    this.scene.add(fire);
  }

  private buildSeats(): void {
    for (let i = 0; i < 4; i++) {
      const ang = -Math.PI * 0.55 + (i / 3) * Math.PI * 1.1;
      const x = Math.sin(ang) * SEAT_RADIUS;
      const z = -Math.cos(ang) * SEAT_RADIUS * 0.72 + 0.35;

      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(-x, -z + 0.1);
      g.userData.slotIndex = i;

      // Chair from TVS pack (async attach) — placeholder log until loaded
      const stub = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.45, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.95 }),
      );
      stub.position.set(0, 0.22, 0.12);
      stub.castShadow = true;
      stub.name = "chair_stub";
      g.add(stub);
      void this.attachChair(g);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 40),
        new THREE.MeshBasicMaterial({
          color: 0x1a3048,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      g.userData.ring = ring;
      g.add(ring);

      const proxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 2.0, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      proxy.position.y = 1.0;
      proxy.userData.slotIndex = i;
      g.add(proxy);

      this.scene.add(g);
      this.seats.push(g);

      const label = this.makeLabel("…");
      label.position.set(0, 2.35, 0);
      g.add(label);
      this.labels.push({ mesh: label, name: "…" });
    }
  }

  private async attachChair(seat: THREE.Group): Promise<void> {
    try {
      const chair = await loadGltfFirst(this.gltf, tvsUrl("chair.glb"));
      if (!chair) return;
      await finishTvsProp(chair, "chair.glb");
      chair.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(chair);
      const size = box.getSize(new THREE.Vector3());
      const s = 0.95 / Math.max(size.y, 0.01);
      chair.scale.setScalar(s);
      chair.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(chair);
      chair.position.set(0, -b2.min.y, 0.18);
      chair.rotation.y = Math.PI;
      const stub = seat.getObjectByName("chair_stub");
      if (stub) seat.remove(stub);
      seat.add(chair);
    } catch {
      /* keep stub */
    }
  }

  private applySitPose(anim: Animator, sit: boolean): void {
    // Crouch idle approximates sit in chair; hip drop for seat contact
    anim.setLocomotion({ x: 0, z: 0, speed: 0, running: false });
    anim.setCrouch(sit);
    if (sit) {
      anim.root.position.z = 0.06;
      anim.root.position.y = Math.max(0, 0.02);
    } else {
      anim.root.position.z = 0;
      anim.root.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(anim.root);
      anim.root.position.y -= b.min.y;
    }
  }

  private cacheGlowMats(i: number, root: THREE.Object3D): void {
    const mats: THREE.MeshStandardMaterial[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material;
      const list = Array.isArray(mat) ? mat : [mat];
      for (const mm of list) {
        if (mm && (mm as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const std = mm as THREE.MeshStandardMaterial;
          if (std.userData.__campGlowBase == null) {
            std.userData.__campGlowBase = std.emissiveIntensity ?? 0;
            std.userData.__campGlowColor = std.emissive?.getHex?.() ?? 0;
          }
          mats.push(std);
        }
      }
    });
    this.glowMats.set(i, mats);
  }

  private setGlow(i: number, on: boolean): void {
    const mats = this.glowMats.get(i);
    if (!mats) return;
    for (const m of mats) {
      if (on) {
        m.emissive.setHex(0x44aaff);
        m.emissiveIntensity = 0.55;
      } else {
        m.emissive.setHex(m.userData.__campGlowColor ?? 0);
        m.emissiveIntensity = m.userData.__campGlowBase ?? 0;
      }
      m.needsUpdate = true;
    }
  }

  private clearGlow(i: number): void {
    this.setGlow(i, false);
    this.glowMats.delete(i);
  }

  private playGesture(i: number): void {
    const anim = this.heroes[i];
    if (!anim || this.gestureCd > 0) return;
    this.gestureCd = 1.8;
    // Friendly stand gesture — attack flourish as wave substitute when no wave clip
    try {
      const d = anim.attackMoving(0.55);
      if (!d) anim.enterStance("idle" as never);
    } catch {
      /* idle only */
    }
  }

  private setHover(index: number, clientX?: number, clientY?: number): void {
    if (index === this.hover) {
      if (index >= 0 && this.onHover) {
        const hero = this.lastHeroes[index] ?? null;
        const rect = this.canvas.getBoundingClientRect();
        this.onHover({
          index,
          hero,
          x: (clientX ?? 0) - rect.left,
          y: (clientY ?? 0) - rect.top,
        });
      }
      return;
    }
    // leave previous
    if (this.hover >= 0) {
      const prev = this.heroes[this.hover];
      if (prev) {
        this.applySitPose(prev, true);
        this.seatMode[this.hover] = "sit";
      }
      this.setGlow(this.hover, false);
    }
    this.hover = index;
    if (index >= 0) {
      const anim = this.heroes[index];
      if (anim) {
        this.applySitPose(anim, false);
        this.seatMode[index] = "stand";
        this.playGesture(index);
      }
      this.setGlow(index, true);
      this.setSelected(index);
      const hero = this.lastHeroes[index] ?? null;
      const rect = this.canvas.getBoundingClientRect();
      this.onHover?.({
        index,
        hero,
        x: (clientX ?? rect.width * 0.5) - rect.left,
        y: (clientY ?? rect.height * 0.4) - rect.top,
      });
      this.onSelect?.(index);
    } else {
      this.onHover?.(null);
    }
    // refresh rings
    this.setSelected(this.selected);
  }

  private makeLabel(text: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "rgba(6,12,20,0.78)";
    ctx.fillRect(8, 8, 240, 48);
    ctx.strokeStyle = "rgba(95,224,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 240, 48);
    ctx.fillStyle = "#cfe8ff";
    ctx.font = "bold 22px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.slice(0, 18), 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.65, 0.4, 1);
    spr.userData.canvas = canvas;
    spr.userData.tex = tex;
    return spr;
  }

  private updateLabel(i: number, name: string): void {
    const entry = this.labels[i];
    if (!entry) return;
    entry.name = name;
    const canvas = entry.mesh.userData.canvas as HTMLCanvasElement;
    const tex = entry.mesh.userData.tex as THREE.CanvasTexture;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 64);
    const on = i === this.selected || i === this.hover;
    ctx.fillStyle = on ? "rgba(8,28,40,0.88)" : "rgba(6,12,20,0.78)";
    ctx.fillRect(8, 8, 240, 48);
    ctx.strokeStyle = on ? "rgba(95,224,255,0.75)" : "rgba(95,224,255,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 240, 48);
    ctx.fillStyle = on ? "#5fe0ff" : "#cfe8ff";
    ctx.font = "bold 22px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 18), 128, 32);
    tex.needsUpdate = true;
  }

  private buildStars(): void {
    const n = 280;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      const r = 70;
      pos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r * 0.65 + 6;
      pos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r - 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xd0e0ff,
        size: 0.28,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        fog: false,
      }),
    );
    this.scene.add(this.stars);
  }

  private pickSlot(clientX: number, clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.seats, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (typeof o.userData.slotIndex === "number") return o.userData.slotIndex as number;
        o = o.parent;
      }
    }
    return -1;
  }

  private onPointerDown = (e: PointerEvent): void => {
    const i = this.pickSlot(e.clientX, e.clientY);
    if (i >= 0) {
      this.setSelected(i);
      this.onSelect?.(i);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const i = this.pickSlot(e.clientX, e.clientY);
    this.setHover(i, e.clientX, e.clientY);
  };

  private onPointerLeave = (): void => {
    this.setHover(-1);
  };

  private resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  private animate(): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.gestureCd = Math.max(0, this.gestureCd - dt);

    for (let i = 0; i < this.fireSprites.length; i++) {
      const sp = this.fireSprites[i];
      const f = Math.sin(t * (9 + i) + (sp.userData.phase as number)) * 0.5 + 0.5;
      const w = sp.userData.baseW as number;
      sp.scale.set(w * (0.88 + f * 0.3), w * 1.7 * (0.85 + f * 0.38), 1);
      (sp.material as THREE.SpriteMaterial).opacity = 0.7 + f * 0.3;
    }
    if (this.fireLight) {
      this.fireLight.intensity = 24 + Math.sin(t * 11) * 3.2 + Math.random() * 2;
    }
    if (this.fireLight2) {
      this.fireLight2.intensity = 8 + Math.sin(t * 13.5) * 1.4;
    }

    this.orbit += dt * 0.028;
    this.camera.position.x = CAM_POS.x + Math.sin(this.orbit) * 0.22;
    this.camera.position.y = CAM_POS.y + Math.sin(this.orbit * 0.65) * 0.08;
    this.camera.position.z = CAM_POS.z + Math.cos(this.orbit) * 0.12;
    this.camera.lookAt(CAM_LOOK);

    const sel = this.seats[this.selected];
    if (sel?.userData.ring) {
      const ring = sel.userData.ring as THREE.Mesh;
      ring.scale.setScalar(1 + 0.05 * Math.sin(t * 2.6));
    }

    for (const h of this.heroes) {
      if (!h) continue;
      h.setLocomotion({ x: 0, z: 0, speed: 0, running: false });
      h.update(dt);
    }

    this.composer.render();
  }
}

function makeFlameTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 78, 2, 64, 60, 62);
  g.addColorStop(0, "rgba(255,252,235,1)");
  g.addColorStop(0.2, "rgba(255,200,90,0.95)");
  g.addColorStop(0.45, "rgba(255,110,30,0.55)");
  g.addColorStop(0.75, "rgba(255,50,10,0.18)");
  g.addColorStop(1, "rgba(255,20,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

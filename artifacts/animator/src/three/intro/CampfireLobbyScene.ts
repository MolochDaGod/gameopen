/**
 * CampfireLobbyScene — Open `/characters` 4-seat voxel roster.
 *
 * Product rules:
 *  - No dungeon / Ethereal Falls overlook
 *  - Fruzer Encament village behind the plaza; 4 seats **outside the gate**
 *  - Same terrain height (grind encampment walkable front to y = 0)
 *  - Heroes sit idle; hover → stand, glow, tooltip, gesture
 *  - Per-character voxelLook / Avatar Edit head (never steal a global look)
 *  - SI: human ~1.8 m
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAnimatedCharacter } from "../explorer/loader";
import type { Animator } from "../explorer/Animator";
import type { CharacterLook } from "../explorer/types";
import type { VoxelPart } from "../explorer/rig";
import { CHARACTER_HEIGHT_M } from "../types";
import { baseIdToRaceKey, type GenesisHeroOption } from "../../lib/grudoxRoster";
import {
  partOverridesFromSave,
  resolveVoxelAvatar,
  voxelAvatarToLook,
  VOXEL_AVATAR_EVENT,
} from "../explorer/voxelAvatarSave";
import { resolveLobbySeatAvatar } from "../avatar/playerHead";
import {
  CAMPFIRE_TVS,
  campfireTvsUrls,
  encampmentBackdropUrls,
} from "../../lib/productionSystemsPattern";

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

const HERO_H = CHARACTER_HEIGHT_M;
/** Line-up outside the village gate (camera is +Z, camp is −Z). */
const SEAT_XS = [-4.9, -1.65, 1.65, 4.9] as const;
const PLAZA_Z = 5.6;
const ENCAMP_TARGET_W = 54;
const ENCAMP_FRONT_Z = 1.35;
const CAM_POS = new THREE.Vector3(0, 2.92, 13.4);
const CAM_LOOK = new THREE.Vector3(0, 1.12, 3.4);
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
  loader: GLTFLoader,
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

export class CampfireLobbyScene {
  private renderer: THREE.WebGLRenderer;
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
  private gltf = new GLTFLoader();
  private glowMats: Map<number, THREE.MeshStandardMaterial[]> = new Map();
  private seatMode: ("sit" | "stand")[] = ["sit", "sit", "sit", "sit"];
  private gestureCd = 0;
  private camPos = CAM_POS.clone();
  private camLook = CAM_LOOK.clone();
  private plazaZ = PLAZA_Z;

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;

    // Warm dusk farm — no purple dungeon sky
    this.scene.background = new THREE.Color(0x081018);
    this.scene.fog = new THREE.Fog(0x0a141c, 22, 160);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.08, 360);
    this.camera.position.copy(CAM_POS);
    this.camera.lookAt(CAM_LOOK);

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
        const saved = resolveVoxelAvatar(hero.id || null, hero.voxelLook ?? null);
        const headCfg = resolveLobbySeatAvatar(i, {
          characterId: hero.id,
          raceKey,
        });
        let look: CharacterLook = {
          skin: "#c98c5a",
          shirt: "#c0392b",
          pants: "#2e3440",
          hat: "none",
          hatColor: "#b03030",
          avatarHead: true,
          avatarConfig: headCfg,
          ...LOOK_RACES[raceKey],
        };
        let parts: Partial<Record<VoxelPart, string>> | null = null;
        if (saved) {
          look = { ...look, ...voxelAvatarToLook(saved), avatarConfig: headCfg };
          parts = partOverridesFromSave(saved);
        }
        const anim = await createAnimatedCharacter({
          height: HERO_H,
          weapon: "unarmed",
          look,
          classes: ["unarmed"],
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
        anim.root.frustumCulled = false;
        anim.root.traverse((o) => {
          o.frustumCulled = false;
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            m.visible = true;
          }
        });
        dressAvatarMaterials(anim.root);
        anim.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(anim.root);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 0.05) {
          const s = (HERO_H / size.y) * (anim.root.scale.x || 1);
          anim.root.scale.setScalar(THREE.MathUtils.clamp(s, 0.85, 1.25));
          anim.root.updateMatrixWorld(true);
          const b2 = new THREE.Box3().setFromObject(anim.root);
          anim.root.position.y -= b2.min.y;
        }
        this.applySitPose(anim, true);
        const seat = this.seats[i]!;
        seat.add(anim.root);
        this.heroes[i] = anim;
        this.cacheGlowMats(i, anim.root);
        try {
          anim.setLocomotion({ x: 0, z: 0, speed: 0, running: false });
          anim.update(1 / 30);
        } catch {
          /* idle tick optional */
        }
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
    this.renderer.dispose();
  }

  // ── private ────────────────────────────────────────────────────────────

  private onAvatarSaved = (): void => {
    if (this.lastHeroes.length) void this.setHeroes(this.lastHeroes);
  };

  private buildLightsAndGround(): void {
    this.scene.add(new THREE.AmbientLight(0x3a4450, 0.18));
    this.scene.add(new THREE.HemisphereLight(0x6e8498, 0x1c1810, 0.26));
    const sun = new THREE.DirectionalLight(0xd8c4a0, 0.38);
    sun.position.set(10, 18, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.00035;
    const d = 28;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x6a88a8, 0.14);
    rim.position.set(-8, 6, -12);
    this.scene.add(rim);

    const key = new THREE.DirectionalLight(0xffe8cc, 0.22);
    key.position.set(2.5, 3.4, 10);
    this.scene.add(key);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(48, 72),
      new THREE.MeshStandardMaterial({
        color: 0x24382a,
        roughness: 0.96,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.envRoot.add(ground);

    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(7.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x2c2418, roughness: 0.98, metalness: 0 }),
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0.015, PLAZA_Z);
    dirt.name = "plaza_dirt";
    this.envRoot.add(dirt);
  }

  /**
   * Encament village behind the plaza (camera +Z). Scale up, grind front
   * walkable ground to y=0 (same terrain as the 4 seats), gate faces us.
   */
  private async loadEncampmentBackdrop(): Promise<void> {
    try {
      const root = await loadGltfFirst(this.gltf, encampmentBackdropUrls());
      if (!root || this.disposed) return;
      root.name = "encampment-backdrop";
      root.scale.set(1, 1, 1);
      root.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 80 || size.x > 400) {
        root.scale.multiplyScalar(0.01);
        root.updateMatrixWorld(true);
        box.setFromObject(root);
      }
      const width = Math.max(0.5, box.max.x - box.min.x);
      root.scale.multiplyScalar(ENCAMP_TARGET_W / width);
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.x += -center.x;
      root.position.z += -center.z;
      root.position.y -= box.min.y;
      root.updateMatrixWorld(true);
      grindWalkableFrontToGround(root);
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      root.position.z += ENCAMP_FRONT_Z - box.max.z;
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        dressEnvMaterial(m);
      });
      this.envRoot.add(root);
      this.layoutPlazaFromEncampment(box.max.z);
    } catch (e) {
      console.warn("[CampfireLobby] Encament backdrop skip", e);
    }
  }

  /** Seats + fire + camera sit on the road just outside the gate. */
  private layoutPlazaFromEncampment(gateZ: number): void {
    const plazaZ = gateZ + 4.5;
    this.plazaZ = plazaZ;
    for (let i = 0; i < 4; i++) {
      const seat = this.seats[i];
      if (!seat) continue;
      seat.position.set(SEAT_XS[i]!, 0, plazaZ);
      seat.rotation.y = 0;
    }
    const fire = this.scene.getObjectByName("campfire_fx");
    if (fire) fire.position.set(7.6, 0.02, plazaZ + 1.1);
    const dirt = this.envRoot.getObjectByName("plaza_dirt");
    if (dirt) dirt.position.set(0, 0.015, plazaZ);
    this.camLook.set(0, 1.12, plazaZ);
    this.camPos.set(0, 2.95, plazaZ + 8.1);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

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
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            dressEnvMaterial(m);
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

    const pz = this.plazaZ;
    await place("fence.glb", -8.2, pz + 2.2, 0.15, 1.15);
    await place("fence.glb", 8.2, pz + 2.0, Math.PI - 0.12, 1.15);
    await place("fencepost.glb", -8.8, pz + 0.4, 0, 1.2);
    await place("fencepost.glb", 8.6, pz + 0.3, 0, 1.2);
    await place("haybale.glb", -7.4, pz + 3.4, 0.4, 1.0);
    await place("haybale.glb", -8.0, pz + 4.0, -0.3, 0.9);
    await place("watertrough.glb", 7.8, pz + 3.6, -0.5, 1.0);
    await place("soil.glb", 9.2, pz + 5.2, 0.1, 1.3);
    await place("wheat.glb", 9.8, pz + 5.6, 0.2, 1.0);
    await place("pumpkin.glb", 6.6, pz + 4.4, 0.5, 0.7);
    await place("tree.glb", -12.5, pz - 2.0, 0.3, 1.15);
    await place("appletree.glb", 12.2, pz - 1.6, -0.35, 1.1);
    await place("tree.glb", -6.5, pz - 6.5, 0.1, 1.2);

    // Prefer TVS campfire mesh if present (replaces procedural if load ok)
    try {
      const root = await loadGltfFirst(this.gltf, tvsUrl("campfire.glb"));
      if (root) {
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
        root.position.set(7.6, -b2.min.y + 0.02, this.plazaZ + 1.1);
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
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.SpriteMaterial({
        map: flameTex,
        color: i % 2 === 0 ? 0xff8a30 : 0xffc868,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        opacity: 0.72,
      });
      const sp = new THREE.Sprite(mat);
      const w = 0.52 - i * 0.05;
      sp.scale.set(w, w * 1.7, 1);
      sp.position.set((hash2(i, 4) - 0.5) * 0.18, 0.4 + i * 0.09, (hash2(i, 5) - 0.5) * 0.18);
      sp.userData.baseW = w;
      sp.userData.phase = i * 1.15;
      this.fireSprites.push(sp);
      fire.add(sp);
    }
    const light = new THREE.PointLight(0xff7a2e, 3.4, 9, 2);
    light.position.set(0, 1.0, 0);
    light.castShadow = false;
    fire.add(light);
    this.fireLight = light;
    const fill = new THREE.PointLight(0xffaa55, 1.2, 6, 2.2);
    fill.position.set(0, 0.4, 0.7);
    fire.add(fill);
    this.fireLight2 = fill;
    fire.position.set(7.6, 0.02, PLAZA_Z + 1.1);
    this.scene.add(fire);
  }

  private buildSeats(): void {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.position.set(SEAT_XS[i]!, 0, PLAZA_Z);
      g.rotation.y = 0;
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
      // Chair seat is ~0.4 m; sit on the plank, not inside the log stub / Encament dirt.
      anim.root.position.z = 0.08;
      anim.root.position.y = 0.42;
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
        m.emissiveIntensity = 0.12;
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
      (sp.material as THREE.SpriteMaterial).opacity = 0.55 + f * 0.18;
    }
    if (this.fireLight) {
      this.fireLight.intensity = 3.1 + Math.sin(t * 8) * 0.35;
    }
    if (this.fireLight2) {
      this.fireLight2.intensity = 1.05 + Math.sin(t * 10) * 0.18;
    }

    this.orbit += dt * 0.022;
    this.camera.position.x = this.camPos.x + Math.sin(this.orbit) * 0.16;
    this.camera.position.y = this.camPos.y + Math.sin(this.orbit * 0.65) * 0.05;
    this.camera.position.z = this.camPos.z + Math.cos(this.orbit) * 0.08;
    this.camera.lookAt(this.camLook);

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

    this.renderer.render(this.scene, this.camera);
  }
}

/** Sink encampment so sampled front-road height shares y=0 with the plaza. */
function grindWalkableFrontToGround(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const hits: number[] = [];
  const zFront = box.max.z - Math.min(2.4, (box.max.z - box.min.z) * 0.08);
  for (let i = 0; i < 9; i++) {
    const x = THREE.MathUtils.lerp(box.min.x + 3, box.max.x - 3, i / 8);
    origin.set(x, box.max.y + 4, zFront);
    ray.set(origin, down);
    const rec = ray.intersectObject(root, true);
    if (rec[0] && Number.isFinite(rec[0].point.y)) hits.push(rec[0].point.y);
  }
  if (!hits.length) {
    root.position.y -= box.min.y;
    return;
  }
  hits.sort((a, b) => a - b);
  const med = hits[Math.floor(hits.length / 2)]!;
  root.position.y -= med;
}

function dressEnvMaterial(mesh: THREE.Mesh): void {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const raw of list) {
    const m = raw as THREE.MeshStandardMaterial;
    if (!m || !m.isMeshStandardMaterial) continue;
    m.metalness = Math.min(m.metalness ?? 0, 0.12);
    m.roughness = Math.max(m.roughness ?? 0.75, 0.68);
    m.envMapIntensity = 0.28;
    if (m.emissiveIntensity > 0.2) m.emissiveIntensity = 0.08;
    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
  }
}

function dressAvatarMaterials(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of list) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || !m.isMeshStandardMaterial) continue;
      m.metalness = 0;
      m.roughness = Math.max(m.roughness ?? 0.82, 0.72);
      m.envMapIntensity = 0.22;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    }
  });
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

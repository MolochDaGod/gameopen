/**
 * Ethereal Falls campfire — GRUDOX 4-slot hero backdrop.
 *
 * Atmosphere inspired by the play-shell intro (torch, mist, bloom) plus a
 * ring of procedural Explorers (Avatar Edit heads when saved). Used as the
 * Characters GRUDOX main-page background: select a seat → fleet character.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createTorch, type TorchHandle } from "../fx/torchFlame";
import { createAnimatedCharacter } from "../explorer/loader";
import type { Animator } from "../explorer/Animator";
import type { CharacterLook } from "../explorer/types";
import { CHARACTER_HEIGHT_M } from "../types";
import { baseIdToRaceKey, type GenesisHeroOption } from "../../lib/grudoxRoster";
import { EtherealSky } from "../lobby/etherealSky";

export interface CampfireSlotView {
  index: number;
  hero: GenesisHeroOption | null;
  worldPos: THREE.Vector3;
}

const SEAT_RADIUS = 2.35;
const LOOK_RACES: Record<string, Partial<CharacterLook>> = {
  human: { skin: "#c98c5a", shirt: "#3d5a80", pants: "#2e3440", cape: true, capeColor: "#1a2740" },
  orc: { skin: "#5a8f3a", shirt: "#4a3020", pants: "#2a2018", cape: false },
  undead: { skin: "#9aa8b0", shirt: "#2a2038", pants: "#1a1520", cape: true, capeColor: "#2a1840" },
  barbarian: { skin: "#c07040", shirt: "#8b3a1a", pants: "#3a2818", cape: false },
  dwarf: { skin: "#c09060", shirt: "#5a4a30", pants: "#3a3028", cape: false },
  elf: { skin: "#e8d0b0", shirt: "#2a6050", pants: "#1a3028", cape: true, capeColor: "#143028" },
};

export class CampfireLobbyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private torch: TorchHandle | null = null;
  private mist?: THREE.Points;
  private ethereal: EtherealSky | null = null;
  private ro?: ResizeObserver;
  private heroes: (Animator | null)[] = [null, null, null, null];
  private seats: THREE.Group[] = [];
  private labels: { mesh: THREE.Sprite; name: string }[] = [];
  private selected = 0;
  private orbit = 0;
  private onSelect: ((index: number) => void) | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor(
    private canvas: HTMLCanvasElement,
    opts?: { onSelect?: (index: number) => void },
  ) {
    this.onSelect = opts?.onSelect ?? null;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Night clearing + fog (EtherealSky is fog-immune, like charactersgrudox lobby)
    this.scene.background = new THREE.Color(0x05080f);
    this.scene.fog = new THREE.FogExp2(0x05080f, 0.048);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 80);
    this.camera.position.set(0, 2.8, 7.2);
    this.camera.lookAt(0, 1.1, 0);

    this.buildEnvironment();
    this.buildSeats();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.72, 0.55, 0.22));
    this.composer.addPass(new OutputPass());
    this.composer.setSize(w, h);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener("pointerdown", this.onPointerDown);

    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);
  }

  /** Load up to 4 roster heroes as Explorer rigs around the fire. */
  async setHeroes(heroes: GenesisHeroOption[]): Promise<void> {
    if (this.disposed) return;
    // Clear previous
    for (let i = 0; i < 4; i++) {
      const prev = this.heroes[i];
      if (prev) {
        this.seats[i]?.remove(prev.root);
        prev.dispose();
        this.heroes[i] = null;
      }
    }
    for (let i = 0; i < 4; i++) {
      const hero = heroes[i] ?? null;
      this.updateLabel(i, hero?.name ?? (i === 0 ? "Empty seat" : "—"));
      if (!hero) continue;
      try {
        const raceKey = baseIdToRaceKey(hero.baseId) || hero.raceKey;
        const look: CharacterLook = {
          skin: "#c98c5a",
          shirt: "#c0392b",
          pants: "#2e3440",
          hat: "none",
          hatColor: "#b03030",
          avatarHead: true, // Avatar Edit modular head when saved
          ...LOOK_RACES[raceKey],
        };
        const anim = await createAnimatedCharacter({
          height: CHARACTER_HEIGHT_M * 0.92,
          weapon: "sword",
          look,
          classes: ["unarmed", "sword"],
        });
        if (this.disposed) {
          anim.dispose();
          return;
        }
        anim.setWeapon("sword", true);
        anim.root.position.set(0, 0, 0);
        // Face the campfire (origin)
        const seat = this.seats[i]!;
        anim.root.rotation.y = Math.PI; // outward seats face inward after seat yaw
        seat.add(anim.root);
        this.heroes[i] = anim;
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
      mat.color.setHex(i === this.selected ? 0x5fe0ff : 0x1a3048);
      mat.opacity = i === this.selected ? 0.85 : 0.35;
    }
  }

  getSelected(): number {
    return this.selected;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.ro?.disconnect();
    for (const h of this.heroes) h?.dispose();
    this.heroes = [null, null, null, null];
    this.torch?.dispose();
    this.ethereal?.dispose();
    this.ethereal = null;
    this.composer.dispose();
    this.renderer.dispose();
  }

  // ── private ────────────────────────────────────────────────────────────

  private buildEnvironment(): void {
    // Ground disc — dark stone at falls overlook
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ color: 0x0c121c, roughness: 0.96, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Soft ethereal pool under fire
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshStandardMaterial({
        color: 0x1a4060,
        emissive: 0x0a2038,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.2,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    this.scene.add(pool);

    this.scene.add(new THREE.AmbientLight(0x1a3050, 0.45));
    const moon = new THREE.DirectionalLight(0xa8c8ff, 0.55);
    moon.position.set(-4, 8, -2);
    this.scene.add(moon);

    // Campfire torch (dying = atmospheric)
    createTorch({ targetHeight: 1.4, dying: 0.25, lightIntensity: 14, flameScale: 1.35 })
      .then((t) => {
        if (this.disposed) {
          t.dispose();
          return;
        }
        this.torch = t;
        t.group.position.set(0, 0, 0);
        t.light.castShadow = true;
        this.scene.add(t.group);
      })
      .catch(() => {
        /* torch optional */
      });

    this.mist = this.buildMist();
    this.scene.add(this.mist);

    // Canon Ethereal Falls skyline (charactersgrudox Lobby SSOT)
    try {
      this.ethereal = new EtherealSky(this.scene);
    } catch (err) {
      console.warn("[CampfireLobby] EtherealSky init failed", err);
    }
  }

  private buildSeats(): void {
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const g = new THREE.Group();
      g.position.set(Math.cos(ang) * SEAT_RADIUS, 0, Math.sin(ang) * SEAT_RADIUS);
      g.rotation.y = ang + Math.PI; // face campfire
      g.userData.slotIndex = i;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.68, 32),
        new THREE.MeshBasicMaterial({
          color: 0x1a3048,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      g.userData.ring = ring;
      g.add(ring);

      // Log seat
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.95 }),
      );
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.12, 0.35);
      log.castShadow = true;
      g.add(log);

      this.scene.add(g);
      this.seats.push(g);

      const label = this.makeLabel("…");
      label.position.set(0, 2.35, 0);
      g.add(label);
      this.labels.push({ mesh: label, name: "…" });
    }
  }

  private makeLabel(text: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "rgba(6,12,20,0.72)";
    ctx.fillRect(8, 8, 240, 48);
    ctx.fillStyle = "#cfe8ff";
    ctx.font = "bold 22px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.slice(0, 18), 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.4, 0.35, 1);
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
    ctx.fillStyle = "rgba(6,12,20,0.72)";
    ctx.fillRect(8, 8, 240, 48);
    ctx.fillStyle = i === this.selected ? "#5fe0ff" : "#cfe8ff";
    ctx.font = "bold 22px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 18), 128, 32);
    tex.needsUpdate = true;
  }

  private buildMist(): THREE.Points {
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x88aacc,
      size: 0.12,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  private onPointerDown = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.seats, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (typeof o.userData.slotIndex === "number") {
          this.setSelected(o.userData.slotIndex);
          this.onSelect?.(o.userData.slotIndex);
          return;
        }
        o = o.parent;
      }
    }
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

    this.torch?.update(dt);
    this.ethereal?.update(t);

    // Gentle orbit camera — overlook toward the falls (-Z)
    this.orbit += dt * 0.06;
    const r = 7.4;
    this.camera.position.x = Math.sin(this.orbit) * r * 0.32;
    this.camera.position.z = 7.2 + Math.cos(this.orbit) * 0.35;
    this.camera.position.y = 2.7 + Math.sin(this.orbit * 0.7) * 0.12;
    this.camera.lookAt(0, 1.15, -2.5);

    if (this.mist) {
      this.mist.rotation.y = t * 0.02;
    }

    for (const h of this.heroes) {
      if (!h) continue;
      h.setLocomotion({ x: 0, z: 0, speed: 0, running: false });
      h.update(dt);
    }

    this.composer.render();
  }
}

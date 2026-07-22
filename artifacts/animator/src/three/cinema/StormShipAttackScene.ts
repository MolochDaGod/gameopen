/**
 * Production Open intro — "Storm Ship Attack" / island-3d cinema.
 *
 * Storm ocean shader, stylized pirate ship, mutant stingray (stonewisp),
 * grudge-style crew actors, player hero jumps into the sea as the beast
 * tears the boat. Mystical post grade.
 *
 * Assets (prod bake meshopt):
 *  - models/cinema/stylized-pirate-ship.prod.glb
 *  - models/creatures/ocean/mutant-stingray.prod.glb
 *  - hero mesh candidates (grudge / introgamer)
 */
import * as THREE from "three";
import CameraControls from "camera-controls";
import { createMysticalComposer, type MysticalComposer } from "../fx/postfx";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { prepObjectMaterials } from "../texturePrep";
import { bindTextureAnisotropy } from "../texturePrep";
import { CHARACTER_HEIGHT_M } from "../types";
import {
  createStormWater,
  enhanceBeastMaterials,
  enhanceShipMaterials,
  type StormWaterHandle,
} from "./stormWater";

CameraControls.install({ THREE });

export const STORM_SHIP_ASSETS = {
  ship: [
    "models/cinema/stylized-pirate-ship.prod.glb",
    "models/cinema/stylized-pirate-ship.glb",
    "models/pirate/black-tide.glb",
  ],
  stingray: [
    "models/creatures/ocean/mutant-stingray.prod.glb",
    "models/creatures/ocean/mutant-stingray.glb",
  ],
  heroes: [
    "models/introgamer.glb",
    "models/landing/astrocreeper.glb",
    "models/astrocreeper.glb",
    "models/racalvin.glb",
    "models/karate-boss.glb",
    "models/orc.glb",
  ],
} as const;

type CamKey = { pos: [number, number, number]; look: [number, number, number]; fov?: number };

const BEATS: { t: number; cam: CamKey; caption: string; sub: string }[] = [
  {
    t: 0,
    cam: { pos: [28, 12, 32], look: [0, 3, 0], fov: 42 },
    caption: "PRODUCTION OPEN · ISLAND-3D",
    sub: "Storm Ship Attack",
  },
  {
    t: 3.2,
    cam: { pos: [14, 6, 18], look: [0, 4, -2], fov: 40 },
    caption: "THE BLACK TIDE",
    sub: "Grudge crew holds the deck",
  },
  {
    t: 6.8,
    cam: { pos: [-18, 4, 12], look: [2, 1, -4], fov: 38 },
    caption: "SOMETHING BENEATH",
    sub: "Stonewisp mutant stingray",
  },
  {
    t: 11,
    cam: { pos: [8, 5, 10], look: [0, 2, 0], fov: 36 },
    caption: "TEAR THE HULL",
    sub: "Follow your hero into the sea",
  },
  {
    t: 15.5,
    cam: { pos: [4, 2.5, 14], look: [0, 0.5, -6], fov: 40 },
    caption: "SURVIVE THE STORM",
    sub: "open.grudge-studio.com",
  },
];

function plantHeight(obj: THREE.Object3D, h: number): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = h / Math.max(size.y, 0.001);
  obj.scale.setScalar(s);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= b2.min.y;
}

function fitShip(obj: THREE.Object3D, targetLength = 22): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 0.001);
  obj.scale.setScalar(targetLength / span);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= b2.min.y;
  // Seat hull slightly in water
  obj.position.y -= 0.35;
}

export type StormShipCallbacks = {
  onCaption?: (caption: string, sub: string) => void;
  onComplete?: () => void;
};

export class StormShipAttackScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: CameraControls;
  private fx: MysticalComposer | null = null;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro?: ResizeObserver;
  private water: StormWaterHandle | null = null;
  private ship = new THREE.Group();
  private rayRoot = new THREE.Group();
  private crewRoot = new THREE.Group();
  private playerRoot = new THREE.Group();
  private rain?: THREE.Points;
  private rainVel = new Float32Array(0);
  private debris: THREE.Mesh[] = [];
  private mixers: THREE.AnimationMixer[] = [];
  private time = 0;
  private beatIdx = -1;
  private lightning = 0;
  private storm = 0.9;
  private shipBreak = 0;
  private completed = false;
  private duration = 20;

  constructor(
    private canvas: HTMLCanvasElement,
    private cbs: StormShipCallbacks = {},
  ) {
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    bindTextureAnisotropy(this.renderer);

    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = new THREE.FogExp2(0x0a1018, 0.018);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 500);
    this.controls = new CameraControls(this.camera, canvas);
    this.controls.smoothTime = 1.4;
    this.controls.mouseButtons.left = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.right = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.middle = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.wheel = CameraControls.ACTION.NONE;
    this.controls.touches.one = CameraControls.ACTION.NONE;
    this.controls.touches.two = CameraControls.ACTION.NONE;
    this.controls.touches.three = CameraControls.ACTION.NONE;

    const k0 = BEATS[0]!.cam;
    this.controls.setLookAt(...k0.pos, ...k0.look, false);

    this.scene.add(this.ship, this.rayRoot, this.crewRoot, this.playerRoot);
    this.buildStage();
    void this.loadAll();

    try {
      this.fx = createMysticalComposer(this.renderer, this.scene, this.camera, {
        bloomIntensity: 0.95,
        bloomThreshold: 0.22,
        bloomRadius: 0.7,
        saturation: 0.08,
        hue: -0.02,
        vignetteDarkness: 0.72,
        chromatic: 0.0012,
        grain: 0.09,
      });
      this.fx.setSize(w, h);
    } catch {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.fx = null;
    }

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);
  }

  skip(): void {
    this.time = this.duration;
    this.fireComplete();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.water?.dispose();
    if (this.rain) {
      this.rain.geometry.dispose();
      (this.rain.material as THREE.PointsMaterial).dispose();
    }
    for (const d of this.debris) {
      d.geometry.dispose();
      (d.material as THREE.Material).dispose();
    }
    for (const m of this.mixers) m.stopAllAction();
    this.fx?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // ── build ──────────────────────────────────────────────────────────

  private buildStage(): void {
    // Storm hemisphere light
    this.scene.add(new THREE.AmbientLight(0x1a2438, 0.35));
    const hemi = new THREE.HemisphereLight(0x4a6080, 0x0a1018, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0x88aacc, 0.65);
    key.position.set(20, 40, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = key.shadow.camera.bottom = -40;
    key.shadow.camera.right = key.shadow.camera.top = 40;
    this.scene.add(key);

    // Storm dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uFlash: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          uniform float uTime;
          uniform float uFlash;
          float n(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
          }
          void main() {
            float h = vDir.y * 0.5 + 0.5;
            vec3 low = vec3(0.04, 0.06, 0.09);
            vec3 mid = vec3(0.08, 0.10, 0.14);
            vec3 high = vec3(0.12, 0.14, 0.18);
            vec3 col = mix(low, mid, smoothstep(0.0, 0.45, h));
            col = mix(col, high, smoothstep(0.4, 1.0, h));
            // cloud bands
            float c = n(vDir.xz * 3.0 + uTime * 0.02);
            col *= 0.75 + 0.25 * c;
            col += vec3(0.55, 0.65, 0.9) * uFlash;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    dome.name = "StormDome";
    this.scene.add(dome);
    (this as unknown as { _dome: THREE.Mesh })._dome = dome;

    this.water = createStormWater(320, 140);
    this.scene.add(this.water.mesh);

    // Rain
    const N = 4000;
    const pos = new Float32Array(N * 3);
    this.rainVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 40 + 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      this.rainVel[i] = 12 + Math.random() * 18;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xaabbcc,
        size: 0.06,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  private async loadAll(): Promise<void> {
    const loader = sharedGltfLoader();
    // Ship
    try {
      const { scene, animations } = await loadGltfFirst([...STORM_SHIP_ASSETS.ship], loader, {
        prepMaterials: true,
      });
      if (this.disposed) return;
      const root = scene.clone(true);
      prepObjectMaterials(root, { neutralizeMetal: true });
      enhanceShipMaterials(root);
      fitShip(root, 24);
      this.ship.add(root);
      if (animations?.length) {
        const mix = new THREE.AnimationMixer(root);
        mix.clipAction(animations[0]!).play();
        this.mixers.push(mix);
      }
    } catch (e) {
      console.warn("[StormShip] ship load failed", e);
      // Fallback hull
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(18, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.7 }),
      );
      hull.position.y = 1.5;
      this.ship.add(hull);
    }

    // Stingray
    try {
      const { scene, animations } = await loadGltfFirst([...STORM_SHIP_ASSETS.stingray], loader, {
        prepMaterials: true,
      });
      if (this.disposed) return;
      const root = scene.clone(true);
      prepObjectMaterials(root, { neutralizeMetal: true });
      enhanceBeastMaterials(root);
      // Large sea beast ~12–16 m wingspan
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z, 0.001);
      root.scale.setScalar(14 / span);
      root.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(root);
      root.position.y -= b2.min.y;
      this.rayRoot.add(root);
      this.rayRoot.position.set(18, -4, -8);
      if (animations?.length) {
        const mix = new THREE.AnimationMixer(root);
        const clip =
          animations.find((c) => /swim|fly|idle|move|loop/i.test(c.name)) ?? animations[0]!;
        const act = mix.clipAction(clip);
        act.setEffectiveTimeScale(1.1);
        act.play();
        this.mixers.push(mix);
      }
    } catch (e) {
      console.warn("[StormShip] stingray load failed", e);
    }

    // Crew + player heroes
    await this.spawnActors(loader);
  }

  private async spawnActors(
    loader: ReturnType<typeof sharedGltfLoader>,
  ): Promise<void> {
    const deckY = 3.2;
    const slots: { x: number; z: number; player?: boolean }[] = [
      { x: 0.5, z: 1.2, player: true },
      { x: -1.8, z: 0.4 },
      { x: 1.6, z: -0.8 },
      { x: -0.4, z: -1.5 },
    ];
    for (let i = 0; i < slots.length; i++) {
      if (this.disposed) return;
      try {
        const { scene, animations } = await loadGltfFirst(
          [...STORM_SHIP_ASSETS.heroes],
          loader,
          { prepMaterials: true },
        );
        if (this.disposed) return;
        const root = scene.clone(true);
        prepObjectMaterials(root, { neutralizeMetal: true });
        plantHeight(root, CHARACTER_HEIGHT_M * (slots[i]!.player ? 1 : 0.95));
        root.position.set(slots[i]!.x, deckY, slots[i]!.z);
        root.rotation.y = Math.PI + (Math.random() - 0.5) * 0.4;
        const parent = slots[i]!.player ? this.playerRoot : this.crewRoot;
        parent.add(root);
        if (animations?.length) {
          const mix = new THREE.AnimationMixer(root);
          const clip =
            animations.find((c) => /idle|stand|breath|combat/i.test(c.name)) ??
            animations[0]!;
          mix.clipAction(clip).play();
          this.mixers.push(mix);
        }
      } catch {
        /* skip actor */
      }
    }
  }

  private spawnDebris(): void {
    if (this.debris.length) return;
    for (let i = 0; i < 14; i++) {
      const g = new THREE.BoxGeometry(
        0.3 + Math.random() * 0.9,
        0.12 + Math.random() * 0.25,
        0.2 + Math.random() * 0.6,
      );
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.08, 0.35, 0.25 + Math.random() * 0.15),
          roughness: 0.85,
        }),
      );
      m.position.set(
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 2,
        (Math.random() - 0.5) * 4,
      );
      m.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 6,
      );
      m.userData.spin = new THREE.Vector3(
        Math.random() * 4,
        Math.random() * 4,
        Math.random() * 4,
      );
      this.ship.add(m);
      this.debris.push(m);
    }
  }

  // ── update ─────────────────────────────────────────────────────────

  private applyBeats(): void {
    let idx = 0;
    for (let i = 0; i < BEATS.length; i++) {
      if (BEATS[i]!.t <= this.time) idx = i;
    }
    if (idx !== this.beatIdx) {
      this.beatIdx = idx;
      const b = BEATS[idx]!;
      this.controls.setLookAt(...b.cam.pos, ...b.cam.look, true);
      if (b.cam.fov) {
        this.camera.fov = b.cam.fov;
        this.camera.updateProjectionMatrix();
      }
      this.cbs.onCaption?.(b.caption, b.sub);
    }
  }

  private updateStory(dt: number): void {
    // Ship rock
    const rock = Math.sin(this.time * 1.4) * 0.06 + Math.sin(this.time * 2.7) * 0.03;
    const roll = Math.cos(this.time * 1.1) * 0.05;
    this.ship.rotation.z = roll + this.shipBreak * 0.45;
    this.ship.rotation.x = rock * 0.6 + this.shipBreak * 0.25;
    this.ship.position.y = Math.sin(this.time * 1.3) * 0.25 - this.shipBreak * 1.8;

    // Stingray approach & attack
    const attackT = THREE.MathUtils.clamp((this.time - 6.5) / 6, 0, 1);
    const dive = Math.sin(attackT * Math.PI);
    this.rayRoot.position.x = THREE.MathUtils.lerp(22, -6, attackT);
    this.rayRoot.position.z = THREE.MathUtils.lerp(-10, 2, attackT);
    this.rayRoot.position.y = THREE.MathUtils.lerp(-5, 1.5, dive) - (1 - dive) * 2;
    this.rayRoot.rotation.y = -Math.PI * 0.5 + attackT * 0.8;
    this.rayRoot.rotation.z = Math.sin(this.time * 2.2) * 0.12;
    this.rayRoot.rotation.x = Math.sin(attackT * Math.PI) * 0.35;

    if (this.time > 11 && this.shipBreak < 1) {
      this.shipBreak = Math.min(1, this.shipBreak + dt * 0.35);
      this.spawnDebris();
      this.lightning = 1;
    }

    // Debris physics-ish
    for (const d of this.debris) {
      const vel = d.userData.vel as THREE.Vector3;
      const spin = d.userData.spin as THREE.Vector3;
      vel.y -= 4.5 * dt;
      d.position.addScaledVector(vel, dt);
      d.rotation.x += spin.x * dt;
      d.rotation.y += spin.y * dt;
      if (d.position.y < 0.2) {
        d.position.y = 0.2;
        vel.y *= -0.25;
        vel.x *= 0.9;
        vel.z *= 0.9;
      }
    }

    // Actors: stand then leap into sea after hull tear
    const flee = THREE.MathUtils.clamp((this.time - 12.5) / 4, 0, 1);
    if (flee > 0) {
      this.playerRoot.position.x = flee * 2.5;
      this.playerRoot.position.y = Math.sin(flee * Math.PI) * 1.8 - flee * 3.5;
      this.playerRoot.position.z = flee * 6;
      this.playerRoot.rotation.x = flee * 0.6;
      this.crewRoot.position.x = -flee * 3;
      this.crewRoot.position.y = Math.sin(flee * Math.PI) * 1.4 - flee * 3.2;
      this.crewRoot.position.z = flee * 5;
      this.crewRoot.rotation.x = flee * 0.5;
    }

    // Lightning
    if (Math.random() < 0.008 * this.storm) this.lightning = 1;
    this.lightning = Math.max(0, this.lightning - dt * 2.5);
    const dome = (this as unknown as { _dome?: THREE.Mesh })._dome;
    if (dome) {
      const mat = dome.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = this.time;
      mat.uniforms.uFlash.value = this.lightning;
    }
  }

  private updateRain(dt: number): void {
    if (!this.rain) return;
    const attr = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < this.rainVel.length; i++) {
      arr[i * 3 + 1] -= this.rainVel[i]! * dt;
      arr[i * 3] += dt * 2.5; // wind
      if (arr[i * 3 + 1]! < 0) {
        arr[i * 3 + 1] = 25 + Math.random() * 15;
        arr[i * 3] = (Math.random() - 0.5) * 80;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
    }
    attr.needsUpdate = true;
  }

  private fireComplete(): void {
    if (this.completed) return;
    this.completed = true;
    this.cbs.onComplete?.();
  }

  private animate(): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    this.applyBeats();
    this.updateStory(dt);
    this.updateRain(dt);
    this.water?.update(this.time, this.storm);
    for (const m of this.mixers) m.update(dt);
    this.controls.update(dt);

    if (this.fx) this.fx.render(dt);
    else this.renderer.render(this.scene, this.camera);

    if (this.time >= this.duration) this.fireComplete();
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.fx?.setSize(w, h);
  }
}

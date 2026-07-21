/**
 * Production cinema stage — mystical post, torch/embers, character/shell assets,
 * timed camera keys from CinemaManifest. Pure three.js (no R3F).
 */
import * as THREE from "three";
import CameraControls from "camera-controls";
import { createMysticalComposer, type MysticalComposer } from "../fx/postfx";
import { createTorch, type TorchHandle } from "../fx/torchFlame";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { CHARACTER_HEIGHT_M } from "../types";
import { CinemaTimeline } from "./CinemaTimeline";
import type { CinemaAssetRef, CinemaManifest, CinemaTimelineState } from "./types";

CameraControls.install({ THREE });

export type ProductionCinemaCallbacks = {
  onState?: (state: CinemaTimelineState) => void;
  onComplete?: () => void;
  onBeat?: (index: number, caption: string) => void;
};

function plantHeight(obj: THREE.Object3D, targetHeight: number): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = targetHeight / Math.max(size.y, 0.001);
  obj.scale.setScalar(s);
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
}

function prepMeshes(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (!mat) continue;
      if ("map" in mat && mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
}

export class ProductionCinemaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: CameraControls;
  private fx: MysticalComposer | null = null;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private torch: TorchHandle | null = null;
  private embers?: THREE.Points;
  private emberVel = new Float32Array(0);
  private ro?: ResizeObserver;
  private timeline: CinemaTimeline;
  private lastBeatIndex = -1;
  private completedFired = false;
  private assetRoot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private manifest: CinemaManifest,
    private cbs: ProductionCinemaCallbacks = {},
  ) {
    this.timeline = new CinemaTimeline(manifest);
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

    this.scene.background = new THREE.Color(manifest.background);
    this.scene.fog = new THREE.FogExp2(manifest.background, manifest.fogDensity);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.08, 400);
    this.controls = new CameraControls(this.camera, canvas);
    this.controls.smoothTime = 1.35;
    this.controls.draggingSmoothTime = 1.35;
    this.controls.mouseButtons.left = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.right = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.middle = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.wheel = CameraControls.ACTION.NONE;
    this.controls.touches.one = CameraControls.ACTION.NONE;
    this.controls.touches.two = CameraControls.ACTION.NONE;
    this.controls.touches.three = CameraControls.ACTION.NONE;

    const b0 = manifest.beats[0]?.cam;
    if (b0) {
      this.controls.setLookAt(
        b0.pos[0],
        b0.pos[1],
        b0.pos[2],
        b0.look[0],
        b0.look[1],
        b0.look[2],
        false,
      );
      if (b0.fov) {
        this.camera.fov = b0.fov;
        this.camera.updateProjectionMatrix();
      }
    }

    this.scene.add(this.assetRoot);
    this.buildAtmosphere();
    void this.loadAssets(manifest.assets);

    try {
      const grade =
        manifest.post === "subtle"
          ? {
              bloomIntensity: 0.55,
              bloomThreshold: 0.45,
              bloomRadius: 0.55,
              saturation: 0.06,
              vignetteDarkness: 0.3,
              chromatic: 0.0002,
              grain: 0.02,
            }
          : {
              bloomIntensity: 1.2,
              bloomThreshold: 0.15,
              bloomRadius: 0.76,
              saturation: 0.18,
              hue: 0.03,
              vignetteDarkness: 0.65,
              chromatic: 0.001,
              grain: 0.065,
            };
      if (manifest.post !== "raw") {
        this.fx = createMysticalComposer(this.renderer, this.scene, this.camera, grade);
        this.fx.setSize(w, h);
      } else {
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
      }
    } catch {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.fx = null;
    }

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);
  }

  getManifest(): CinemaManifest {
    return this.manifest;
  }

  getState(): CinemaTimelineState {
    return this.timeline.snapshot();
  }

  skip(): void {
    const s = this.timeline.skip();
    this.cbs.onState?.(s);
    if (s.finished) this.fireComplete();
  }

  continueBeat(): void {
    this.cbs.onState?.(this.timeline.continue());
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.torch?.dispose();
    this.mixer?.stopAllAction();
    this.mixer = null;
    if (this.embers) {
      this.embers.geometry.dispose();
      const m = this.embers.material as THREE.PointsMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.assetRoot.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.fx?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // ── private ──────────────────────────────────────────────────────────

  private buildAtmosphere(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 56),
      new THREE.MeshStandardMaterial({
        color: 0x0a0c12,
        roughness: 0.94,
        metalness: 0.05,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(new THREE.AmbientLight(0x14213a, 0.28));
    const key = new THREE.DirectionalLight(0xc8d8ff, 0.55);
    key.position.set(4, 10, 6);
    key.castShadow = true;
    this.scene.add(key);

    if (this.manifest.torch) {
      createTorch({
        targetHeight: 2.15,
        dying: 0.5,
        lightIntensity: 9,
        flameScale: 1.12,
      })
        .then((t) => {
          if (this.disposed) {
            t.dispose();
            return;
          }
          this.torch = t;
          t.light.castShadow = true;
          this.scene.add(t.group);
        })
        .catch(() => {});
    }
    if (this.manifest.embers !== false && this.manifest.torch) {
      this.embers = this.buildEmbers();
      this.scene.add(this.embers);
    }
  }

  private async loadAssets(assets: CinemaAssetRef[]): Promise<void> {
    const loader = sharedGltfLoader();
    for (const ref of assets) {
      if (this.disposed) return;
      try {
        const { scene, animations } = await loadGltfFirst([...ref.meshKeys], loader, {
          prepMaterials: true,
        });
        if (this.disposed) return;
        const root = scene.clone(true);
        prepMeshes(root);
        const h =
          ref.heightM ??
          (ref.kind === "character" ? CHARACTER_HEIGHT_M : ref.kind === "world_boss" ? 3.2 : 4);
        if (ref.kind === "character" || ref.kind === "world_boss" || ref.kind === "hero_stage") {
          plantHeight(root, h);
        } else if (ref.kind === "shell") {
          // Soft fit: longest horizontal span ≈ heightM when provided as footprint hint
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const span = Math.max(size.x, size.z, 0.001);
          const target = ref.heightM ?? 24;
          root.scale.setScalar(target / span);
          root.updateMatrixWorld(true);
          const b2 = new THREE.Box3().setFromObject(root);
          root.position.y -= b2.min.y;
        }
        if (ref.position) root.position.add(new THREE.Vector3(...ref.position));
        if (ref.rotationY != null) root.rotation.y = ref.rotationY;
        this.assetRoot.add(root);
        if (animations?.length) {
          this.mixer = new THREE.AnimationMixer(root);
          const clip =
            animations.find((c) => /idle|stand|breath/i.test(c.name)) ?? animations[0]!;
          this.mixer.clipAction(clip).play();
        }
      } catch (err) {
        console.warn("[ProductionCinema] asset failed", ref.meshKeys[0], err);
      }
    }
  }

  private emberTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,240,200,1)");
    grd.addColorStop(0.35, "rgba(255,140,50,0.75)");
    grd.addColorStop(1, "rgba(255,60,10,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildEmbers(): THREE.Points {
    const N = 140;
    const pos = new Float32Array(N * 3);
    this.emberVel = new Float32Array(N);
    for (let i = 0; i < N; i++) this.resetEmber(pos, i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff8a3c,
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: this.emberTexture(),
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  private resetEmber(arr: Float32Array, i: number): void {
    const r = Math.random() * 0.4;
    const a = Math.random() * Math.PI * 2;
    arr[i * 3] = Math.cos(a) * r;
    arr[i * 3 + 1] = 1.85 + Math.random() * 0.35;
    arr[i * 3 + 2] = Math.sin(a) * r;
    this.emberVel[i] = 0.35 + Math.random() * 0.85;
  }

  private updateEmbers(dt: number): void {
    if (!this.embers) return;
    const attr = this.embers.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const wob = performance.now() * 0.001;
    for (let i = 0; i < this.emberVel.length; i++) {
      arr[i * 3 + 1] += this.emberVel[i] * dt;
      arr[i * 3] += Math.sin(wob + i) * 0.002;
      if (arr[i * 3 + 1] > 4.5) this.resetEmber(arr, i);
    }
    attr.needsUpdate = true;
  }

  private applyBeatCam(state: CinemaTimelineState): void {
    const cam = state.beat?.cam;
    if (!cam) return;
    if (state.beatIndex !== this.lastBeatIndex) {
      this.controls.setLookAt(
        cam.pos[0],
        cam.pos[1],
        cam.pos[2],
        cam.look[0],
        cam.look[1],
        cam.look[2],
        true,
      );
      if (cam.fov != null) {
        this.camera.fov = cam.fov;
        this.camera.updateProjectionMatrix();
      }
      this.cbs.onBeat?.(state.beatIndex, state.caption);
      this.lastBeatIndex = state.beatIndex;
    }
  }

  private fireComplete(): void {
    if (this.completedFired || this.manifest.loop) return;
    this.completedFired = true;
    this.cbs.onComplete?.();
  }

  private animate(): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const state = this.timeline.update(dt);
    this.applyBeatCam(state);
    this.cbs.onState?.(state);
    if (state.finished) this.fireComplete();

    this.controls.update(dt);
    this.torch?.update(dt);
    this.updateEmbers(dt);
    this.mixer?.update(dt);

    if (this.fx) this.fx.render(dt);
    else this.renderer.render(this.scene, this.camera);
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

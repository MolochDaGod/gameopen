/**
 * Opening cinematic — a dark chamber with the dying torch, rising embers, and a
 * slow, eased camera move (yomotsu `camera-controls`) with UnrealBloom glow.
 * Rendered behind the door-select landing as an atmospheric backdrop.
 */
import * as THREE from "three";
import CameraControls from "camera-controls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createTorch, type TorchHandle } from "../fx/torchFlame";

CameraControls.install({ THREE });

/** [posX, posY, posZ, targetX, targetY, targetZ] cinematic viewpoints. */
type Key = [number, number, number, number, number, number];

const KEYS: Key[] = [
  [4.6, 1.1, 5.4, 0, 1.5, 0],
  [-3.6, 0.7, 4.9, 0, 1.4, 0],
  [2.4, 2.7, 3.1, 0, 1.7, 0],
  [0.2, 1.0, 3.0, 0, 1.5, 0],
];
const DWELL = 5.5; // seconds per viewpoint

export class IntroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: CameraControls;
  private composer: EffectComposer;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private torch: TorchHandle | null = null;
  private embers?: THREE.Points;
  private emberVel = new Float32Array(0);
  private ro?: ResizeObserver;
  private keyIdx = 0;
  private keyTimer = 0;

  constructor(private canvas: HTMLCanvasElement) {
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
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.085);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.controls = new CameraControls(this.camera, canvas);
    this.controls.smoothTime = 1.6;
    this.controls.draggingSmoothTime = 1.6;
    // Purely cinematic — no user input drives the camera.
    this.controls.mouseButtons.left = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.right = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.middle = CameraControls.ACTION.NONE;
    this.controls.mouseButtons.wheel = CameraControls.ACTION.NONE;
    this.controls.touches.one = CameraControls.ACTION.NONE;
    this.controls.touches.two = CameraControls.ACTION.NONE;
    this.controls.touches.three = CameraControls.ACTION.NONE;
    const k0 = KEYS[0];
    this.controls.setLookAt(k0[0], k0[1], k0[2], k0[3], k0[4], k0[5], false);

    this.buildScene();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.95, 0.6, 0.18));
    this.composer.addPass(new OutputPass());
    this.composer.setSize(w, h);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);
  }

  private buildScene(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(new THREE.AmbientLight(0x14213a, 0.25));

    createTorch({ targetHeight: 2.2, dying: 0.55, lightIntensity: 9, flameScale: 1.15 })
      .then((t) => {
        if (this.disposed) {
          t.dispose();
          return;
        }
        this.torch = t;
        t.light.castShadow = true;
        this.scene.add(t.group);
      })
      .catch(() => {
        /* torch is best-effort; the scene still renders without it */
      });

    this.embers = this.buildEmbers();
    this.scene.add(this.embers);
  }

  private emberTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,240,200,1)");
    grd.addColorStop(0.3, "rgba(255,150,60,0.8)");
    grd.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildEmbers(): THREE.Points {
    const N = 150;
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
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: this.emberTexture(),
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  private resetEmber(arr: Float32Array, i: number): void {
    const r = Math.random() * 0.35;
    const a = Math.random() * Math.PI * 2;
    arr[i * 3] = Math.cos(a) * r;
    arr[i * 3 + 1] = 1.9 + Math.random() * 0.4;
    arr[i * 3 + 2] = Math.sin(a) * r;
    this.emberVel[i] = 0.4 + Math.random() * 0.8;
  }

  private updateEmbers(dt: number): void {
    if (!this.embers) return;
    const attr = this.embers.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const wob = performance.now() * 0.001;
    for (let i = 0; i < this.emberVel.length; i++) {
      arr[i * 3 + 1] += this.emberVel[i] * dt;
      arr[i * 3] += Math.sin(wob + i) * 0.002;
      if (arr[i * 3 + 1] > 4.4) this.resetEmber(arr, i);
    }
    attr.needsUpdate = true;
  }

  private animate(): void {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.keyTimer += dt;
    if (this.keyTimer >= DWELL) {
      this.keyTimer = 0;
      this.keyIdx = (this.keyIdx + 1) % KEYS.length;
      const k = KEYS[this.keyIdx];
      this.controls.setLookAt(k[0], k[1], k[2], k[3], k[4], k[5], true);
    }

    this.controls.update(dt);
    this.torch?.update(dt);
    this.updateEmbers(dt);
    this.composer.render();
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.torch?.dispose();
    if (this.embers) {
      this.embers.geometry.dispose();
      const m = this.embers.material as THREE.PointsMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.controls.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

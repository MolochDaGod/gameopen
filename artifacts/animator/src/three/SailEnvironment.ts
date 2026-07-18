/**
 * Sailtest environment — water, wind, sky, sand retouch (Three.js best practices).
 *
 * - Sky: three/examples Sky (physical sun + atmosphere) + fog match
 * - Water: three/examples Water with waternormals (wind-aligned scroll)
 * - Sand: sRGB albedo tile on terrain meshes named/sand/beach/ground
 * - Wind: direction vector + optional gust; drives water, sail, light haze
 * - Characters stay on grudge6 path (Studio); this only sets outdoor stage
 */

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { assetCandidates, loadTextureFirst } from "./assets";
import { prepObjectMaterials } from "./texturePrep";

export type SailEnvOptions = {
  /** Water surface Y (world). Islands should sit slightly above. */
  waterY?: number;
  /** Water plane size (m). */
  waterSize?: number;
  /** Wind direction on XZ (normalized). */
  windDir?: THREE.Vector2;
  /** Wind strength 0..1 (wave scale + scroll). */
  windStrength?: number;
  sunElevationDeg?: number;
  sunAzimuthDeg?: number;
};

const DEFAULTS: Required<SailEnvOptions> = {
  waterY: 0.15,
  waterSize: 400,
  windDir: new THREE.Vector2(0.72, 0.35).normalize(),
  windStrength: 0.55,
  sunElevationDeg: 28,
  sunAzimuthDeg: 165,
};

export class SailEnvironment {
  readonly group = new THREE.Group();
  private sky: Sky | null = null;
  private water: Water | null = null;
  private sun = new THREE.Vector3();
  private windDir = new THREE.Vector2(1, 0);
  private windStrength = 0.55;
  private waterY = 0.15;
  private hemi: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private disposed = false;
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = "SailEnvironment";
    scene.add(this.group);
  }

  get wind(): { dir: THREE.Vector2; strength: number } {
    return { dir: this.windDir.clone(), strength: this.windStrength };
  }

  get waterSurfaceY(): number {
    return this.waterY;
  }

  /**
   * Build sky + water + outdoor lights. Call after terrain is seated.
   */
  async mount(opts: SailEnvOptions = {}): Promise<void> {
    if (this.disposed) return;
    this.clearVisuals();
    const o = { ...DEFAULTS, ...opts };
    this.waterY = o.waterY;
    this.windDir.copy(o.windDir).normalize();
    this.windStrength = THREE.MathUtils.clamp(o.windStrength, 0.05, 1);

    this.buildSky(o.sunElevationDeg, o.sunAzimuthDeg);
    await this.buildWater(o.waterSize);
    this.buildLights();
    this.applySkyBackground();
  }

  /** Retouch terrain materials: sand/beach/ground get sand albedo + proper colour space. */
  async retouchTerrain(terrain: THREE.Object3D): Promise<void> {
    prepObjectMaterials(terrain, { neutralizeMetal: true });
    let sandTex: THREE.Texture | null = null;
    try {
      const { texture } = await loadTextureFirst(
        ["textures/terrain/sand.jpg", "textures/sand.jpg"],
        new THREE.TextureLoader(),
        { sRGB: true, mipmaps: true },
      );
      sandTex = texture;
      sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
      sandTex.repeat.set(8, 8);
      sandTex.anisotropy = 8;
    } catch {
      /* procedural sand colour only */
    }

    terrain.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const name = `${m.name} ${m.parent?.name || ""}`.toLowerCase();
      const isSand =
        /sand|beach|shore|coast|dune|ground|terrain|island|dirt|soil/i.test(name) ||
        // Large low meshes without obvious rock/tree names
        (() => {
          const box = new THREE.Box3().setFromObject(m);
          const s = new THREE.Vector3();
          box.getSize(s);
          return s.x > 5 && s.z > 5 && s.y < 6 && !/tree|rock|wood|water|leaf/i.test(name);
        })();

      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i] as THREE.MeshStandardMaterial;
        if (!mat?.isMeshStandardMaterial) continue;
        const next = mat.clone();
        if (isSand) {
          next.color.setHex(0xd4b896);
          next.roughness = 0.92;
          next.metalness = 0.02;
          if (sandTex) {
            next.map = sandTex;
            next.map.colorSpace = THREE.SRGBColorSpace;
            next.needsUpdate = true;
          }
        } else {
          // Mild warm-up for non-sand so unlit GLBs don't read grey-plastic
          if (!next.map) next.color.offsetHSL(0.02, 0.05, 0.02);
          next.roughness = Math.max(next.roughness ?? 0.7, 0.55);
          next.metalness = Math.min(next.metalness ?? 0.1, 0.15);
        }
        if (Array.isArray(m.material)) {
          (m.material as THREE.Material[])[i] = next;
        } else {
          m.material = next;
        }
      }
      m.castShadow = true;
      m.receiveShadow = true;
    });
  }

  /** Seat dual islands near water level: lowest terrain Y → slightly above water. */
  seatIslandsNearWater(terrain: THREE.Object3D, clearance = 0.08): void {
    terrain.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(terrain);
    // Raise so min Y is waterY + clearance (both islands share mesh → near-level)
    const dy = this.waterY + clearance - box.min.y;
    terrain.position.y += dy;
    terrain.updateMatrixWorld(true);
  }

  update(dt: number) {
    if (this.disposed) return;
    this.time += dt;
    // Gust for wind
    const gust = 0.85 + 0.15 * Math.sin(this.time * 0.35) + 0.08 * Math.sin(this.time * 1.1);
    const strength = this.windStrength * gust;

    if (this.water) {
      const u = this.water.material.uniforms;
      if (u["time"]) u["time"].value = this.time * (0.4 + strength * 0.8);
      // Scroll distortion with wind
      if (u["distortionScale"]) {
        u["distortionScale"].value = 2.2 + strength * 3.5;
      }
      if (u["size"]) u["size"].value = 0.8 + strength * 0.6;
      // Rotate water normal map offset if available via water.material
    }

    // Gentle sun sway
    if (this.sunLight) {
      this.sunLight.intensity = 1.35 + 0.15 * Math.sin(this.time * 0.2);
    }
  }

  /** Wind push for sailing / swim assist (world XZ). */
  windVelocity(scale = 1): THREE.Vector3 {
    const s = this.windStrength * scale;
    return new THREE.Vector3(this.windDir.x * s * 2.2, 0, this.windDir.y * s * 2.2);
  }

  private buildSky(elevation: number, azimuth: number) {
    const sky = new Sky();
    sky.scale.setScalar(4500);
    const u = sky.material.uniforms;
    u["turbidity"].value = 6.5;
    u["rayleigh"].value = 1.8;
    u["mieCoefficient"].value = 0.004;
    u["mieDirectionalG"].value = 0.75;

    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);
    u["sunPosition"].value.copy(this.sun);

    this.group.add(sky);
    this.sky = sky;
  }

  private async buildWater(size: number) {
    let normals: THREE.Texture | null = null;
    try {
      const { texture } = await loadTextureFirst(
        ["textures/water/waternormals.jpg"],
        new THREE.TextureLoader(),
        { sRGB: false, mipmaps: true },
      );
      normals = texture;
      normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    } catch {
      // Water still works with default solid; generate flat normal
      const data = new Uint8Array([128, 128, 255, 255]);
      normals = new THREE.DataTexture(data, 1, 1);
      normals.needsUpdate = true;
    }

    const geo = new THREE.PlaneGeometry(size, size);
    const water = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals!,
      sunDirection: this.sun.clone().normalize(),
      sunColor: 0xfff2d6,
      waterColor: 0x1a5f8a,
      distortionScale: 3.2,
      fog: this.scene.fog !== undefined,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = this.waterY;
    water.material.uniforms["size"].value = 1.1;
    this.group.add(water);
    this.water = water;
  }

  private buildLights() {
    // Soft sky/ground fill for outdoor characters (prevents black silhouettes)
    const hemi = new THREE.HemisphereLight(0xb8d4ff, 0xc4a882, 0.55);
    this.group.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff0d8, 1.45);
    sun.position.copy(this.sun).multiplyScalar(80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.00025;
    this.group.add(sun);
    this.sunLight = sun;

    if (this.water) {
      this.water.material.uniforms["sunDirection"].value.copy(this.sun).normalize();
    }
  }

  private applySkyBackground() {
    // Match fog to horizon aqua for sailtest
    this.scene.fog = new THREE.Fog(0x8ec8e8, 28, 160);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(0x7eb8e0);
    } else {
      this.scene.background = new THREE.Color(0x7eb8e0);
    }
  }

  private clearVisuals() {
    if (this.sky) {
      this.group.remove(this.sky);
      this.sky = null;
    }
    if (this.water) {
      this.group.remove(this.water);
      this.water = null;
    }
    if (this.hemi) {
      this.group.remove(this.hemi);
      this.hemi = null;
    }
    if (this.sunLight) {
      this.group.remove(this.sunLight);
      this.sunLight = null;
    }
  }

  dispose() {
    this.disposed = true;
    this.clearVisuals();
    this.group.removeFromParent();
  }
}

/** Resolve preferred sand texture URL candidates for debugging. */
export function sandTextureCandidates(): string[] {
  return assetCandidates("textures/terrain/sand.jpg");
}

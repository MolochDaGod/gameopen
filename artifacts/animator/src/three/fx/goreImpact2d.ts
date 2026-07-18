/**
 * 2D gore + impact sprites for zone combat (Open native engines).
 *
 * Uses fleet CDN slash/effect icons as billboards (additive or alpha).
 * Wired from Vfx.impact / fireAura hit paths and Brawler damage.
 */

import * as THREE from "three";
import { goreSpriteUrl } from "../../lib/d1AssetRegistry";

export type GoreKind = "slash" | "impact" | "heavy" | "blood";

export interface GoreBurstOpts {
  kind?: GoreKind;
  /** World scale of the sprite (metres). */
  scale?: number;
  /** Lifetime seconds. */
  life?: number;
  /** Tint (default crimson for blood, white for energy). */
  color?: number;
  /** Face camera (default true). */
  billboard?: boolean;
  /** Blood uses darker alpha blend; slash uses additive. */
  blood?: boolean;
}

interface ActiveGore {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  spin: number;
  grow: number;
}

const texCache = new Map<string, THREE.Texture>();

function loadTex(url: string): THREE.Texture {
  let t = texCache.get(url);
  if (t) return t;
  const loader = new THREE.TextureLoader();
  t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(url, t);
  return t;
}

/**
 * Lightweight manager — attach to a scene; call update(dt) each frame.
 */
export class GoreImpact2D {
  private scene: THREE.Scene;
  private camera: THREE.Camera | null;
  private active: ActiveGore[] = [];
  private geo = new THREE.PlaneGeometry(1, 1);

  constructor(scene: THREE.Scene, camera?: THREE.Camera | null) {
    this.scene = scene;
    this.camera = camera ?? null;
  }

  setCamera(camera: THREE.Camera | null) {
    this.camera = camera;
  }

  /**
   * Spawn a 2D impact/gore burst at world position.
   */
  burst(pos: THREE.Vector3, opts: GoreBurstOpts = {}): void {
    const kind = opts.kind ?? (opts.blood ? "blood" : "slash");
    const blood = opts.blood ?? kind === "blood";
    const scale = opts.scale ?? (blood ? 0.9 : 1.15);
    const life = opts.life ?? (blood ? 0.38 : 0.28);
    const color = new THREE.Color(
      opts.color ?? (blood ? 0x8b1018 : kind === "heavy" ? 0xffaa66 : 0xffffff),
    );

    const url =
      kind === "blood"
        ? goreSpriteUrl("slash", Math.floor(Math.random() * 3))
        : goreSpriteUrl(kind === "heavy" ? "heavy" : kind === "impact" ? "impact" : "slash", Math.floor(Math.random() * 2));

    const tex = loadTex(url);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      depthWrite: false,
      blending: blood ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      opacity: blood ? 0.92 : 0.95,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(scale * (0.85 + Math.random() * 0.35));
    mesh.rotation.z = Math.random() * Math.PI * 2;
    if (opts.billboard !== false && this.camera) {
      mesh.lookAt(this.camera.position);
    } else {
      // Face camera-ish default: upright in XZ
      mesh.rotation.x = -0.2 + Math.random() * 0.4;
    }
    this.scene.add(mesh);
    this.active.push({
      mesh,
      mat,
      age: 0,
      life,
      spin: (Math.random() - 0.5) * 4,
      grow: 1.4 + Math.random() * 0.8,
    });

    // Second layer for blood (darker offset)
    if (blood) {
      const mat2 = mat.clone();
      mat2.color = new THREE.Color(0x4a0508);
      mat2.opacity = 0.75;
      const mesh2 = new THREE.Mesh(this.geo, mat2);
      mesh2.position.copy(pos).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25),
      );
      mesh2.scale.setScalar(scale * 0.7);
      mesh2.rotation.z = Math.random() * Math.PI;
      this.scene.add(mesh2);
      this.active.push({
        mesh: mesh2,
        mat: mat2,
        age: 0,
        life: life * 1.15,
        spin: (Math.random() - 0.5) * 2,
        grow: 1.2,
      });
    }
  }

  /** Convenience: melee connect. */
  meleeHit(pos: THREE.Vector3, heavy = false): void {
    this.burst(pos, {
      kind: heavy ? "heavy" : "slash",
      blood: true,
      scale: heavy ? 1.35 : 0.95,
      color: heavy ? 0xaa2028 : 0x9a1818,
    });
    this.burst(pos, {
      kind: "impact",
      blood: false,
      scale: heavy ? 1.1 : 0.75,
      color: 0xffe0a0,
      life: 0.18,
    });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const g = this.active[i]!;
      g.age += dt;
      const t = g.age / g.life;
      if (t >= 1) {
        this.scene.remove(g.mesh);
        g.mat.dispose();
        this.active.splice(i, 1);
        continue;
      }
      const fade = 1 - t;
      g.mat.opacity = Math.max(0, fade * (g.mat.blending === THREE.AdditiveBlending ? 0.95 : 0.9));
      const s = g.mesh.scale.x * (1 + dt * g.grow * 0.35);
      g.mesh.scale.setScalar(s);
      g.mesh.rotation.z += g.spin * dt;
      if (this.camera) {
        g.mesh.quaternion.copy(this.camera.quaternion);
      }
    }
  }

  dispose(): void {
    for (const g of this.active) {
      this.scene.remove(g.mesh);
      g.mat.dispose();
    }
    this.active.length = 0;
    this.geo.dispose();
  }
}

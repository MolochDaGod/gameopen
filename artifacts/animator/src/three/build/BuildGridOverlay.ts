/**
 * 1 m snap build grid overlay — raycast for place ghost.
 *
 * Active cell is the real zhunbei.glb frame (inner plate + cardinal arrows).
 * The CampBuild asset ghost sits inside that snapped frame.
 */
import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import { GHOST_BLUE, GHOST_RED } from "../camp/placeables";
import {
  groundCenterZhunbei,
  measureZhunbeiInnerM,
  recolorZhunbei,
  tintZhunbei,
  ZHUNBEI_MESH,
  ZHUNBEI_NATIVE_INNER_M,
  zhunbeiScaleForInner,
} from "./zhunbeiFrame";

export interface BuildGridOpts {
  snapM?: number;
  halfExtent?: number;
}

export type BuildGridHit = {
  point: THREE.Vector3;
};

export class BuildGridOverlay {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private snapM: number;
  private halfExtent: number;
  private groundMeshes: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private visible = false;
  private cell: THREE.Group | null = null;
  private nativeInnerM = ZHUNBEI_NATIVE_INNER_M;
  private innerM: number;
  private valid = true;

  constructor(scene: THREE.Scene, opts: BuildGridOpts = {}) {
    this.scene = scene;
    this.snapM = opts.snapM ?? 1;
    this.halfExtent = opts.halfExtent ?? 32;
    this.innerM = this.snapM;
    this.group = new THREE.Group();
    this.group.name = "BuildGridOverlay";
    this.group.visible = false;
    this.rebuildGrid();
    this.scene.add(this.group);
    void this.loadZhunbeiCell();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private rebuildGrid() {
    for (const c of [...this.group.children]) {
      if (c.name === "zhunbei-cell") continue;
      this.group.remove(c);
      const m = c as THREE.Mesh;
      m.geometry?.dispose?.();
      (m.material as THREE.Material)?.dispose?.();
    }
    const size = this.halfExtent * 2;
    const geo = new THREE.PlaneGeometry(size, size, Math.max(1, Math.floor(size / this.snapM)), Math.max(1, Math.floor(size / this.snapM)));
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4a90d9,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "build-grid-wire";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    this.group.add(mesh);
  }

  private async loadZhunbeiCell() {
    try {
      const { scene } = await loadGltfFirst(ZHUNBEI_MESH, sharedGltfLoader(), { quiet: true });
      groundCenterZhunbei(scene);
      this.nativeInnerM = measureZhunbeiInnerM(scene);
      const cell = new THREE.Group();
      cell.name = "zhunbei-cell";
      scene.name = "zhunbei-frame";
      cell.add(scene);
      tintZhunbei(cell, this.valid ? GHOST_BLUE : GHOST_RED);
      this.applyCellScale(cell);
      this.cell = cell;
      this.group.add(cell);
    } catch (err) {
      console.warn("[BuildGridOverlay] zhunbei frame missing — wire grid only", err);
    }
  }

  private applyCellScale(cell = this.cell) {
    if (!cell) return;
    const s = zhunbeiScaleForInner(this.innerM, this.nativeInnerM);
    cell.scale.setScalar(s);
  }

  /** Snap-cell inner size (m). Defaults to snapM; placeables pass footprint width. */
  setInnerM(m: number) {
    this.innerM = Math.max(this.snapM, m);
    this.applyCellScale();
  }

  setValid(ok: boolean) {
    this.valid = ok;
    if (this.cell) recolorZhunbei(this.cell, ok ? GHOST_BLUE : GHOST_RED);
  }

  /** Move the zhunbei frame to a snapped world point (selection or ghost cell). */
  setCell(world: THREE.Vector3) {
    if (!this.cell) return;
    const p = this.snap(world.clone());
    this.cell.position.set(p.x, p.y + 0.02, p.z);
    this.cell.visible = true;
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.group.visible = v;
  }

  setSnap(m: number) {
    this.snapM = Math.max(0.25, m);
    this.rebuildGrid();
    this.group.visible = this.visible;
  }

  setHalfExtent(h: number) {
    this.halfExtent = Math.max(4, h);
    this.rebuildGrid();
    this.group.visible = this.visible;
  }

  setGroundMeshes(meshes: THREE.Mesh[]) {
    this.groundMeshes = meshes.filter(Boolean);
  }

  /**
   * Ray from character forward onto ground meshes / plane.
   * Returns snapped hit (`point`) and moves the zhunbei cell there.
   */
  raycastFromCharacter(
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    maxDist = 48,
  ): BuildGridHit | null {
    this.raycaster.set(origin, forward.clone().normalize());
    this.raycaster.far = maxDist;
    const targets =
      this.groundMeshes.length > 0
        ? this.groundMeshes
        : this.group.children.filter((c) => c.name !== "zhunbei-cell");
    const hits = this.raycaster.intersectObjects(targets, true);
    let snapped: THREE.Vector3 | null = null;
    if (!hits.length) {
      const dir = forward.clone().normalize();
      if (Math.abs(dir.y) < 1e-4) return null;
      const t = -origin.y / dir.y;
      if (t < 0 || t > maxDist) return null;
      snapped = this.snap(origin.clone().addScaledVector(dir, t));
    } else {
      snapped = this.snap(hits[0].point.clone());
    }
    this.setCell(snapped);
    return { point: snapped };
  }

  private snap(p: THREE.Vector3): THREE.Vector3 {
    const s = this.snapM;
    p.x = Math.round(p.x / s) * s;
    p.z = Math.round(p.z / s) * s;
    return p;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

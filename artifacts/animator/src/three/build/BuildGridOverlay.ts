/**
 * 1 m snap build grid overlay — raycast for place ghost.
 */
import * as THREE from "three";

export interface BuildGridOpts {
  snapM?: number;
  halfExtent?: number;
}

export class BuildGridOverlay {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private snapM: number;
  private halfExtent: number;
  private groundMeshes: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private visible = false;

  constructor(scene: THREE.Scene, opts: BuildGridOpts = {}) {
    this.scene = scene;
    this.snapM = opts.snapM ?? 1;
    this.halfExtent = opts.halfExtent ?? 32;
    this.group = new THREE.Group();
    this.group.name = "BuildGridOverlay";
    this.group.visible = false;
    this.rebuildGrid();
    this.scene.add(this.group);
  }

  private rebuildGrid() {
    while (this.group.children.length) {
      const c = this.group.children[0];
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
      opacity: 0.35,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    this.group.add(mesh);
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
   * Returns snapped hit point or null.
   */
  raycastFromCharacter(
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    maxDist = 48,
  ): THREE.Vector3 | null {
    this.raycaster.set(origin, forward.clone().normalize());
    this.raycaster.far = maxDist;
    const targets =
      this.groundMeshes.length > 0
        ? this.groundMeshes
        : (this.group.children as THREE.Object3D[]);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (!hits.length) {
      // fallback flat plane y=0
      const dir = forward.clone().normalize();
      if (Math.abs(dir.y) < 1e-4) return null;
      const t = -origin.y / dir.y;
      if (t < 0 || t > maxDist) return null;
      const p = origin.clone().addScaledVector(dir, t);
      return this.snap(p);
    }
    return this.snap(hits[0].point.clone());
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

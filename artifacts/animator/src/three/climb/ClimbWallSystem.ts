import * as THREE from "three";
import { loadGltfFirst } from "../assets";
import { sharedGltfLoader } from "../loaders/gltf";
import {
  buildHoldGraph,
  seedClimbPose,
  stepClimbLocomotion,
  type ClimbHold,
  type ClimbLimbState,
} from "./climbHolds";

export type ClimbWallFace = {
  wall: ClimbHold["wall"];
  /** World position centre of wall face (inside room). */
  anchor: THREE.Vector3;
  /** Yaw so +Z of mesh faces into room. */
  yaw: number;
  /** Uniform scale after fit. */
  scale: number;
};

/**
 * Loads climbingwall.glb onto Danger Room faces, hides the climb mesh, and
 * builds spaced hold points from shard/peg geometry for IK + AI paths.
 *
 * Review-first skill build: opposite wall to Racalvin DJ is primary; left/right
 * walls also get invisible hold meshes.
 */
export class ClimbWallSystem {
  readonly group = new THREE.Group();
  holds: ClimbHold[] = [];
  graph = new Map<string, string[]>();
  private roots: THREE.Object3D[] = [];
  private disposed = false;
  /** Debug spheres for hold review (toggle). */
  private debugRoot = new THREE.Group();
  private debugVisible = false;
  review: {
    meshCount: number;
    holdCount: number;
    walls: string[];
    sourceUrl: string;
    notes: string[];
  } = {
    meshCount: 0,
    holdCount: 0,
    walls: [],
    sourceUrl: "",
    notes: [],
  };

  constructor() {
    this.group.name = "ClimbWallSystem";
    this.debugRoot.name = "ClimbHoldDebug";
    this.debugRoot.visible = false;
    this.group.add(this.debugRoot);
  }

  /**
   * @param faces — opposite (-Z), left (-X), right (+X). Skip DJ +Z wall.
   */
  async load(faces: ClimbWallFace[]): Promise<void> {
    const loader = sharedGltfLoader();
    let sourceUrl = "";
    let meshCount = 0;
    const notes: string[] = [];
    const allHolds: ClimbHold[] = [];

    for (const face of faces) {
      if (this.disposed) return;
      let gltf: Awaited<ReturnType<typeof loadGltfFirst>>;
      try {
        gltf = await loadGltfFirst(
          [
            "models/maps/climbing/climbingwall.glb",
            "models/climbing/climbingwall.glb",
            "models/maps/climbingwall.glb",
          ],
          loader,
          { prepMaterials: false },
        );
      } catch (e) {
        notes.push(`load fail ${face.wall}: ${e instanceof Error ? e.message : e}`);
        continue;
      }
      sourceUrl = gltf.url;
      const root = gltf.scene.clone(true);
      root.name = `ClimbWallMesh_${face.wall}`;

      // Fit + centre mesh at local origin, then parent under wall anchor
      this.fitToWall(root, face);
      const wrap = new THREE.Group();
      wrap.name = `ClimbWall_${face.wall}`;
      wrap.position.copy(face.anchor);
      wrap.rotation.y = face.yaw;
      wrap.add(root);

      // Invisible climb mesh — holds remain as logical data only
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.visible = false;
          m.castShadow = false;
          m.receiveShadow = false;
          m.userData.climbHoldMesh = true;
          m.userData.gameLayer = "climb";
          m.userData.invisibleClimb = true;
        }
      });

      this.group.add(wrap);
      this.roots.push(wrap);

      // Extract holds after world matrices include anchor
      wrap.updateMatrixWorld(true);
      const faceHolds = this.extractHolds(wrap, face.wall);
      allHolds.push(...faceHolds);
      meshCount += this.countMeshes(root);
      notes.push(
        `${face.wall}: ${faceHolds.length} holds from shards · invisible mesh`,
      );
    }

    this.holds = allHolds;
    this.graph = buildHoldGraph(allHolds);
    this.rebuildDebug();
    this.review = {
      meshCount,
      holdCount: allHolds.length,
      walls: faces.map((f) => f.wall),
      sourceUrl,
      notes,
    };
    console.info("[ClimbWallSystem] review", this.review);
  }

  private fitToWall(root: THREE.Object3D, face: ClimbWallFace): void {
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.setScalar(1);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 1e-4 && size.y < 1e-4) {
      root.scale.setScalar(face.scale);
      return;
    }
    // Target: width ~26 m, height ~11 m on wall face (XZ may swap by authoring)
    const width = Math.max(size.x, size.z, 0.01);
    const sW = 26 / width;
    const sY = 11 / Math.max(size.y, 0.01);
    const s = Math.min(sW, sY) * face.scale;
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    const c = box2.getCenter(new THREE.Vector3());
    // Local origin = horizontal centre, bottom of wall mesh
    root.position.set(-c.x, -box2.min.y, -c.z);
  }

  private countMeshes(root: THREE.Object3D): number {
    let n = 0;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) n++;
    });
    return n;
  }

  /**
   * Shard* / peg / hold meshes → world-space hold points.
   * Wall plate (pCube*) is NOT a hold — only spaced assets.
   */
  private extractHolds(root: THREE.Object3D, wall: ClimbHold["wall"]): ClimbHold[] {
    const holds: ClimbHold[] = [];
    let i = 0;
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const name = `${m.name} ${m.parent?.name ?? ""}`;
      // Hold candidates: shards, holds, pegs, grips — not large wall plates
      const isHold = /shard|hold|peg|grip|crimp|jug|volume/i.test(name);
      const isPlate = /pcube1$|wall_plate|background/i.test(name.replace(/\s/g, ""));
      if (!isHold || isPlate) return;
      m.updateWorldMatrix(true, false);
      box.setFromObject(m);
      if (!Number.isFinite(box.min.x)) return;
      box.getCenter(center);
      // Normal into room from wall
      let nx = 0,
        ny = 0,
        nz = 0;
      if (wall === "opposite") nz = 1;
      else if (wall === "left") nx = 1;
      else nx = -1;
      holds.push({
        id: `${wall}_${i++}_${(m.name || "h").slice(0, 24)}`,
        x: center.x,
        y: center.y,
        z: center.z,
        nx,
        ny,
        nz,
        source: name.trim(),
        wall,
      });
    });
    // If no shards matched, sample spaced grid on mesh AABB as synthetic holds
    if (holds.length < 4) {
      root.updateMatrixWorld(true);
      const wb = new THREE.Box3().setFromObject(root);
      if (Number.isFinite(wb.min.x)) {
        const nx = wall === "left" ? 1 : wall === "right" ? -1 : 0;
        const nz = wall === "opposite" ? 1 : 0;
        let gi = 0;
        for (let u = 0; u < 6; u++) {
          for (let v = 0; v < 8; v++) {
            const x =
              wall === "opposite"
                ? THREE.MathUtils.lerp(wb.min.x, wb.max.x, (u + 0.5) / 6)
                : wall === "left"
                  ? wb.max.x
                  : wb.min.x;
            const y = THREE.MathUtils.lerp(wb.min.y, wb.max.y, (v + 0.5) / 8);
            const z =
              wall === "opposite"
                ? wb.max.z
                : THREE.MathUtils.lerp(wb.min.z, wb.max.z, (u + 0.5) / 6);
            holds.push({
              id: `${wall}_grid_${gi++}`,
              x,
              y,
              z,
              nx,
              ny: 0,
              nz,
              source: "synthetic_grid",
              wall,
            });
          }
        }
      }
    }
    return holds;
  }

  private rebuildDebug(): void {
    while (this.debugRoot.children.length) {
      const c = this.debugRoot.children.pop()!;
      this.debugRoot.remove(c);
      const m = c as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose?.();
    }
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    for (const h of this.holds) {
      const col =
        h.wall === "opposite" ? 0x44ff88 : h.wall === "left" ? 0x44aaff : 0xffaa44;
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.85,
      });
      const s = new THREE.Mesh(geo, mat);
      s.position.set(h.x, h.y, h.z);
      s.userData.holdId = h.id;
      this.debugRoot.add(s);
    }
  }

  setDebugVisible(v: boolean): void {
    this.debugVisible = v;
    this.debugRoot.visible = v;
  }

  toggleDebug(): boolean {
    this.setDebugVisible(!this.debugVisible);
    return this.debugVisible;
  }

  /** Seed limbs near body on a wall for climb enter. */
  seedPose(wall: ClimbHold["wall"], body: THREE.Vector3): ClimbLimbState {
    return seedClimbPose(this.holds, wall, { x: body.x, y: body.y, z: body.z });
  }

  /** One locomotion step (hand move + foot drag). */
  step(state: ClimbLimbState, hand: "leftHand" | "rightHand", bodyY: number): ClimbLimbState {
    return stepClimbLocomotion(this.holds, state, hand, bodyY);
  }

  holdPosition(id: string | null, out = new THREE.Vector3()): THREE.Vector3 | null {
    if (!id) return null;
    const h = this.holds.find((x) => x.id === id);
    if (!h) return null;
    return out.set(h.x, h.y, h.z);
  }

  /**
   * Controller climb probe: near holds, wall normal into room, atTop for mantle.
   * Radius in metres around player root.
   */
  probeNear(
    pos: THREE.Vector3,
    radius = 1.35,
  ): {
    near: boolean;
    wallNormal?: THREE.Vector3;
    atTop?: boolean;
    canGrab?: boolean;
  } | null {
    if (!this.holds.length) return null;
    let best: ClimbHold | null = null;
    let bestD = Infinity;
    let maxY = -Infinity;
    let minY = Infinity;
    for (const h of this.holds) {
      const d = Math.hypot(h.x - pos.x, h.y - pos.y, h.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
      if (d < radius * 2.5) {
        maxY = Math.max(maxY, h.y);
        minY = Math.min(minY, h.y);
      }
    }
    if (!best || bestD > radius) {
      return { near: false, canGrab: false };
    }
    const span = Math.max(0.5, maxY - minY);
    const atTop = best.y > maxY - span * 0.18;
    return {
      near: true,
      canGrab: true,
      atTop,
      wallNormal: new THREE.Vector3(best.nx, best.ny, best.nz),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.holds = [];
    this.graph.clear();
    this.rebuildDebug();
    for (const r of this.roots) {
      r.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    }
    this.roots = [];
    this.group.clear();
  }
}

/** Default three wall faces for Danger Room (half≈16). */
export function dangerRoomClimbFaces(half: number, height: number): ClimbWallFace[] {
  const y = Math.min(height * 0.38, 7.2);
  return [
    {
      wall: "opposite",
      anchor: new THREE.Vector3(0, y, -half + 0.12),
      yaw: 0, // face +Z into room
      scale: 1,
    },
    {
      wall: "left",
      anchor: new THREE.Vector3(-half + 0.12, y, 0),
      yaw: Math.PI / 2,
      scale: 0.92,
    },
    {
      wall: "right",
      anchor: new THREE.Vector3(half - 0.12, y, 0),
      yaw: -Math.PI / 2,
      scale: 0.92,
    },
  ];
}
